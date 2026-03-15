# Tech Brief: Sales & Pipeline Management

**Date:** 2026-03-15
**PRD Version:** 1.0
**Depends on:** Core Contact & Account Management Tech Brief (v1.0)
**Stories Covered:** Lead Scoring (1.1), Lead Qualification (1.2), Opportunity Entity (2.1), Customizable Sales Stages (2.2), Pipeline Kanban (2.3), Pipeline Value Summary (3.1), Win Rate & Deal Velocity (3.2), Close Date Risk Flagging (3.3), Quote Creation (4.1), Quote Status Tracking (4.2), Quote PDF Export (4.3)

---

## Architecture Overview

This feature adds three new domain areas — pipeline management, sales forecasting, and quote management — all of which share a common structural pattern with the existing codebase. No architectural paradigm shifts are introduced. The additions follow the same module-per-domain approach already established by `CustomersModule`.

**`packages/types`** — Must be updated first. Six new top-level interfaces (`Opportunity`, `PipelineStage`, `Quote`, `QuoteLineItem`, and their DTOs) plus four new enums (`OpportunityStatus`, `QuoteStatus`, `QualificationStatus`, `DisqualificationReason`) are required before either app team begins implementation. The `Customer` interface is extended in place with three new columns (`leadScoreOverride`, `qualificationStatus`, `disqualificationReason`). This continues the same additive extension strategy used by the Contact Management feature for `Sheet1`.

**`apps/api`** — Three new NestJS modules are introduced: `OpportunitiesModule`, `PipelineStagesModule`, and `QuotesModule`. Each follows the exact pattern of `CustomersModule`: its own controller, its own service wrapping `SheetsService`-style Sheets calls, and an import of `AuthModule` for the JWT guard. `DriveService.findOrCreateSpreadsheet` and `ensureTabsExist` (introduced in Contact Management) are extended to provision three additional tabs: `Opportunities`, `PipelineStages`, and `Quotes`. `Sheet1` gains three new columns (O–Q) for lead score override and qualification fields.

**`apps/web`** — Three new Zustand stores are added (`opportunityStore`, `pipelineStageStore`, `quoteStore`), all following the `customerStore` pattern with optimistic updates. Two new full-page routes are added: `/pipeline` (Kanban board) and `/forecast` (forecasting dashboard). The Contact Management PRD already mandates React Router v6; this feature assumes that routing work is complete. The existing `CustomerKanban` component is a direct reference implementation for the new `PipelineKanban` component — the `@dnd-kit` pattern, `DndContext` + `useDroppable` + `useDraggable` setup, and optimistic rollback approach are all reused without change. A `QuotePrintTemplate` component, isolated from the main UI tree, handles the PDF export path via `react-to-print`.

The overall data flow is unchanged. All reads and writes go through the NestJS API using the user's own OAuth tokens.

---

## API Design

All routes are protected by `JwtAuthGuard`. The `sub`, `accessToken`, and `refreshToken` values are extracted from the JWT payload via `req.user` on every request, identical to the pattern in `CustomersController`.

### New Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/opportunities` | Fetch all rows from `Opportunities` tab | JWT |
| POST | `/opportunities` | Append new opportunity row | JWT |
| PATCH | `/opportunities/:id` | Update opportunity fields | JWT |
| GET | `/pipeline-stages` | Fetch all rows from `PipelineStages` tab | JWT |
| POST | `/pipeline-stages` | Append new stage row | JWT |
| PATCH | `/pipeline-stages/:id` | Update stage name, probability, or order | JWT |
| DELETE | `/pipeline-stages/:id` | Delete stage row (guarded: blocked if open opportunities reference this stage id) | JWT |
| GET | `/quotes` | Fetch all rows from `Quotes` tab | JWT |
| POST | `/quotes` | Append new quote row | JWT |
| PATCH | `/quotes/:id` | Update quote fields or advance status | JWT |

### Modified Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/customers` | Response shape extended with three new lead fields | JWT |
| POST | `/customers` | Request body extended with three new lead fields (all optional) | JWT |
| PATCH | `/customers/:id` | Request body extended with three new lead fields (all optional) | JWT |

### Request / Response Shapes

