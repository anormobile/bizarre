# Bizarre

Real-time web chat with rooms, direct messages, friends, file attachments, and moderation.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- PostgreSQL 18
- WebSockets (`ws` 8) — single Node process, in-memory fan-out
- Zod 4 — input and env validation
- `postgres.js` — tagged-template SQL, no ORM

## Run

```bash
cp .env.example .env
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000).

The stack starts two containers:

- `app` — Next.js + WebSocket server on port `3000`
- `db` — PostgreSQL 18 on port `5432`, schema auto-loaded from `db/schema.sql`

Attachments persist on the host at `./files/`.

## Health

```bash
curl -fsS http://localhost:3000/api/health
```

## Features

- **Auth**: register, login, logout, persistent session, active sessions list, per-session logout, change password.
- **Rooms**: create, join public, browse catalog, invite-only private, leave, delete (owner), ban, unban, promote/demote admins.
- **Messaging**: send, edit own, delete own (or as admin), infinite scroll history, reply quote, UTF-8 multiline, 3 KB text limit.
- **DMs**: one-to-one between confirmed friends, frozen after user-to-user ban.
- **Friends**: request by username or from room member list, optional note, accept/decline, remove, user-to-user ban.
- **Presence**: online / AFK / offline, multi-tab aware, AFK after 1 min idle.
- **Attachments**: upload button and copy-paste, image preview, 20 MB file limit, 3 MB image limit, access control by membership.
- **Moderation**: admin delete any message, ban from room, view banned list with "banned by", unban.
- **Notifications**: unread counts per room and DM, friend-request badge, invitation badge.

## Architecture

See [`agent.md`](agent.md) for full architecture, DB schema, WebSocket event catalog, HTTP API routes, and ADRs.

## Scope notes

Per `agent.md` ADR-7, the following are stub routes (return 501):

- `/api/auth/forgot-password` and `/api/auth/reset-password`
- `/api/auth/delete-account`

Load testing (300 concurrent users, 10 000-message virtual scroll) is not included — see `agent.md` ADR-6 for the phased-scope rationale.

## Jabber (XMPP)

Phase 13 adds two Prosody XMPP servers with HTTP-delegated auth and s2s federation.

### Domains and ports

| Domain   | Host port | Service | Seed user                       |
|----------|-----------|---------|---------------------------------|
| `xmpp-a` | 5222      | c2s     | `alice@xmpp-a` / `alicepass`   |
| `xmpp-b` | 5322      | c2s     | `bob@xmpp-b` / `bobpass`       |

### Connect a Jabber client

Use Gajim, Dino, or Adium. Set the server to `localhost` with the port above. Log in as `alice@xmpp-a` (password `alicepass`) or `bob@xmpp-b` (password `bobpass`).

### Smoke test

```bash
# Login test
node phase-13/test-client.js localhost 5222 alice@xmpp-a alicepass

# Federation: open a listener in one terminal
node phase-13/test-client.js localhost 5322 bob@xmpp-b bobpass --listen

# Send from another terminal
node phase-13/test-client.js localhost 5222 alice@xmpp-a alicepass bob@xmpp-b "hello bob"
```

The listener prints the message and exits 0. Reverse direction works the same way.
