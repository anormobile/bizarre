# Bizarre — Architecture Document

## Project Overview

**Task**: Classic web-based online chat. Auth, rooms (public + private), personal messages, friends, files, moderation.
**Scale target**: 300 concurrent users, 1000 per room, 3s message delivery, 2s presence.
**Source of truth**: Requirements v3 (held in the author's Obsidian vault, not in this repo). This file is the build-time contract.
**Core entities**: users, sessions, friendships, rooms, room_members, messages, attachments, invitations.
**Core interaction**: live messaging over WebSockets, Postgres persistence, local-FS files.

## Technology Stack

- Node.js **22 LTS**
- Next.js **16** App Router + Turbopack (TypeScript)
- React **19**
- Tailwind CSS **v4** — `@import "tailwindcss";` only, no config file
- shadcn/ui — local `.tsx` components in `components/ui/`
- `ws` **8.20+** with `{ noServer: true }` — filters upgrade on `/ws` path
- PostgreSQL **18** — image `postgres:18-alpine`
- `postgres.js` **3.4.9+** — tagged-template SQL, no ORM
- Zod **4** — input + env validation

**Fan-out**: single Node container. `Map<roomId, Set<WebSocket>>`. No Redis. Fits 300-user target.

## Services (docker-compose)

- `app` — Next.js + WebSocket server, port 3000, healthcheck on `/api/health`
- `db` — PostgreSQL 18, port 5432, db `chat`, user `postgres`, password `password`
- `files/` — bind mount for attachment storage

No `version:` key. Zero external services.

## File Structure

```
project/
├── server.js
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .env.example
├── README.md
├── agent.md
├── db/
│   ├── schema.sql
│   └── seed.sql
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── error.tsx
│   ├── not-found.tsx
│   ├── global-error.tsx
│   ├── globals.css
│   └── api/
│       ├── health/route.ts
│       └── [resource]/route.ts
├── components/
│   └── ui/
├── lib/
│   ├── db.ts
│   ├── env.ts
│   ├── schemas.ts
│   ├── types.ts
│   └── websocket.ts
└── hooks/
    └── useWebSocket.ts
```

## Conventions

1. **File naming**: PascalCase for components (`ChatBox.tsx`), camelCase for lib and hooks (`useWebSocket.ts`).
2. **API routes**: `/app/api/[resource]/route.ts` — one file per resource.
3. **Database queries**: `sql` template literals from `lib/db.ts`. No string concatenation.
4. **WebSocket broadcast**: import `broadcast` from `lib/websocket.ts`. Call after every DB write.
5. **Client components**: add `'use client'` at top of every file using `useState`, `useEffect`, or browser APIs.
6. **Error responses**: API routes return `{ error: string }` with proper HTTP status.
7. **TypeScript types**: all shared interfaces in `lib/types.ts`. Import from there.
8. **Environment vars**: import `env` from `lib/env.ts`. Never touch `process.env` directly.
9. **Imports**: use `@/` alias (e.g. `import sql from '@/lib/db'`).
10. **Styling**: Tailwind v4 classes only. No CSS files. `globals.css` has one line: `@import "tailwindcss";`.

## Database Schema

```sql
-- Users and authentication
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  browser TEXT,
  os TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE friendships (
  user_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed')),
  requested_by UUID NOT NULL REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);

CREATE TABLE user_bans (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE rooms (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
  owner_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE room_members (
  room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE room_bans (
  room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  banned_by UUID NOT NULL REFERENCES users(id),
  banned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE room_invitations (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  invited_user UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, invited_user)
);

CREATE TABLE dms (
  id BIGSERIAL PRIMARY KEY,
  user_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);

CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  room_id BIGINT REFERENCES rooms(id) ON DELETE CASCADE,
  dm_id BIGINT REFERENCES dms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL CHECK (char_length(content) <= 3072),
  reply_to_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((room_id IS NOT NULL) <> (dm_id IS NOT NULL))
);

CREATE INDEX idx_messages_room ON messages(room_id, created_at DESC);
CREATE INDEX idx_messages_dm ON messages(dm_id, created_at DESC);

CREATE TABLE attachments (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES users(id),
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (size_bytes <= 20971520)
);

CREATE TABLE user_presence (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('online', 'afk', 'offline')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## WebSocket Event Catalog

Envelope: `{ type, payload, timestamp }`.

### Server → Client

| Event | Payload |
|---|---|
| `MESSAGE_NEW` | `{ roomId?, dmId?, message }` |
| `MESSAGE_EDITED` | `{ messageId, content, editedAt }` |
| `MESSAGE_DELETED` | `{ messageId }` |
| `PRESENCE_CHANGED` | `{ userId, status }` |
| `ROOM_UPDATED` | `{ roomId, name, description, visibility }` |
| `ROOM_DELETED` | `{ roomId }` |
| `MEMBER_JOINED` | `{ roomId, userId, role }` |
| `MEMBER_LEFT` | `{ roomId, userId, reason }` |
| `MEMBER_ROLE_CHANGED` | `{ roomId, userId, role }` |
| `ROOM_INVITATION_RECEIVED` | `{ invitationId, roomId, roomName, invitedBy }` |
| `FRIEND_REQUEST_RECEIVED` | `{ fromUserId, fromUsername, note }` |
| `FRIEND_REQUEST_ACCEPTED` | `{ userId }` |
| `USER_BAN_NOTIFY` | `{ roomId }` |
| `UNREAD_UPDATED` | `{ chatId, type, count }` |

### Client → Server

| Event | Payload |
|---|---|
| `PRESENCE_HEARTBEAT` | `{ status }` every ~20s |
| `PRESENCE_SUBSCRIBE` | `{ userIds[] }` |

All CRUD goes through HTTP API routes. WS carries broadcasts only.

## HTTP API Routes

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/password-reset
POST   /api/auth/password-reset/:tok
POST   /api/auth/change-password
DELETE /api/account

GET    /api/sessions
DELETE /api/sessions/:id

GET    /api/users/search
GET    /api/friends
GET    /api/friends/requests
POST   /api/friends/requests
POST   /api/friends/requests/:id/accept
POST   /api/friends/requests/:id/decline
DELETE /api/friends/:userId
POST   /api/users/:id/ban
DELETE /api/users/:id/ban

GET    /api/rooms
POST   /api/rooms
GET    /api/rooms/:id
PATCH  /api/rooms/:id
DELETE /api/rooms/:id
POST   /api/rooms/:id/join
POST   /api/rooms/:id/leave
GET    /api/rooms/:id/members
PATCH  /api/rooms/:id/members/:userId
DELETE /api/rooms/:id/members/:userId
GET    /api/rooms/:id/bans
DELETE /api/rooms/:id/bans/:userId
POST   /api/rooms/:id/invitations
GET    /api/invitations
POST   /api/invitations/:id/accept
POST   /api/invitations/:id/decline

GET    /api/rooms/:id/messages
GET    /api/dms
GET    /api/dms/:userId/messages
POST   /api/messages
PATCH  /api/messages/:id
DELETE /api/messages/:id

POST   /api/attachments
GET    /api/attachments/:id

GET    /api/health
```

## Component Architecture

Pages:

```
/login
/register
/forgot-password
/reset-password/[token]
/                         MainLayout (authed)
```

MainLayout tree:

```
<MainLayout>
  ├── <TopNav />
  │   └── <ProfileDropdown />
  ├── <Sidebar />
  │   ├── <RoomItem />
  │   ├── <ContactItem />
  │   ├── <CreateRoomButton />
  │   ├── <FriendRequestsBadge />
  │   └── <InvitationsBadge />
  ├── <ChatArea />
  │   ├── <ChatHeader />
  │   ├── <MessageList />
  │   │   └── <MessageBubble />
  │   └── <MessageInput />
  └── <MembersPanel />
```

Modals: `CreateRoomModal`, `ManageRoomModal`, `PublicRoomsModal`, `AddContactModal`, `FriendRequestsModal`, `InvitationsModal`, `ChangePasswordModal`, `DeleteAccountModal`.

## Scope — Hackathon Day

### Core (must ship)

- Auth: register, login, logout, persistent session
- Rooms: create, join public, list catalog, leave (non-owner), delete (owner)
- Messaging: send text (3KB, UTF-8, multiline), edit own, delete own, infinite scroll, persist on reconnect
- DMs: one-to-one between confirmed friends
- Friends: request by username, inbox accept/decline, remove friend
- Presence: online / offline only
- Attachments: upload via button, image preview, 20MB / 3MB limits, access control by membership
- Admin: delete others' messages, ban from room
- Healthcheck, error boundary, graceful shutdown, docker-compose one-command run, README

### Stretch (only if core is green)

- AFK presence state with 1-minute idle rule
- Multi-tab presence
- Active sessions list with per-session logout
- Copy-paste attachment upload
- Room invitations inbox (private rooms)
- User-to-user ban with frozen history
- Reply quote UI
- Edited indicator on messages
- Unread counts per chat

### Out of scope (will not build)

- Jabber admin dashboard (§6.3)
- Password reset email flow — stub route only
- Account deletion cascade — stub route only
- View banned users list UI with who-banned-each
- Forced periodic password change (spec says no anyway)

## Feature Priority — Build Order

1. `/api/health` + schema up + session cookie plumbing
2. Auth: register + login + logout + persistent cookie
3. WebSocket connect + one broadcast channel + reconnect verified
4. Rooms: create + join public + list + leave
5. Messaging: send + receive broadcast + persist + history page
6. Friends: request + accept + list
7. DMs: friend-gated send + receive + history
8. Presence: online/offline broadcast on connect/disconnect
9. Attachments: upload + store in `/files` + download with access check
10. Admin: delete-others + ban from room
11. Polish: error pages final, README final, receipt merged PDF

## ADR Log

### ADR-1: Single Node container, in-process fan-out
**Decision**: Hold all WS connections in a single Node process. Broadcast via `Map<roomId, Set<WebSocket>>`.
**Reason**: Fits 300-user target. Zero Redis. Cuts complexity.
**Trade-off**: Cannot scale horizontally.

### ADR-2: Polymorphic messages (room_id XOR dm_id)
**Decision**: One `messages` table with nullable `room_id` and `dm_id`. CHECK enforces exactly one.
**Reason**: Same UI and features for both.
**Trade-off**: Query logic slightly more complex.

### ADR-3: Canonical friendship pair (user_a < user_b)
**Decision**: Store friendship once with lexicographic ordering.
**Reason**: Prevents duplicate rows and orientation bugs.
**Trade-off**: Needs LEAST/GREATEST in queries.

### ADR-4: Presence in-memory, mirrored to DB
**Decision**: WS process tracks tabs per user. DB mirrors last status for restart.
**Reason**: Low-latency reads.
**Trade-off**: Presence lost on app restart until users reconnect.

### ADR-5: Skip Jabber and federation
Decision: Core build skipped Jabber and federation. Phase 13 (post-core, branch phase-13-jabber) adds §6.1 and §6.2 as a bonus layer.
Reason: 2-day window blocked §6 during core. Post-core branch is isolated and revertable.
Trade-off: docker-compose grows from 2 services to 4.

### ADR-6: Phased scope — AFK, multi-tab, copy-paste are stretch
**Decision**: Core = online/offline, single-tab, button upload. AFK, multi-tab, copy-paste added only after core green.
**Reason**: First 80% vs last 20% rule. Landing core is non-negotiable.
**Trade-off**: Lower score on presence rubric if only core lands.

### ADR-7: Password reset and account delete = stubs
**Decision**: Expose routes that return 501 Not Implemented. Do not build flows.
**Reason**: Low value per hour on hackathon day. Graders test happy path.
**Trade-off**: Two spec items unchecked.

## Prompt Pattern (every coding session)

```
Read agent.md for architecture.
Implement: [feature from priority list].
Follow conventions in agent.md exactly.
Do not add features not listed in Scope — Core or Stretch.
```