```typescript
// ── Lead fields on Customer (Sheet1 extension) ────────────────────────────

interface Customer {
  // ...existing fields unchanged (id through tags from Contact Management PRD)...
  leadScoreOverride: number | null;    // null = no override; integer 0-100 when set
  qualificationStatus: QualificationStatus;
  disqualificationReason: string;      // empty string when not disqualified
}

// leadScore is NOT stored — computed client-side only.
// leadScoreOverride stored in sheet column O.
// qualificationStatus stored in sheet column P.
// disqualificationReason stored in sheet column Q.

// ── Opportunities ─────────────────────────────────────────────────────────

interface Opportunity {
  id: string;
  name: string;
  contactId: string;
  companyId: string;
  stage: string;                  // PipelineStage id (UUID reference, not name string)
  value: number;
  closeDate: string;              // ISO date string (YYYY-MM-DD)
  probability: number;            // integer 0-100
  notes: string;
  status: OpportunityStatus;
  lossReason: string;             // empty string unless status = 'Lost'
  createdAt: string;
  updatedAt: string;
}

interface CreateOpportunityDto {
  name: string;
  contactId: string;
  companyId?: string;
  stage: string;
  value: number;
  closeDate: string;
  probability?: number;           // defaults to stage's probability_default if omitted
  notes?: string;
}

interface UpdateOpportunityDto extends Partial<CreateOpportunityDto> {
  status?: OpportunityStatus;
  lossReason?: string;
  // updatedAt: server always overwrites; client value ignored
}

// ── Pipeline Stages ───────────────────────────────────────────────────────

interface PipelineStage {
  id: string;
  name: string;
  probabilityDefault: number;
  order: number;
  createdAt: string;
}

interface CreatePipelineStageDto {
  name: string;
  probabilityDefault: number;
  order: number;
}

interface UpdatePipelineStageDto extends Partial<CreatePipelineStageDto> {}

// DELETE /pipeline-stages/:id
// 204 on success
// 409 Conflict: { conflictCount: number, message: string }

// ── Quotes ────────────────────────────────────────────────────────────────

interface QuoteLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Quote {
  id: string;
  opportunityId: string;
  contactId: string;
  companyId: string;
  title: string;
  lineItems: QuoteLineItem[];     // deserialized from JSON cell on read
  subtotal: number;               // server-computed
  discountPercent: number;
  total: number;                  // server-computed
  notes: string;
  status: QuoteStatus;
  validUntil: string;
  sentAt: string;                 // ISO timestamp or empty string
  createdAt: string;
  updatedAt: string;
}

interface CreateQuoteDto {
  opportunityId: string;
  contactId: string;
  companyId?: string;
  title: string;
  lineItems: QuoteLineItem[];
  discountPercent?: number;       // defaults to 0
  notes?: string;
  validUntil?: string;            // defaults to today + 30 days
}

interface UpdateQuoteDto extends Partial<CreateQuoteDto> {
  status?: QuoteStatus;
  // sentAt and updatedAt: server-set; client values ignored
}

// ── Enums ─────────────────────────────────────────────────────────────────

type OpportunityStatus = 'Open' | 'Won' | 'Lost';
type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined' | 'Expired';
type QualificationStatus = 'Unqualified' | 'Qualified' | 'Disqualified';
type DisqualificationReason = 'Budget' | 'Authority' | 'Need' | 'Timeline' | 'Other';
// disqualificationReason stored as "Category: optional free text", split on first ': ' on read
```

### Error Contracts

```typescript
{ statusCode: 400, message: string | string[], error: 'Bad Request' }
{ statusCode: 404, message: string, error: 'Not Found' }
{ statusCode: 409, message: string, error: 'Conflict', conflictCount: number }
{ statusCode: 422, message: string, error: 'Unprocessable Entity', allowedTransitions: QuoteStatus[] }
```

---

## Data Model Changes

### Sheet1 — Extended Header Row

Contact Management established columns A–N. This PRD appends three columns, O–Q:

`id | first_name | last_name | email | phone | company | status | last_contact_date | notes | created_at | job_title | preferred_contact | linkedin_url | tags | lead_score_override | qualification_status | disqualification_reason`

