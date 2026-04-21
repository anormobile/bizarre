# Bizarre

## What

Real-time web chat with rooms, direct messages, friends, file attachments, and moderation.
Built with Next.js 16, React 19, Tailwind v4, PostgreSQL 18, and WebSockets.

## Run

```bash
cp .env.example .env
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000).

## Test

```bash
npm run build
curl -fsS http://localhost:3000/api/health
```

Full QA suite: [`output/qa/full-coverage-qa.md`](output/qa/full-coverage-qa.md)
