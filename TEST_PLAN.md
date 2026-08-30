# HabitUp Backend — API Test Plan

## 1. Overview

This document provides a comprehensive quality assurance test plan for the **HabitUp Backend REST API**. The scope of testing encompasses all authentication, habit lifecycle, schedule configuration, daily completion check-ins, timezone-aware streak calculations, reminder notifications, statistics aggregation, and security rate-limiting endpoints. Testing methodology combines automated integration test scripts built with Node.js `fetch` alongside manual end-to-end verification via interactive Swagger UI documentation and HTTP clients such as Thunder Client or Postman.

---

## 2. Test Environment

- **Local Base URL**: `http://localhost:5000`
- **Production Base URL (Railway)**: `https://habitup-backend-v2-production.up.railway.app`
- **Interactive Swagger UI**: `/api-docs`
- **Test Isolation Policy**: Automated test suites dynamically generate isolated, uniquely timestamped test user accounts (e.g., `testuser_<timestamp>@example.com`) for each execution run, followed by automated database cleanup to prevent test state pollution.

---

## 3. Test Categories

### 3.1 Authentication

| Test Case ID | Description | Preconditions | Steps | Expected Result | Automated Script Reference | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AUTH-01** | Register new user account | Database accessible; unique email | Send `POST /auth/register` with `name`, `email`, `password`, `timezone` | Returns `201 Created` with `accessToken` and user object | `scripts/test-me.js` | Not Yet Run |
| **AUTH-02** | User login with valid credentials | User registered | Send `POST /auth/login` with registered `email` and `password` | Returns `200 OK` with `accessToken`, `refreshToken`, and user object | `scripts/test-me.js` | Not Yet Run |
| **AUTH-03** | Fetch authenticated user profile (`/auth/me`) | User logged in with access token | Send `GET /auth/me` with `Authorization: Bearer <accessToken>` | Returns `200 OK` with user profile details | `scripts/test-me.js` | Not Yet Run |
| **AUTH-04** | Refresh token rotation | Active `refreshToken` available | Send `POST /auth/refresh` with valid `refreshToken` | Returns `200 OK` with a *new* `accessToken` and a *new* `refreshToken` | `scripts/test-me.js` | Not Yet Run |
| **AUTH-05** | Single session logout | Active `refreshToken` available | Send `POST /auth/logout` with `refreshToken` | Returns `200 OK` message; `refreshToken` revoked in database | `scripts/test-me.js` | Not Yet Run |
| **AUTH-06** | Logout from all sessions | User logged in on multiple sessions | Send `POST /auth/logout-all` with `Authorization: Bearer <accessToken>` | Returns `200 OK`; all active refresh tokens for the user revoked | `scripts/test-me.js` | Not Yet Run |
| **AUTH-07** | Request password reset token | User registered | Send `POST /auth/reset-password/request` with `email` | Returns `200 OK` generic message; generates reset token in database | `scripts/test-reset-password.js` | Not Yet Run |
| **AUTH-08** | Confirm password reset | Valid reset token generated | Send `POST /auth/reset-password/confirm` with `token` and `newPassword` | Returns `200 OK`; updates password hash, invalidates token & revokes active sessions | `scripts/test-reset-password.js` | Not Yet Run |

---

### 3.2 Habits CRUD

| Test Case ID | Description | Preconditions | Steps | Expected Result | Automated Script Reference | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **HAB-01** | Create a daily habit | User authenticated | Send `POST /habits` with `name`, `frequency_type: "daily"` | Returns `201 Created` with habit ID and default properties | `scripts/test-pause-archive.js` | Not Yet Run |
| **HAB-02** | List active habits | User authenticated with 1+ habits | Send `GET /habits` | Returns `200 OK` with array of active habits (excluding archived & soft-deleted) | `scripts/test-pause-archive.js` | Not Yet Run |
| **HAB-03** | Fetch habit by ID | Active habit exists | Send `GET /habits/:id` | Returns `200 OK` with detailed habit object including schedule and streak data | `scripts/test-pause-archive.js` | Not Yet Run |
| **HAB-04** | Update habit metadata | Active habit exists | Send `PATCH /habits/:id` with updated `name`, `description`, `color`, `icon` | Returns `200 OK` with updated habit fields | `scripts/test-pause-archive.js` | Not Yet Run |
| **HAB-05** | Soft-delete a habit | Active habit exists | Send `DELETE /habits/:id` | Returns `200 OK`; sets `deleted_at` timestamp; habit omitted from standard list calls | `scripts/test-pause-archive.js` | Not Yet Run |

