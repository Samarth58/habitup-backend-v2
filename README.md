# HabitUp Backend

A Node.js/Express/PostgreSQL backend for HabitUp, a daily habit tracker mobile app.

---

## Tech Stack

- **Runtime & Framework**: Node.js, Express.js (v5)
- **Database**: PostgreSQL (hosted on [Neon](https://neon.tech/))
- **Database Access**: Raw `pg` queries (no ORM)
- **Migrations**: `node-pg-migrate`
- **Authentication**: JWT (JSON Web Tokens) with access & refresh token rotation, Argon2id password hashing
- **Email Service**: Resend HTTP API (primary for production cloud environments), Nodemailer with Gmail SMTP (local development fallback)
- **API Documentation**: Swagger / OpenAPI 3.0 (`swagger-ui-express`, `swagger-jsdoc`)
- **Rate Limiting**: `express-rate-limit`

---

## Features

### Authentication
- User registration and password hashing using Argon2id.
- JWT-based auth with short-lived access tokens and long-lived refresh tokens.
- Secure refresh token rotation, single session logout, and `logout-all` (invalidating all active refresh sessions for a user).
- Password reset flow via secure, time-limited tokens sent by email.
- Endpoint rate limiting to protect authentication routes against brute-force attacks.

### Habits
- Full CRUD operations for habits (create, read, update, delete).
- Support for custom weekly schedules (selecting specific active days of the week).
- Habit lifecycle management: pause, unpause, archive, unarchive, and soft-deletion.

### Completions & Streaks
- Idempotent daily completion check-ins (mark complete or uncomplete).
- Timezone-aware streak calculation engine tracking current streaks, longest streaks, and completion history.

### Reminders
- Full CRUD operations for per-habit notification reminders.

### Statistics
- Per-habit and aggregate metrics, including completion rates, total completion counts, current streaks, and longest streaks.

---

## Getting Started

### Prerequisites

- **Node.js**: v18.x or higher
- **PostgreSQL Database**: A running PostgreSQL instance (e.g. [Neon](https://neon.tech/) serverless Postgres)

### Clone and Install

```bash
git clone https://github.com/Spryntworks/habitup-backend.git
cd habitup-backend
npm install
```

### Environment Variables

Create a `.env` file in the root directory based on `.env.example`:

```env
PORT=5000
DATABASE_URL=postgresql://user:password@host:port/dbname?sslmode=require
JWT_ACCESS_SECRET=your_jwt_access_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
GMAIL_USER=your_gmail_address@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
RESEND_API_KEY=your_resend_api_key
```

#### Variable Descriptions:
- `PORT`: Port on which the Express server listens (default: `5000`).
- `DATABASE_URL`: PostgreSQL connection URI (with SSL enabled for cloud providers like Neon).
- `JWT_ACCESS_SECRET`: Secret key used to sign access JWTs.
- `JWT_REFRESH_SECRET`: Secret key used to sign refresh JWTs.
- `GMAIL_USER`: Gmail address used to dispatch transactional emails (e.g. password resets).
- `GMAIL_APP_PASSWORD`: Google App Password generated for SMTP authentication.
- `RESEND_API_KEY`: API key for Resend email service (for future company domain migration).

### Running Migrations

Apply database migrations using `node-pg-migrate`:

```bash
npm run migrate up
```

### Running the Server

Start the development server with hot-reloading via `nodemon`:

```bash
npm run dev
```

For production mode:

```bash
npm start
```

---

## API Documentation

Interactive Swagger/OpenAPI documentation is available locally at `/api-docs` once the server is running:

`http://localhost:5000/api-docs`

### Deployed API Documentation
The live interactive documentation for the deployed backend is available at:

[https://habitup-backend-v2-production.up.railway.app/api-docs](https://habitup-backend-v2-production.up.railway.app/api-docs)

---

## Project Structure

```text
habitup-backend/
├── controllers/       # HTTP request handlers processing requests and responses
├── middleware/        # Express middleware (auth verification, rate limiters)
├── migrations/        # SQL schema migration scripts (node-pg-migrate)
├── routes/            # Route definitions with Swagger documentation annotations
├── scripts/           # Integration & regression test scripts
├── services/          # Core business logic (auth, habit engine, streaks, reminders)
├── server.js          # Main application entry point & Express setup
├── swagger.js         # OpenAPI specification and Swagger UI configuration
└── package.json       # Dependencies and npm scripts
```

---

## Testing

Run the normal suite with:

```bash
npm test
```

The main test suite requires an elevated `AUTH_RATE_LIMIT_MAX` for the test run so the combined auth calls across all files do not hit the production 10/15 minute limit during CI or local runs. The script in `package.json` sets this for the test run automatically.

Run the rate-limit test separately with a fresh server restart:

```bash
npm run test:rate-limit
```

The auth rate-limit test is intentionally isolated because it exercises the IP-based login/register limiter and consumes its 10-request window. It must run on a fresh server instance to avoid cross-test contamination and false failures in the main suite.

The project also includes isolated end-to-end automated test scripts in the `scripts/` directory. Each script generates isolated per-run test users to ensure repeatable execution:

- `scripts/test-me.js`: Tests user profile (`GET /auth/me`) endpoints.
- `scripts/test-rate-limit.js`: Verifies rate limiting enforcement on auth endpoints.
- `scripts/test-schedules.js`: Tests habit custom schedule creation and retrieval.
- `scripts/test-completions.js`: Verifies daily check-ins and timezone-aware streak calculations.
- `scripts/test-pause-archive.js`: Tests habit lifecycle states (pause, unpause, archive, unarchive).
- `scripts/test-reminders.js`: Tests reminder creation, updates, listing, and deletion.
- `scripts/test-stats.js`: Verifies habit and aggregate statistics calculations.
- `scripts/test-reset-password.js`: Tests request and confirmation of password resets.
- `scripts/test-email-delivery.js`: Tests transactional email sending.
- `scripts/cleanup-test-data.js`: Cleans up test user accounts and associated data.

Run any test script directly with Node.js:

```bash
node scripts/test-completions.js
node scripts/test-rate-limit.js
```

---

## Known Limitations

- **Email Delivery in Cloud / Railway**: Cloud platforms like Railway block outbound raw SMTP ports (25, 465, 587) to prevent spam abuse. Password reset emails in production are dispatched via Resend's HTTPS API (`https://api.resend.com`). In free sandbox mode, Resend allows sending to the account owner's email address; verifying a custom domain DNS in the Resend dashboard unlocks delivery to all recipient domains. Gmail SMTP remains available as a local development fallback where raw SMTP ports are unblocked.
- **Cold Starts**: Hosting on free or starter tiers (Render/Railway) may introduce initial cold-start delays on the first request after periods of inactivity.

---

## Deployment

The application is deployed on **Railway**. Environment variables are configured in the Railway project settings, and deployments trigger automatically upon pushing commits to the `main` branch.

