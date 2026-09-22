# HabitUp Backend — Agent Instructions

## Quick Start

```bash
npm install
cp .env.example .env   # configure DATABASE_URL, JWT secrets, email credentials
npm run migrate up     # apply DB migrations
npm run dev            # start dev server (nodemon, port 5000)
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server with hot reload |
| `npm start` | Production server |
| `npm run migrate up` | Apply migrations |
| `npm run migrate down` | Rollback last migration |
| `npm test` | Full test suite (elevated rate limits) |
| `npm run test:rate-limit` | Rate-limit test (fresh server required) |
| `npm run test:admin` | Admin-only tests |
| `npm run build` | Build admin dashboard (in `habitup-admin/`) |
| `npm run build:admin` | Alias for `build` |

**Test isolation:** `npm test` sets `AUTH_RATE_LIMIT_MAX=100` and `SEARCH_RATE_LIMIT_MAX=1000` to avoid production limits. The rate-limit test (`npm run test:rate-limit`) must run on a fresh server instance to avoid cross-test contamination.

## Architecture

- **Runtime:** Node.js (CommonJS), Express 5
- **DB:** PostgreSQL (Neon), raw `pg` queries, no ORM
- **Migrations:** `node-pg-migrate` (files in `migrations/`)
- **Auth:** JWT (access + refresh rotation), Argon2id hashing
- **Email:** Resend (production HTTPS API), Gmail SMTP (dev fallback)
- **Admin UI:** React + Vite in `habitup-admin/`, served statically at `/admin-dashboard`

### Key Directories

```
services/      # Business logic (auth, habits, streaks, notifications, experiments, etc.)
routes/        # Express routers with Swagger JSDoc annotations
controllers/   # Request handlers
middleware/    # authMiddleware, rateLimiter, experimentMiddleware, adminMiddleware, validateUuid
scripts/       # Integration test scripts (run with `node scripts/<name>.js`)
tests/         # Node.js --test suite (helpers.js provides test utilities)
```

### Entry Points

- `server.js` — Express app, mounts routes, starts notification scheduler
- `services/db.js` — PostgreSQL pool (`ssl: { rejectUnauthorized: false }` for Neon)
- `swagger.js` — OpenAPI 3.0 spec

## Critical Conventions

1. **UUID validation:** All `:id` params validated by `validateUuid` middleware (returns 400 on invalid format).
2. **Cross-user isolation:** Every resource lookup scopes by `userId` from JWT; returns 404 (not 403) to prevent existence disclosure.
3. **Soft deletes:** `deleted_at` timestamp on users/habits; excluded from standard queries.
4. **Rate limiting:** Per-IP limiters on auth endpoints (`authLimiter`, `passwordResetLimiter`, `heartbeatLimiter`).
5. **Trust proxy:** `app.set('trust proxy', 1)` for Railway's load balancer (required for correct rate-limit IP detection).
6. **Timezone-aware:** User timezone stored at registration; streak/completion calculations use it.
7. **Experiment assignment vs exposure:** Assignment (`GET /experiments/:name`) is deterministic and stored; exposure (`POST /experiments/:name/exposure`) logs separately. See `EXPERIMENTATION.md`.

## Environment Variables (required)

```
PORT=5000
DATABASE_URL=postgresql://...?sslmode=verify-full
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
GMAIL_USER=...@gmail.com
GMAIL_APP_PASSWORD=...
RESEND_API_KEY=...
MAX_SESSION_GAP_MINUTES=120
HEARTBEAT_RATE_LIMIT_MAX=60
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...  # for push notifications
```

## Testing Notes

- `tests/helpers.js` exports `registerTestUser()`, `authFetch()`, `loginUser()`, `promoteToAdmin()`.
- Test scripts in `scripts/` create isolated users per run; `cleanup-test-data.js` purges them.
- Admin promotion: `node scripts/make-admin.js user@example.com` (after migrations).

## Admin Dashboard

```bash
cd habitup-admin
npm install
npm run build   # outputs to habitup-admin/dist, served by backend at /admin-dashboard
```

## Deployment

- **Platform:** Railway (auto-deploy on `main` branch push)
- **Env vars:** Configured in Railway project settings
- **Health check:** `GET /health` (checks DB + Firebase config)

## Common Gotchas

- **Cloud SMTP blocked:** Railway/Render block raw SMTP ports. Use Resend API in production.
- **Cold starts:** Free tier may have first-request latency.
- **Migrations are one-way in prod:** No rollback on Railway; test locally first.
- **Refresh token rotation:** Old tokens are revoked on use; `logout-all` revokes all user sessions.