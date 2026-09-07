# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary Users**: Individuals striving to build daily consistency, break bad habits, and maintain positive routines through peer accountability and streak tracking.
- **Administrators**: Platform operators monitoring user growth, engagement trends, session usage durations, and system audit logs.

## Product Purpose

HabitUp is a habit-formation and social accountability platform designed to make personal consistency sustainable. Success means users consistently complete their scheduled habits, celebrate milestones with friends, and stay accountable through verifiable streak data.

## Positioning

Unlike isolated, solo habit trackers, HabitUp combines rigorous streak calculation, customizable schedules, and peer accountability (friend requests, public habit sharing, mutual streaks) with enterprise-grade administrative activity tracking.

## Operating Context

- **Daily Check-ins**: Users log in on desktop or mobile web/app to check off daily habit occurrences and receive reminder notifications.
- **Social Accountability**: Users connect via unique `@username` handles to view friends' public habits and streak status.
- **Admin Control**: Operators access the dedicated administration dashboard (`/admin-dashboard`) to inspect metrics, audit activity trails, and analyze platform engagement.

## Capabilities and Constraints

- **Habit Scheduling**: Daily, weekly, and custom frequency schedules with timezone-aware streak tracking.
- **Session & Audit Tracking**: Live heartbeat pings, session duration estimations, and granular event logs (`LOGIN`, `REGISTER`, `HABIT_CREATED`, `HABIT_COMPLETED`, `HABIT_UPDATED`, `HABIT_DELETED`).
- **Administrative Portal**: Secure role-based dashboard for user management, metric visualization, and audit feeds.
- **Integrity Constraints**: Production backend with strict authentication, password hashing, and token rotation.

## Brand Commitments

- **Tone & Voice**: Motivating, clear, reliable, and privacy-conscious.
- **Visual Aesthetic**: Modern SaaS with subtle Soft Neumorphism + Light Glassmorphism, crisp typography (`Plus Jakarta Sans`), and calm blue-gray palette.

## Evidence on Hand

- Backend API with Swagger documentation (`/api-docs`).
- Full PostgreSQL database schema with migrations for users, habits, schedules, completions, sessions, reminders, friendships, and activity audit logs.
- React-based Vite administrative dashboard (`habitup-admin`).

## Product Principles

1. **Accountability Drives Consistency**: Social visibility and shared streaks encourage regular follow-through over solitary tracking.
2. **Precision Over Guesswork**: Accurate timezones, completion timestamps, and audit records build trust in streak metrics.
3. **Clarity and Focus**: The interface prioritizes effortless check-ins, readable metrics, and distraction-free operation.
4. **Administrative Transparency**: Operators have clear, real-time visibility into platform health, user activity, and engagement without compromising security.

## Accessibility & Inclusion

- Adherence to WCAG AA contrast guidelines across text and interactive components.
- Responsive accessibility across desktop, tablet, and mobile devices.
- Standardized tabular numbers for financial, streak, timestamp, and duration readability.
