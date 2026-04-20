const { createServer } = require("http");
const next = require("next");
const { WebSocketServer } = require("ws");
const { parse } = require("url");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const rooms = new Map();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || "/", true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url || "/", true);
    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws, req) => {
    const { query } = parse(req.url || "/", true);
    const roomId = typeof query.room === "string" ? query.room : "default";

    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(ws);

    ws.on("close", () => {
      const room = rooms.get(roomId);
      if (room) {
        room.delete(ws);
        if (room.size === 0) rooms.delete(roomId);
      }
    });
  });

  function shutdown() {
    console.log("> Shutting down...");
    const forceTimer = setTimeout(() => process.exit(0), 5000);
    forceTimer.unref?.();

    for (const [, clients] of rooms) {
      for (const ws of clients) {
        ws.close(1001, "server shutting down");
      }
    }
    rooms.clear();

    server.close(() => {
      process.exit(0);
    });
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
