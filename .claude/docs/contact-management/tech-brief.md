# Tech Brief: Core Contact & Account Management

**Date:** 2026-03-15
**PRD Version:** 1.0
**Stories Covered:** Extended Contact Profile, Company Entity, Interaction Log, 360-Degree Contact View, Duplicate Detection, Duplicate Merging

---

## Architecture Overview

This feature touches all three layers of the monorepo.

**`packages/types`** — Must be updated first. Seven new exported interfaces are required before either app team begins implementation. The `Customer` interface is extended in place; three new top-level interfaces are added (`Company`, `Interaction`, and their DTOs). The `company` field on `Customer` changes semantics (UUID reference or legacy plain-text) but its TypeScript type remains `string` to preserve backward compatibility without a migration gate.

**`apps/api`** — Two new NestJS modules are introduced: `CompaniesModule` and `InteractionsModule`, each with its own controller and a dedicated service that wraps `SheetsService` calls for their respective sheet tab. `SheetsService` is extended with new methods for the `Companies` and `Interactions` tabs. `DriveService.findOrCreateSpreadsheet` is the single provisioning entry point and must be updated to create both new tabs at spreadsheet creation time. A new `MergeService` handles the multi-step merge write sequence.

**`apps/web`** — Two new Zustand stores (`companyStore`, `interactionStore`) are added alongside the existing `customerStore`. A client-side router is introduced (React Router v6) to support the stable-URL requirement of the Contact Detail panel. `useCustomers.ts` is extended with the duplicate detection utility. `CustomerForm` / `CustomerDrawer` gain the new profile fields and company combobox.

The overall data flow remains unchanged: all reads and writes travel through the NestJS API, which calls Google Sheets via the user's OAuth tokens. No secondary store is introduced.

---

## API Design

All routes below inherit the existing JWT Auth Guard pattern. The `sub`, `accessToken`, and `refreshToken` values are extracted from the JWT payload on every request, exactly as `CustomersController` does today.

### New and Modified Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/customers` | Existing — response shape extended with new profile fields | JWT |
| POST | `/customers` | Existing — request body extended with new profile fields | JWT |
| PATCH | `/customers/:id` | Existing — request body extended with new profile fields | JWT |
| GET | `/companies` | Fetch all rows from `Companies` tab | JWT |
| POST | `/companies` | Append a new company row | JWT |
| PATCH | `/companies/:id` | Update a company row by id | JWT |
| GET | `/interactions` | Fetch all rows from `Interactions` tab | JWT |
| POST | `/interactions` | Append a new interaction row; side-effects `last_contact_date` on parent contact | JWT |
| PATCH | `/interactions/:id` | Update `summary` and `edited_at` on an interaction (within 24-hour window, enforced server-side) | JWT |
| POST | `/customers/merge` | Execute a merge: write surviving record, re-point interactions, archive loser | JWT |

### Request / Response Shapes

```typescript
// ── Customers (extended) ─────────────────────────────────────────────────────

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;          // UUID ref to Company.id OR legacy plain-text string
  status: CustomerStatus;
  lastContactDate: string;
  notes: string;
  createdAt: string;
  // New fields — absent on legacy rows; treated as empty string
  jobTitle: string;
  preferredContact: PreferredContact | '';
  linkedinUrl: string;
  tags: string;             // comma-separated free text, e.g. "vip,renewal"
}

// CreateCustomerDto — same as Customer minus id and createdAt (all new fields optional)
// UpdateCustomerDto — Partial<CreateCustomerDto> (unchanged shape rule)

// ── Companies ────────────────────────────────────────────────────────────────

interface Company {
  id: string;
  name: string;
  industry: string;
  website: string;
  notes: string;
  createdAt: string;
}

interface CreateCompanyDto {
  name: string;
  industry?: string;
  website?: string;
  notes?: string;
}

interface UpdateCompanyDto extends Partial<CreateCompanyDto> {}

// ── Interactions ─────────────────────────────────────────────────────────────

interface Interaction {
  id: string;
  customerId: string;
  type: InteractionType;
  summary: string;          // max 1,000 characters, enforced server-side
  createdAt: string;        // ISO timestamp, set by server
  createdBy: string;        // user email from JWT payload
  editedAt: string;         // ISO timestamp or empty string if never edited
}

interface CreateInteractionDto {
  customerId: string;
  type: InteractionType;
  summary: string;
}

interface UpdateInteractionDto {
  summary: string;          // only field editable post-creation
}

// ── Merge ─────────────────────────────────────────────────────────────────────

interface MergeCustomersDto {
  survivorId: string;
  discardedId: string;
  // Field-level selections: each key is a Customer field name;
  // value is 'survivor' | 'discarded' indicating which record's value to keep.
  fieldSelections: Partial<Record<keyof Customer, 'survivor' | 'discarded'>>;
}

// POST /customers/merge response: the updated survivor Customer record
```

