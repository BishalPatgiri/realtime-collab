# realtime-collab

Real-time collaborative workspace — live multi-user sync, presence, and horizontal scaling via Redis Pub/Sub.

**Stack:** Node.js · TypeScript · WebSockets (`ws`) · Redis Pub/Sub · Express · JWT · React (Vite)

## Why

A single WebSocket server is easy. Making many WebSocket servers behave like one — so a user connected to instance A sees edits from a user on instance B — is the interesting part. This project builds that up from scratch: a hand-rolled WebSocket protocol, presence tracking, and a Redis Pub/Sub fan-out layer that lets the server scale horizontally behind a load balancer.

## How scaling works

The connection layer depends only on a `CollabBackend` interface, which has two implementations:

- **Memory** — single instance, state in process memory. Zero dependencies, ideal for local dev (used when `REDIS_URL` is unset).
- **Redis** — authoritative document and presence state live in Redis; every room event is published to a per-room Pub/Sub channel. Each instance subscribes only to the rooms it serves and relays incoming events to its local sockets. Document operations are applied with a Lua script so concurrent edits from different instances can't corrupt the content.

Because every event round-trips through the backend, a user on instance A and a user on instance B share one logical room. Run it locally:

```bash
docker compose up -d                                   # Redis
REDIS_URL=redis://localhost:6379 PORT=4000 npm run dev # instance 1
REDIS_URL=redis://localhost:6379 PORT=4001 npm run dev # instance 2
```

## Monorepo layout

```
realtime-collab/
├── shared/    # Protocol types & constants shared by server and client
├── server/    # Node + Express + ws backend
└── client/    # React (Vite) frontend
```

Managed with npm workspaces.

## Getting started

```bash
# Install all workspace dependencies
npm install

# Copy environment defaults
cp .env.example .env

# Type-check the whole monorepo
npm run typecheck
```

## Scripts

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Start the backend in watch mode              |
| `npm run build`     | Build all workspaces                         |
| `npm run typecheck` | Type-check the whole monorepo                |
| `npm run lint`      | Lint all TypeScript sources                  |
| `npm run format`    | Format the codebase with Prettier            |

## Roadmap

- [x] **Stage 1** — Monorepo scaffolding & tooling
- [x] **Stage 2** — Express HTTP server, config & logging
- [x] **Stage 3** — WebSocket foundation & shared protocol
- [x] **Stage 4** — JWT authentication
- [x] **Stage 5** — Rooms & live document sync
- [x] **Stage 6** — Presence & cursors
- [x] **Stage 7** — Redis Pub/Sub horizontal scaling
- [ ] **Stage 8** — React client
- [ ] **Stage 9** — Docker & load-balanced deployment
- [ ] **Stage 10** — Tests & CI

## License

MIT
