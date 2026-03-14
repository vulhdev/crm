# CRM Platform — Project Overview

## Summary

A lightweight CRM platform using **Google Sheets as the primary database**, structured as a **Turborepo monorepo**. Users authenticate via Google OAuth2; their customer data lives in a per-user Google Sheets spreadsheet managed through the backend.

---

## Monorepo Structure

```
crm/
├── apps/
│   ├── api/        # NestJS backend (port 3000)
│   └── web/        # Vite + React frontend (port 5173)
└── packages/
    └── types/      # Shared TypeScript interfaces (@crm/types)
```

**Tooling:** Turborepo v2.4.4, npm v10.9.4 workspaces.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Monorepo | Turborepo | 2.4.4 |
| Frontend | Vite + React | 7.3.1 / 19.2.0 |
| Styling | Tailwind CSS + shadcn/ui | 3.4.19 |
| State | Zustand | 5.0.0 |
| Drag & Drop | @dnd-kit | 6.3.1+ |
| Backend | NestJS | 11.0.1 |
| Auth | Passport + Google OAuth20 + JWT | — |
| Data | Google Sheets API v4 via `googleapis` | 171.4.0 |
| FE Tests | Vitest + React Testing Library | 4.1.0 / 16.3.2 |
| BE Tests | Jest | 30.0.0 |
| TypeScript | — | 5.9.3 (FE) / 5.7.3 (BE) |

---

## Architecture

### Authentication Flow
1. User clicks "Sign in with Google" → `GET /auth/google` (Passport redirects)
2. Google OAuth consent → `GET /auth/google/callback`
3. Backend signs a JWT containing user identity + OAuth tokens
4. Frontend stores JWT under `crm_token` in localStorage
5. All API calls use `apiFetch()` which attaches `Authorization: Bearer <token>`
6. `JwtAuthGuard` validates the token on every `/customers` route

### Google Sheets Integration
- Each user gets a personal "crm" folder in their Google Drive (created via `DriveService`)
- A "customers" spreadsheet is provisioned inside that folder
- Range: `Sheet1!A:J` — 10 columns, headers auto-synced
- No Service Account — the backend uses the user's own OAuth tokens to access their sheet
- No hard deletes — `status = Archived` is used instead

### State Management
| Scope | Mechanism |
|-------|-----------|
| Auth (token, user) | React Context (`AuthContext`) + localStorage |
| Customer data | Zustand store (`customerStore`) with optimistic updates |
| UI state (drawer, filters, view) | Component-level `useState` |

---

## Data Model

**Google Sheet schema** (`Sheet1!A:J`):

| Column | Field | Notes |
|--------|-------|-------|
| A | id | UUID |
| B | first_name | |
| C | last_name | |
| D | email | |
| E | phone | |
| F | company | |
| G | status | `Lead \| Active \| Churned \| Archived` |
| H | last_contact_date | ISO date string |
| I | notes | |
| J | created_at | ISO timestamp |

**Shared types** (from `@crm/types`): `Customer`, `CustomerStatus`, `CreateCustomerDto`, `UpdateCustomerDto`, `GoogleUser`, `JwtPayload`.

---

## API Routes

| Method | Path | Auth | Action |
|--------|------|------|--------|
| GET | `/auth/google` | — | Initiate OAuth flow |
| GET | `/auth/google/callback` | — | Handle callback, issue JWT |
| GET | `/customers` | JWT | Fetch all rows from Sheet1!A:J |
| POST | `/customers` | JWT | Append new row |
| PATCH | `/customers/:id` | JWT | Find row by id, update fields |

---

## Frontend Pages & Components

### Pages
| File | Purpose |
|------|---------|
| `LoginPage.tsx` | Google sign-in button |
| `AuthCallbackPage.tsx` | Extracts JWT from OAuth redirect |
| `DashboardPage.tsx` | Main app shell with customer management |

### Key Components
| Component | Purpose |
|-----------|---------|
| `CustomerTable.tsx` | Sortable list view |
| `CustomerGrid.tsx` | Card grid view |
| `CustomerKanban.tsx` | Drag-drop board grouped by status |
| `ViewToggle.tsx` | Switches between List / Grid / Kanban |
| `CustomerDrawer.tsx` | Add / Edit modal (shadcn Sheet) |
| `CustomerFilters.tsx` | Search + status filter bar |
| `StatsRow.tsx` + `MetricCard.tsx` | Dashboard metrics |
| `StatusBadge.tsx` | Color-coded status label |

### Hooks & Utilities
- `useCustomers.ts` — CRUD, filtering, sorting, drawer state
- `customerStore.ts` — Zustand store (fetch, add, update with optimistic updates)
- `api.ts` — `apiFetch()` with Bearer token injection
- `formatDate.ts`, `avatarPalette.ts` — shared utilities

---

## Backend Modules

| Module | Files | Responsibility |
|--------|-------|---------------|
| `AuthModule` | `auth.controller`, `auth.service`, `google.strategy`, `jwt.strategy`, `jwt-auth.guard` | OAuth2 + JWT flow |
| `CustomersModule` | `customers.controller`, `sheets.service`, `drive.service` | Customer CRUD + Google Sheets/Drive |
| `AppModule` | `app.controller`, `app.service` | Root module, config bootstrap |

---

## Environment Variables

### Backend (`apps/api/.env`)
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_KEY=
GOOGLE_SHEET_ID=
JWT_SECRET=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
PORT=3000
```

### Frontend
- API base URL hardcoded to `http://localhost:3000`
- JWT stored under key `crm_token` in localStorage

---

## Development Workflow

### Commands
```bash
npm run dev       # Start all apps in parallel (Turborepo)
npm run build     # Build all apps
npm run lint      # Lint all apps
```

### Run individually
```bash
# Backend
cd apps/api && npm run start:dev

# Frontend
cd apps/web && npm run dev
```

### TDD Workflow (Claude agents)
The project uses a 4-agent TDD workflow via `/develop-team`:
1. **QC Agent** — writes tests first (Jest for API, Vitest for FE)
2. **UI Designer** — creates design brief
3. **Senior FE Developer** + **Senior BE Developer** (parallel) — implement against tests

### Issue Workflow
- `/start-issue <number>` — creates branch `<prefix>/<number>-<slug>`
- `/finish-issue` — commits, pushes, opens PR

---

## Implemented Features (as of 2026-03-15)

- [x] Google OAuth2 authentication with JWT
- [x] Per-user Google Drive + Sheets provisioning
- [x] Customer CRUD (create, read, update, archive)
- [x] Three views: Table, Grid, Kanban
- [x] Drag-and-drop status change on Kanban
- [x] Silent optimistic updates (no loading flash on status change)
- [x] Customer filtering (search + status) and sorting
- [x] Add/Edit modal drawer
- [x] Dashboard metrics (StatsRow)
- [x] Loading skeletons + toast notifications
- [x] Shared TypeScript types across FE and BE

---

## Full Specification

See [`.specifications/crm_specification.md`](../../.specifications/crm_specification.md) for the complete product spec.