Column positions: O=lead_score_override, P=qualification_status, Q=disqualification_reason.

`lead_score` is computed client-side and is never stored. `SHEET_RANGE` advances from `Sheet1!A:N` to `Sheet1!A:Q`. Legacy rows with absent O–Q columns default to `null`, `'Unqualified'`, and `''`.

**Column count is now 17 (A:Q).** Flag any future extension of Sheet1 for a contacts tab migration discussion before proceeding.

### Opportunities Tab — New

Tab name: `Opportunities`
Header: `id | name | contact_id | company_id | stage | value | close_date | probability | notes | status | loss_reason | created_at | updated_at`
Columns: A=id through M=updated_at
Range constant: `Opportunities!A:M`

`stage` stores the `PipelineStage.id` UUID — renaming a stage requires no data migration.

### PipelineStages Tab — New

Tab name: `PipelineStages`
Header: `id | name | probability_default | order | created_at`
Columns: A=id through E=created_at
Range constant: `PipelineStages!A:E`

Provisioned with five default rows at creation time (see Backend Technical Notes).

### Quotes Tab — New

Tab name: `Quotes`
Header: `id | opportunity_id | contact_id | company_id | title | line_items | subtotal | discount_percent | total | notes | status | valid_until | sent_at | created_at | updated_at`
Columns: A=id through O=updated_at
Range constant: `Quotes!A:O`

`line_items` (column F) stores a `JSON.stringify`'d `QuoteLineItem[]`. `subtotal` and `total` are server-computed and stored as numeric strings.

### `packages/types` — Required Changes

All of the following must be exported from `packages/types/src/index.ts` before implementation starts:

- Extend `Customer` with `leadScoreOverride: number | null`, `qualificationStatus: QualificationStatus`, `disqualificationReason: string`
- Add type aliases: `QualificationStatus`, `DisqualificationReason`, `OpportunityStatus`, `QuoteStatus`
- Add interfaces: `QuoteLineItem`, `Opportunity`, `CreateOpportunityDto`, `UpdateOpportunityDto`, `PipelineStage`, `CreatePipelineStageDto`, `UpdatePipelineStageDto`, `Quote`, `CreateQuoteDto`, `UpdateQuoteDto`

`leadScore` is intentionally omitted from the `Customer` interface — it never round-trips through the API.

---

## Frontend Technical Notes

### Routing

Adds three routes to the React Router v6 tree established by Contact Management:

```
/pipeline          → PipelinePage
/forecast          → ForecastPage
/opportunities/:id → OpportunityDetailPage
```

### New Pages and Component Boundaries

**`PipelinePage`** (`apps/web/src/pages/PipelinePage.tsx`) — owns pipeline filter state (search, close date range, at-risk/overdue toggle, show-closed toggle); triggers `opportunityStore.fetchOpportunities()` and `interactionStore.fetchInteractions()` in parallel on mount.

**`PipelineKanban`** (`apps/web/src/components/pipeline/PipelineKanban.tsx`) — direct structural copy of `CustomerKanban` with columns keyed by `PipelineStage.id` instead of hardcoded status strings; columns rendered in `stage.order` ascending order. `handleDragEnd` calls `opportunityStore.updateOpportunity` with the new stage id and stage's `probability_default` (preserve existing probability if the user had manually overridden it). Do not modify `CustomerKanban`; build `PipelineKanban` as a separate component.

**`ForecastPage`** (`apps/web/src/pages/ForecastPage.tsx`) — purely presentational; all metrics computed from `opportunityStore.opportunities` via `useForecastMetrics`; no additional API calls on mount.

**`OpportunityDetailPage`** (`apps/web/src/pages/OpportunityDetailPage.tsx`) — resolves opportunity from store (falls back to filtering full list by id on cold start — no dedicated `GET /opportunities/:id` endpoint exists); shows linked quotes filtered client-side by `opportunityId`; shows linked contact interactions from `interactionStore`; hosts Won/Lost flow and quote creation drawer.

### State Management — New Stores

