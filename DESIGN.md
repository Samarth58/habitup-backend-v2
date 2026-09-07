---
name: HabitUp Design System
description: Soft Neumorphic & Light Glass administrative interface for HabitUp
colors:
  primary: "#4f46e5"
  primary-hover: "#4338ca"
  primary-light: "rgba(79, 70, 229, 0.08)"
  secondary: "#0284c7"
  secondary-light: "rgba(2, 132, 199, 0.08)"
  success: "#059669"
  success-light: "rgba(5, 150, 105, 0.09)"
  warning: "#d97706"
  warning-light: "rgba(217, 119, 6, 0.09)"
  danger: "#e11d48"
  danger-light: "rgba(225, 29, 72, 0.09)"
  neutral-bg: "#f1f5f9"
  neutral-card: "rgba(255, 255, 255, 0.84)"
  neutral-input: "#f8fafc"
  text-main: "#0f172a"
  text-secondary: "#334155"
  text-muted: "#64748b"
  text-dim: "#94a3b8"
  border-glass: "rgba(255, 255, 255, 0.85)"
  border-subtle: "rgba(226, 232, 240, 0.8)"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "2.1rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.7px"
  headline:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.38rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.4px"
  title:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.08rem"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "-0.2px"
  body:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.6px"
rounded:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "13px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-action:
    backgroundColor: "#ffffff"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  card-glass:
    backgroundColor: "{colors.neutral-card}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input-search:
    backgroundColor: "{colors.neutral-input}"
    textColor: "{colors.text-main}"
    rounded: "{rounded.md}"
    padding: "9px 15px"
  chip-badge:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary}"
    rounded: "{rounded.xs}"
    padding: "4px 10px"
---

# Design System: HabitUp Admin

## Overview

**Creative North Star: "The Calibrated Command Center"**

HabitUp Admin is an operational platform interface designed for high-density administrative clarity. It bridges soft neumorphic tactile physics with frosted light glassmorphism to present complex habit check-in volumes, longitudinal session durations, and user activity audit trails with effortless scanability.

The visual atmosphere balances a calm slate-blue canvas (`#f1f5f9`) with layered semi-transparent glass cards (`rgba(255, 255, 255, 0.84)`) that use 14px backdrop blur and crisp 1px specular highlight borders (`rgba(255, 255, 255, 0.85)`). Heavy ambient shadows, noisy neon gradients, and disruptive micro-animations are deliberately avoided in favor of functional depth, precise geometry, and unwavering visual hierarchy.

**Key Characteristics:**
- **Calm, High-Contrast Palette**: Slate neutrals (`#0f172a`, `#334155`, `#64748b`) paired with purposeful semantic accents.
- **Dual Neumorphic Physics**: Elevated surface cards above the canvas, with tactile inset wells for metric data containers and search inputs.
- **Tabular Precision**: Standardized `font-variant-numeric: tabular-nums` across all timestamps, streak counters, check-in totals, and financial/audit data.
- **Operational Focus**: Sticky frosted table headers, clear interactive states, and WCAG AA contrast.

## Colors

The palette uses a calm, light blue-gray foundation with an Indigo primary accent and semantic status indicators.

### Primary
- **Indigo 600** (`#4f46e5`): Primary interactive brand color; used for active navigation pills, primary actions, and primary KPI indicators.
- **Indigo 700** (`#4338ca`): Pressed and hover states for primary buttons.
- **Indigo Subdued** (`rgba(79, 70, 229, 0.08)`): Subtle background fill for badges, active states, and focus rings.

### Secondary
- **Sky 600** (`#0284c7`): Secondary metric highlights, streak best records, and informational status chips.
- **Sky Subdued** (`rgba(2, 132, 199, 0.08)`): Info chip background.

### Tertiary
- **Emerald 600** (`#059669`): Success indicators, habit completion records, and live heartbeat status.
- **Amber 600** (`#d97706`): Warnings, streak tracking highlights, and leaderboard rank accents.
- **Rose 600** (`#e11d48`): Danger states, account deletions, and sign-out controls.

