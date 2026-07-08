# Evonaire — Frontend

The official frontend for **Evonaire**, a platform that connects creators and members through guided digital experiences called *rituals*. Built with a focus on trust, emotional safety, and controlled access.

---



## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Roles & Routing](#roles--routing)
- [Key Concepts](#key-concepts)
- [Architecture Decisions](#architecture-decisions)
- [Component Guide](#component-guide)
- [API Integration](#api-integration)
- [Design System](#design-system)
- [Contributing](#contributing)

---

## Overview

Evonaire is a role-based platform with four user types — **Members**, **Creators**, **Moderators**, and **Admins** — each with their own dashboard and capabilities. The frontend is a Next.js 14 App Router application that communicates with a Django + DRF backend.

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI Components | [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) |
| Forms | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) |
| Charts | [Recharts](https://recharts.org/) |
| Icons | [Lucide React](https://lucide.dev/) |
| Notifications | [Sonner](https://sonner.emilkowal.ski/) |
| Font | [Geist](https://vercel.com/font) |
| Analytics | [Vercel Analytics](https://vercel.com/analytics) |

---

## Project Structure

```
evonaire-frontend-v1/
├── app/                        # Next.js App Router pages
│   ├── auth/                   # Authentication pages (login, register, activate)
│   ├── admin/                  # Admin dashboard
│   ├── creator/                # Creator studio dashboard
│   ├── member/                 # Member library dashboard
│   ├── moderate/               # Moderator dashboard
│   ├── consent/                # Consent acceptance page
│   ├── privacy/                # Privacy policy page
│   ├── terms/                  # Terms of service page
│   ├── dashboard/              # Generic post-login redirect
│   ├── profile/                # User profile settings
│   ├── layout.tsx              # Root layout (providers, nav, footer)
│   ├── page.tsx                # Public landing page
│   └── globals.css             # Global styles + design tokens
│
├── components/
│   ├── ui/                     # Base UI primitives (shadcn/ui)
│   ├── sanctuaries/            # Sanctuary-related components
│   ├── moderation/             # Moderation dashboard components
│   ├── rts/                    # Resonance Trust Score components
│   ├── payments/               # Payment / premium tier components
│   ├── navigation.tsx          # Role-aware top navigation bar
│   ├── consent-guard.tsx       # Route-level consent enforcement
│   ├── report-modal.tsx        # User content reporting modal
│   ├── footer.tsx              # Global footer
│   └── theme-provider.tsx      # next-themes wrapper
│
├── lib/
│   ├── auth-context.tsx        # Global auth state (React Context)
│   ├── auth.ts                 # AuthService — all API calls + type definitions
│   ├── rts.ts                  # RTS API calls
│   ├── sanctuaries.ts          # Sanctuary API calls
│   ├── payments.ts             # Payments API calls
│   └── utils.ts                # Shared utilities (cn helper, etc.)
│
├── public/                     # Static assets (logo, images)
├── components.json             # shadcn/ui configuration
├── next.config.mjs             # Next.js configuration
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- The Evonaire backend running locally (or a staging API URL)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd evonaire-frontend-v1

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run start     # Start production server
npm run lint      # Run ESLint
```

---

## Environment Variables

Create a `.env.local` file in the root of the project:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
```

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Base URL for the Django backend API | `/api` |

> If `NEXT_PUBLIC_API_BASE_URL` is not set, the app falls back to `/api` which assumes a proxy is configured.

---

## Roles & Routing

After login, users are routed to their role-specific dashboard. The `Navigation` component dynamically renders links based on the authenticated user's role.

| Role | Dashboard | Access |
|---|---|---|
| `member` | `/member` | Browse rituals, join sanctuaries, track play history |
| `creator` | `/creator` | Upload rituals, view analytics, manage sanctuaries |
| `moderator` | `/moderate` | Review pending rituals, manage moderation cases |
| `admin` | `/admin` | Approve role requests, platform-level controls |

All role routing is handled client-side via the `useAuth()` hook from `lib/auth-context.tsx`.

---

## Key Concepts

### Rituals
Content created by creators — typically audio journeys or reflective experiences. Each ritual has a care level that controls access:

- **Level 1** — Public, accessible to all users
- **Level 2 & 3** — Restricted, requires sanctuary membership

### Sanctuaries
Private communities created by creators. Members request to join; creators approve or reject. Approved members gain access to higher-level rituals within that sanctuary.

### RTS (Resonance Trust Score)
A dynamic score assigned to creators based on engagement, feedback, moderation signals, and activity. It governs sanctuary capacity growth and can trigger care/safety interventions.

### Consent Gate
Every authenticated user must accept the Privacy Policy and Terms of Service before accessing any protected route. This is enforced by `ConsentGuard` (`components/consent-guard.tsx`), which wraps the entire app and redirects to `/consent` if consent has not been recorded.

---

## Architecture Decisions

### Centralized Auth Context
All auth state lives in `lib/auth-context.tsx` via a single `AuthProvider`. This was introduced to fix session bugs caused by scattered local state. Every component reads from `useAuth()` — never from `localStorage` directly.

**What `AuthProvider` manages:**
- `user` — the full user profile object
- `loading` — initial auth check state
- `consentsAccepted` — whether the user has accepted the legal consent
- `login`, `logout`, `refreshUser`, `acceptConsent` — auth actions

### Client-Side Auth Only
There is no server-side session management. Auth tokens (`access_token`, `refresh_token`) are stored in `localStorage`. The `AuthService` in `lib/auth.ts` handles token refresh transparently — if a 401 is received, it automatically attempts a token refresh before retrying.

### Service Layer Pattern
All API communication is encapsulated in service classes and files under `lib/`. Components never call `fetch` directly. This keeps API logic centralized and makes it easy to update endpoints without touching component code.

### No New Business Logic in Components
Components are display-only. Business decisions (role checks, access control, consent enforcement) happen in `lib/` or dedicated guard components, not inside page components.

---

## Component Guide

### `components/navigation.tsx`
Role-aware sticky navigation bar. Hidden on auth pages and the landing page. Reads `user.role` from `useAuth()` to render the correct nav links and dashboard redirect.

### `components/consent-guard.tsx`
Wraps all children. On every route change, checks if the authenticated user has `consentsAccepted === false` and redirects to `/consent` if so. Public routes (landing, auth pages) are exempt.

### `components/rts/`
A set of self-contained components for displaying and interacting with the Resonance Trust Score system:
- `score-badge.tsx` — compact score display
- `score-history.tsx` — historical chart
- `creator-score-table.tsx` — admin/moderator overview table
- `config-form.tsx` — admin RTS configuration
- `flag-form.tsx` — flag a creator's RTS signal

### `components/sanctuaries/`
All sanctuary interaction components: sanctuary cards, member tables, join request forms, pending requests management, ritual assignment, and a full audit log view.

### `components/moderation/`
Components for the moderator dashboard: pending review queue, moderation stats, and a full case detail view with history.

---

## API Integration

All API calls go through `lib/auth.ts` (`AuthService` class) and the smaller service files (`lib/rts.ts`, `lib/sanctuaries.ts`, `lib/payments.ts`).

**Base URL:** Configured via `NEXT_PUBLIC_API_BASE_URL`.

**Authentication:** Bearer token sent via `Authorization` header. The `getAuthHeaders()` method on `AuthService` reads the token from `localStorage`.

**Token Refresh:** Handled automatically inside `getProfile()`. If a 401 is returned, `refreshToken()` is called and the original request is retried once. If the refresh fails, the user is logged out.

### Key API Endpoints Used

| Endpoint | Purpose |
|---|---|
| `POST /auth/login/` | Login, returns JWT pair |
| `POST /auth/register/` | Register new user |
| `GET /me/` | Fetch authenticated user profile |
| `POST /auth/consent/` | Record consent acceptance |
| `GET /rituals/public/` | Fetch all public rituals |
| `GET /rituals/mine/` | Fetch creator's own rituals |
| `POST /rituals/` | Upload a new ritual |
| `GET /analytics/creator/dashboard/` | Creator metrics |
| `GET /moderations/rituals/pending/` | Pending ritual reviews |
| `GET /moderations/cases/` | All moderation cases |
| `GET /sanctuaries/joined/` | Member's joined sanctuaries |

---

## Design System

Evonaire uses a custom dark sanctuary theme defined as CSS custom properties in `app/globals.css`.

### Color Tokens

| Token | Value | Usage |
|---|---|---|
| `--gold` | `#d9b574` | Primary accent, CTAs, icons |
| `--gold-muted` | `#b8975a` | Secondary accent |
| `--cream` | `#f3e5c8` | Warm text on dark backgrounds |
| `--dark-navy` | `#0f171e` | Page background |
| `--dark-navy-light` | `#1a2230` | Card backgrounds |

### Typography
Geist Sans (body) and Geist Mono (code), applied globally via CSS variables.

### UI Components
All base components (`Button`, `Card`, `Dialog`, `Badge`, etc.) come from shadcn/ui and are located in `components/ui/`. They are thin wrappers around Radix UI primitives, styled with Tailwind and `class-variance-authority`.

---

## Contributing

### Branching

- `master` — stable, production-ready code
- Feature branches: `v0/<short-description>` or `feat/<short-description>`

### Before You Start

1. Make sure you have the backend running locally and `NEXT_PUBLIC_API_BASE_URL` set correctly.
2. Read through `lib/auth-context.tsx` and `lib/auth.ts` to understand the auth and data flow before touching any feature.
3. Do not introduce new business logic into page or component files — keep it in `lib/`.
4. Do not break or modify existing API calls unless a backend change has been confirmed.

### Code Style

- TypeScript strict mode is expected — avoid `any` where possible.
- Use `useAuth()` for any user/session data — never read from `localStorage` directly in components.
- Keep components focused on rendering. Move side effects and data fetching to service files or hooks.
- Tailwind only — no inline styles or external CSS files unless absolutely necessary.

### Running a Build Check

```bash
npm run build
```

> Note: `eslint` and TypeScript errors are currently set to warn-only during builds (`ignoreDuringBuilds: true`). This is a temporary setting — fix lint errors before submitting PRs.