---

### 3.3 Cross-User Security & Isolation

| Test Case ID | Description | Preconditions | Steps | Expected Result | Automated Script Reference | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Prevent access to another user's habit | Two distinct users registered (User A, User B); User A created Habit 1 | User B sends `GET /habits/<Habit1_ID>` with User B's token | Returns `404 Not Found` (prevents resource existence disclosure / data leakage) | `scripts/test-pause-archive.js` | Not Yet Run |
| **SEC-02** | Prevent updating another user's habit | User A created Habit 1 | User B sends `PATCH /habits/<Habit1_ID>` with User B's token | Returns `404 Not Found`; Habit 1 remains unmodified | `scripts/test-pause-archive.js` | Not Yet Run |
| **SEC-03** | Prevent deleting another user's habit | User A created Habit 1 | User B sends `DELETE /habits/<Habit1_ID>` with User B's token | Returns `404 Not Found`; Habit 1 is not deleted | `scripts/test-pause-archive.js` | Not Yet Run |
| **SEC-04** | Prevent recording completions on another user's habit | User A created Habit 1 | User B sends `POST /habits/<Habit1_ID>/completions` with User B's token | Returns `404 Not Found`; no completion record created | `scripts/test-completions.js` | Not Yet Run |

---

### 3.4 Habit Schedules

| Test Case ID | Description | Preconditions | Steps | Expected Result | Automated Script Reference | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SCH-01** | Create scheduled habit with custom days | User authenticated | Send `POST /habits` with `frequency_type: "scheduled"` and `days: [1, 3, 5]` (Mon, Wed, Fri) | Returns `201 Created` with habit and associated habit schedule days | `scripts/test-schedules.js` | Not Yet Run |
| **SCH-02** | Update scheduled days (replace behavior) | Scheduled habit exists with `days: [1, 3, 5]` | Send `PATCH /habits/:id` with `frequency_type: "scheduled"` and `days: [0, 2, 4]` (Sun, Tue, Thu) | Returns `200 OK`; schedule records are *replaced*, not appended (old days removed) | `scripts/test-schedules.js` | Not Yet Run |
| **SCH-03** | Transition habit from scheduled to daily | Scheduled habit exists | Send `PATCH /habits/:id` with `frequency_type: "daily"` | Returns `200 OK`; schedule table entries deleted for habit | `scripts/test-schedules.js` | Not Yet Run |

---

### 3.5 Completions & Streaks

| Test Case ID | Description | Preconditions | Steps | Expected Result | Automated Script Reference | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CMP-01** | Record daily completion | Active habit exists | Send `POST /habits/:id/completions` | Returns `201 Created` with completion record for today in user's timezone & recalculated streak | `scripts/test-completions.js` | Not Yet Run |
| **CMP-02** | Completion idempotency check | Completion already recorded for today | Send `POST /habits/:id/completions` a second time for same date | Returns `201 Created` or `200 OK` gracefully; duplicate database row prevented | `scripts/test-completions.js` | Not Yet Run |
| **CMP-03** | Remove completion (undo check-in) | Completion recorded for date `YYYY-MM-DD` | Send `DELETE /habits/:id/completions/YYYY-MM-DD` | Returns `200 OK`; completion row deleted; streak recalculated downwards | `scripts/test-completions.js` | Not Yet Run |
| **STR-01** | Daily habit streak calculation | Daily habit with consecutive check-ins | Record check-ins for 3 consecutive days | Current streak evaluates to `3`; longest streak evaluates to `3` | `scripts/test-completions.js` | Not Yet Run |
| **STR-02** | Daily habit streak reset on missed day | Daily habit with 3-day streak | Skip check-in for 1 day, then query habit stats | Current streak resets to `0` (or `1` if completed today); longest streak remains `3` | `scripts/test-completions.js` | Not Yet Run |
| **STR-03** | Scheduled habit streak evaluation | Scheduled habit active on Mon (1) and Wed (3) | Record completions on Mon and Wed; non-scheduled Tue is uncompleted | Current streak continues across non-scheduled days without resetting | `scripts/test-schedules.js` | Not Yet Run |
| **STR-04** | Timezone boundary verification | User registered in timezone `Asia/Kolkata` (UTC+5:30) | Perform completion near UTC midnight boundary | Completion `completed_on` date correctly matches local user date | `scripts/test-completions.js` | Not Yet Run |

