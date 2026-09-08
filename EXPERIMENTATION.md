# HabitUp A/B Experimentation Framework

A production-grade, generic randomized A/B experimentation system built for HabitUp.

---

## 1. Architectural Overview

The experimentation framework enables randomized, backend-controlled A/B experiments across HabitUp. The initial experiment deployed is `friends_feature_v1`, evaluating the impact of the **Friends Feature** on user retention (D1 and D7) and habit engagement.

```
                  ┌──────────────────────────────┐
                  │      Client Application      │
                  └──────────────┬───────────────┘
                                 │
                 1. GET /experiments/:name (Variant assignment)
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │    experimentService.js      │
                  │  (Deterministic Assignment)  │
                  └──────────────┬───────────────┘
                                 │
                      ┌──────────┴──────────┐
                      ▼                     ▼
               Variant A (Control)   Variant B (Treatment)
               - friendsEnabled: false - friendsEnabled: true
                      │                     │
                      │             2. User navigates to feature
                      │             3. POST /experiments/:name/exposure
                      │                     │
                      ▼                     ▼
               ┌─────────────┐       ┌─────────────┐
               │ 403 Blocked │       │ 200 Granted │
               │ Friends API │       │ Friends API │
               └─────────────┘       └─────────────┘
```

---

## 2. Core Principles & Design Decisions

### A. Generic & Reusable
- The system uses generic `experiments` and `user_experiments` tables.
- Any future experiment (e.g., `new_onboarding_v1`, `gamification_v2`) can be added simply by inserting a record into `experiments` with custom variant configurations and allocation percentages in JSONB.

### B. Assignment vs. Exposure Separation
- **Assignment**: Determined once per user when the client queries `GET /experiments/:name`. Deterministic, stored in `user_experiments`, and stable forever.
- **Exposure**: Logged ONLY when the user is actually exposed to the experiment UI/treatment via `POST /experiments/:name/exposure`. Querying the variant does **NOT** log an exposure event.

### C. Database as Source of Truth
- Variant ratios, start dates, end dates, and experiment status (`RUNNING`, `PAUSED`, `CONCLUDED`, `DRAFT`) are loaded directly from the database—never hardcoded in application logic.

### D. User Eligibility & Pre-existing User Handling
- Users who registered **before** `experiment.start_at` are classified as **Pre-existing Users** (`preExisting: true`).
- Pre-existing users are **not randomized** and retain full access to existing features (`friendsEnabled: true`).
- Only users registering **at or after** `experiment.start_at` are randomized into Variant A (Control) or Variant B (Treatment).

### E. Exact Retention Windows (D1 & D7)
Rather than loose "any activity in the first 7 days" heuristics, retention is evaluated on precise calendar windows relative to user registration time ($T_0 = \text{user.created\_at}$):
- **Day 1 Retention ($D_1$)**: Has activity in the window $[T_0 + 24\text{h}, T_0 + 48\text{h})$.
- **Day 7 Retention ($D_7$)**: Has activity in the window $[T_0 + 168\text{h}, T_0 + 192\text{h})$.
- **Eligibility**: A user is only eligible for $D_1$ analysis if $T_0 + 48\text{h} \le \text{NOW()}$, and for $D_7$ analysis if $T_0 + 192\text{h} \le \text{NOW()}$.

### F. Definition of "Active User"
A user is counted as active within a retention window if they perform at least one meaningful action:
- Any event in `user_activity` (e.g., `HABIT_CREATED`, `HABIT_COMPLETED`, `FRIEND_REQUEST_SENT`), **OR**
- Any recorded completion in `habit_completions`.
- Passive session heartbeats without actions are excluded to prevent artificial inflation.

---

## 3. Database Schema

### `experiments` Table

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique identifier |
| `name` | `VARCHAR(100)` | `UNIQUE, NOT NULL` | System name (e.g. `friends_feature_v1`) |
| `description` | `TEXT` | `NULLABLE` | Human-readable explanation |
| `status` | `VARCHAR(20)` | `NOT NULL, DEFAULT 'DRAFT'` | `DRAFT`, `RUNNING`, `PAUSED`, `CONCLUDED` |
| `variants` | `JSONB` | `NOT NULL` | List of variant names, e.g. `["A", "B"]` |
| `allocation` | `JSONB` | `NOT NULL` | Allocation ratio, e.g. `{"A": 0.50, "B": 0.50}` |
| `start_at` | `TIMESTAMPTZ` | `NULLABLE` | Experiment launch timestamp |
| `end_at` | `TIMESTAMPTZ` | `NULLABLE` | Experiment conclusion timestamp |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Record update timestamp |