### Notes on `/customers/merge`

The merge endpoint is the only route that writes to two sheet tabs in a single request (Sheet1 and Interactions). There is no transaction primitive in the Sheets API — the sequencing and rollback strategy are covered under Technical Risks.

### Notes on `/interactions` (GET)

The endpoint returns all interaction rows regardless of `customerId`. The client filters by `customerId` after receipt. This is consistent with the existing pattern of fetching the full customer list and filtering client-side. Given the 2,000-row upper bound stated in the PRD, a full fetch is acceptable at current scale.

---

## Data Model Changes

### Sheet1 — Extended Header Row

Current: `id | first_name | last_name | email | phone | company | status | last_contact_date | notes | created_at`

Updated: `id | first_name | last_name | email | phone | company | status | last_contact_date | notes | created_at | job_title | preferred_contact | linkedin_url | tags`

Columns A–J are positionally unchanged. New columns K–N are appended. `rowToCustomer` in `SheetsService` reads columns by index; rows without columns K–N (all existing rows) return empty string for the new fields, which is the intended backward-compatible behavior.

### Companies Tab — New

Tab name: `Companies`

Header row: `id | name | industry | website | notes | created_at`

Column positions: A=id, B=name, C=industry, D=website, E=notes, F=created_at

### Interactions Tab — New

Tab name: `Interactions`

Header row: `id | customer_id | type | summary | created_at | created_by | edited_at`

Column positions: A=id, B=customer_id, C=type, D=summary, E=created_at, F=created_by, G=edited_at

### `packages/types` — Required Changes

The following must be defined and exported from `/Users/lehuyvu/Research/crm/packages/types/src/index.ts` before implementation starts:

- Extend `Customer` with `jobTitle`, `preferredContact`, `linkedinUrl`, `tags`
- Add `PreferredContact` type alias: `'Email' | 'Phone' | 'LinkedIn'`
- Add `InteractionType` type alias: `'Call' | 'Email' | 'Meeting' | 'Note'`
- Add `Company`, `CreateCompanyDto`, `UpdateCompanyDto`
- Add `Interaction`, `CreateInteractionDto`, `UpdateInteractionDto`
- Add `MergeCustomersDto`

`CreateCustomerDto` and `UpdateCustomerDto` are currently derived via `Omit` and `Partial` from `Customer`, so they automatically pick up the new fields once `Customer` is extended — no manual change needed for those two types.

---

## Frontend Technical Notes

### Routing

The app currently uses manual `window.location.pathname` switching with no router library. The Contact Detail panel's stable-URL requirement (Story 4) cannot be met without a proper router. **React Router v6 must be introduced** before the Contact Detail panel is built. This is a structural change that affects `App.tsx`.

Recommended route structure:
```
/                        → DashboardPage (existing list views)
/contacts/:id            → ContactDetailPage (new)
/companies               → CompaniesPage (new)
/companies/:id           → CompanyDetailPage (new)
/auth/callback           → AuthCallbackPage (existing, mapped as route)
```