---

### 3.6 Pause/Archive Lifecycle

| Test Case ID | Description | Preconditions | Steps | Expected Result | Automated Script Reference | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **LIFE-01** | Pause an active habit | Active habit exists | Send `PATCH /habits/:id/pause` | Returns `200 OK`; `paused_at` timestamp set; habit marked paused | `scripts/test-pause-archive.js` | Not Yet Run |
| **LIFE-02** | Unpause a paused habit | Paused habit exists | Send `PATCH /habits/:id/unpause` | Returns `200 OK`; `paused_at` cleared to `NULL` | `scripts/test-pause-archive.js` | Not Yet Run |
| **LIFE-03** | Archive a habit | Active or paused habit exists | Send `PATCH /habits/:id/archive` | Returns `200 OK`; `archived_at` timestamp set; habit excluded from `GET /habits` | `scripts/test-pause-archive.js` | Not Yet Run |
| **LIFE-04** | List archived habits | Archived habit exists | Send `GET /habits/archived` | Returns `200 OK` containing list of archived habits | `scripts/test-pause-archive.js` | Not Yet Run |
| **LIFE-05** | Unarchive a habit | Archived habit exists | Send `PATCH /habits/:id/unarchive` | Returns `200 OK`; `archived_at` cleared to `NULL`; habit re-appears in active list | `scripts/test-pause-archive.js` | Not Yet Run |

---

### 3.7 Reminders CRUD

| Test Case ID | Description | Preconditions | Steps | Expected Result | Automated Script Reference | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REM-01** | Create habit reminder | Active habit exists | Send `POST /reminders/habits/:habitId/reminders` with `time: "08:00"` | Returns `201 Created` with reminder object | `scripts/test-reminders.js` | Not Yet Run |
| **REM-02** | List reminders for a habit | Reminder created for habit | Send `GET /reminders/habits/:habitId/reminders` | Returns `200 OK` with array of reminders for the habit | `scripts/test-reminders.js` | Not Yet Run |
| **REM-03** | Update reminder time and enabled state | Reminder exists | Send `PATCH /reminders/:id` with `time: "09:30"`, `enabled: false` | Returns `200 OK` with updated reminder properties | `scripts/test-reminders.js` | Not Yet Run |
| **REM-04** | Delete reminder | Reminder exists | Send `DELETE /reminders/:id` | Returns `200 OK`; reminder removed from database | `scripts/test-reminders.js` | Not Yet Run |
| **REM-05** | Cross-user reminder security | User A owns Reminder 1 | User B sends `PATCH /reminders/<Reminder1_ID>` | Returns `404 Not Found`; reminder remains unchanged | `scripts/test-reminders.js` | Not Yet Run |

---

### 3.8 Statistics

| Test Case ID | Description | Preconditions | Steps | Expected Result | Automated Script Reference | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **STAT-01** | Per-habit statistics retrieval | Habit with completion history exists | Send `GET /habits/:id/stats?period=month` | Returns `200 OK` with `completion_rate`, `total_completions`, `current_streak`, `longest_streak` | `scripts/test-stats.js` | Not Yet Run |
| **STAT-02** | User aggregate statistics | User has multiple habits with completions | Send `GET /habits/stats?period=month` (or `GET /stats`) | Returns `200 OK` with aggregate completion rate, active habit count, and overall streaks | `scripts/test-stats.js` | Not Yet Run |

---

### 3.9 Rate Limiting

| Test Case ID | Description | Preconditions | Steps | Expected Result | Automated Script Reference | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RAT-01** | Auth endpoint rate limit threshold | Server running | Execute 10 rapid invalid login requests from single IP | First 10 requests return `401 Unauthorized` | `scripts/test-rate-limit.js` | Not Yet Run |
| **RAT-02** | Rate limit blocking (11th request) | 10 rapid login attempts performed | Send 11th login attempt from same IP within window | Returns `429 Too Many Requests` with JSON body `{ "error": "Too many attempts. Please try again in 15 minutes." }` | `scripts/test-rate-limit.js` | Not Yet Run |
| **RAT-03** | Password reset request rate limit | Server running | Execute 3 password reset requests from single IP | 4th attempt returns `429 Too Many Requests` | `scripts/test-rate-limit.js` | Not Yet Run |

---

## 4. Edge Cases & Negative Testing