### Neutral
- **Canvas Base** (`#f1f5f9`): High-calm background with subtle radial gradient lighting.
- **Frosted Glass Surface** (`rgba(255, 255, 255, 0.84)`): Translucent card containers with 14px backdrop blur.
- **Slate 900** (`#0f172a`): Dominant text color for headings, metric values, and primary labels.
- **Slate 700** (`#334155`): Secondary body copy and table cell contents.
- **Slate 500** (`#64748b`): Subtitles, helper text, and table header labels.
- **Slate 400** (`#94a3b8`): Inactive placeholders and divider timestamps.

### Named Rules
**The Rarity of Red Rule.** Rose/red accents (`#e11d48`) are reserved exclusively for irreversible destructive actions and critical error notices.
**The High-Contrast Text Rule.** All text layers must achieve a minimum 4.5:1 contrast ratio against their immediate background surface.

## Typography

**Display & Body Font:** `Plus Jakarta Sans` (with system fallbacks `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`)
**Monospace Font:** `JetBrains Mono` (with fallbacks `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`)

**Character:** Modern geometric sans-serif with high x-height, open apertures, and crisp letterforms designed for high legibility at dense administrative scales.

### Hierarchy
- **Display** (800, `2.1rem`, line-height `1.1`, letter-spacing `-0.7px`): Primary numerical metric figures inside KPI cards.
- **Headline** (800, `1.38rem`, line-height `1.25`, letter-spacing `-0.4px`): Main toolbar page titles and login header.
- **Title** (800, `1.08rem`, line-height `1.3`, letter-spacing `-0.2px`): Card section titles and chart headers.
- **Body** (500/600, `0.88rem`, line-height `1.5`): Table cell data, modal details, and descriptive copy.
- **Label** (700, `0.72rem`, line-height `1.2`, uppercase, letter-spacing `0.6px`): Table column headers, KPI titles, and status badge text.

### Named Rules
**The Tabular Number Rule.** All timestamps, duration calculations, habit counts, and streak numbers must render with `tabular-nums` to ensure zero jitter and perfect vertical column alignment.

## Layout

- **Spatial Model**: Fixed sticky sidebar (`260px` default, `80px` collapsed) paired with a responsive fluid content container (`max-width: 1560px`, centered with `2rem 2.25rem` padding).
- **Grid Systems**:
  - Top KPI cards: Auto-fit responsive grid (`grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))`, `gap: 1.25rem`).
  - Analytics & Charts: Multi-column grid (`repeat(auto-fit, minmax(360px, 1fr))`, `gap: 1.5rem`).
  - Modal Metric Tiles: Dense responsive grid (`repeat(auto-fit, minmax(130px, 1fr))`, `gap: 0.85rem`).
- **Responsive Breakpoints**:
  - Desktop (>1024px): Full sidebar expanded, multi-column grid cards.
  - Tablet (768px–1024px): Padding scales to `1.5rem`, KPI cards reflow to `minmax(200px, 1fr)`.
  - Mobile (<768px): Sidebar collapses into off-canvas drawer (`-280px` transform), toolbars stack vertically, full-width inputs.

## Elevation & Depth

HabitUp Admin combines layered frosted glass surfaces with dual soft neumorphic lighting to produce tactile depth without visual clutter.

### Shadow Vocabulary
- **Card Ambient** (`0 1px 3px rgba(15, 23, 42, 0.04), 0 6px 16px rgba(15, 23, 42, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.9)`): Default resting elevation for glass cards and table containers.
- **Card Hover** (`0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 12px 24px -2px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 1)`): Interactive elevated lift on card hover.
- **Button Raised** (`0 1px 2px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)`): Subtle resting button lift.
- **Inset Well** (`inset 1.5px 1.5px 3px rgba(148, 163, 184, 0.18), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.95)`): Tactile recessed shadow for search inputs, select dropdowns, and data metric tiles.
- **Modal Dialog** (`0 25px 50px -12px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.9)`): High-focus dialog elevation above the blurred backdrop.