The Contact Detail panel should be a full-page route (`/contacts/:id`), not a modal. A modal cannot satisfy the deep-link requirement without significant URL hash engineering. The existing `CustomerDrawer` continues to serve the add/edit workflow; the new page serves the read/360 workflow.

### State Management

Do not extend `customerStore` with companies and interactions. Three stores, three responsibilities:

- `customerStore` — unchanged shape; add `jobTitle`, `preferredContact`, `linkedinUrl`, `tags` to the `Customer` type it already uses
- `companyStore` — new Zustand store; mirrors the `customerStore` pattern with `companies`, `isLoading`, `fetchCompanies`, `addCompany`, `updateCompany`
- `interactionStore` — new Zustand store; `interactions`, `isLoading`, `fetchInteractions`, `addInteraction`, `updateInteraction`; interactions are fetched once on first visit to any Contact Detail panel and cached

All three stores follow the same `apiFetch` + optimistic-update pattern already established in `customerStore`.

### Contact Detail Page — Data Loading

The `ContactDetailPage` component fetches three data sources: the single customer record (already in `customerStore` if the list was visited first, otherwise fetched by id), the company record (by `company` id from `companyStore`), and interactions filtered by `customerId` from `interactionStore`. All three are resolved in parallel via `Promise.all` equivalents at the page level.

The resolved company name lookup and the legacy plain-text fallback live in a shared utility function: given a `company` string, check if it is a UUID present in `companyStore.companies`; if yes, return `company.name`; if no, return the raw string as-is. This function is used everywhere a company display name is rendered.

### Duplicate Detection

Duplicate detection runs inside `useCustomers.ts` (or a co-located `useDuplicateDetection.ts` hook) against the already-loaded `customerStore.customers` array. No additional hook state or store is needed.

Two detection passes:

1. **Email exact match** — triggered on the `email` field's `onChange` event. `customers.filter(c => c.email.toLowerCase() === input.toLowerCase() && c.status !== 'Archived')`.

2. **Fuzzy name + company match** — triggered when all three of `firstName`, `lastName`, and `company` have non-empty values. Normalize all fields with `.toLowerCase().trim()`. All three fields must match exactly after normalization (the PRD specifies "all three must match, case-insensitive" — this is case-insensitive exact match, not approximate fuzzy match; no third-party library is needed).

Both checks return `Customer | null`. The result is surfaced as a `duplicateWarning: Customer | null` state variable in `CustomerForm`. Do not use a fuzzy-matching library — the PRD's "fuzzy" language refers to the combination of three fields, not algorithmic similarity scoring.

### Company Combobox

Use `shadcn/ui` `Command` + `Popover` (the Combobox pattern from the shadcn/ui docs). The combobox is driven by `companyStore.companies`. When the user types a name not present in the list and selects "Create [name]", the form calls `POST /companies` inline, receives the new `Company` record, adds it to `companyStore`, and sets the contact's `company` field to the new UUID.

### New shadcn/ui Components Needed

- `Command` + `Popover` — company combobox
- `Badge` — tag pills on contact cards
- `Tabs` — Contact Detail page sections (Profile / Interactions)
- `AlertDialog` — merge confirmation dialog
- `Separator` — already installed, used in detail layout

---

## Backend Technical Notes

### Module Structure

Introduce two new NestJS modules following the exact structure of `CustomersModule`:

- `CompaniesModule` — `CompaniesController`, `CompaniesService`, imports `AuthModule`
- `InteractionsModule` — `InteractionsController`, `InteractionsService`, imports `AuthModule`

Both modules provide their own service and do not share `SheetsService` across modules. Each service calls `googleapis` directly via the same `buildSheetsClient` helper pattern. Alternatively, extract `buildSheetsClient` into a shared `GoogleAuthService` provider — acceptable refactor if the team wants to reduce duplication, but not required for this iteration.

Register both new modules in `AppModule`.

### DriveService Changes