| Test Case ID | Scenario | Preconditions / Input | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **NEG-01** | Missing required registration fields | Missing `email` or `password` in body | Send `POST /auth/register` | Returns `400 Bad Request` with error message | Not Yet Run |
| **NEG-02** | Duplicate email registration | Email already registered | Send `POST /auth/register` with duplicate email | Returns `409 Conflict` (`Email already registered`) | Not Yet Run |
| **NEG-03** | Invalid login credentials | Incorrect password provided | Send `POST /auth/login` with wrong password | Returns `401 Unauthorized` (`Invalid email or password`) | Not Yet Run |
| **NEG-04** | Expired / Malformed access token | Invalid JWT header string | Send `GET /habits` with `Authorization: Bearer invalid.jwt.string` | Returns `401 Unauthorized` | Not Yet Run |
| **NEG-05** | Reusing a rotated refresh token | Refresh token already rotated in prior call | Send `POST /auth/refresh` with old refresh token | Returns `401 Unauthorized` | Not Yet Run |
| **NEG-06** | Reusing a used password reset token | Reset token already consumed | Send `POST /auth/reset-password/confirm` with consumed token | Returns `400 Bad Request` (`Invalid or expired reset token`) | Not Yet Run |
| **NEG-07** | Invalid UUID format in path parameter | Malformed string `not-a-uuid` | Send `GET /habits/not-a-uuid` | Returns `400 Bad Request` with `{ "error": "Invalid ID format." }` via UUID validation middleware | Not Yet Run |
| **NEG-08** | Accessing soft-deleted habit | Habit soft-deleted (`deleted_at` set) | Send `GET /habits/:id` for soft-deleted ID | Returns `404 Not Found` | Not Yet Run |

---

## 5. Existing Automated Test Script Coverage

The table below maps the automated test scripts located in the `scripts/` directory to their corresponding functional test categories:

| Script Path | Description & Test Category Coverage | Corresponding Test IDs |
| :--- | :--- | :--- |
| `scripts/test-me.js` | Tests user profile retrieval (`GET /auth/me`), token rotation, login, logout, and session invalidation | `AUTH-01` to `AUTH-06` |
| `scripts/test-reset-password.js` | End-to-end testing of password reset token request generation and token confirmation | `AUTH-07`, `AUTH-08`, `NEG-06` |
| `scripts/test-rate-limit.js` | Verifies rate limiting enforcement (401 on first 10 requests, 429 on 11th request) | `RAT-01`, `RAT-02`, `RAT-03` |
| `scripts/test-invalid-uuid.js` | Verifies malformed UUID path parameter validation middleware returning 400 Bad Request | `NEG-07` |
| `scripts/test-pause-archive.js` | Verifies habit creation, detail retrieval, updates, pause/unpause, archive/unarchive, and soft-delete | `HAB-01` to `HAB-05`, `LIFE-01` to `LIFE-05`, `SEC-01` to `SEC-03` |
| `scripts/test-schedules.js` | Verifies scheduled habit creation, day array replacements, and scheduled streak logic | `SCH-01` to `SCH-03`, `STR-03` |
| `scripts/test-completions.js` | End-to-end testing of daily completions, idempotency, completion removal, and streak engine calculations | `CMP-01` to `CMP-03`, `STR-01`, `STR-02`, `STR-04`, `SEC-04` |
| `scripts/test-reminders.js` | Tests reminder creation, listing, updating time/enabled state, deletion, and cross-user isolation | `REM-01` to `REM-05` |
| `scripts/test-stats.js` | Tests per-habit and user aggregate statistics calculation accuracy | `STAT-01`, `STAT-02` |
| `scripts/test-email-delivery.js` | Tests SMTP transport email dispatching functionality | `AUTH-07` (email delivery path) |
| `scripts/cleanup-test-data.js` | Utility script to purge test accounts and associated database records | Test Environment Maintenance |

---

## 6. Known Limitations & Out of Scope

1. **Load and Concurrency Testing**: Performance stress testing, high-concurrency connection handling, and database connection pool exhaustion testing under load have not been performed in this suite and are out of scope.
2. **Email Delivery Provider Caveats**: Automated email delivery testing via Nodemailer with Gmail SMTP is subject to Google's internal spam and rate-filtering mechanisms. Email delivery to recipient addresses hosted on Gmail can experience intermittent delays or filtering, whereas delivery to non-Gmail domains (Outlook, Yahoo, custom domains) operates reliably.
