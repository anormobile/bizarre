#!/usr/bin/env node

// Usage:
//   node phase-13/test-client.js <host> <port> <jid> <password> [--listen]
//   node phase-13/test-client.js <host> <port> <jid> <password> <to-jid> "<message>"
//
// Exits 0 on success (auth or message round-trip), 1 on any failure within 10s.

const { client, xml } = require("@xmpp/client");

const args = process.argv.slice(2);

if (args.length < 4) {
  console.error(
    "Usage: node phase-13/test-client.js <host> <port> <jid> <password> [--listen | <to-jid> <message>]",
  );
  process.exit(1);
}

const [host, port, jid, password] = args;
const listenMode = args[4] === "--listen";
const toJid = !listenMode ? args[4] : undefined;
const message = !listenMode ? args[5] : undefined;

const TIMEOUT_MS = 10_000;

const timeout = setTimeout(() => {
  console.error("Timeout: operation did not complete within 10s");
  process.exit(1);
}, TIMEOUT_MS);

const [localpart, domain] = jid.split("@");

const xmpp = client({
  service: `xmpp://${host}:${port}`,
  domain,
  username: localpart,
  password,
});

xmpp.on("error", (err) => {
  console.error("XMPP error:", err.message || err);
  clearTimeout(timeout);
  process.exit(1);
});

xmpp.on("stanza", (stanza) => {
  if (stanza.is("message") && stanza.getChildText("body")) {
    const from = stanza.attrs.from;
    const body = stanza.getChildText("body");
    console.log(`Message from ${from}: ${body}`);
    if (listenMode) {
      clearTimeout(timeout);
      xmpp.stop().then(() => process.exit(0));
    }
  }
});

xmpp.on("online", async (address) => {
  console.log(`Online as ${address.toString()}`);

  await xmpp.send(xml("presence"));

  if (toJid && message) {
    const msg = xml("message", { type: "chat", to: toJid }, xml("body", {}, message));
    await xmpp.send(msg);
    console.log(`Sent "${message}" to ${toJid}`);
    clearTimeout(timeout);
    await xmpp.stop();
    process.exit(0);
  } else if (!listenMode) {
    clearTimeout(timeout);
    await xmpp.stop();
    process.exit(0);
  }
});

xmpp.start().catch((err) => {
  console.error("Failed to start:", err.message || err);
  clearTimeout(timeout);
  process.exit(1);
});