`findOrCreateSpreadsheet` currently creates a spreadsheet with only `Sheet1`. It must be updated to add the `Companies` and `Interactions` tabs in the same `spreadsheets.create` call (adding two more entries to the `sheets` array in `requestBody`). Each tab gets its header row in the `data` field, matching the pattern already used for `Sheet1`.

For existing spreadsheets that were provisioned before this feature ships, a `ensureTabsExist` method must be added to `DriveService`. This method calls `spreadsheets.get` to read existing sheet titles and calls `spreadsheets.batchUpdate` with `addSheet` requests only for tabs that are absent. `getOrCreateSpreadsheet` calls `ensureTabsExist` after resolving the spreadsheet id, on every request. The result of `ensureTabsExist` should be cached per `userId` after the first successful check (a boolean flag alongside the existing `spreadsheetCache` map).

### SheetsService — New Methods

Add these methods to the existing `SheetsService` class:

- `getAllCompanies(accessToken, refreshToken, spreadsheetId): Promise<Company[]>`
- `appendCompany(dto, accessToken, refreshToken, spreadsheetId): Promise<Company>`
- `updateCompany(id, dto, accessToken, refreshToken, spreadsheetId): Promise<Company>`
- `getAllInteractions(accessToken, refreshToken, spreadsheetId): Promise<Interaction[]>`
- `appendInteraction(dto, createdBy, accessToken, refreshToken, spreadsheetId): Promise<Interaction>` — also calls the existing `update` method to patch `last_contact_date` on the parent contact row
- `updateInteraction(id, dto, accessToken, refreshToken, spreadsheetId): Promise<Interaction>` — validates the 24-hour edit window using `createdAt`; throws `ForbiddenException` if window has passed

The `rowToCustomer` and `customerToRow` helpers must be updated to handle the four new columns (K–N), defaulting missing indices to empty string.

Update the `SHEET_RANGE` constant from `Sheet1!A:J` to `Sheet1!A:N`.

### MergeService

Create a new `MergeService` provider inside `CustomersModule` (it reads and writes to both Sheet1 and Interactions, so keeping it in `CustomersModule` avoids a circular module dependency). The merge sequence is:

1. `GET Sheet1` — resolve both the survivor row index and the discarded row index
2. `GET Interactions` — collect all interaction rows where `customer_id === discardedId`
3. Build the merged survivor row using `fieldSelections` from the DTO
4. Write merged survivor row via `spreadsheets.values.update` on the survivor row
5. For each interaction row referencing `discardedId`, write `survivorId` into column B via individual `spreadsheets.values.update` calls (batch these into a `spreadsheets.values.batchUpdate` request)
6. Build the archived discard row: set `status = Archived`, append to `notes` the string `"Merged into [survivorId] on [ISO date]"`
7. Write the archived discard row via `spreadsheets.values.update` on the discarded row

All seven steps above are individual Sheets API calls — there is no atomic transaction. See Technical Risks for the partial-failure handling approach.

Add a `POST /customers/merge` route to `CustomersController`. **Register this route before the `PATCH :id` route** to avoid NestJS matching `merge` as a path parameter.

### `linkedin_url` Validation

Validate in the `InteractionsService` and `CustomersController` using a NestJS pipe or a manual guard: `linkedinUrl` must be empty or start with `https://linkedin.com/`. Throw `BadRequestException` on violation. The PRD requires an inline error; the frontend derives this from the 400 response body.

### Interaction Edit Window

In `updateInteraction`, parse `createdAt` from the row and compare against `Date.now()`. If the difference exceeds 86,400,000 ms, throw `ForbiddenException` with message `"Interaction can no longer be edited"`. The frontend should reflect this by hiding the edit affordance client-side (compare `createdAt` against current time before rendering the edit button), but the server enforces the rule.

---

## Technical Constraints

- **Google Sheets API write quota:** 300 write requests per minute per project. The merge operation can emit up to `N + 3` write requests where `N` is the number of interactions being re-pointed. For a contact with 50 interactions, that is 53 requests. This is safe in isolation but concurrent merges from multiple users could approach the limit. Batch the interaction re-pointing step into a single `batchUpdate` call (one request regardless of `N`) to reduce write pressure.