**`opportunityStore`** (`apps/web/src/store/opportunityStore.ts`)
```typescript
interface OpportunityState {
  opportunities: Opportunity[];
  isLoading: boolean;
  error: string | null;
  fetchOpportunities: () => Promise<void>;
  addOpportunity: (data: CreateOpportunityDto) => Promise<Opportunity>;
  updateOpportunity: (id: string, data: UpdateOpportunityDto) => Promise<void>;
}
```
Identical pattern to `customerStore`: optimistic update on `updateOpportunity`, rollback via `set({ opportunities: prev })` on failure, toast on success/failure.

**`pipelineStageStore`** (`apps/web/src/store/pipelineStageStore.ts`)
```typescript
interface PipelineStageState {
  stages: PipelineStage[];
  isLoading: boolean;
  fetchStages: () => Promise<void>;
  addStage: (data: CreatePipelineStageDto) => Promise<PipelineStage>;
  updateStage: (id: string, data: UpdatePipelineStageDto) => Promise<void>;
  deleteStage: (id: string) => Promise<void>;
}
```
`deleteStage` does not optimistically update the store — the deletion guard makes premature store mutation unsafe. Handle 409 by surfacing the conflict count message to the user.

**`quoteStore`** (`apps/web/src/store/quoteStore.ts`)
```typescript
interface QuoteState {
  quotes: Quote[];
  isLoading: boolean;
  error: string | null;
  fetchQuotes: () => Promise<void>;
  addQuote: (data: CreateQuoteDto) => Promise<Quote>;
  updateQuote: (id: string, data: UpdateQuoteDto) => Promise<void>;
}
```
Fetched once on first mount of `OpportunityDetailPage`; filtered by `opportunityId` client-side.

### Lead Score — Client-Side Computation

Add `apps/web/src/lib/leadScore.ts`:
```typescript
function computeLeadScore(
  customer: Customer,
  interactions: Interaction[],
  companies: Company[]
): number
```
Rules: +30 company linked (id in companies array), +20 interaction exists, +20 phone and email both non-empty, +15 created within 14 days, +15 jobTitle non-empty. Called inside `useMemo` at the badge render site. If `customer.leadScoreOverride !== null`, display the override value with a "manual" indicator instead of calling the function.

### Auto-Expire Sent Quotes

On `OpportunityDetailPage` mount, after `quoteStore` loads, check quotes scoped to the current `opportunityId`:
```typescript
quotes
  .filter(q => q.opportunityId === id && q.status === 'Sent' && new Date(q.validUntil) < new Date())
  .forEach(q => quoteStore.updateQuote(q.id, { status: 'Expired' }))
```
Apply optimistically in the store. Fire-and-forget: API failures logged but not surfaced as blocking errors.

### PDF Export — `react-to-print`

Install `react-to-print` in `apps/web`. Create `QuotePrintTemplate` (`apps/web/src/components/quotes/QuotePrintTemplate.tsx`) with print-safe styles (CSS module or scoped `<style>` tag, not Tailwind interactive utilities). Wire `useReactToPrint` to the "Export PDF" button on `OpportunityDetailPage`. Set `documentTitle` to `Quote-${quote.id.slice(0, 8)}-${contactLastName}`. Do not use `jsPDF` or `html2canvas`.

### Forecast Metrics — `useForecastMetrics`

Add `apps/web/src/hooks/useForecastMetrics.ts`:
```typescript
interface ForecastMetrics {
  totalPipeline: number;
  weightedPipeline: number;
  expectedCloseThisMonth: number;
  expectedCloseThisQuarter: number;
  winRate: number | null;        // null = fewer than 3 closed deals in trailing 90d
  winRateNumerator: number;
  winRateDenominator: number;
  averageDealAgeDays: number;
  byStage: StageForecastRow[];
}

interface StageForecastRow {
  stageId: string;
  stageName: string;
  dealCount: number;
  totalValue: number;
  weightedValue: number;
  averageDaysInStage: number;
}
```
All values are `useMemo`-derived from the opportunity array. Currency formatted with `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`.

### At-Risk and Overdue Flagging

