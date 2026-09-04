# HabitUp Admin API Contract Specification

This document provides the verified API contracts for the HabitUp Admin Dashboard frontend implementation.

---

## 1. Authentication & Security Overview

### Token Scheme
- **Access Token:** JWT with 15-minute expiration signed with `JWT_ACCESS_SECRET`.
- **Refresh Token:** JWT with 30-day expiration containing `jti` (random hex string hashed with Argon2 in DB).
- **Header Format for Protected Endpoints:**
  ```http
  Authorization: Bearer <accessToken>
  ```

### Administrative Role Enforcement
All `/admin/*` routes enforce two-tier middleware protection:
1. `requireAuth`: Verifies `Authorization: Bearer <accessToken>`. Decodes JWT payload and attaches `req.userId`.
2. `requireAdmin`: Queries PostgreSQL DB (`users` table) for `role = 'admin'` and `deleted_at IS NULL` for `req.userId`. Returns `403 Forbidden` if role is not `'admin'`.

---

## 2. API Endpoints Contract

---

### `POST /auth/login`
Authenticate admin or user and obtain access and refresh tokens.

- **HTTP Method:** `POST`
- **Path:** `/auth/login`
- **Authentication:** None (Public)
- **Rate Limit:** Applied (`authLimiter`)
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "userPassword"
  }
  ```
- **Successful Response (200 OK):**
  ```json
  {
    "accessToken": "string (JWT)",
    "refreshToken": "string (JWT)",
    "user": {
      "id": "uuid-string",
      "name": "string",
      "email": "string",
      "timezone": "string",
      "created_at": "ISO-date-string"
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: `{ "error": "email and password are required." }`
  - `401 Unauthorized`: `{ "error": "Invalid credentials." }`
  - `500 Internal Server Error`: `{ "error": "Login failed." }`

---

### `POST /auth/session/heartbeat`
Update `last_used_at` timestamp on active session for usage analytics.

- **HTTP Method:** `POST`
- **Path:** `/auth/session/heartbeat`
- **Authentication:** `requireAuth` (`Bearer <accessToken>`)
- **Rate Limit:** Applied (`heartbeatLimiter`)
- **Request Body:**
  ```json
  {
    "refreshToken": "string (JWT)"
  }
  ```
- **Successful Response (200 OK):**
  ```json
  {
    "ok": true,
    "message": "Session heartbeat recorded."
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: `{ "error": "refreshToken is required." }` or `{ "error": "Invalid or expired refresh token." }` or `{ "error": "Refresh token does not belong to the authenticated user." }`
  - `401 Unauthorized`: `{ "error": "Authorization header missing or malformed." }`
  - `404 Not Found`: `{ "error": "Session not found or revoked." }`

---

### `GET /admin/dashboard`
Retrieve high-level system metrics and key performance indicators.

- **HTTP Method:** `GET`
- **Path:** `/admin/dashboard`
- **Authentication:** `requireAuth` + `requireAdmin` (`Bearer <accessToken>`)
- **Query Parameters:**
  - `period` (optional, enum: `7d`, `30d`, `90d`, `365d`, `1d`, default: `7d`)
- **Request Body:** N/A
- **Successful Response (200 OK):**
  ```json
  {
    "period": "7d",
    "from": "ISO-date-string",
    "to": "ISO-date-string",
    "users": {
      "total": 140,
      "active_in_period": 19,
      "new_in_period": 124,
      "deleted_in_period": 8,
      "active_users_note": "Non-deleted users with at least one recorded activity event in the selected period."
    },
    "habits": {
      "total": 202,
      "created_in_period": 190
    },
    "completions": {
      "total": 90,
      "in_period": 86
    },
    "reminders": {
      "total": 4
    },
    "sessions": {
      "total_in_period": 150,
      "estimated_avg_duration_seconds": 0,
      "estimated_total_usage_seconds": 54,
      "usage_note": "Estimated. Sessions without heartbeat data contribute 0 seconds. Durations are capped at 120 minutes gap and clipped to period bounds."
    }
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: Authentication missing/expired.
  - `403 Forbidden`: `{ "error": "Forbidden: Admin access required." }`
  - `500 Internal Server Error`: `{ "error": "Failed to fetch dashboard metrics." }`

---

### `GET /admin/users`
List user accounts with pagination, search, role/status filtering, and sorting.

- **HTTP Method:** `GET`
- **Path:** `/admin/users`
- **Authentication:** `requireAuth` + `requireAdmin` (`Bearer <accessToken>`)
- **Query Parameters:**
  - `page` (optional integer, min: 1, default: 1)
  - `limit` (optional integer, min: 1, max: 100, default: 20)
  - `email` (optional string, partial case-insensitive search `ILIKE`)
  - `role` (optional string, enum: `user`, `admin`)
  - `status` (optional string, enum: `active`, `deleted`)
  - `sort` (optional string, enum: `created_at`, `email`, `last_activity`, default: `created_at`)
  - `order` (optional string, enum: `asc`, `desc`, default: `desc`)
- **Request Body:** N/A
- **Successful Response (200 OK):**
  ```json
  {
    "users": [
      {
        "id": "uuid-string",
        "name": "string",
        "email": "string",
        "role": "user | admin",
        "created_at": "ISO-date-string",
        "deleted_at": null,
        "last_login": "ISO-date-string | null",
        "last_activity_at": "ISO-date-string | null",
        "total_habits": 5,
        "total_completions": 24,
        "estimated_usage_seconds": 3600,
        "status": "active | deleted"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 140,
      "totalPages": 7
    }
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: Auth missing/expired.
  - `403 Forbidden`: Forbidden non-admin.
  - `500 Internal Server Error`: `{ "error": "Failed to fetch users list." }`

---

### `GET /admin/users/:userId`
Fetch complete administrative profile, metrics, habit streaks, and recent activity for a specific user.

- **HTTP Method:** `GET`
- **Path:** `/admin/users/:userId`
- **Authentication:** `requireAuth` + `requireAdmin` (`Bearer <accessToken>`)
- **Path Parameters:**
  - `userId` (required UUID string, validated by `validateUuid`)
- **Request Body:** N/A
- **Successful Response (200 OK):**
  ```json
  {
    "user": {
      "id": "uuid-string",
      "name": "string",
      "email": "string",
      "role": "user | admin",
      "timezone": "string",
      "status": "active | deleted",
      "created_at": "ISO-date-string",
      "deleted_at": null,
      "last_login": "ISO-date-string | null",
      "last_activity_at": "ISO-date-string | null",
      "total_habits": 5,
      "total_completions": 20,
      "current_streak_max": 7,
      "best_streak_max": 14,
      "estimated_total_usage_seconds": 7200,
      "estimated_avg_session_seconds": 600,
      "total_sessions": 12,
      "recent_activity": [
        {
          "id": "uuid-string",
          "activity_type": "HABIT_COMPLETED",
          "metadata": { "habit_id": "uuid-string" },
          "created_at": "ISO-date-string"
        }
      ]
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: `{ "error": "Invalid UUID format for userId." }`
  - `401 Unauthorized`: Auth missing/expired.
  - `403 Forbidden`: Non-admin user.
  - `404 Not Found`: `{ "error": "User not found." }`

---

### `GET /admin/activity`
Retrieve paginated audit feed of user activity events.

- **HTTP Method:** `GET`
- **Path:** `/admin/activity`
- **Authentication:** `requireAuth` + `requireAdmin` (`Bearer <accessToken>`)
- **Query Parameters:**
  - `userId` (optional UUID string)
  - `activityType` (optional string, e.g. `LOGIN`, `REGISTER`, `HABIT_CREATED`, `HABIT_COMPLETED`, etc.)
  - `from` (optional ISO timestamp)
  - `to` (optional ISO timestamp)
  - `page` (optional integer, default: 1)
  - `limit` (optional integer, max: 200, default: 50)
- **Request Body:** N/A
- **Successful Response (200 OK):**
  ```json
  {
    "events": [
      {
        "id": "uuid-string",
        "user_id": "uuid-string | null",
        "activity_type": "LOGIN",
        "metadata": null,
        "created_at": "ISO-date-string"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 500,
      "totalPages": 10
    }
  }
  ```
- **Error Responses:**
  - `401 Unauthorized` / `403 Forbidden`
  - `500 Internal Server Error`: `{ "error": "Failed to fetch activity feed." }`

---

### `GET /admin/analytics/usage`
Retrieve session and usage duration analytics formatted for charts and reporting.

- **HTTP Method:** `GET`
- **Path:** `/admin/analytics/usage`
- **Authentication:** `requireAuth` + `requireAdmin` (`Bearer <accessToken>`)
- **Query Parameters:**
  - `period` (optional, `7d`, `30d`, `90d`, `365d`, default: `7d`) OR
  - `from` & `to` (optional ISO date-time strings)
- **Request Body:** N/A
- **Successful Response (200 OK):**
  ```json
  {
    "from": "ISO-date-string",
    "to": "ISO-date-string",
    "usage_note": "Estimated...",
    "summary": {
      "total_sessions": 150,
      "estimated_total_usage_seconds": 18000,
      "estimated_avg_session_seconds": 120,
      "active_users": 19
    },
    "daily": [
      {
        "date": "YYYY-MM-DD",
        "sessions": 25,
        "active_users": 10,
        "estimated_usage_seconds": 3000
      }
    ],
    "most_active_users": [
      {
        "user_id": "uuid-string",
        "email": "user@example.com",
        "session_count": 15,
        "estimated_usage_seconds": 5400
      }
    ]
  }
  ```

---

### `GET /admin/analytics/activity`
Retrieve activity breakdowns grouped by type and date for chart visualizations.

- **HTTP Method:** `GET`
- **Path:** `/admin/analytics/activity`
- **Authentication:** `requireAuth` + `requireAdmin` (`Bearer <accessToken>`)
- **Query Parameters:**
  - `period` (optional, `7d`, `30d`, `90d`, `365d`, default: `7d`) OR
  - `from` & `to` (optional ISO date-time strings)
- **Request Body:** N/A
- **Successful Response (200 OK):**
  ```json
  {
    "from": "ISO-date-string",
    "to": "ISO-date-string",
    "summary": {
      "total_events": 450,
      "by_type": {
        "LOGIN": 120,
        "HABIT_COMPLETED": 280,
        "REGISTER": 50
      }
    },
    "daily": [
      {
        "date": "YYYY-MM-DD",
        "total": 65,
        "by_type": {
          "LOGIN": 20,
          "HABIT_COMPLETED": 45
        }
      }
    ]
  }
  ```

---

## 3. Frontend Integration Guidance

1. **Authentication Flow:**
   - Call `POST /auth/login` with email and password.
   - Extract `accessToken`, `refreshToken`, and `user`. Verify `user.role === 'admin'`.
   - Store tokens in client state or `sessionStorage` / `localStorage`.

2. **API Authorization Header:**
   - Include `Authorization: Bearer <accessToken>` in all requests to `/admin/*` and `/auth/session/heartbeat`.

3. **Session Heartbeat:**
   - Call `POST /auth/session/heartbeat` periodically (e.g. every 60 seconds) with `{ refreshToken }` to keep session activity accurately logged.

4. **Token Refresh (Rotation):**
   - When an API request returns `401 Unauthorized` (Access token expired), call `POST /auth/refresh` with `{ refreshToken }`. Update `accessToken` and `refreshToken` with the new pair.
