# develop-team

A two-agent team for building the CRM platform. Agents work in parallel on independent app boundaries — `apps/web` (FE) and `apps/api` (BE) — coordinating through the shared `packages/types` contract.

## Agents

| Agent | File | Owns |
|-------|------|------|
| `senior-fe-developer` | `.claude/agents/senior-fe-developer.md` | `apps/web/` |
| `senior-be-developer` | `.claude/agents/senior-be-developer.md` | `apps/api/` |

## Shared Contract (`packages/types`)

The BE agent publishes types; the FE agent consumes them. Coordinate changes here before running parallel tasks.

```ts
// packages/types/src/index.ts
export type CustomerStatus = 'Lead' | 'Active' | 'Churned' | 'Archived';

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  status: CustomerStatus;
  last_contact_date: string; // ISO date string
  notes: string;
  created_at: string;        // ISO timestamp
}

export interface CreateCustomerDto extends Omit<Customer, 'id' | 'created_at'> {}
export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {}
```

---

## Task Breakdown

### Phase 1 — Setup & Configuration
> Run sequentially; both agents needed.

| # | Agent | Task |
|---|-------|------|
| 1.1 | BE | Init NestJS project in `apps/api`, configure `@nestjs/config`, add `.env.example` |
| 1.2 | FE | Init Vite + React (TS) project in `apps/web`, configure Tailwind CSS and shadcn/ui |
| 1.3 | BE | Create `packages/types/src/index.ts` with `Customer`, `CustomerStatus`, `CreateCustomerDto`, `UpdateCustomerDto` |
| 1.4 | BE | Set up Turborepo root (`turbo.json`, root `package.json` workspaces) |

---

### Phase 2 — Authentication
> BE tasks first; FE login page can be built in parallel once API contract is agreed.

| # | Agent | Task |
|---|-------|------|
| 2.1 | BE | Install `@nestjs/passport`, `passport-google-oauth20`, `@nestjs/jwt`; implement `GoogleStrategy` |
| 2.2 | BE | Implement `AuthController` (`GET /auth/google`, `GET /auth/google/callback`), issue signed JWT on callback |
| 2.3 | BE | Implement `JwtAuthGuard`; apply to `CustomersController` (stub if not yet created) |
| 2.4 | FE | Build `/login` page with "Sign in with Google" button → navigates to `GET /auth/google` |
| 2.5 | FE | Handle OAuth callback redirect: extract JWT from query param, store in `localStorage` as `crm_token`, redirect to `/dashboard` |
| 2.6 | FE | Create `AuthContext` + protected route wrapper; redirect unauthenticated users to `/login` |

---

### Phase 3 — Google Sheets Integration (Backend)
> BE only; fully parallel with FE Phase 4 once types are published.

| # | Agent | Task |
|---|-------|------|
| 3.1 | BE | Install `googleapis`; create `SheetsModule` and `SheetsService` with Service Account auth |
| 3.2 | BE | `SheetsService.getAll()` — fetch `Sheet1!A:J`, map rows to `Customer[]` objects |
| 3.3 | BE | `SheetsService.append(dto)` — generate UUID for `id`, set `created_at`, append row |
| 3.4 | BE | `SheetsService.update(id, dto)` — scan `id` column for row number, update that range |
| 3.5 | BE | Wire `CustomersController`: `GET /customers`, `POST /customers`, `PATCH /customers/:id` |

---

### Phase 4 — Frontend Core Pages
> FE only; can run in parallel with Phase 3 using mock data, then switch to real API.

| # | Agent | Task |
|---|-------|------|
| 4.1 | FE | Create `src/services/api.ts` — centralized fetch wrapper that attaches `Authorization: Bearer` header |
| 4.2 | FE | Build `/dashboard` — metric cards (total customers, leads this week) + recent customers list |
| 4.3 | FE | Build `/customers` — data table with client-side sort, filter by status/name, and pagination |
| 4.4 | FE | Build `/customers/new` — Add Customer form with validation, calls `POST /customers` |
| 4.5 | FE | Build `/customers/:id/edit` — Edit Customer form (modal or page), calls `PATCH /customers/:id` |
| 4.6 | FE | Archive action on customer list/detail — calls `PATCH /customers/:id` with `{ status: 'Archived' }` |

---

### Phase 5 — Polish & Deployment
> Both agents in parallel.

| # | Agent | Task |
|---|-------|------|
| 5.1 | FE | Add loading skeletons to all async views |
| 5.2 | FE | Add shadcn/ui `Toast` notifications for all mutation success/error outcomes |
| 5.3 | FE | Audit and fix responsive layout for mobile breakpoints |
| 5.4 | BE | Add server-side input sanitization/validation on all DTOs using `class-validator` |
| 5.5 | BE | Write production `.env` guide; configure CORS for deployed frontend origin |
| 5.6 | BE | Deploy `apps/api` to Render or Railway; configure production env vars |
| 5.7 | FE | Deploy `apps/web` to Vercel or Netlify; set `VITE_API_URL` to production API |