### Named Rules
**The Recessed Data Rule.** Inputs, search fields, and metric calculation tiles are styled as recessed inset wells (`neu-inset-tile`), while interactive cards and action triggers remain elevated above the canvas.

## Shapes

- **Corner Language**:
  - Sub-elements & badges: `6px` radius (`--radius-xs`).
  - Action buttons & inputs: `8px` to `12px` radius (`--radius-sm` / `--radius-md`).
  - Cards & table containers: `16px` radius (`--radius-lg`).
  - Dialog modals & login card: `20px` radius (`--radius-xl`).
- **Border Treatment**: 1px crisp specular highlights (`rgba(255, 255, 255, 0.85)`) on frosted cards and subtle borders (`rgba(226, 232, 240, 0.8)`) on tables and inputs.

## Components

### Buttons
- **Shape**: Soft rectangular with `12px` radius (`--radius-md`).
- **Primary**: Solid Indigo (`#4f46e5`), white bold text, `0 4px 12px rgba(79, 70, 229, 0.35)` shadow, `13px 20px` padding.
- **Action/Secondary**: White solid base, Indigo text (`#4f46e5`), `8px` radius (`--radius-sm`), `6px 12px` padding.
- **Hover/Focus**: `transform: translateY(-1px)`, amplified glow, accessible `2px solid var(--accent-primary)` focus ring with `2px` offset.

### Chips & Badges
- **Style**: Pill tags with `6px` radius (`--radius-xs`), bold uppercase tracking (`0.72rem`, `letter-spacing: 0.2px`), semantic light background with 20% border stroke.

### Cards & Containers
- **Corner Style**: `16px` radius (`--radius-lg`).
- **Background**: Translucent frosted glass (`rgba(255, 255, 255, 0.84)`), `14px` blur.
- **Shadow**: Resting dual-shadow with top inner highlight.
- **Internal Padding**: `1.4rem` to `1.5rem`.

### Inputs & Selects
- **Style**: Inset recessed well (`#f8fafc`), `1px` subtle stroke (`rgba(226, 232, 240, 0.85)`), `12px` radius (`--radius-md`), `9px 15px` padding.
- **Focus**: Transitions to pure white (`#ffffff`), Indigo border (`#4f46e5`), and `0 0 0 3px rgba(79, 70, 229, 0.12)`.

### Navigation
- **Sidebar**: Frosted vertical surface (`260px` width), active item highlighted with solid white tile, left Indigo accent bar (`3.5px` width), and bold typography.
- **Header**: Sticky horizontal frosted glass (`68px` height), live session heartbeat indicator with pulsating green dot, and user avatar badge.

### Signature Component: Live Heartbeat Indicator
- **Description**: Real-time session monitoring badge displaying a pulsating emerald beacon (`#059669`) alongside the formatted session timestamp in tabular numerals.

## Do's and Don'ts

### Do:
- **Do** use `tabular-nums` on all streak numbers, time durations, dates, and metrics.
- **Do** wrap data calculation metrics and search inputs in tactile inset wells (`neu-inset-tile`).
- **Do** preserve the sticky frosted table header (`backdrop-filter: blur(14px)`) so column headers remain visible during scroll.
- **Do** use monospace formatting (`JetBrains Mono`) for raw UUIDs and metadata JSON context.
- **Do** maintain WCAG AA contrast (minimum 4.5:1 ratio) on all text layers.

### Don't:
- **Don't** use opaque heavy drop-shadows or dark neumorphism; keep elevation light, clean, and ambient.
- **Don't** add decorative animated background gradients that distract from administrative data inspection.
- **Don't** use generic default browser focus rings; use the standardized 2px offset Indigo focus ring.
- **Don't** mix multiple font families outside `Plus Jakarta Sans` and `JetBrains Mono`.
- **Don't** allow long metadata strings to cause horizontal layout distortion; truncate with ellipsis and monospace styling.
