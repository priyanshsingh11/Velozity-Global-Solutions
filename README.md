# Velozity — Real-Time Client Project Dashboard

An internal agency tool for managing clients, projects and tasks with **role-based access enforced at the API level**, a **role-filtered live activity feed over WebSockets**, in-app notifications, WebSocket presence, and a background job that flags overdue tasks.

| Layer | Choice |
| --- | --- |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Real-time | Socket.io |
| Background jobs | node-cron |
| Validation | Zod (server-side, every endpoint) |
| Auth | JWT access token + refresh token in an HttpOnly cookie |

---

## Table of contents

1. [Local setup](#1-local-setup)
2. [Seeded accounts](#2-seeded-accounts)
3. [Database design](#3-database-design)
4. [Indexing decisions](#4-indexing-decisions)
5. [Authorization model](#5-authorization-model)
6. [Real-time architecture](#6-real-time-architecture)
7. [API reference](#7-api-reference)
8. [Architecture decisions](#8-architecture-decisions)
9. [Project structure](#9-project-structure)
10. [How to verify the requirements](#10-how-to-verify-the-requirements)
11. [Deployment](#11-deployment)
12. [Known limitations](#12-known-limitations)
13. [Assessment explanation](#13-assessment-explanation)

---

## 1. Local setup

### Prerequisites

- **Node.js 20+** and npm
- **PostgreSQL 14+** — or **Docker** (recommended, no local Postgres required)

### Option A — Docker (recommended)

Brings up Postgres, the API and the SPA with one command.

```bash
cp .env.docker.example .env      # then edit the two JWT secrets
docker compose up --build
docker compose exec backend npx prisma db seed
```

| Service | URL |
| --- | --- |
| Frontend | http://localhost:5173 |
| API | http://localhost:5000/api |
| Postgres | localhost:5432 |

The frontend container runs nginx, which reverse-proxies `/api` and `/socket.io` to the backend. Everything is same-origin, so the refresh cookie works without any CORS or `SameSite` configuration.

Tear down with `docker compose down` (add `-v` to also drop the database volume).

### Option B — Run locally without Docker

**1. Start PostgreSQL and create a database**

```bash
createdb velozity
```

**2. Configure the backend**

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```ini
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/velozity?schema=public"
DIRECT_URL="postgresql://USER:PASSWORD@localhost:5432/velozity?schema=public"

JWT_ACCESS_SECRET=<openssl rand -hex 48>
JWT_REFRESH_SECRET=<a different openssl rand -hex 48>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

> `DIRECT_URL` matters only for pooled providers (Supabase, Neon), where migrations must bypass the pooler. For plain Postgres, set it to the same value as `DATABASE_URL`.

**3. Install, apply the schema, seed**

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init   # or: npx prisma db push
npm run seed
```

**4. Start the backend**

```bash
npm run dev          # http://localhost:5000
```

Optionally confirm everything works before touching the UI:

```bash
npm run verify       # 85 end-to-end assertions against the running API
```

**5. Start the frontend** (in a second terminal)

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The Vite dev server proxies `/api` and `/socket.io` to `http://localhost:5000`, so no frontend `.env` is needed for local development.

### Environment variables

**`backend/.env`**

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | no | `5000` | HTTP + WebSocket port |
| `NODE_ENV` | no | `development` | Switches cookie `Secure`/`SameSite` and log verbosity |
| `FRONTEND_URL` | yes | `http://localhost:5173` | Allowed CORS + WebSocket origin |
| `ADDITIONAL_ORIGINS` | no | — | Comma-separated extra origins (e.g. Vercel previews) |
| `DATABASE_URL` | yes | — | Postgres connection string |
| `DIRECT_URL` | yes | — | Non-pooled connection used by Prisma Migrate |
| `JWT_ACCESS_SECRET` | yes | — | Signs access tokens |
| `JWT_REFRESH_SECRET` | yes | — | Signs refresh tokens (must differ) |
| `JWT_ACCESS_EXPIRES_IN` | no | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | no | `7d` | Refresh token lifetime |

**`frontend/.env`** — only needed when the API is on a different origin (production):

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Absolute backend origin, e.g. `https://velozity-api.onrender.com`. Leave empty locally. |

Secrets are read exclusively from the environment. No secret is committed; `.env` is gitignored and only `.env.example` files are tracked.

### macOS note

macOS **AirPlay Receiver** listens on port 5000 and will shadow the API with an empty `403`. Either disable it (System Settings → General → AirDrop & Handoff) or run the backend on another port:

```bash
# backend
PORT=5055 npm run dev

# frontend — point the dev proxy at the same port
echo "BACKEND_URL=http://localhost:5055" >> frontend/.env
```

---

## 2. Seeded accounts

`npm run seed` creates 7 users, 3 clients, 3 projects, 16 tasks (2 already overdue), pre-existing activity logs and notifications.

Password for every account: **`Password123!`**

| Role | Email | Sees |
| --- | --- | --- |
| Admin | `admin@velozity.com` | Everything, plus the live online-user count |
| Project Manager | `pm1@velozity.com` | Only Project Alpha + Project Gamma (created by PM 1) |
| Project Manager | `pm2@velozity.com` | Only Project Beta (created by PM 2) |
| Developer | `dev1@velozity.com` | Only tasks assigned to Ravi Kumar |
| Developer | `dev2@velozity.com` | Only tasks assigned to Aisha Patel |
| Developer | `dev3@velozity.com` | Only tasks assigned to Liam O'Connor |
| Developer | `dev4@velozity.com` | Only tasks assigned to Sofia Chen |

The login screen has quick-fill buttons for the first four.

---

## 3. Database design

### Entity relationships

```
       ┌──────────────┐
       │    Client    │
       └──────┬───────┘
              │ 1
              │
              │ N
┌────────┐  ┌─▼────────────┐  N   ┌──────────┐
│  User  │──┤   Project    ├─────►│   Task   │
└───┬────┘ 1└──────────────┘   1  └────┬─────┘
    │ createdById (PM ownership)       │ assignedDeveloperId
    │                                  │
    │        ┌─────────────┐           │
    ├───────►│ ActivityLog │◄──────────┤
    │        └─────────────┘           │
    │        ┌──────────────┐          │
    ├───────►│ Notification │◄─────────┘
    │        └──────────────┘
    │        ┌──────────────┐
    └───────►│ RefreshToken │
             └──────────────┘
```

| Relationship | Cardinality | On delete |
| --- | --- | --- |
| `Client` → `Project` | 1 : N | Cascade |
| `User` → `Project` (`createdById`) | 1 : N | Cascade |
| `Project` → `Task` | 1 : N | Cascade |
| `User` → `Task` (`assignedDeveloperId`, nullable) | 1 : N | **SetNull** — deleting a developer must not delete the work |
| `Task` → `ActivityLog` (nullable `taskId`) | 1 : N | Cascade |
| `Project` → `ActivityLog` | 1 : N | Cascade |
| `User` → `ActivityLog` | 1 : N | Cascade |
| `User` → `Notification` | 1 : N | Cascade |
| `Task` → `Notification` | 1 : N | Cascade |
| `User` → `RefreshToken` | 1 : N | Cascade |

Every foreign key is declared as a real Postgres FK constraint through Prisma relations.

### Enums

```
Role             ADMIN | PM | DEVELOPER
TaskStatus       TODO | IN_PROGRESS | IN_REVIEW | DONE
TaskPriority     LOW | MEDIUM | HIGH | CRITICAL
NotificationType TASK_ASSIGNED | TASK_IN_REVIEW | TASK_OVERDUE | SYSTEM
```

Enums (rather than free-text status columns) push the four legal statuses and priorities down into the database, so no code path can write an invalid value.

### Two design notes worth calling out

**`ActivityLog` is an append-only event table, not a projection.** It stores `oldStatus`, `newStatus`, `action`, `userId` and `createdAt` for every transition. Task history is therefore never reconstructed from `Task.status` — a task currently in `IN_REVIEW` still has both `TODO → IN_PROGRESS` and `IN_PROGRESS → IN_REVIEW` rows behind it. It also carries a denormalised `projectId` alongside `taskId` so the feed can be filtered per project (and so that non-task project events still have a home) without a join through `Task`.

**`Task.isOverdue` is a materialised flag, not a computed one.** It is written by the background cron job. Reads never derive overdue status from `dueDate < now()` at request time, which is what the assessment requires, and it also keeps the Admin overdue count a plain indexed count rather than a full scan.

**Refresh tokens are stored hashed.** `RefreshToken.tokenHash` holds a SHA-256 of the token, so a database leak does not hand out usable sessions. Rows carry `expiresAt` and a nullable `revokedAt` to support rotation and logout revocation.

---

## 4. Indexing decisions

Each index below exists because a specific query in this codebase needs it. No speculative indexes were added.

| Index | Query it serves | Why |
| --- | --- | --- |
| `User.email` (unique) | `findUnique({ where: { email } })` on login | Every login is an email lookup; uniqueness is also the correctness constraint. |
| `User.role` | `listDevelopers()` — `where: { role: DEVELOPER }` | The assignee dropdown filters by role on every task form. |
| `RefreshToken.tokenHash` (unique) | `findUnique({ where: { tokenHash } })` on `/auth/refresh` | Hit on every token refresh; uniqueness also prevents duplicate token rows. |
| `RefreshToken.userId` | Revoking a user's sessions | Bounded scan per user rather than per table. |
| `Project.createdById` | **PM ownership** — `where: { createdById }` | The single hottest authorization predicate: every PM list, dashboard and feed query filters on it. |
| `Project.clientId` | Projects for a client; cascade resolution | Supports the client → projects relationship lookups. |
| `Client.name` | Client list ordered/filtered by name | Small table, but keeps ordering index-backed. |
| `Task.projectId` | Tasks of a project; project detail page | Primary drill-down path. |
| `Task.assignedDeveloperId` | **Developer scoping** — `where: { assignedDeveloperId }` | The other hot authorization predicate; every developer list and dashboard query filters on it. |
| `Task.status` | `/tasks?status=IN_PROGRESS`, status group-by | Status filter + Admin "tasks by status" aggregation. |
| `Task.priority` | `/tasks?priority=HIGH`, PM priority group-by | Priority filter + PM "tasks by priority" aggregation. |
| `Task.dueDate` | `/tasks?dueFrom=&dueTo=`, PM "due this week" | Range scans on a B-tree. |
| `Task.(isOverdue, dueDate)` | **Cron job** — `where: { isOverdue: false, dueDate: { lt: now } }` | Composite, in selectivity order: the job runs every minute and must not scan the task table. `isOverdue` narrows first, `dueDate` then range-scans within it. Also serves the Admin overdue count. |
| `ActivityLog.(projectId, createdAt)` | PM/project feed: filter by project, order by recency | Composite equality-then-sort: Postgres can satisfy both the `WHERE` and the `ORDER BY … DESC LIMIT 20` from one index, with no sort step. |
| `ActivityLog.(taskId, createdAt)` | Per-task history on the task detail view | Same equality-then-sort shape. |
| `ActivityLog.(userId, createdAt)` | "What did this user do" lookups | Same shape. |
| `ActivityLog.createdAt` | **Admin global feed** — no filter, just `ORDER BY createdAt DESC LIMIT 20` | The Admin feed has no equality predicate, so it needs a standalone index on the sort column. |
| `Notification.(userId, isRead, createdAt)` | Notification list **and** unread count | Covers both queries: `WHERE userId = ?` ordered by `createdAt` for the dropdown, and `WHERE userId = ? AND isRead = false` for the badge count. Column order is equality → equality → sort. |
| `Notification.createdAt` | Retention/cleanup scans by age | Age-ordered sweeps. |

The recurring principle: **equality columns first, sort column last**. That is what lets the "last 20 events" catch-up query and the unread-count query each run off a single index with no sort.

---

## 5. Authorization model

Authorization is enforced **entirely on the server**. The React app hides links and buttons a role cannot use, but that is a convenience layer only — removing it changes nothing about what the API will return.

Every protected request passes through three stages:

```
authenticateToken    Who is this user?   (verify JWT signature → req.user)
        ↓
requireRole(...)     What is their role? (coarse gate: e.g. only ADMIN|PM may POST /tasks)
        ↓
controller check     Do they own this specific resource?
                     (project.createdById === user.id, task.assignedDeveloperId === user.id)
```

The third stage is the important one. A role gate alone would let PM A edit PM B's project, so every controller that touches a specific record re-loads it and compares ownership before acting.

### Matrix

| Operation | Admin | PM | Developer |
| --- | --- | --- | --- |
| Manage clients | ✅ | read-only | ❌ |
| Manage users | ✅ | list developers only | ❌ |
| Create projects | ✅ | ✅ (owns them) | ❌ |
| View / edit **any** project | ✅ | ❌ 403 | ❌ 403 |
| View / edit **own** project | ✅ | ✅ | ❌ |
| Create + assign tasks | ✅ | ✅ own projects | ❌ 403 |
| View a task | ✅ | own projects | only if assigned |
| Update task status | ✅ | own projects | only if assigned |
| Delete task | ✅ | own projects | ❌ 403 |
| Activity feed scope | all projects | own projects | own assigned tasks |
| Join a project WebSocket room | any | own projects | only where assigned |

### Why forged tokens do not help

The role is a **signed claim** inside the access token, verified with `JWT_ACCESS_SECRET` on every request. Editing the payload invalidates the signature and the request is rejected with `401`. And even a validly-signed token only carries a role — ownership is still checked against the database row, so a real PM token cannot reach another PM's project.

### A subtle leak that is closed

`GET /projects/:id` returns the project **with its tasks**. A developer is allowed to open a project they have work in — but the response is filtered to only their own tasks before it is sent, so the project view cannot be used as a side channel to read other developers' work.

### Error envelope

Every error, from every endpoint, has the same shape. Stack traces are never serialised to the client; unexpected errors are logged server-side and returned as a generic `INTERNAL_ERROR`.

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this resource",
    "details": [{ "field": "dueFrom", "message": "dueFrom must be on or before dueTo" }]
  }
}
```

Codes: `VALIDATION_ERROR` (400) · `UNAUTHORIZED` (401) · `FORBIDDEN` (403) · `NOT_FOUND` (404) · `CONFLICT` (409) · `INTERNAL_ERROR` (500).

---

## 6. Real-time architecture

### Socket authentication

The access token travels in the Socket.io handshake (`auth.token`) and is verified in `io.use()` middleware **before** the connection is accepted. An unauthenticated socket never reaches the `connection` handler, so there is no window in which an anonymous client is subscribed to anything.

### Room design

Delivery is filtered by **which rooms a socket is allowed into**, not by what the client asks for. The server decides room membership; the client cannot subscribe itself to data it should not see.

| Room | Joined by | Carries |
| --- | --- | --- |
| `user:<userId>` | every socket, automatically | that user's notifications + activity on their own tasks |
| `admin:global` | sockets whose verified role is `ADMIN` | every activity event, and presence updates |
| `project:<projectId>` | on request — **re-authorized server-side** | task + activity events for that project |

`project:join` is the only room a client can ask for, and the request is checked against the database before the join: a PM is refused a project they did not create, and a developer is refused a project they have no assigned task in. The refusal is returned through the acknowledgement callback.

This gives the three required feed scopes without any per-event filtering:

```
Admin      → admin:global          → all activity, everywhere
PM         → project:<own ids>     → only projects they created
Developer  → user:<id> + project:… → only activity touching their assigned tasks
```

### Event flow for a status change

```
PATCH /tasks/:id/status
  1. authenticate + authorize (assigned developer, owning PM, or admin)
  2. UPDATE task
  3. INSERT ActivityLog  (old → new, who, when)   ← PostgreSQL is the source of truth
  4. emit task:updated   → project:<id>, admin:global, user:<assignee>
  5. emit activity:new   → same rooms
  6. if newStatus = IN_REVIEW → INSERT Notification for the owning PM
                             → emit notification:new → user:<pmId>
```

The database write always precedes the broadcast, so a client that reconnects immediately after an event still finds it persisted.

### Events

| Event | Direction | Payload |
| --- | --- | --- |
| `task:updated` | server → client | `{ task, activity }` |
| `activity:new` | server → client | `ActivityLog` |
| `notification:new` | server → client | `Notification` |
| `presence:update` | server → client | `{ onlineCount, onlineUserIds, timestamp }` |
| `project:join` | client → server | `{ projectId }` + ack `{ success, error? }` |
| `project:leave` | client → server | `{ projectId }` |

### Missed-event catch-up

On connect and on every reconnect the client calls `GET /activity/missed`, which returns **the last 20 activity rows from PostgreSQL**, scoped by the caller's role using exactly the same predicates as the live rooms. Nothing is replayed from server memory or a cache — a server restart does not lose a single event, because the events were never in memory to begin with.

### Presence

`PresenceManager` maps `userId → Set<socketId>`, so a user with three tabs open counts once, and closing one tab does not mark them offline. Connect and disconnect both recompute the count and broadcast `presence:update` to `admin:global`. The Admin dashboard renders that pushed value — it never polls.

Presence is intentionally in-memory: it describes *live socket connections on this process*, which is ephemeral state that would be wrong, not merely stale, if persisted. See [Known limitations](#12-known-limitations) for what this means across multiple instances.

### Overdue job

`node-cron` runs every minute and looks for `isOverdue = false AND dueDate < now() AND status != DONE`. The `isOverdue = false` predicate is what makes the job idempotent: a task is processed exactly once, and subsequent runs skip it. For each newly overdue task it flags the row, writes an `ActivityLog` entry, notifies the assignee, and broadcasts the update — so a dashboard left open sees a task go overdue live, with no page load involved.

---

## 7. API reference

All routes are prefixed with `/api`. Every route except the three auth endpoints and `/health` requires `Authorization: Bearer <accessToken>`.

### Auth

| Method | Route | Access | Notes |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | public | Returns access token + user; sets refresh cookie |
| `POST` | `/auth/refresh` | cookie | Rotates the refresh token, returns a new access token |
| `POST` | `/auth/logout` | cookie | Revokes the stored refresh token and clears the cookie |
| `GET` | `/auth/me` | any | Current authenticated user |

### Resources

| Method | Route | Access |
| --- | --- | --- |
| `GET` | `/projects` | any — scoped by role |
| `GET` | `/projects/:id` | Admin, owning PM, assigned developer |
| `POST` `PUT` `DELETE` | `/projects`, `/projects/:id` | Admin, owning PM |
| `GET` | `/tasks` | any — scoped by role; supports filters |
| `GET` | `/tasks/:id` | Admin, owning PM, assigned developer |
| `POST` `PUT` `DELETE` | `/tasks`, `/tasks/:id` | Admin, owning PM |
| `PATCH` | `/tasks/:id/status` | Admin, owning PM, **assigned developer** |
| `GET` | `/clients` | Admin, PM |
| `POST` `PUT` `DELETE` | `/clients`, `/clients/:id` | Admin |
| `GET` | `/users` | Admin |
| `GET` | `/users/developers` | Admin, PM |
| `GET` | `/activity/feed?limit=&since=` | any — scoped by role |
| `GET` | `/activity/missed` | any — last 20, scoped by role |
| `GET` | `/notifications` | own only |
| `PATCH` | `/notifications/:id/read` | own only |
| `POST` | `/notifications/read-all` | own only |
| `GET` | `/dashboard` | any — returns the role-specific payload |
| `GET` | `/health` | public |

### Task filters

Composable query parameters, validated server-side. Because they live in the URL, any filtered view is shareable.

```
/api/tasks?status=IN_PROGRESS
/api/tasks?priority=HIGH
/api/tasks?dueFrom=2026-09-01&dueTo=2026-09-15
/api/tasks?status=IN_PROGRESS&priority=HIGH&dueFrom=2026-09-01&dueTo=2026-09-30&projectId=<uuid>
```

Invalid values are rejected with `VALIDATION_ERROR` rather than silently ignored — including the cross-field rule that `dueFrom` must not be after `dueTo`. The React app mirrors these into `useSearchParams`, so the browser URL and the API call always agree.

---

## 8. Architecture decisions

### Backend framework — Express

Express, over Fastify. The deciding factor was that this application needs Socket.io, `cookie-parser` for the HttpOnly refresh cookie, and CORS with credentials, all interacting correctly. Express's middleware model composes those directly and is the path every one of those libraries documents first. Fastify is measurably faster per request, but the bottleneck here is Postgres round-trips and WebSocket fan-out, not HTTP parsing — so Fastify's advantage would not show up, while its plugin-encapsulation model would add friction around sharing the Socket.io instance between HTTP handlers and the cron job.

### Real-time — Socket.io

Socket.io, over native `ws`. Three reasons, in order of weight:

1. **Rooms are the authorization primitive.** The entire role-filtered feed reduces to "which rooms may this socket join" — `admin:global`, `project:<id>`, `user:<id>`. With native WebSockets I would have to hand-build room membership, fan-out and per-event filtering, which is exactly the code most likely to leak data across roles.
2. **Reconnection is built in.** The offline catch-up requirement depends on reliably detecting a reconnect. Socket.io ships automatic reconnection with backoff and a `reconnect` event; native `ws` requires writing that plus heartbeat/timeout handling by hand.
3. **Acknowledgement callbacks.** `project:join` needs to tell the client *why* a join was refused. Socket.io's ack callbacks give a request/response shape over the socket; with raw `ws` that means inventing a correlation-id protocol.

The cost is a larger client bundle and a non-standard wire protocol. For an internal tool of this size that is a good trade.

### Background jobs — node-cron

node-cron, over Bull. The overdue sweep is a single periodic query with no job payloads, no retries, no concurrency and no failure semantics beyond "try again in 60 seconds". Bull would require running and operating **Redis** purely to schedule one recurring query — real infrastructure cost for no benefit. node-cron is in-process, adds no dependency, and the job is naturally idempotent (`isOverdue = false` guards it), so a missed or duplicated tick is harmless.

The honest trade-off: node-cron is per-process, so running two API instances runs the job twice. It stays correct because of the idempotency guard, but Bull (or a Postgres advisory lock) would be the right answer if this ever scaled horizontally.

### Token storage

| Token | Lifetime | Stored | Reasoning |
| --- | --- | --- | --- |
| Access | 15 min | In memory (React state), mirrored to `localStorage` for page reloads | Sent as `Authorization: Bearer`. Short-lived, so a leaked one expires quickly. |
| Refresh | 7 days | **HttpOnly, Secure, SameSite cookie — never readable by JavaScript** | The long-lived credential, so it is the one kept out of JavaScript's reach entirely. |

The split is the point: the token worth stealing (7-day refresh) is unreachable from JavaScript, so an XSS foothold cannot exfiltrate a durable session — only a token that dies in fifteen minutes. `SameSite=Lax` locally (same-origin via the dev proxy) and `SameSite=None; Secure` in production, where the SPA and API are on different origins.

Refresh tokens are **rotated** on every use: the old row is marked `revokedAt` and a new token is issued. They are stored only as SHA-256 hashes, and logout revokes the row server-side rather than merely clearing the cookie.

A 401 triggers a single silent refresh in an axios interceptor, with concurrent failed requests queued and replayed against the new token — so an expired access token is invisible to the user.

### ORM — Prisma, used consistently

Prisma is the only database access path. There is no raw SQL anywhere in the controllers; the schema is the single source of truth for types, and generated types flow through services into the API responses.

---

## 9. Project structure

```
.
├── docker-compose.yml           # Postgres + API + SPA
├── .env.docker.example
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # models, enums, relations, indexes
│   │   └── seed.ts              # 7 users, 3 clients, 3 projects, 16 tasks, activity, notifications
│   ├── tests/e2e.mjs            # end-to-end RBAC + WebSocket verification (npm run verify)
│   └── src/
│       ├── config/              # env parsing, CORS origins, cookie policy
│       ├── controllers/         # request handling + authorization + Prisma access
│       ├── routes/              # route table: auth → role gate → validation → controller
│       ├── middleware/
│       │   ├── authMiddleware.ts    # JWT verification
│       │   ├── roleMiddleware.ts    # requireRole(...)
│       │   ├── validate.ts          # Zod body/query/params validation
│       │   └── errorHandler.ts      # single structured error envelope
│       ├── websocket/
│       │   ├── socketServer.ts      # handshake auth, rooms, emitters
│       │   └── presenceManager.ts   # userId → Set<socketId>
│       ├── jobs/overdueCron.ts  # node-cron overdue sweep
│       ├── utils/               # typed AppError hierarchy, JWT helpers
│       ├── types/               # AuthRequest, JwtPayload
│       └── server.ts            # composition root
│
└── frontend/
    └── src/
        ├── components/          # AppLayout (nav, notification bell), shared UI
        ├── context/
        │   ├── AuthContext.tsx      # session, login/logout, silent refresh
        │   └── SocketContext.tsx    # socket lifecycle, notifications, activity, presence
        ├── lib/api.ts           # axios instance + refresh interceptor
        ├── pages/               # Login, Dashboard, Projects, ProjectDetail, Tasks, Activity, Clients, Users
        ├── types/               # shared domain types
        ├── App.tsx              # routes + auth/role guards
        └── main.tsx
```

**Separation of concerns.** A request flows `route → authenticate → role gate → validate → controller → Prisma`. Each layer has one job: routes declare the pipeline, middleware handles cross-cutting identity/validation/errors, controllers own resource authorization and orchestration, and Prisma owns data access. Errors are never handled inline — controllers `throw` a typed `AppError` and the single error handler serialises it.

---

## 10. How to verify the requirements

### Automated end-to-end suite

`backend/tests/e2e.mjs` drives the real HTTP and WebSocket surface — no mocks — and asserts the behaviours this assessment grades. With Postgres seeded and the API running:

```bash
cd backend
npm run verify                 # 85 assertions, ~15s
RUN_CRON=1 npm run verify      # +8 assertions, ~3min (waits for real cron ticks)
API_URL=http://localhost:5055 npm run verify   # non-default port
```

It covers, in order: token issuance and rotation, HttpOnly cookie storage, forged-role rejection, the full RBAC matrix (cross-PM and cross-developer access, direct API calls), query-parameter filters and their validation, all three dashboards, WebSocket handshake auth, presence semantics (including multi-tab), project-room authorization, live status propagation *and* the negative case that an unauthorized PM receives nothing, persisted status history, both notification scenarios, and missed-event catch-up from PostgreSQL. `RUN_CRON=1` additionally proves the overdue job flags a task that was *not* overdue at creation, persists the activity row, broadcasts it, and is idempotent across ticks.

The negative assertions are the point: a suite that only checks the happy path would pass against a completely unauthorized system.

### Manual checks

Use two browsers (or one normal + one incognito) to have two roles signed in at once.

**API-level RBAC — the core check.** Sign in as `pm2`, copy the access token, and request a project owned by PM 1 directly:

```bash
curl -H "Authorization: Bearer <pm2-token>" http://localhost:5000/api/projects/<pm1-project-id>
# → 403 {"success":false,"error":{"code":"FORBIDDEN", ...}}
```

Same for a developer requesting another developer's task — `403`, with no UI involved.

**Forged role claim.** Take a developer's token, edit the `role` claim to `ADMIN`, re-encode without re-signing, and call `/api/users` → `401 UNAUTHORIZED` (signature check fails).

**Real-time task updates.** Open the same project detail page as Admin in one browser and as the assigned developer in another. Move the task's status as the developer → the Admin's list and activity feed update with no refresh.

**Role-filtered feed.** With Admin, `pm1` and `pm2` all watching `/activity`, change a task in a PM 1 project: Admin and PM 1 receive it, PM 2 does not.

**Missed-event catch-up.** Sign in as a developer, then kill the browser tab. As a PM, change several of that developer's tasks. Reopen the developer's session → the last 20 relevant events are fetched from Postgres and rendered.

**Presence.** Watch "Online Now" on the Admin dashboard while signing another user in and out — the count moves live. Open two tabs as the same user; the count increases by one, not two.

**Notifications.** Assign a task to a developer as a PM → their bell badge increments instantly. Have that developer move the task to *In Review* → the owning PM gets a notification. Both persist in the database; mark-one-read and mark-all-read both work.

**Overdue job.** Create a task with a due date a minute in the future, then leave the dashboard open. Within 60 seconds the cron job flags it, the badge appears and an overdue activity entry arrives — with no page load. Two tasks are also seeded already overdue.

**Filters.** Visit `/tasks?status=IN_PROGRESS&priority=HIGH` directly — the filtered view loads from the URL. Send `?dueFrom=2026-12-01&dueTo=2026-01-01` to see the cross-field validation error.

**Refresh-token storage.** DevTools → Application → Local Storage holds only `accessToken`. The refresh token appears under Cookies flagged `HttpOnly`, and `document.cookie` cannot see it.

---

## 11. Deployment

The SPA and the API deploy separately, because a WebSocket server needs a long-lived process that Vercel's serverless functions do not provide.

### Frontend → Vercel

| Setting | Value |
| --- | --- |
| Root directory | `frontend` |
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variable | `VITE_API_URL = https://<your-api-host>` |

`frontend/vercel.json` already rewrites all paths to `index.html` so deep links survive a refresh.

### Backend → any host that keeps a process alive

Render, Railway and Fly.io all work; `backend/Dockerfile` builds a production image. Set:

```ini
NODE_ENV=production
DATABASE_URL=...          # managed Postgres (Neon, Supabase, Render)
DIRECT_URL=...
FRONTEND_URL=https://<your-app>.vercel.app
ADDITIONAL_ORIGINS=       # optional: Vercel preview URLs, comma-separated
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
```

Then run `npx prisma migrate deploy` and `npm run seed` once against the production database.

Two things matter in production and are already handled: `FRONTEND_URL` must match the Vercel origin exactly or both CORS and the WebSocket handshake are rejected; and because the two origins differ, the refresh cookie is issued `SameSite=None; Secure`, which requires HTTPS on both sides.

---

## 12. Known limitations

These are real, and they are deliberate trade-offs for an assessment-scoped build rather than oversights.

1. **Presence and the cron job are single-instance.** `PresenceManager` keeps online users in process memory, so two API instances would each report only their own connections. Fixing it means a Redis adapter for Socket.io and a shared presence store. Likewise, node-cron would run the overdue sweep once per instance — harmless today thanks to the idempotency guard, but a Postgres advisory lock or Bull would be the correct fix.

2. **The test suite is end-to-end only.** `npm run verify` covers the graded behaviour well, but it needs a running server and a seeded database, so it cannot run in a plain CI job without provisioning Postgres first. There are no unit tests around the individual controllers, and no fixture isolation — the suite writes into the seeded database rather than a throwaway schema per run, so repeated runs accumulate probe records. Spinning up a per-run schema and adding controller-level unit tests is the next step.

3. **The activity feed is not paginated.** It returns the most recent N events with no cursor, so there is no way to scroll back through history. The `(projectId, createdAt)` indexes are already shaped for keyset pagination; only the API surface is missing.

4. **The access token is mirrored to `localStorage`.** This is what survives a page refresh without an extra round-trip. It is a deliberate, bounded exposure — the token expires in 15 minutes and the refresh token stays HttpOnly — but a stricter design would keep the access token purely in memory and always re-derive it from the refresh cookie on load.

5. **Client management is create/list/update/delete without soft deletes.** Deleting a client cascades to its projects and their tasks. Real agency software would soft-delete and archive instead.

6. **Notification unread count is incremented optimistically on the client** when a `notification:new` event arrives, rather than the server pushing an authoritative count. The two can drift if the same account acts in two tabs at once; re-opening the app reconciles from the database.

---

## 13. Assessment explanation

*(150–250 words, as required by the submission form.)*

The hardest problem was making the real-time feed enforce the same permissions as the REST API without duplicating the rules in two places. My first instinct — broadcast every event and filter client-side — is exactly the mistake the assessment is testing for, since anyone with DevTools open would see other roles' data on the wire.

I solved it by making **room membership** the authorization mechanism rather than event filtering. A socket is authenticated during the handshake, then joined only to rooms its verified identity permits: `admin:global` for admins, `user:<id>` for everyone, and `project:<id>` only after the server re-checks ownership or task assignment against the database. Because a client cannot join a room it is not entitled to, an unauthorized event is never transmitted at all — there is nothing to filter. The same predicates that scope the REST queries scope the rooms, so the two cannot drift apart.

Missed-event catch-up falls out cleanly: on reconnect the client asks Postgres for the last 20 events using those same predicates, so nothing depends on server memory.

What I would do differently: write the authorization tests first rather than last. I built the end-to-end suite after the features, and it immediately found two defects I had missed by hand — `GET /projects/:id` returning a project's full task list to a developer who should only see their own, and refresh tokens colliding when minted twice in the same second. Both would have been caught on day one.

---

## License

Built as a technical assessment for Velozity Global Solutions.
