const { createServer } = require("http");
const { createHmac, createHash, timingSafeEqual } = require("crypto");
const next = require("next");
const { WebSocketServer } = require("ws");
const { parse } = require("url");
const postgres = require("postgres");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "bizarre_session";
const DATABASE_URL = process.env.DATABASE_URL;

const dbSql = postgres(DATABASE_URL);

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const connectionsByUser = new Map();
globalThis.__bizarreWsConnections__ = connectionsByUser;

/** @type {Map<string, Map<import('ws').WebSocket, string>>} userId -> Map<ws, status> */
const userConnectionStatuses = new Map();
let wsIdCounter = 0;

function parseCookies(header) {
  const map = {};
  if (!header) return map;
  for (const pair of header.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim();
    const val = pair.slice(eq + 1).trim();
    map[key] = decodeURIComponent(val);
  }
  return map;
}

function verifySessionCookie(cookieValue) {
  const dotIndex = cookieValue.indexOf(".");
  if (dotIndex === -1) return null;

  const encoded = cookieValue.slice(0, dotIndex);
  const signature = cookieValue.slice(dotIndex + 1);

  let sessionId;
  try {
    sessionId = Buffer.from(encoded, "base64").toString();
  } catch {
    return null;
  }

  const expected = createHmac("sha256", SESSION_SECRET).update(sessionId).digest("hex");

  if (signature.length !== expected.length) return null;

  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length) return null;

  if (!timingSafeEqual(sigBuf, expBuf)) return null;

  return sessionId;
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || "/", true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    const { pathname } = parse(req.url || "/", true);
    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }

    try {
      const cookies = parseCookies(req.headers.cookie);
      const cookieValue = cookies[SESSION_COOKIE_NAME];
      if (!cookieValue) {
        socket.destroy();
        return;
      }

      const sessionId = verifySessionCookie(cookieValue);
      if (!sessionId) {
        socket.destroy();
        return;
      }

      const tokenHash = createHash("sha256").update(sessionId).digest("hex");

      const rows = await dbSql`
        SELECT user_id FROM sessions WHERE token_hash = ${tokenHash}
      `;

      if (rows.length === 0) {
        socket.destroy();
        return;
      }

      const userId = rows[0].user_id;

      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.userId = userId;
        wss.emit("connection", ws, req);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on("connection", async (ws) => {
    const userId = ws.userId;
    const isFirstConnect = !connectionsByUser.has(userId) || connectionsByUser.get(userId).size === 0;
    if (!connectionsByUser.has(userId)) connectionsByUser.set(userId, new Set());
    connectionsByUser.get(userId).add(ws);

    if (!userConnectionStatuses.has(userId)) userConnectionStatuses.set(userId, new Map());
    userConnectionStatuses.get(userId).set(ws, "online");

    if (isFirstConnect) {
      try {
        await dbSql`
          INSERT INTO user_presence (user_id, status, updated_at)
          VALUES (${userId}, 'online', NOW())
          ON CONFLICT (user_id) DO UPDATE SET status = 'online', updated_at = NOW()
        `;
        const presenceMsg = JSON.stringify({
          type: "PRESENCE_CHANGED",
          payload: { userId, status: "online" },
          timestamp: Date.now(),
        });
        for (const [, socks] of connectionsByUser) {
          for (const s of socks) {
            if (s.readyState === 1) {
              try { s.send(presenceMsg); } catch { /* swallow */ }
            }
          }
        }
      } catch (err) {
        console.error("setUserOnline error:", err);
      }
    }

    ws.on("message", async (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === "PRESENCE_HEARTBEAT") {
          const newStatus = data.payload?.status;
          if (newStatus !== "online" && newStatus !== "afk") return;

          const connStatuses = userConnectionStatuses.get(userId);
          if (connStatuses) connStatuses.set(ws, newStatus);

          const aggregated = connStatuses && [...connStatuses.values()].includes("online")
            ? "online"
            : "afk";

          const prevRows = await dbSql`
            SELECT status FROM user_presence WHERE user_id = ${userId}
          `;
          const prevAggregated = prevRows.length > 0 ? prevRows[0].status : "online";
          if (prevAggregated === aggregated) return;

          try {
            await dbSql`
              INSERT INTO user_presence (user_id, status, updated_at)
              VALUES (${userId}, ${aggregated}, NOW())
              ON CONFLICT (user_id) DO UPDATE SET status = ${aggregated}, updated_at = NOW()
            `;
          } catch (err) {
            console.error("presence heartbeat db error:", err);
          }
          const presenceMsg = JSON.stringify({
            type: "PRESENCE_CHANGED",
            payload: { userId, status: aggregated },
            timestamp: Date.now(),
          });
          for (const [, socks] of connectionsByUser) {
            for (const s of socks) {
              if (s.readyState === 1) {
                try { s.send(presenceMsg); } catch { /* swallow */ }
              }
            }
          }
        }
      } catch { /* ignore malformed messages */ }
    });

    ws.on("close", async () => {
      const connStatuses = userConnectionStatuses.get(userId);
      if (connStatuses) {
        connStatuses.delete(ws);
        if (connStatuses.size === 0) userConnectionStatuses.delete(userId);
      }

      const sockets = connectionsByUser.get(userId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size > 0) {
          const remaining = userConnectionStatuses.get(userId);
          if (remaining && remaining.size > 0) {
            const aggregated = [...remaining.values()].includes("online") ? "online" : "afk";
            try {
              const prevRows = await dbSql`SELECT status FROM user_presence WHERE user_id = ${userId}`;
              const prevStatus = prevRows.length > 0 ? prevRows[0].status : "online";
              if (prevStatus !== aggregated) {
                await dbSql`
                  INSERT INTO user_presence (user_id, status, updated_at)
                  VALUES (${userId}, ${aggregated}, NOW())
                  ON CONFLICT (user_id) DO UPDATE SET status = ${aggregated}, updated_at = NOW()
                `;
                const presenceMsg = JSON.stringify({
                  type: "PRESENCE_CHANGED",
                  payload: { userId, status: aggregated },
                  timestamp: Date.now(),
                });
                for (const [, ss] of connectionsByUser) {
                  for (const s of ss) {
                    if (s.readyState === 1) {
                      try { s.send(presenceMsg); } catch { /* swallow */ }
                    }
                  }
                }
              }
            } catch (err) {
              console.error("presence re-aggregate error:", err);
            }
          }
        } else if (sockets.size === 0) {
          connectionsByUser.delete(userId);
          try {
            await dbSql`
              INSERT INTO user_presence (user_id, status, updated_at)
              VALUES (${userId}, 'offline', NOW())
              ON CONFLICT (user_id) DO UPDATE SET status = 'offline', updated_at = NOW()
            `;
            const presenceMsg = JSON.stringify({
              type: "PRESENCE_CHANGED",
              payload: { userId, status: "offline" },
              timestamp: Date.now(),
            });
            for (const [, socks] of connectionsByUser) {
              for (const s of socks) {
                if (s.readyState === 1) {
                  try { s.send(presenceMsg); } catch { /* swallow */ }
                }
              }
            }
          } catch (err) {
            console.error("setUserOffline error:", err);
          }
        }
      }
    });
  });

  function shutdown() {
    console.log("> Shutting down...");
    const forceTimer = setTimeout(() => process.exit(0), 5000);
    forceTimer.unref?.();

    for (const [, clients] of connectionsByUser) {
      for (const ws of clients) {
        ws.close(1001, "server shutting down");
      }
    }
    connectionsByUser.clear();

    server.close(() => {
      dbSql.end().then(() => process.exit(0));
    });
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