Add `apps/web/src/lib/opportunityFlags.ts`:
```typescript
interface OpportunityFlags {
  isOverdue: boolean;    // closeDate < today && status = 'Open'
  isAtRisk: boolean;     // closeDate within 14 days && no interaction for contactId in last 7 days
}

function computeOpportunityFlags(
  opportunity: Opportunity,
  interactions: Interaction[]
): OpportunityFlags
```
Called per-card inside `useMemo` in `PipelineKanban`. Overdue = red date indicator. At-Risk = amber warning indicator. "At Risk & Overdue" filter button on `PipelinePage` filters to `isOverdue || isAtRisk` with a count badge.

### shadcn/ui Components Needed

New additions to the existing installed set: `Dialog`, `Popover` + `Calendar`, `Table`, `Tooltip`, `Progress` (optional). `Badge` and `Sheet` are already installed; reuse them.

---

## Backend Technical Notes

### Module Structure

Three new NestJS modules, each in its own directory under `apps/api/src/`:

- `OpportunitiesModule` (`opportunities/`) — `OpportunitiesController`, `OpportunitiesService`, imports `AuthModule`
- `PipelineStagesModule` (`pipeline-stages/`) — `PipelineStagesController`, `PipelineStagesService`, imports `AuthModule`
- `QuotesModule` (`quotes/`) — `QuotesController`, `QuotesService`, imports `AuthModule`

Register all three in `AppModule`. Each service has its own `buildSheetsClient` private method — same pattern as `SheetsService` and `DriveService`. If eliminating this duplication is desired, extract a `@Global()` `GoogleAuthService`; acceptable refactor but not required for this iteration.

### DriveService Changes

Extend tab provisioning to include `Opportunities`, `PipelineStages` (with eager defaults), and `Quotes` alongside existing tabs. All header rows are named constants in `drive.service.ts`.

**Eager stage provisioning:** Write the five default stage rows at `PipelineStages` tab creation time in the same `spreadsheets.batchUpdate` call. Use hardcoded stable UUIDs (defined as constants, not `crypto.randomUUID()`) so defaults are testable deterministically.

| Constant | Name | probability_default | order |
|----------|------|--------------------:|------:|
| `DEFAULT_STAGE_PROSPECTING` | Prospecting | 20 | 1 |
| `DEFAULT_STAGE_QUALIFICATION` | Qualification | 40 | 2 |
| `DEFAULT_STAGE_PROPOSAL_SENT` | Proposal Sent | 60 | 3 |
| `DEFAULT_STAGE_NEGOTIATION` | Negotiation | 80 | 4 |
| `DEFAULT_STAGE_CLOSING` | Closing | 90 | 5 |

### `SheetsService` — Extended Customer Row Handling

Use named index constants in `sheets.service.ts`:
```typescript
const COL_LEAD_SCORE_OVERRIDE     = 14; // column O (0-indexed)
const COL_QUALIFICATION_STATUS    = 15; // column P
const COL_DISQUALIFICATION_REASON = 16; // column Q
```
Absent indices default to `null`, `'Unqualified'`, `''`. `SHEET_RANGE` advances to `Sheet1!A:Q`. Update range in `update()` advances from `Sheet1!A${row}:N${row}` to `Sheet1!A${row}:Q${row}`.

### `OpportunitiesService` — Key Behaviors

- `update` always sets `updatedAt` server-side.
- `update` with `status = 'Lost'` throws `BadRequestException` if `lossReason` is absent or empty.
- `getAll` returns all opportunities including Won and Lost; client filters to `Open`.
- `rowToOpportunity` parses `value` and `probability` from numeric strings; defaults `status` to `'Open'` if absent.

### `PipelineStagesService` — Deletion Guard

Sequence for `delete(id, ...)`:
1. Fetch all `Opportunities!A:M` rows.
2. Count rows where column E (`stage`) = `id` AND column J (`status`) = `'Open'`.
3. If count > 0, throw `ConflictException` with `{ conflictCount: count, message: '...' }`.
4. If count = 0, resolve the `PipelineStages` tab's numeric `sheetId` via `spreadsheets.get` (cache per user in a module-scoped `Map`), then delete the row via `spreadsheets.batchUpdate` with `deleteDimension`. Do NOT blank the row — blank rows break the `slice(1)` header-skip logic.

### `QuotesService` — Key Behaviors