### `user_experiments` Table

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique identifier |
| `user_id` | `UUID` | `NOT NULL, REFERENCES users(id) ON DELETE CASCADE` | Assigned user |
| `experiment_id` | `UUID` | `NOT NULL, REFERENCES experiments(id) ON DELETE CASCADE` | Assigned experiment |
| `variant` | `VARCHAR(50)` | `NOT NULL` | Assigned variant (`A`, `B`, etc.) |
| `assigned_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Assignment timestamp |

*Constraint:* `UNIQUE(user_id, experiment_id)` guarantees idempotent, stable 1:1 user assignment per experiment.

---

## 4. Statistical Engine

Statistical significance is calculated using a **Two-Proportion Z-Test** with a standard significance level $\alpha = 0.05$ ($Z_{\text{crit}} = 1.96$ for a two-tailed test):

### Formulas
1. **Pooled Proportion ($P$)**:
   $$P = \frac{X_A + X_B}{N_A + N_B}$$
2. **Standard Error ($SE$)**:
   $$SE = \sqrt{P(1 - P)\left(\frac{1}{N_A} + \frac{1}{N_B}\right)}$$
3. **Z-Score**:
   $$Z = \frac{\hat{p}_B - \hat{p}_A}{SE}$$
4. **P-Value** (computed via standard error function $\text{erf}$ approximation):
   $$p = 2 \times (1 - \Phi(|Z|))$$
5. **Confidence Interval for Difference ($\hat{p}_B - \hat{p}_A$)**:
   $$(\hat{p}_B - \hat{p}_A) \pm 1.96 \times \sqrt{\frac{\hat{p}_A(1-\hat{p}_A)}{N_A} + \frac{\hat{p}_B(1-\hat{p}_B)}{N_B}}$$

### Safeguards & Statistical Sufficiency (Success-Failure Condition)
- **Minimum sample size**: Both groups must have $n \ge 5$ eligible users.
- **Success-Failure condition**: For the normal approximation to the binomial distribution to hold in the two-proportion Z-test, the expected counts of both successes and failures under the pooled proportion ($P$) must be at least 5 in both groups:
  $$n_A P \ge 5, \quad n_A (1 - P) \ge 5, \quad n_B P \ge 5, \quad n_B (1 - P) \ge 5$$
- When these conditions are not satisfied (e.g. zero conversions, small sample sizes, extreme imbalance), the statistical report sets `hasSufficientData: false` and `significant: false` with an explanatory verdict.

---

## 5. API Reference

### Client Endpoints

#### `GET /experiments/:name`
Retrieves or assigns the user's experiment variant. Requires `Bearer` token.
- **Response**:
```json
{
  "experiment": "friends_feature_v1",
  "variant": "B",
  "friendsEnabled": true,
  "assigned": true,
  "preExisting": false
}
```

#### `POST /experiments/:name/exposure`
Logs an explicit exposure beacon when the user views the experiment feature.
- **Response**:
```json
{
  "message": "Exposure recorded",
  "experiment": "friends_feature_v1",
  "variant": "B"
}
```

### Admin Endpoints

#### `GET /admin/experiments`
Lists all experiments and their statuses. Requires `admin` role.

#### `GET /admin/experiments/:name`
Retrieves comprehensive analytics, retention metrics, and statistical significance tests.
- **Key Metrics Returned**:
  - Sample sizes ($N_A$, $N_B$) and exposed counts.
  - D1 & D7 retention rates with $Z$-score, $p$-value, relative lift, and 95% CI.
  - Habit completions per user (means, standard deviations).
  - Friends feature engagement metrics (requests sent, friendships formed).
  - Summary verdict: `TREATMENT_WINNER`, `CONTROL_WINNER`, `NO_DIFFERENCE`, or `INSUFFICIENT_DATA`.

---

## 6. Testing

The suite is located in `tests/experiments.test.js` and tests all aspects:
1. Endpoint authentication and error handling.
2. Variant assignment idempotency and stability.
3. Strict separation of assignment vs. exposure.
4. Friends API 403 feature gating for Control (Variant A).
5. Automatic activity logging (`FRIEND_REQUEST_SENT`, `FRIEND_REQUEST_ACCEPTED`, `FRIEND_REMOVED`).
6. Pre-existing user eligibility preservation.
7. Allocation distribution validation.
8. Two-proportion Z-test statistical calculation engine edge cases.

To run the experiment test suite:
```bash
node --test tests/experiments.test.js
```