- **Google Sheets API read quota:** 300 read requests per minute per project. The `getOrCreateSpreadsheet` + `ensureTabsExist` pattern on every API call adds one extra read per cold request. The existing `spreadsheetCache` in `DriveService` already eliminates repeat provisioning calls for warm requests; extend the cache with the tabs-checked boolean to prevent repeat `spreadsheets.get` calls.

- **No atomic multi-tab writes:** The Sheets API has no transaction support across tabs or even across ranges in the same tab. The merge operation is the only path that writes to two tabs. Partial failure leaves the sheet in an inconsistent state. Mitigation is documented under Technical Risks.

- **Sheet row scan on every update:** The current `update` method in `SheetsService` fetches the entire Sheet1 range to find the target row by id. At 500 contacts, this is a ~5 KB payload — acceptable. At 5,000 rows it becomes a concern, but the PRD's stated scale ceiling is 500 contacts and 2,000 interactions. No optimization is required in this iteration.

- **`last_contact_date` side-effect write:** `appendInteraction` must update Sheet1 as well as the Interactions tab. This is two write requests in sequence within a single POST call. The order is: write interaction row first, then update contact row. If the second write fails, the interaction row exists without the `last_contact_date` update — this is acceptable data drift (non-critical field) compared to the inverse.

- **Browser compatibility:** No new browser APIs are required. React Router v6, Zustand, and shadcn/ui `Command` all support the same browser baseline as the existing stack.

- **JWT token size:** `accessToken` and `refreshToken` are stored in the JWT payload (existing design). Adding more tabs does not change this. No constraint added.

- **`linkedin_url` validation is server-enforced:** Client-side validation in the form is a UX convenience but the server must also validate. Do not rely on frontend-only validation for security-adjacent fields.

---

## Migration Strategy — Legacy `company` Field

Existing contacts have a plain-text string in the `company` column (e.g., "Acme Corp"). After this feature ships, the `company` column is expected to hold a UUID referencing the `Companies` tab. Both formats will coexist.

**Runtime display resolution (required from day one):** The frontend resolves company display names via the utility function described in the Frontend section: attempt UUID lookup in `companyStore`, fall back to raw string. This must be in place before any contact is migrated.

**No automated server-side migration.** Do not run a background job that converts plain-text company strings to Company records. The risk of creating duplicate or misnamed Company records from inconsistently-entered legacy strings (e.g., "acme", "Acme Corp", "ACME Corporation" all becoming separate entities) outweighs the friction of manual re-linking.

**Manual re-linking flow:** When a user opens the edit drawer for a legacy contact, the company combobox displays the raw string as the current value. The user can search for or create a Company record and select it, at which point the contact's `company` field is updated to the new UUID. No separate migration UI is needed.

**No schema migration script is required.** The existing rows are valid — the `company` column continues to hold a string, which is what it held before. Only the semantic interpretation changes.

---

## Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Merge partial failure — interaction re-pointing succeeds but survivor/discard row write fails (or vice versa) | Medium | High — sheet enters inconsistent state with interactions pointing to archived contact | Log the full merge intent (survivor id, discard id, list of affected interaction ids) to the API error log before any write begins. Document a recovery procedure: re-run the specific failed write step manually via the Sheets UI. A full rollback primitive is not feasible without a transactional DB. Consider adding a `POST /customers/merge/dry-run` endpoint in a follow-on iteration that validates preconditions without writing. |
| Google Sheets write quota exceeded under concurrent load | Low | Medium — 429 errors bubble to the user as failed saves | Batch interaction re-pointing into `batchUpdate`. Rate-limit the merge endpoint to one in-flight merge per user session (client-side guard). Add retry-with-backoff on 429 responses in `SheetsService`. |
| `ensureTabsExist` adds latency to every cold API request | Medium | Low — adds one extra `spreadsheets.get` call per user per server restart | Cache the "tabs verified" boolean per userId in `DriveService.spreadsheetCache` alongside the spreadsheet id. After the first successful verification, the check is skipped for the life of the server process. |
| React Router v6 introduction breaks existing manual routing in `App.tsx` | High (certainty, not risk) | Low — isolated to `App.tsx` and two pages | Treat `App.tsx` routing refactor as its own sub-task in Story 4. The existing `LoginPage`, `AuthCallbackPage`, and `DashboardPage` each map to a route; `AuthCallbackPage` reads `window.location.search` today and must be verified to work under React Router's `useSearchParams`. |
| `company` UUID vs. plain-text detection is ambiguous | Low | Medium — if a legacy contact happens to have a UUID-shaped company string, it will be looked up incorrectly | UUID format is `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`. The lookup utility must check both that the string matches the UUID regex AND that a Company with that id exists in the store. If the id is UUID-shaped but not found in the store, fall back to raw-string display and log a warning. |
| 24-hour edit window relies on server clock only | Low | Low | Acceptable. The server sets `createdAt` at write time; the same server evaluates the window on edit. No clock skew concern within a single server process. |
| Tag search performance degrades with large datasets | Low | Low — search is already O(n) over all customers | Tags are a comma-separated string; the existing `includes(q)` search in `useCustomers.ts` already covers the full field value. No change needed. |

---

## Implementation Order

The stories have a hard dependency chain. The recommended sequence maps to minimum viable increments that can be tested independently.

**Sprint 1 — Foundation (unblocks everything else)**

1. Update `packages/types` — extend `Customer`, add all new interfaces and enums. Ship this before any app code is written.
2. Update `DriveService` — add `Companies` and `Interactions` tab provisioning + `ensureTabsExist`. No frontend changes yet; can be validated by inspecting the Google Sheet.
3. Extend Sheet1 schema — update `SHEET_RANGE` constant, update `rowToCustomer` / `customerToRow` in `SheetsService`, extend `CreateCustomerDto` handling. All new fields are optional; no existing API consumers break.
4. Story 1: Extended Contact Profile — backend columns are live; extend `CustomerForm` / `CustomerDrawer` with the four new fields, update `useCustomers.ts` search to cover new fields.

**Sprint 2 — Companies + Routing**

5. Introduce React Router v6 — refactor `App.tsx`. Prerequisite for the Contact Detail page route.
6. Story 2: Company Entity — `CompaniesModule` backend + `companyStore` frontend + company combobox in `CustomerForm` + legacy display fallback utility.

**Sprint 3 — Interactions + 360 View**

7. Story 3: Interaction Log — `InteractionsModule` backend + `interactionStore` frontend + inline interaction form within Contact Detail page.
8. Story 4: 360-Degree Contact View — `ContactDetailPage` at `/contacts/:id` assembling profile, company, and interactions. Requires Stories 2 and 3 to be complete.

**Sprint 4 — Data Hygiene**

9. Story 5: Duplicate Detection — add detection logic to `useCustomers.ts` / `CustomerForm`. No backend work. Can be parallelized with Sprint 3 after types are settled.
10. Story 6: Duplicate Merging — `MergeService` backend + merge UI flow. Depends on Story 5 (warning banner entry point) and Story 4 (actions menu entry point).

---

## Out of Scope (Technical)

- Automated batch migration of legacy plain-text company strings to Company entity records
- Pagination or virtual scrolling for the Interactions list (re-evaluate if interaction count per contact exceeds 200 in production usage)
- Optimistic updates for the merge operation (the write sequence is too complex to roll back optimistically; show a loading state instead)
- Role-based access control to restrict merge to Admin users (the PRD lists this as an open question; no backend guard is implemented until the product decision is made)
- Interaction revision history / audit log beyond the single `edited_at` timestamp
- `POST /companies/:id/archive` dedicated endpoint (use `PATCH /companies/:id` with `status`-equivalent field; the Companies tab schema as defined in the PRD does not include a `status` column — if archiving is needed, add it to the schema in a follow-on)