**Subtotal / total:**
```
subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0)
total    = subtotal * (1 - discountPercent / 100)
```
Computed on every POST and any PATCH that includes `lineItems` or `discountPercent`. Client-provided `subtotal`/`total` are ignored.

**Status transition table:**

| From | Allowed To |
|------|-----------|
| Draft | Sent, Expired |
| Sent | Accepted, Declined, Expired |
| Accepted | (none) |
| Declined | (none) |
| Expired | (none) |

Invalid transitions throw `UnprocessableEntityException` with `allowedTransitions`. Read current status from the sheet before writing; validate before any write.

**`sentAt`:** Set server-side on transition to `Sent`; client value ignored.

**`line_items` JSON safety:** `try/catch` on `JSON.parse`; return `lineItems: []` and log warning (row id + raw cell value) on failure. Never throw from parse failure — a corrupt cell must not fail the entire `GET /quotes` response.

---

## Technical Constraints

- **Google Sheets API write quota — 300 writes/minute/project.** One write per drag-drop, one per status change, two per stage deletion (`spreadsheets.get` + `batchUpdate`). No batching optimization required at stated scale.
- **`line_items` JSON cell size.** 50,000 character cell limit; 50 line items ≈ 4,000 characters. Enforce 50 line item maximum client-side as a UX guard.
- **Client-side data volume.** ~1,500 opportunities + ~2,500 interactions ≈ 500 KB JSON. Comfortably within browser constraints; no virtualization needed.
- **`@dnd-kit` compatibility.** Dynamic droppable ids (stage UUIDs) are fully supported by the existing `@dnd-kit` version. No upgrade required.
- **Stage reorder writes.** At 10 stages maximum, `Promise.all` across up to 10 parallel PATCH calls on reorder. Independent writes, no ordering dependency.
- **`lossReason` is a dedicated column** (`loss_reason`), not embedded in `notes`, to support future filtering without text parsing.
- **`updatedAt` is always server-set** on Opportunities and Quotes. `averageDealAgeDays` depends on this; client-provided values would corrupt the metric.
- **No cross-tab atomic writes.** Won/Lost + Quote Accepted is two sequential user-confirmed API calls, not an automatic cascade. Acceptable.

---

## Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `line_items` JSON cell corrupt (user edits sheet directly) | Low | Medium — quote line items unreadable | `try/catch` in `QuotesService`; return `lineItems: []` and log. Surface warning badge on quote card if `lineItems` is empty but `subtotal > 0`. |
| Stage deletion race: opportunity created in target stage between guard read and delete write | Very Low | Medium — orphaned opportunity references deleted stage id | Guard reads all opportunities immediately before delete; window is sub-second. Acceptable at single-user-per-spreadsheet scale. |
| `PipelineStages` tab empty on first Pipeline page load | Low | Low — Kanban renders zero columns; no crash | Eager provisioning of five defaults at tab creation time eliminates this. Render empty-state prompt if `stages.length === 0` after load. |
| `order` field collisions from simultaneous stage creation in two browser tabs | Very Low | Low — undefined column sort order | Sort by `order` then `createdAt` as tiebreaker. Stage Settings UI enforces sequential order on save. |
| `react-to-print` blocked by browser popup blocker | Low | Low — manual print fallback available | Document in UX brief that users may need to allow popups. |
| Contact Management feature not yet shipped when this feature begins | High (dependency risk) | High — `OpportunityDetailPage`, `interactionStore`, routing all depend on it | Stories 2.1–2.3 and 3.1–3.2 are buildable independently. Stories 3.3 and all of Feature Area 4 require Contact Management to be complete. Enforce in implementation order. |
| Sheet1 column index mapping breaks if Contact Management and Sales Pipeline columns merge in the wrong order | Medium | High — all customer reads return silently misaligned data | Correct order: A–J (original), K–N (Contact Management), O–Q (this PRD). Enforce with named index constants in `sheets.service.ts`. Never use bare numeric literals for column indices. |
| Auto-expire PATCH calls generate unexpected write traffic for users with many stale sent quotes | Low | Low | Scope auto-expiry to current opportunity's quotes only. Fire in parallel via `Promise.all`. |

---

## Implementation Order

**Phase 1 — Types and Data Model Foundation (unblocks everything)**

1. Update `packages/types` — all new interfaces, DTOs, enums. No app code before this.
2. Update `DriveService` — provision `Opportunities`, `PipelineStages` (with eager defaults), `Quotes` tabs; extend `Sheet1` header to A:Q.
3. Extend `SheetsService` row helpers — advance to `Sheet1!A:Q`, update `rowToCustomer`/`customerToRow` with named index constants.

**Phase 2 — Core Pipeline (Stories 2.1, 2.2, 2.3 — all "Must")**

4. `OpportunitiesModule` backend — GET/POST/PATCH.
5. `PipelineStagesModule` backend — GET/POST/PATCH/DELETE with deletion guard.
6. `opportunityStore` and `pipelineStageStore` frontend.
7. `PipelinePage` and `PipelineKanban` — drag-drop, search/filter bar, column value summaries, overdue/at-risk indicators (filter button stubbed; wired in Phase 5).
8. Navigation entry for Pipeline in `Sidebar`.

**Phase 3 — Forecast (Stories 3.1, 3.2 — "Must" and "Should")**

9. `useForecastMetrics` hook.
10. `ForecastPage` — `ForecastStatsRow`, `DealVelocityRow`, `PipelineBreakdownTable`.
11. Navigation entry for Forecast in `Sidebar`.

Phases 2 and 3 are buildable without Contact Management being complete.

**Phase 4 — Lead Management (Stories 1.1, 1.2 — both "Should")**

Parallel with Phase 3; no dependency on Opportunity data.

12. `computeLeadScore` utility, lead score badge (Hot/Warm/Cold tiers, breakdown tooltip, override indicator).
13. `qualificationStatus` / `disqualificationReason` PATCH flow on Contact Detail panel (requires Contact Management routing).
14. "Qualified Leads" `MetricCard` on `StatsRow`.

**Phase 5 — At-Risk Flagging (Story 3.3 — "Should")**

Requires Contact Management's `interactionStore`.

15. `computeOpportunityFlags` utility.
16. Wire "At Risk & Overdue" filter button on `PipelinePage` with count badge.
17. Overdue (red) and At-Risk (amber) visual indicators on `OpportunityCard`.

**Phase 6 — Quotes (Stories 4.1, 4.2, 4.3 — all "Should")**

Requires `OpportunityDetailPage` and Contact Management routing.

18. `QuotesModule` backend — GET/POST/PATCH with transition validation and subtotal/total computation.
19. `quoteStore` frontend.
20. `OpportunityDetailPage` — opportunity detail, linked quotes list, contact interactions, Won/Lost flow.
21. Quote creation drawer — line items, discount, valid-until.
22. Quote status tracking UI — transitions, Won confirmation prompt, auto-expire on mount.
23. "Quotes Sent" `MetricCard` on `StatsRow`.
24. `QuotePrintTemplate` + `react-to-print` PDF export.

---

## Out of Scope (Technical)

- **`QuoteLineItems` dedicated tab.** JSON in a single cell is the chosen approach; a normalized tab is deferred pending resolution of PRD open question 6.
- **Server-side lead score computation.** Score is purely client-side; no `lead_score` column written to the sheet.
- **`GET /opportunities/:id` single-record endpoint.** Not in the PRD's API route list; `OpportunityDetailPage` resolves from the store or filters the full list by id.
- **Opportunity-to-multiple-contacts junction.** Single `contact_id` column only; multi-contact opportunities deferred pending PRD open question 1.
- **Pagination.** Evaluate only if opportunity count exceeds 1,000 per user in production.
- **Stage reorder drag-to-reorder UI.** API supports it (`PATCH /pipeline-stages/:id` with `order`); frontend UX implementation deferred to UX brief scope.
- **Multi-currency support.** USD only; no `currency` column added this iteration. Must be revisited before any future feature touching monetary fields, as retrofitting requires a data migration.
- **Mobile-optimized Pipeline Kanban.** Desktop only per PRD.
- **Approval workflow for quotes.** Deferred per PRD.
- **Historical pipeline snapshots.** Deferred per PRD; not natively supported by Google Sheets without a separate log tab.
