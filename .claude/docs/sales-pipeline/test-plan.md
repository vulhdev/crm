# Test Plan: Sales & Pipeline Management

**Version:** 1.0
**Date:** 2026-03-15
**Feature PRD Version:** 1.0
**Prepared by:** QA Analyst
**Status:** Draft — pending developer review before sprint start

---

## 1. Scope & Objectives

### In Scope

This test plan covers all eleven user stories defined in the Sales & Pipeline Management PRD:

| Story | Title | Priority |
|-------|-------|----------|
| 1.1 | Lead Capture with Scoring | Should |
| 1.2 | Lead Qualification Workflow | Should |
| 2.1 | Opportunity Entity | Must |
| 2.2 | Customizable Sales Stages | Must |
| 2.3 | Pipeline Kanban Board | Must |
| 3.1 | Pipeline Value Summary | Must |
| 3.2 | Deal Velocity & Win Rate Metrics | Should |
| 3.3 | Close Date Risk Flagging | Should |
| 4.1 | Quote Creation | Should |
| 4.2 | Quote Status Tracking | Should |
| 4.3 | Quote Export to PDF | Could |

Testing covers: functional behavior, data integrity (Google Sheets read/write across all new tabs and the extended Sheet1 A:Q range), API contract verification for all nine new endpoints and three modified endpoints, UX fidelity against the UX Brief, client-side computation correctness, optimistic update and rollback mechanics, status transition enforcement, JSON cell safety, edge cases, and regression against Contact Management features.

### Quality Objectives

1. Zero data corruption — no opportunity, stage, or quote record is silently written to the wrong Sheet column or wrong tab.
2. All status lifecycle rules are enforced both on the server (422) and reflected accurately in the UI (only valid transitions shown as active).
3. Client-side computations (lead score, forecast metrics, flags) produce numerically correct results and handle boundary conditions without crashing.
4. Optimistic updates roll back cleanly on API failure; no stale state remains in the Zustand store after a failed drag-drop.
5. The `line_items` JSON parse failure path never crashes the `GET /quotes` response or any quote-displaying UI component.
6. The Sheet1 column index extension (O, P, Q) does not misalign any existing Contact Management field reads or writes.

### Out of Scope

Per PRD exclusions: multi-user collaboration, email delivery of quotes, e-signature, revenue quota tracking, AI-assisted probability, historical pipeline snapshots, multi-currency, recurring revenue modeling, product catalog, quote approval workflow, quote versioning/diff, activity reminder tasks, and mobile-optimized Kanban.

---

## 2. Risk Assessment

| Risk | Likelihood | Severity | Mitigation |
|------|-----------|----------|-----------|
| Sheet1 column index misalignment — Contact Management wrote A:N; this PRD appends O:Q; wrong order silently corrupts all customer reads | Medium | Critical | Verify named index constants `COL_LEAD_SCORE_OVERRIDE=14`, `COL_QUALIFICATION_STATUS=15`, `COL_DISQUALIFICATION_REASON=16` in `sheets.service.ts`; run explicit column-alignment test reading each field by header name and cross-checking position |
| `line_items` JSON parse failure — user edits Quotes tab directly in Google Sheets, corrupting JSON cell; if not caught, entire `GET /quotes` response fails | Low | High | Confirm `try/catch` in `QuotesService.rowToQuote`; verify `lineItems: []` returned rather than exception thrown; verify UI does not crash when `lineItems` is empty but `subtotal > 0` |
| Stage UUID reference integrity — `Opportunities.stage` stores PipelineStage UUID; if stage is deleted without guard catching it, orphaned UUIDs produce broken Kanban columns | Low | High | Test deletion guard (409) rigorously; test that the guard reads Open opportunities immediately before delete; verify UI handles an opportunity whose stage UUID no longer exists in `pipelineStageStore` |
| Optimistic update not rolling back on API failure — drag-drop leaves card in wrong column in the store after a network error | Medium | High | Verify `set({ opportunities: prev })` rollback path is triggered on all failure codes; verify toast appears; verify store state equals pre-drag state after failure |
| Quote status backward transition — client sends an invalid `Accepted → Draft` transition and the API silently accepts it due to missing validation | Low | High | Test every invalid transition pair against `PATCH /quotes/:id`; confirm 422 response with `allowedTransitions` array for each |
| `updatedAt` client override corrupting `averageDealAgeDays` metric — client sends `updatedAt` in PATCH body and server accepts it | Low | High | Verify server ignores client-provided `updatedAt` on both Opportunities and Quotes; compare `updatedAt` value returned by server with server timestamp, not client timestamp |
| `lead_score` stored in Sheet — developer misreads spec and writes computed score to the sheet, creating stale/misleading data | Medium | Medium | Verify no `lead_score` column exists in Sheet1 header row; verify API response for `GET /customers` does not include `leadScore` field; verify score is computed in `computeLeadScore` call site only |
| Auto-expire PATCH calls firing on every OpportunityDetailPage mount for the same stale quotes — repeated writes cause unnecessary quota consumption | Low | Medium | Verify the auto-expire filter checks `q.status === 'Sent'` before patching; after first expire, re-visiting the page should not fire additional PATCHes for the same quote |
| Stage deletion race condition — an opportunity is created in the target stage between guard read and delete write | Very Low | Medium | Document as accepted risk at single-user-per-spreadsheet scale; verify guard reads all opportunities immediately before delete, not from cached store state |
| `probability` not updating on drag-drop when user had manual override — spec says preserve override if manually set | Medium | Medium | Verify drag-drop sends the stage default probability only if `probability` was not manually overridden; define and test the "manual override" detection logic |
| PDF export blocked by browser popup blocker — `react-to-print` triggers browser print dialog | Low | Low | Document in acceptance criteria that popup permission may be required; test in Chrome and Safari with popup blocker enabled |
| `PipelineStages` tab empty on first load — if eager provisioning fails silently, Kanban renders no columns | Low | Medium | Verify provisioning happens in same `batchUpdate` as tab creation; add integration test for first-time sheet setup that verifies five default rows exist |
| Win Rate showing misleading data with 1–2 closed deals | High | Medium | Enforce "Not enough data" display when closed deal count in trailing 90 days is less than 3; test with exactly 0, 1, 2, and 3 closed deals |

---

## 3. Test Scenarios by Feature Area

### Feature Area 1: Lead Management

#### Scenario 1.1-A — Lead score computes correctly from contributing fields (happy path)

- **Given**: A contact with `status = Lead` exists; the contact has a linked company entity, at least one logged interaction, both phone and email populated, `created_at` within the last 14 days, and `job_title` non-empty
- **When**: The contact detail panel renders the lead score badge
- **Then**: The displayed score is 100 (30 + 20 + 20 + 15 + 15); the badge renders as Hot (red); the tooltip shows each rule with its contribution
- **Acceptance Criterion covered**: AC 1.1 — lead score badge, scoring model, Hot tier, tooltip breakdown

#### Scenario 1.1-B — Lead score tiers render at correct thresholds

- **Given**: Three contacts exist: one with computed score 70 (Hot boundary), one with score 69 (Warm boundary), one with score 39 (Cold boundary)
- **When**: The lead list renders
- **Then**: Score 70 shows red Hot badge; score 69 shows amber Warm badge; score 39 shows gray Cold badge; score 40 shows amber Warm badge
- **Acceptance Criterion covered**: AC 1.1 — Hot/Warm/Cold visual tiers at exact boundaries

#### Scenario 1.1-C — Lead score is never stored; API response contains no `leadScore` field

- **Given**: A contact with a computed score of 85 exists
- **When**: `GET /customers` is called
- **Then**: The response object for that customer does not contain a `leadScore` key; the `lead_score_override` field in the response is `null`
- **Acceptance Criterion covered**: AC 1.1 — score is client-side only; Tech Brief — `leadScore` omitted from `Customer` interface

#### Scenario 1.1-D — Manual lead score override stored and displayed with indicator

- **Given**: A lead contact is open in the detail panel with a computed score of 45 (Warm)
- **When**: The Sales Rep clicks the inline edit on the score badge and enters 90, then saves
- **Then**: `PATCH /customers/:id` is called with `leadScoreOverride: 90`; the badge displays 90 (Hot); a visual "manual override" indicator distinguishes it from a calculated score; the tooltip still shows rule breakdown but indicates override is active
- **Acceptance Criterion covered**: AC 1.1 — manual override, stored in `lead_score_override`, visual distinction

#### Scenario 1.1-E — Lead score recalculates immediately when contributing field changes

- **Given**: A lead contact has `job_title` empty (score 85 without that rule)
- **When**: The Sales Rep adds a `job_title` value and the form updates
- **Then**: The lead score badge updates to 100 without a page reload; no API call is needed for recalculation
- **Acceptance Criterion covered**: AC 1.1 — real-time recalculation

#### Scenario 1.1-F — Unscored lead shows neutral indicator rather than zero

- **Given**: A contact with `status = Lead` has no phone, no email, no company, no interactions, was created more than 14 days ago, and no `job_title` — computed score is 0
- **When**: The lead score badge renders
- **Then**: The badge shows "–" rather than "0"; no Hot/Warm/Cold tier badge is applied
- **Acceptance Criterion covered**: AC 1.1 — unscored lead displays neutral indicator

#### Scenario 1.2-A — Qualifying a lead is a single-click action

- **Given**: A lead contact is open in the Contact Detail panel with `qualification_status = Unqualified`
- **When**: The Rep clicks "Mark Qualified" on the detail panel
- **Then**: `PATCH /customers/:id` is called with `{ qualificationStatus: 'Qualified' }`; the contact's `status` field is unchanged; the detail panel reflects the new status immediately; no confirmation dialog is shown
- **Acceptance Criterion covered**: AC 1.2 — single-click qualification, no automatic status change

#### Scenario 1.2-B — Disqualifying a lead requires category selection and confirmation

- **Given**: A lead contact is open in the Contact Detail panel
- **When**: The Rep clicks "Disqualify"; selects "Budget" from the reason dropdown; optionally enters free text; confirms the action
- **Then**: `PATCH /customers/:id` is called with `{ qualificationStatus: 'Disqualified', disqualificationReason: 'Budget: [free text]' }`; the `disqualification_reason` stores as "Category: free text" format; the contact is hidden from default views
- **Acceptance Criterion covered**: AC 1.2 — disqualification flow, BANT categories, confirmation step

#### Scenario 1.2-C — Disqualified leads are hidden by default but accessible via toggle

- **Given**: Three lead contacts exist: one Qualified, one Unqualified, one Disqualified
- **When**: The Lead Management view loads with the default filter (no toggle)
- **Then**: Only the Qualified and Unqualified leads are shown; the Disqualified lead is not visible
- **When**: The Rep enables the "Show disqualified" toggle
- **Then**: All three leads are visible
- **Acceptance Criterion covered**: AC 1.2 — disqualified hidden by default, toggle filter

#### Scenario 1.2-D — "Qualified Leads" MetricCard shows correct count

- **Given**: The Sheet1 tab contains 10 contacts with `status = Lead`, 4 of which have `qualification_status = Qualified`
- **When**: The StatsRow dashboard renders
- **Then**: The "Qualified Leads" MetricCard displays "4"
- **Acceptance Criterion covered**: AC 1.2 — Qualified Leads metric card

---

### Feature Area 2: Opportunity & Pipeline Management

#### Scenario 2.1-A — Creating an opportunity from the Contact Detail panel (happy path)

- **Given**: A contact detail panel is open for a contact with `id = contact-123`
- **When**: The Rep clicks "Add Opportunity"; fills in name ("Acme Q3 Deal"), value ($25,000), close date (2026-06-30), stage (selects "Qualification" from the populated stages list); clicks Save
- **Then**: `POST /opportunities` is called with `contactId: 'contact-123'`, correct values; the response includes a server-generated UUID and `createdAt`/`updatedAt` timestamps; the new opportunity appears in the linked opportunities list on the Contact Detail panel; the Pipeline Kanban shows the card in the "Qualification" column
- **Acceptance Criterion covered**: AC 2.1 — opportunity creation from Contact Detail, contact_id pre-populated

#### Scenario 2.1-B — Opportunity name is required; value, close_date, stage are required

- **Given**: The "Add Opportunity" form is open
- **When**: The Rep submits the form with `name` left blank
- **Then**: A validation error is shown on the `name` field; no API call is made
- **When**: The Rep submits with `name` filled but `value` absent
- **Then**: A validation error is shown on the `value` field; no API call is made
- **Acceptance Criterion covered**: AC 2.1 — required field validation

#### Scenario 2.1-C — Opportunity name at maximum 200 characters is accepted; 201 characters is rejected

- **Given**: The "Add Opportunity" form is open
- **When**: The Rep enters a name of exactly 200 characters and submits
- **Then**: The opportunity is created successfully
- **When**: The Rep enters a name of 201 characters
- **Then**: The input is either truncated at 200 or a validation error is shown; no opportunity with 201-character name is persisted
- **Acceptance Criterion covered**: AC 2.1 — name max 200 characters

#### Scenario 2.1-D — Marking an opportunity Lost requires a loss reason

- **Given**: An Open opportunity is displayed in the Opportunity detail view
- **When**: The Rep clicks "Mark Lost"; the Won/Lost modal opens; the Rep attempts to confirm without entering a loss reason
- **Then**: The confirm button is disabled or a validation error is shown; no `PATCH /opportunities/:id` call is made
- **When**: The Rep enters a loss reason (up to 500 characters) and confirms
- **Then**: `PATCH /opportunities/:id` is called with `{ status: 'Lost', lossReason: '...' }`; the opportunity disappears from the active Pipeline Kanban; a "Closed Deals" filter reveals it
- **Acceptance Criterion covered**: AC 2.1 — Won/Lost flow, loss reason required

#### Scenario 2.1-E — Closed opportunities excluded from active Pipeline Kanban by default

- **Given**: The opportunityStore contains 5 Open, 2 Won, and 1 Lost opportunity
- **When**: The Pipeline Kanban renders without the "Closed Deals" filter active
- **Then**: Only the 5 Open opportunities appear as cards; the 3 closed opportunities are not shown
- **When**: The Rep enables the "Closed Deals" filter
- **Then**: All 8 opportunities are displayed
- **Acceptance Criterion covered**: AC 2.1 — closed opportunities excluded from active Kanban

#### Scenario 2.2-A — Default five stages are provisioned on first setup

- **Given**: A new user's Google Sheet is provisioned for the first time
- **When**: `GET /pipeline-stages` is called
- **Then**: The response contains exactly five stages: Prospecting (20%), Qualification (40%), Proposal Sent (60%), Negotiation (80%), Closing (90%) in order 1–5; each has a stable UUID defined as a constant
- **Acceptance Criterion covered**: AC 2.2 — default five stages provisioned

#### Scenario 2.2-B — Renaming a stage reflects immediately without data migration

- **Given**: Two opportunities exist with `stage` set to the UUID of the "Prospecting" stage
- **When**: The Admin renames "Prospecting" to "Discovery" via `PATCH /pipeline-stages/:id` with `{ name: 'Discovery' }`
- **Then**: `GET /pipeline-stages` returns the stage with the new name "Discovery"; `GET /opportunities` still returns both opportunities with the same stage UUID; the Pipeline Kanban column header shows "Discovery" without any changes to opportunity rows
- **Acceptance Criterion covered**: AC 2.2 — rename reflected immediately, no data migration

#### Scenario 2.2-C — Stage deletion blocked when Open opportunities reference the stage

- **Given**: A stage "Negotiation" has 3 Open opportunities referencing its UUID
- **When**: `DELETE /pipeline-stages/:id` is called
- **Then**: The API returns `409 Conflict` with `{ conflictCount: 3, message: '...' }`; the stage is not deleted; the UI displays the message "3 open opportunities in this stage — reassign before deleting"
- **Acceptance Criterion covered**: AC 2.2 — deletion blocked with count message

#### Scenario 2.2-D — Stage deletion succeeds when no Open opportunities reference the stage

- **Given**: A stage "Old Stage" has 0 Open opportunities (it may have Won/Lost opportunities)
- **When**: `DELETE /pipeline-stages/:id` is called
- **Then**: The API returns `204 No Content`; the row is physically deleted from the PipelineStages tab (not blanked); the Pipeline Kanban no longer renders that column
- **Acceptance Criterion covered**: AC 2.2 — deletion succeeds with 0 Open opportunities; Tech Brief — physical row deletion

#### Scenario 2.2-E — Stage count is limited to 10

- **Given**: The PipelineStages tab already contains 10 stages
- **When**: The Admin attempts to add an eleventh stage via the Settings panel
- **Then**: The "Add Stage" action is disabled or a UI error is shown; no `POST /pipeline-stages` call is made
- **Acceptance Criterion covered**: AC 2.2 — 10-stage maximum

#### Scenario 2.3-A — Pipeline Kanban renders all Open opportunities grouped by stage

- **Given**: 8 Open opportunities exist across 3 stages: 3 in Prospecting, 3 in Qualification, 2 in Negotiation
- **When**: The Pipeline page loads
- **Then**: Three columns render in stage order; "Prospecting" column shows 3 cards; "Qualification" shows 3 cards; "Negotiation" shows 2 cards; each column header shows deal count and sum of `value` for that column
- **Acceptance Criterion covered**: AC 2.3 — Kanban renders by stage, column count + value sum

#### Scenario 2.3-B — Dragging a card to a new stage updates stage and probability optimistically

- **Given**: An opportunity "Deal A" is in the "Prospecting" column with probability 20 (stage default, not manually overridden)
- **When**: The Rep drags "Deal A" to the "Qualification" column and drops it
- **Then**: The card moves immediately in the UI (optimistic update); `PATCH /opportunities/:id` is called with `{ stage: qualificationStageId, probability: 40 }` (Qualification default); on API success, the card stays in the new column; the opportunityStore reflects the new stage
- **Acceptance Criterion covered**: AC 2.3 — drag-drop stage update, probability default applied, optimistic update

#### Scenario 2.3-C — Drag-drop rolls back on API failure with toast

- **Given**: An opportunity is in the "Prospecting" column; the API is configured to return a 500 error
- **When**: The Rep drags the card to "Qualification" and drops it
- **Then**: The card moves immediately (optimistic); the API call returns 500; the card returns to "Prospecting" automatically; the opportunityStore is restored to pre-drag state; a toast error notification appears
- **Acceptance Criterion covered**: AC 2.3 — optimistic rollback on API failure

#### Scenario 2.3-D — Pipeline search/filter bar narrows visible cards

- **Given**: The Pipeline Kanban shows 10 opportunity cards across multiple stages
- **When**: The Rep types "Acme" in the search bar
- **Then**: Only cards whose contact name or company name contains "Acme" (case-insensitive) remain visible; empty columns show a reduced or zero-card state; the column count/value headers update to reflect only visible cards
- **Acceptance Criterion covered**: AC 2.3 — search/filter by contact name, company name

#### Scenario 2.3-E — Pipeline page empty state shows CTA when opportunityStore is empty

- **Given**: The opportunityStore contains zero opportunities
- **When**: The Pipeline page renders
- **Then**: A "No opportunities yet" empty state is displayed with a call-to-action prompt; no empty columns or blank UI regions are shown; no JavaScript errors occur
- **Acceptance Criterion covered**: UX Brief — empty state with CTA

---

### Feature Area 3: Sales Forecasting

#### Scenario 3.1-A — Total Pipeline Value and Weighted Pipeline compute correctly

- **Given**: Three Open opportunities exist: A ($10,000, probability 50%), B ($5,000, probability 80%), C ($20,000, probability 25%)
- **When**: The Forecast page renders
- **Then**: Total Pipeline Value = $35,000; Weighted Pipeline = $10,000×0.5 + $5,000×0.8 + $20,000×0.25 = $14,000; values display formatted as USD (e.g., "$14,000")
- **Acceptance Criterion covered**: AC 3.1 — total and weighted pipeline value

#### Scenario 3.1-B — Expected Close This Month and This Quarter filter by close_date

- **Given**: Today is 2026-03-15; two Open opportunities exist: X with `close_date = 2026-03-25` and probability 60% ($10,000); Y with `close_date = 2026-05-10` and probability 70% ($20,000); Q1 2026 is Jan–Mar
- **When**: The Forecast page renders
- **Then**: Expected Close This Month = $10,000×0.6 = $6,000 (only X qualifies); Expected Close This Quarter = $6,000 (Q1 2026 ends March 31, so only X qualifies); deal counts on each MetricCard are correct (1 deal each)
- **Acceptance Criterion covered**: AC 3.1 — Expected Close This Month, Expected Close This Quarter

#### Scenario 3.1-C — Forecast metrics update reactively when store changes

- **Given**: The Forecast page is open with zero opportunities
- **When**: A new opportunity is added via the Pipeline page (triggers store update)
- **Then**: The Forecast MetricCards update without a page reload or additional API call
- **Acceptance Criterion covered**: AC 3.1 — real-time store-driven updates

#### Scenario 3.2-A — Win Rate shows "Not enough data" with fewer than 3 closed deals

- **Given**: Zero closed opportunities exist in the trailing 90 days
- **When**: The Forecast page renders
- **Then**: Win Rate MetricCard shows "Not enough data"
- **Given**: Exactly 2 closed opportunities exist in the trailing 90 days (1 Won, 1 Lost)
- **When**: The Forecast page renders
- **Then**: Win Rate MetricCard still shows "Not enough data"
- **Given**: Exactly 3 closed opportunities exist in the trailing 90 days (2 Won, 1 Lost)
- **When**: The Forecast page renders
- **Then**: Win Rate shows "67%" with supporting text "2 Won / 1 Lost"
- **Acceptance Criterion covered**: AC 3.2 — Win Rate threshold, "Not enough data" behavior

#### Scenario 3.2-B — Win Rate uses trailing 90-day window exclusively

- **Given**: 5 closed opportunities exist: 3 Won within the last 90 days, 2 Won closed 91 days ago, 1 Lost 91 days ago
- **When**: The Forecast page renders
- **Then**: Win Rate considers only the 3 recent opportunities; the 3 opportunities older than 90 days are excluded; Win Rate = 100% (3 Won / 0 Lost in window) with "Not enough data" not shown because count >= 3
- **Acceptance Criterion covered**: AC 3.2 — 90-day trailing window

#### Scenario 3.2-C — Average Deal Age computed correctly for open and closed deals

- **Given**: Today is 2026-03-15; one Open opportunity created 2026-01-01 (73 days ago); one Won opportunity with `createdAt = 2026-01-01` and `updatedAt = 2026-02-15` (45 days from created to closed)
- **When**: The Forecast page renders
- **Then**: Average Deal Age = (73 + 45) / 2 = 59 days (whole number displayed)
- **Acceptance Criterion covered**: AC 3.2 — Average Deal Age for open (to today) and closed (to updatedAt)

#### Scenario 3.2-D — Pipeline by Stage breakdown table is correct and sortable

- **Given**: Stage "Prospecting" has 3 deals totaling $30,000 with weighted value $6,000
- **When**: The Forecast page renders the Pipeline by Stage table
- **Then**: The row for "Prospecting" shows: deal count 3, total value $30,000, weighted value $6,000
- **When**: The Rep clicks the "Total Value" column header
- **Then**: The table sorts by total value descending; clicking again sorts ascending
- **Acceptance Criterion covered**: AC 3.2 — Pipeline by Stage breakdown, sortable

#### Scenario 3.3-A — Overdue flag: Open opportunity with past close_date shows red date indicator

- **Given**: Today is 2026-03-15; an Open opportunity has `close_date = 2026-03-01` (14 days past)
- **When**: The Pipeline Kanban renders
- **Then**: The opportunity card displays the close date in red; no amber indicator is present unless At-Risk conditions are also met
- **Acceptance Criterion covered**: AC 3.3 — Overdue flag, red date indicator

#### Scenario 3.3-B — At-Risk flag: close_date within 14 days and no recent interaction

- **Given**: Today is 2026-03-15; an Open opportunity has `close_date = 2026-03-25` (10 days away); the linked contact has no interactions logged in the last 7 days
- **When**: The Pipeline Kanban renders
- **Then**: The opportunity card displays an amber warning indicator
- **Acceptance Criterion covered**: AC 3.3 — At-Risk flag, amber indicator

#### Scenario 3.3-C — At-Risk flag clears when a recent interaction exists

- **Given**: The same setup as 3.3-B, but the linked contact has an interaction logged today (2026-03-15)
- **When**: The Pipeline Kanban renders
- **Then**: No amber At-Risk indicator appears on the card; the card displays normally
- **Acceptance Criterion covered**: AC 3.3 — At-Risk condition requires absence of recent interaction

#### Scenario 3.3-D — Won/Lost opportunities do not receive Overdue or At-Risk flags

- **Given**: A Won opportunity has `close_date = 2026-01-01` (past) and the linked contact has no recent interactions
- **When**: The Pipeline Kanban renders (with "Closed Deals" filter active)
- **Then**: The Won opportunity card has no red date indicator and no amber indicator
- **Acceptance Criterion covered**: AC 3.3 — flags are for Open opportunities only (`status = Open`)

#### Scenario 3.3-E — "At Risk & Overdue" filter button surfaces only flagged cards with count badge

- **Given**: 10 Open opportunities exist: 3 Overdue, 2 At-Risk, 1 both Overdue and At-Risk, 4 neither
- **When**: The Rep clicks the "At Risk & Overdue" filter button
- **Then**: Only the 6 flagged opportunities (3+2+1) are shown; the filter button badge displays "6"; non-flagged cards are hidden
- **Acceptance Criterion covered**: AC 3.3 — At Risk & Overdue filter with count badge

---

### Feature Area 4: Quote & Proposal Management

#### Scenario 4.1-A — Creating a quote from an Opportunity (happy path)

- **Given**: An Open opportunity is displayed in the Opportunity detail view
- **When**: The Rep clicks "Create Quote"; fills in title, adds 2 line items (Item A: qty 2, unit price $500; Item B: qty 1, unit price $1,000); sets `discount_percent = 10`; the `valid_until` defaults to today + 30 days
- **Then**: `subtotal` displays $2,000 live as the Rep types; `total` displays $1,800 ($2,000 × 0.9); `POST /quotes` is called with the correct data; the response includes `subtotal: 2000`, `total: 1800` (server-computed); `status = 'Draft'`; the quote appears in the "Quotes" section of the Opportunity detail view
- **Acceptance Criterion covered**: AC 4.1 — quote creation, line items, discount, server-computed subtotal/total, Draft initial status

#### Scenario 4.1-B — Quote pre-populates contact_id, company_id, opportunity_id

- **Given**: An opportunity linked to contact "Jane Doe" at company "Acme Corp" is open
- **When**: The Rep opens the Create Quote form
- **Then**: The form shows "Jane Doe" and "Acme Corp" as read-only context; `contact_id`, `company_id`, and `opportunity_id` are pre-populated in the request payload without the Rep entering them
- **Acceptance Criterion covered**: AC 4.1 — pre-populated IDs, read-only contact/company display

#### Scenario 4.1-C — valid_until defaults to 30 days from creation and is editable

- **Given**: The Create Quote form opens on 2026-03-15
- **When**: The form renders
- **Then**: `valid_until` defaults to 2026-04-14
- **When**: The Rep changes it to 2026-05-01 and saves
- **Then**: `POST /quotes` includes `validUntil: '2026-05-01'`
- **Acceptance Criterion covered**: AC 4.1 — valid_until default and editability

#### Scenario 4.1-D — Multiple quotes per opportunity are all visible

- **Given**: An opportunity already has two quotes in Draft status
- **When**: The Rep creates a third quote
- **Then**: All three quotes are visible in the "Quotes" section of the Opportunity detail view, each showing name, total, status badge, and valid_until
- **Acceptance Criterion covered**: AC 4.1 — multiple quotes per opportunity

#### Scenario 4.2-A — Quote status transitions: allowed transitions show as active buttons

- **Given**: A quote with `status = 'Draft'` is displayed
- **When**: The Rep views the status action buttons
- **Then**: "Mark Sent" and "Mark Expired" buttons are active/enabled; no "Mark Accepted" or "Mark Declined" buttons are shown as active
- **Given**: The same quote is advanced to `status = 'Sent'`
- **Then**: "Mark Accepted", "Mark Declined", and "Mark Expired" buttons are active; "Mark Sent" button is not present or is grayed out
- **Acceptance Criterion covered**: AC 4.2 — only allowed transitions shown as active; UX Brief — grayed-out invalid transitions

#### Scenario 4.2-B — Advancing to Sent sets sentAt server-side

- **Given**: A Draft quote exists
- **When**: `PATCH /quotes/:id` is called with `{ status: 'Sent' }`
- **Then**: The response includes `sentAt` set to the current server timestamp (ISO string); the client-side display shows the sent date; if the client sent a `sentAt` value in the request body, it is ignored
- **Acceptance Criterion covered**: AC 4.2 — sentAt server-set on Sent transition

#### Scenario 4.2-C — Marking a quote Accepted prompts to mark the linked Opportunity Won

- **Given**: A Sent quote exists linked to an Open opportunity
- **When**: The Rep marks the quote as Accepted
- **Then**: A confirmation prompt appears asking whether to mark the parent Opportunity as Won; if the Rep confirms, `PATCH /opportunities/:id` with `{ status: 'Won' }` is called; if the Rep declines, only the quote is updated
- **Acceptance Criterion covered**: AC 4.2 — Won confirmation prompt on quote Accepted

#### Scenario 4.2-D — Backward status transitions are rejected with 422

- **Given**: A quote with `status = 'Accepted'` exists
- **When**: `PATCH /quotes/:id` is called with `{ status: 'Draft' }`
- **Then**: The API returns `422 Unprocessable Entity` with `{ allowedTransitions: [] }` (no transitions allowed from Accepted)
- **Given**: A quote with `status = 'Sent'` exists
- **When**: `PATCH /quotes/:id` is called with `{ status: 'Draft' }`
- **Then**: The API returns `422` with `{ allowedTransitions: ['Accepted', 'Declined', 'Expired'] }`
- **Acceptance Criterion covered**: AC 4.2 — backward transitions blocked; Tech Brief — 422 with allowedTransitions

#### Scenario 4.2-E — Auto-expire stale Sent quotes on OpportunityDetailPage mount

- **Given**: A Sent quote has `valid_until = 2026-03-01` (past); today is 2026-03-15; the OpportunityDetailPage has not been visited since the quote expired
- **When**: The Rep navigates to the OpportunityDetailPage
- **Then**: The quote's status updates to "Expired" immediately in the UI (optimistic); `PATCH /quotes/:id` with `{ status: 'Expired' }` is fired in the background; if the PATCH fails, the error is logged but no blocking error is shown to the user
- **When**: The Rep navigates away and back to the same page
- **Then**: No additional PATCH is fired for the same quote (it is now Expired, not Sent)
- **Acceptance Criterion covered**: AC 4.2 — auto-expire stale Sent quotes on mount; Tech Brief — fire-and-forget

#### Scenario 4.2-F — "Quotes Sent" MetricCard on StatsRow

- **Given**: 5 quotes have `status = 'Sent'` and were created in the last 30 days; 2 quotes have `status = 'Sent'` but were created 45 days ago
- **When**: The dashboard StatsRow renders
- **Then**: The "Quotes Sent" MetricCard displays "5" (only last 30 days)
- **Acceptance Criterion covered**: AC 4.2 — Quotes Sent metric card, last 30 days window

#### Scenario 4.3-A — PDF export does not change the quote's status

- **Given**: A Draft quote is displayed in the Opportunity detail view
- **When**: The Rep clicks "Export PDF"
- **Then**: The browser print dialog opens; after the Rep completes or cancels the print, the quote's status remains "Draft"; no API call to `PATCH /quotes/:id` is made
- **Acceptance Criterion covered**: AC 4.3 — PDF export does not change status

#### Scenario 4.3-B — PDF filename defaults to correct pattern

- **Given**: A quote with `id = 'abc12345-...'` is linked to a contact with `last_name = 'Smith'`
- **When**: The Rep exports the PDF
- **Then**: The browser print dialog shows the document title as `Quote-abc12345-Smith.pdf`
- **Acceptance Criterion covered**: AC 4.3 — PDF filename pattern

#### Scenario 4.3-C — PDF export is only available on Draft or Sent quotes

- **Given**: A quote with `status = 'Accepted'` is displayed
- **When**: The Rep views the quote actions
- **Then**: The "Export PDF" button is not present or is disabled; no print dialog is triggered
- **Acceptance Criterion covered**: AC 4.3 — PDF export available on Draft or Sent status only

---

## 4. Acceptance Test Cases

### AC-01: Lead Score Calculation (Story 1.1)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Open a lead contact detail panel where all five scoring conditions are met | Lead score badge displays 100 | |
| 2 | Hover over the badge | Tooltip shows five lines: "+30 Company linked", "+20 Interaction logged", "+20 Phone and email populated", "+15 Created within 14 days", "+15 Job title populated" | |
| 3 | Remove the contact's `job_title` value | Badge updates to 85 immediately without page reload | |
| 4 | Call `GET /customers` and inspect the response for this contact | Response object does not contain `leadScore` key; `leadScoreOverride` is `null` | |
| 5 | Open the inline edit; enter `90` as the override value; save | `PATCH /customers/:id` fires with `{ leadScoreOverride: 90 }`; badge displays 90 with manual indicator | |
| 6 | Verify score tier boundaries: set score to 70 | Hot (red) badge displays | |
| 7 | Verify score tier boundaries: set score to 69 | Warm (amber) badge displays | |
| 8 | Verify score tier boundaries: set score to 40 | Warm (amber) badge displays | |
| 9 | Verify score tier boundaries: set score to 39 | Cold (gray) badge displays | |
| 10 | Verify unscored state: all conditions unmet, override is null | Badge displays "–" rather than "0" or "Cold" | |

### AC-02: Lead Qualification Workflow (Story 1.2)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Open a lead with `qualification_status = Unqualified`; click "Mark Qualified" | `PATCH /customers/:id` fires with `{ qualificationStatus: 'Qualified' }`; no confirmation dialog shown; contact `status` field unchanged | |
| 2 | Open a lead; click "Disqualify"; submit without selecting a category | Form validation blocks submission | |
| 3 | Select "Budget" category; optionally enter free text "No headcount this quarter"; click Confirm | `PATCH /customers/:id` fires with `{ qualificationStatus: 'Disqualified', disqualificationReason: 'Budget: No headcount this quarter' }` | |
| 4 | Check the Lead Management default view | The disqualified contact is not visible | |
| 5 | Enable "Show disqualified" toggle | The disqualified contact appears | |
| 6 | Verify StatsRow "Qualified Leads" MetricCard | Card count equals the number of contacts with `status = Lead` AND `qualificationStatus = Qualified` | |
| 7 | Enter 501 characters in the disqualification reason free-text field | Input is rejected or truncated at 500 characters | |

### AC-03: Opportunity Entity (Story 2.1)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Open Contact Detail panel; click "Add Opportunity"; fill required fields; save | `POST /opportunities` called; response includes UUID, `createdAt`, `updatedAt`, `status: 'Open'` | |
| 2 | Submit form with `name` blank | Client-side validation error shown; no API call | |
| 3 | Submit form with `value` blank | Client-side validation error shown; no API call | |
| 4 | Submit form with `name` = 200 characters | Opportunity created successfully | |
| 5 | Submit form with `name` = 201 characters | Validation error or truncation; opportunity not created with 201-char name | |
| 6 | Open Opportunity detail view; click "Mark Lost" without entering loss reason; try to confirm | Confirm button disabled or error shown; no API call | |
| 7 | Enter loss reason (max 500 chars); confirm Lost | `PATCH /opportunities/:id` with `{ status: 'Lost', lossReason: '...' }`; opportunity removed from active Kanban | |
| 8 | Enter loss reason of 501 characters | Rejected or truncated at 500 | |
| 9 | Enable "Closed Deals" filter on Kanban | Won and Lost opportunities appear | |
| 10 | Verify Contact Detail panel shows linked opportunity with name, stage, value, close_date | All four fields display correctly; clicking the link navigates to Opportunity detail view | |

### AC-04: Customizable Sales Stages (Story 2.2)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Provision a fresh sheet; call `GET /pipeline-stages` | Response contains exactly 5 stages with correct names, probabilities (20/40/60/80/90), and orders (1–5) | |
| 2 | `PATCH /pipeline-stages/:id` with `{ name: 'Discovery' }` on Prospecting stage | Stage name updates; `GET /opportunities` still returns opportunities with the same stage UUID | |
| 3 | Pipeline Kanban reloads after rename | Column header shows "Discovery" | |
| 4 | Attempt `DELETE /pipeline-stages/:id` on a stage with 2 Open opportunities | Response: `409 Conflict`, body includes `conflictCount: 2` | |
| 5 | Verify UI message on 409 | "2 open opportunities in this stage — reassign before deleting" is displayed | |
| 6 | Move the 2 opportunities to other stages; retry `DELETE` | `204 No Content`; row physically removed from PipelineStages tab (not blanked) | |
| 7 | `POST /pipeline-stages` when 10 stages exist | Request is blocked client-side (button disabled) or server returns 400 | |
| 8 | `POST /pipeline-stages` when 9 stages exist | Stage created successfully; now 10 total | |

### AC-05: Pipeline Kanban Board (Story 2.3)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to `/pipeline` with Open opportunities in 3 stages | Kanban renders 3 columns in stage order; each column header shows deal count and value sum | |
| 2 | Navigate to `/pipeline` with zero opportunities | "No opportunities yet" empty state with CTA renders; no JS errors | |
| 3 | Drag a card to a new stage column; API succeeds | Card moves immediately (optimistic); `PATCH /opportunities/:id` called with new stage UUID and stage default probability; card stays in new column | |
| 4 | Drag a card to a new stage column; API returns 500 | Card moves, then returns to original column; toast error appears; store state matches pre-drag state | |
| 5 | Type "Acme" in the search bar | Only cards with "Acme" in contact or company name remain visible | |
| 6 | Set a close date range filter | Only cards with close_date within the range remain visible | |
| 7 | Pipeline page is accessible from main navigation | Clicking the navigation item loads `/pipeline` | |

### AC-06: Pipeline Value Summary (Story 3.1)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Open Forecast page with known opportunity data | Total Pipeline Value = correct sum of all Open opportunity values | |
| 2 | Verify Weighted Pipeline | Weighted = sum of (value × probability/100) for all Open opportunities | |
| 3 | Verify Expected Close This Month | Weighted value of Open opportunities with close_date in current calendar month | |
| 4 | Verify Expected Close This Quarter | Weighted value of Open opportunities with close_date in current calendar quarter | |
| 5 | Add a new opportunity via the Pipeline page | Forecast MetricCards update without page reload | |
| 6 | Verify currency formatting | All values display as USD with comma separators (e.g., "$12,450") | |
| 7 | Verify MetricCard secondary count | Each card shows the number of deals contributing to that metric | |

### AC-07: Win Rate & Deal Velocity (Story 3.2)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Forecast page with 0 closed deals in 90 days | Win Rate shows "Not enough data" | |
| 2 | Forecast page with exactly 2 closed deals in 90 days | Win Rate shows "Not enough data" | |
| 3 | Forecast page with exactly 3 closed deals (2 Won, 1 Lost) in 90 days | Win Rate shows "67%" with "2 Won / 1 Lost" | |
| 4 | Include closed deals older than 90 days | Deals older than 90 days excluded from Win Rate calculation | |
| 5 | Verify Average Deal Age for an open opportunity | Days = today minus `created_at` (whole number) | |
| 6 | Verify Average Deal Age for a closed opportunity | Days = `updated_at` minus `created_at` (whole number) | |
| 7 | Verify Pipeline by Stage breakdown table columns | Stage name, deal count, total value, weighted value, average days in stage all present | |
| 8 | Click a sortable column header in the breakdown table | Table sorts; clicking again reverses sort direction | |

### AC-08: Close Date Risk Flagging (Story 3.3)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Open opportunity with `close_date` yesterday and `status = Open` | Red date indicator on Kanban card | |
| 2 | Won opportunity with `close_date` yesterday | No red indicator | |
| 3 | Open opportunity with `close_date` 10 days from today, linked contact has no interactions in 7 days | Amber At-Risk indicator on card | |
| 4 | Open opportunity with `close_date` 10 days from today, linked contact has interaction logged today | No amber indicator | |
| 5 | Open opportunity with `close_date` 15 days from today, no recent interactions | No At-Risk indicator (outside 14-day window) | |
| 6 | Click "At Risk & Overdue" filter button | Only flagged cards visible; filter button badge shows correct count | |
| 7 | Click a flagged card | Opportunity detail view opens; linked contact's interaction log is visible | |

### AC-09: Quote Creation (Story 4.1)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Create Quote" on an Open opportunity | Form opens; `contact_id`, `company_id`, `opportunity_id` pre-populated; contact and company names shown read-only | |
| 2 | Add 2 line items; observe subtotal and total | Subtotal updates live = sum(qty × unit_price); total updates live = subtotal × (1 - discount/100) | |
| 3 | Set discount to 10%; add a $1,000 item (qty 1) | Subtotal = $1,000; total = $900; displayed separately | |
| 4 | Submit the form | `POST /quotes` called; response: `subtotal` and `total` server-computed; `status = 'Draft'` | |
| 5 | Verify `valid_until` default | Defaults to creation date + 30 days | |
| 6 | Change `valid_until` and save | `POST /quotes` includes the custom date | |
| 7 | Verify quote appears in Opportunity detail Quotes section | Quote visible with title, total, status badge, valid_until | |
| 8 | Create a second quote on the same opportunity | Both quotes visible in the Quotes section | |
| 9 | Attempt to set discount_percent to 101 | Validation error; not submitted | |

### AC-10: Quote Status Tracking (Story 4.2)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | View a Draft quote — available transitions | "Mark Sent" and "Mark Expired" active; "Mark Accepted" and "Mark Declined" not active | |
| 2 | Advance Draft to Sent | `PATCH /quotes/:id` called with `{ status: 'Sent' }`; response includes server-set `sentAt` timestamp | |
| 3 | View a Sent quote — available transitions | "Mark Accepted", "Mark Declined", "Mark Expired" active; "Mark Sent" not active | |
| 4 | Advance Sent to Accepted | Confirmation prompt shown asking to mark linked Opportunity Won | |
| 5 | Confirm Won from prompt | `PATCH /opportunities/:id` with `{ status: 'Won' }` called; opportunity removed from active Kanban | |
| 6 | Decline Won from prompt | Only quote updated to Accepted; opportunity remains Open | |
| 7 | Attempt invalid transition (Accepted → Draft) via direct `PATCH` | `422 Unprocessable Entity` with `allowedTransitions: []` | |
| 8 | Attempt Sent → Draft via direct `PATCH` | `422` with `allowedTransitions: ['Accepted', 'Declined', 'Expired']` | |
| 9 | Load OpportunityDetailPage with a Sent quote where `valid_until` is past | Quote status changes to Expired in UI immediately; background PATCH fires; no blocking error on failure | |
| 10 | Revisit the same page after auto-expiry | No additional PATCH fired for already-Expired quote | |
| 11 | Verify "Quotes Sent" MetricCard | Count = quotes with `status = 'Sent'` created in last 30 days only | |

### AC-11: Quote PDF Export (Story 4.3)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Export PDF" on a Draft quote | Browser print dialog opens | |
| 2 | Verify PDF content | Includes: sender name/email from JWT, contact name/company, quote title, line items table, subtotal, discount, total, valid_until, notes | |
| 3 | Verify PDF filename | Document title = `Quote-[first 8 chars of id]-[contact last name].pdf` | |
| 4 | After closing print dialog | Quote status remains "Draft"; no `PATCH /quotes/:id` was called | |
| 5 | Verify "Export PDF" on Accepted quote | Button not present or disabled | |
| 6 | Verify "Export PDF" on Expired quote | Button not present or disabled | |

---

## 5. API Contract Tests

### Opportunities Endpoints

#### `GET /opportunities`

| Scenario | Setup | Expected Response | Verify |
|----------|-------|------------------|--------|
| Happy path — authenticated | Valid JWT; 5 opportunities in sheet | `200 OK`; array of 5 Opportunity objects including Won and Lost | All fields correctly mapped from sheet columns A:M |
| Unauthenticated | No Authorization header | `401 Unauthorized` | Response body matches error contract |
| Expired JWT | Expired token | `401 Unauthorized` | |
| Empty tab (headers only) | PipelineStages tab has only header row | `200 OK`; empty array `[]` | No crash on `slice(1)` of header-only data |
| `probability` stored as numeric string | Sheet cell contains "40" | Parsed to integer `40` in response | |
| `value` stored as numeric string | Sheet cell contains "25000" | Parsed to number `25000` | |
| `status` absent on legacy row | Sheet row has no status column | Defaults to `'Open'` | |

#### `POST /opportunities`

| Scenario | Setup | Expected Response | Verify |
|----------|-------|------------------|--------|
| Happy path | Valid JWT; valid body with all required fields | `201 Created`; Opportunity object with server-generated `id`, `createdAt`, `updatedAt` | Row appended to Opportunities tab; `updatedAt` is server timestamp |
| Missing `name` | Body without `name` field | `400 Bad Request` | Error message references `name` |
| Missing `value` | Body without `value` field | `400 Bad Request` | |
| Missing `closeDate` | Body without `closeDate` | `400 Bad Request` | |
| Missing `stage` | Body without `stage` | `400 Bad Request` | |
| `probability` omitted | Body without `probability`; stage has `probability_default = 40` | `201 Created`; `probability = 40` in response | |
| `probability` provided | Body with `probability: 75` | `201 Created`; `probability = 75` | |
| `name` = 200 chars | Valid request | `201 Created` | |
| `name` = 201 chars | Invalid request | `400 Bad Request` | |
| Client provides `updatedAt` | Body includes `updatedAt: '2020-01-01'` | `201 Created`; response `updatedAt` is server timestamp, not `2020-01-01` | |

#### `PATCH /opportunities/:id`

| Scenario | Setup | Expected Response | Verify |
|----------|-------|------------------|--------|
| Update stage (drag-drop) | Valid JWT; existing opportunity; valid stage UUID | `200 OK`; `stage` updated; `updatedAt` refreshed | Sheet row updated in correct column |
| Status → Lost without lossReason | Body: `{ status: 'Lost' }` | `400 Bad Request` | Error references lossReason required |
| Status → Lost with lossReason | Body: `{ status: 'Lost', lossReason: 'Budget cut' }` | `200 OK`; `status = 'Lost'` | `lossReason` stored in correct column |
| Status → Won | Body: `{ status: 'Won' }` | `200 OK`; `status = 'Won'` | |
| Opportunity not found | Non-existent `:id` | `404 Not Found` | |
| Unauthenticated | No JWT | `401 Unauthorized` | |
| Client provides `updatedAt` | Body includes `updatedAt: '2020-01-01'` | `200 OK`; `updatedAt` in response is server timestamp | |

#### `DELETE /pipeline-stages/:id`

| Scenario | Setup | Expected Response | Verify |
|----------|-------|------------------|--------|
| Stage with 0 Open opportunities | Stage exists; 0 Open opps reference it (2 Won allowed) | `204 No Content` | Row physically deleted from PipelineStages tab; no blank row left |
| Stage with 1 Open opportunity | 1 Open opp references stage | `409 Conflict`; `conflictCount: 1` | Stage row not modified |
| Stage with 3 Open opportunities | 3 Open opps reference stage | `409 Conflict`; `conflictCount: 3` | |
| Non-existent stage ID | Invalid UUID | `404 Not Found` | |
| Blank row created on delete | (negative test) | Row is physically deleted; `GET /pipeline-stages` returns no extra blank entry | |

#### `PATCH /quotes/:id` — Status Transitions

| Current Status | Requested Status | Expected Response | Notes |
|---------------|-----------------|------------------|-------|
| Draft | Sent | `200 OK`; `sentAt` set server-side | `sentAt` in response is non-empty ISO timestamp |
| Draft | Expired | `200 OK` | |
| Draft | Accepted | `422`; `allowedTransitions: ['Sent', 'Expired']` | |
| Draft | Declined | `422`; `allowedTransitions: ['Sent', 'Expired']` | |
| Sent | Accepted | `200 OK` | |
| Sent | Declined | `200 OK` | |
| Sent | Expired | `200 OK` | |
| Sent | Draft | `422`; `allowedTransitions: ['Accepted', 'Declined', 'Expired']` | |
| Accepted | (any) | `422`; `allowedTransitions: []` | Terminal state |
| Declined | (any) | `422`; `allowedTransitions: []` | Terminal state |
| Expired | (any) | `422`; `allowedTransitions: []` | Terminal state |

#### `POST /quotes` — Computation Verification

| Scenario | Line Items | Discount | Expected subtotal | Expected total |
|----------|-----------|---------|------------------|---------------|
| Single item | [{qty:1, unit_price:100}] | 0 | 100 | 100 |
| Multiple items | [{qty:2, unit_price:50}, {qty:3, unit_price:100}] | 0 | 400 | 400 |
| With discount | [{qty:1, unit_price:1000}] | 10 | 1000 | 900 |
| Max discount | [{qty:1, unit_price:500}] | 100 | 500 | 0 |
| Client provides subtotal | Body includes `subtotal: 999` | 0 | server-computed value | Client value ignored |
| Client provides total | Body includes `total: 999` | 0 | server-computed value | Client value ignored |

---

## 6. Client-Side Computation Tests

### 6.1 Lead Score Formula (`computeLeadScore`)

All tests use unit test scenarios for `apps/web/src/lib/leadScore.ts`:

| Test Case | Input State | Expected Score | Notes |
|-----------|-------------|---------------|-------|
| All conditions met | Company linked, interaction exists, phone+email set, created 7d ago, job_title set | 100 | |
| No conditions met | No company, no interaction, no phone, no email, created 20d ago, no job_title | 0 | |
| Only company linked | Company linked only | 30 | |
| Only interaction | One interaction only | 20 | |
| Phone only (no email) | Phone set, email empty | 0 (partial condition) | +20 requires BOTH phone AND email |
| Email only (no phone) | Email set, phone empty | 0 (partial condition) | |
| Phone + email | Both set | 20 | |
| Created 13 days ago | `created_at` = today - 13d | +15 applied | Boundary: within 14 days |
| Created 14 days ago | `created_at` = today - 14d | +15 applied | Boundary: exactly 14 days |
| Created 15 days ago | `created_at` = today - 15d | +15 NOT applied | Boundary: outside 14 days |
| job_title non-empty | `job_title = 'CEO'` | +15 applied | |
| job_title whitespace only | `job_title = '   '` | Treat as empty; +15 NOT applied | Define trimming behavior |
| Override set | `leadScoreOverride = 90` | Display 90; `computeLeadScore` not called | |
| Override is null | `leadScoreOverride = null` | Call `computeLeadScore` | |
| Override is 0 | `leadScoreOverride = 0` | Display 0 with manual indicator | Distinct from "unscored" |
| Max score does not exceed 100 | All conditions met | 100 | Cannot exceed 100 |
| Score is non-negative | No conditions met | 0 | Cannot be negative |

### 6.2 Forecast Metrics (`useForecastMetrics`)

| Test Case | Input | Expected Output |
|-----------|-------|----------------|
| Empty opportunities array | `[]` | All metrics = 0; Win Rate = null; averageDealAgeDays = 0 |
| Total Pipeline Value | 3 Open opps: $10k, $20k, $5k | `totalPipeline = 35000` |
| Weighted Pipeline | [{value:10000, prob:50}, {value:5000, prob:80}] | `weightedPipeline = 9000` |
| Close This Month — in month | `close_date = 2026-03-20`, today 2026-03-15 | Included in `expectedCloseThisMonth` |
| Close This Month — out of month | `close_date = 2026-04-01`, today 2026-03-15 | NOT included |
| Close This Month — boundary (last day) | `close_date = 2026-03-31`, today 2026-03-15 | Included |
| Close This Quarter — Q1 in | `close_date = 2026-03-31`, today 2026-03-15 | Included in `expectedCloseThisQuarter` |
| Close This Quarter — Q2 out | `close_date = 2026-04-01`, today 2026-03-15 | NOT included |
| Won/Lost opps excluded from pipeline | 1 Won ($10k), 2 Open ($5k each) | `totalPipeline = 10000` (only Open) |
| Win Rate — 0 closed | No closed deals | `winRate = null` |
| Win Rate — 1 closed | 1 Won | `winRate = null` |
| Win Rate — 2 closed | 2 Won | `winRate = null` |
| Win Rate — 3 closed (3 Won) | All Won in 90d | `winRate = 100`, `numerator = 3`, `denominator = 3` |
| Win Rate — 3 closed (2 Won, 1 Lost) | In 90d | `winRate = 66.67` (rounded) |
| Win Rate — excludes >90d | 3 Won in 90d, 5 Lost at 91d | `denominator = 3` (not 8) |
| Win Rate — boundary at 90 days | Closed deal exactly 90 days ago | Included (closed deal exactly on boundary) |
| Win Rate — boundary at 91 days | Closed deal exactly 91 days ago | Excluded |
| Avg Deal Age — open opp | Created 30d ago, status Open | 30 days |
| Avg Deal Age — closed opp | createdAt=30d ago, updatedAt=10d ago | 20 days (updatedAt - createdAt) |
| Avg Deal Age — mixed | 1 open (30d age), 1 closed (20d age) | 25 days average |
| Currency format | `totalPipeline = 12450` | Displayed as "$12,450" |
| byStage: correct stage aggregation | Stage A has 2 opps with $5k and $10k | Row: count=2, total=$15,000, weighted per probability |

### 6.3 Overdue & At-Risk Flags (`computeOpportunityFlags`)

| Test Case | Opportunity | Interactions | Expected Flags |
|-----------|------------|-------------|---------------|
| Overdue: past close_date, Open | `close_date = yesterday`, `status = 'Open'` | Any | `isOverdue = true` |
| Not overdue: past close_date, Won | `close_date = yesterday`, `status = 'Won'` | Any | `isOverdue = false` |
| Not overdue: future close_date | `close_date = tomorrow`, `status = 'Open'` | Any | `isOverdue = false` |
| Not overdue: today's close_date | `close_date = today`, `status = 'Open'` | Any | `isOverdue = false` |
| At-Risk: close in 14d, no recent interaction | `close_date = today+14`, `status = 'Open'` | No interaction in 7d | `isAtRisk = true` |
| Not at-risk: close in 14d, recent interaction | `close_date = today+14`, `status = 'Open'` | Interaction today | `isAtRisk = false` |
| Not at-risk: close in 15d, no recent interaction | `close_date = today+15`, `status = 'Open'` | No interaction in 7d | `isAtRisk = false` (outside 14-day window) |
| At-Risk boundary: close exactly in 14d | `close_date = today+14`, no recent interaction | `isAtRisk = true` | Boundary inclusive |
| At-Risk: interaction exactly 7d ago | `close_date = today+10`, interaction 7d ago | `isAtRisk = false` | 7-day boundary |
| At-Risk: interaction 8d ago | `close_date = today+10`, interaction 8d ago | `isAtRisk = true` | Outside 7-day window |
| Both flags: overdue AND at-risk | Past close_date + no recent interaction | `isOverdue = true`, `isAtRisk = true` | Both flags set simultaneously |
| Won opp: not at-risk | `close_date = tomorrow`, `status = 'Won'` | No recent interaction | `isAtRisk = false` |

---

## 7. Integration Test Scenarios

### Integration Test 1: Drag-Drop + Optimistic Update + Rollback

**Preconditions:** User is authenticated; Pipeline page loaded; 1 Open opportunity "Deal X" in "Prospecting" (stage UUID `stg-1`, default probability 20); "Qualification" stage (UUID `stg-2`, default probability 40).

| Step | Action | Expected State |
|------|--------|---------------|
| 1 | Drag "Deal X" from Prospecting to Qualification | Card immediately appears in Qualification column; `PATCH /opportunities/:id` fired with `{ stage: 'stg-2', probability: 40 }` |
| 2 | API returns `200 OK` | Card stays in Qualification; opportunityStore has `stage = 'stg-2'`, `probability = 40` |
| 3 | Reset: drag card back to Prospecting | Card in Prospecting; `PATCH` fired |
| 4 | Simulate API failure (500) on next drag to Qualification | Card moves optimistically to Qualification; API returns 500; card returns to Prospecting; toast notification shown |
| 5 | Verify store state after rollback | `opportunityStore.opportunities` shows "Deal X" with `stage = 'stg-1'` and `probability = 20` |
| 6 | Verify Prospecting column count | Count remains correct (1 card) after rollback |

### Integration Test 2: Quote Status Lifecycle End-to-End

**Preconditions:** Open opportunity with `id = opp-1`; `quoteStore` loaded.

| Step | Action | Expected State |
|------|--------|---------------|
| 1 | Create quote on opp-1 with 2 line items | `POST /quotes`; quote `q-1` created with `status = 'Draft'` |
| 2 | View quote q-1; click "Mark Sent" | `PATCH /quotes/q-1` with `{ status: 'Sent' }`; response includes `sentAt` |
| 3 | Click "Mark Accepted" | Confirmation prompt appears |
| 4 | Confirm "Mark Opportunity Won" | `PATCH /quotes/q-1` with `{ status: 'Accepted' }`; `PATCH /opportunities/opp-1` with `{ status: 'Won' }` |
| 5 | Verify opportunity removed from active Kanban | opp-1 no longer visible in Kanban without "Closed Deals" filter |
| 6 | Attempt `PATCH /quotes/q-1` with `{ status: 'Draft' }` directly | `422 Unprocessable Entity`; `allowedTransitions: []` |

### Integration Test 3: Stage Deletion Guard

**Preconditions:** Stage "Old Stage" (UUID `stg-old`) exists; 1 Open opportunity references `stg-old`; 1 Won opportunity also references `stg-old`.

| Step | Action | Expected State |
|------|--------|---------------|
| 1 | Attempt `DELETE /pipeline-stages/stg-old` | `409 Conflict`; `conflictCount: 1` (only Open opps counted) |
| 2 | UI displays error message | "1 open opportunities in this stage — reassign before deleting" shown |
| 3 | Move the Open opportunity to another stage | `PATCH /opportunities/:id` with new stage; Open opp no longer references `stg-old` |
| 4 | Retry `DELETE /pipeline-stages/stg-old` | `204 No Content`; stage row physically deleted from sheet |
| 5 | `GET /pipeline-stages` | `stg-old` not in response; no blank entry |
| 6 | Pipeline Kanban reloads | No column for `stg-old` rendered; Won opportunity (still referencing `stg-old` UUID) handled gracefully in UI |

### Integration Test 4: Auto-Expire on OpportunityDetailPage Mount

**Preconditions:** Opportunity `opp-1` has 2 quotes: `q-sent-expired` (Sent, `valid_until = 2026-03-01`, past), `q-sent-valid` (Sent, `valid_until = 2026-05-01`, future); today is 2026-03-15.

| Step | Action | Expected State |
|------|--------|---------------|
| 1 | Navigate to `/opportunities/opp-1` | Page mounts; quoteStore loads |
| 2 | Auto-expire check runs | `q-sent-expired` has `status = 'Sent'` and `valid_until < today`; immediately appears as "Expired" in UI |
| 3 | `PATCH /quotes/q-sent-expired` with `{ status: 'Expired' }` fires in background | Fire-and-forget; no loading state shown |
| 4 | `q-sent-valid` | Not patched; still shows "Sent" |
| 5 | Simulate PATCH failure for q-sent-expired | Error is logged; UI still shows "Expired" (optimistic); no error toast or blocking modal |
| 6 | Navigate away and back to `/opportunities/opp-1` | `q-sent-expired` is now "Expired" in the store; no PATCH fired again |

### Integration Test 5: First-Time Sheet Provisioning

**Preconditions:** Fresh user with no existing sheet tabs beyond the original `Sheet1`.

| Step | Action | Expected State |
|------|--------|---------------|
| 1 | User authenticates; system calls `ensureTabsExist` | Tabs `Opportunities`, `PipelineStages`, `Quotes` created |
| 2 | `GET /pipeline-stages` | 5 default stages returned with stable hardcoded UUIDs |
| 3 | Pipeline Kanban loads | 5 columns rendered in correct order; "No opportunities yet" empty state shown in each |
| 4 | `GET /opportunities` | `200 OK`; empty array (headers only tab) |
| 5 | `GET /quotes` | `200 OK`; empty array |
| 6 | `GET /customers` (Sheet1 extended to A:Q) | Existing contacts returned with `leadScoreOverride: null`, `qualificationStatus: 'Unqualified'`, `disqualificationReason: ''` for legacy rows |

---

## 8. Data Integrity Scenarios

### 8.1 JSON Parse Failure on `line_items`

| Scenario | Sheet Cell Content | Expected API Behavior | Expected UI Behavior |
|----------|------------------|-----------------------|---------------------|
| Valid JSON | `[{"description":"A","quantity":1,"unitPrice":100}]` | `lineItems: [{...}]` parsed correctly | Line items table renders |
| Empty string | `` | `lineItems: []` returned; no exception thrown; `GET /quotes` succeeds for all other quotes | Quote card shows empty line items; warning badge if `subtotal > 0` |
| Invalid JSON | `{not valid json[` | `lineItems: []` returned; warning logged with quote id and raw cell value | Warning badge displayed; `subtotal` still shows server-stored value |
| Null/undefined cell | Cell absent or empty | `lineItems: []` returned | |
| Valid JSON but wrong shape | `{"description":"A"}` (not an array) | `lineItems: []` returned (parse succeeds but shape invalid; fallback to empty) | |
| 50 line items | Array with 50 items | All 50 parsed and returned | All 50 rendered in line items table |
| 51 line items attempted | Client tries to add 51st | Blocked client-side at 50-item limit | Validation error shown; no API call |

### 8.2 Sheet1 Column Index Alignment

**Objective:** Confirm that the 17-column `Sheet1!A:Q` range is read and written with correct field-to-column mapping. This test must be run whenever `SheetsService` is modified.

| Column | Index (0-based) | Expected Field | Verify |
|--------|----------------|---------------|--------|
| A | 0 | `id` | |
| B | 1 | `first_name` | |
| C | 2 | `last_name` | |
| D | 3 | `email` | |
| E | 4 | `phone` | |
| F | 5 | `company` | |
| G | 6 | `status` | |
| H | 7 | `last_contact_date` | |
| I | 8 | `notes` | |
| J | 9 | `created_at` | |
| K | 10 | `job_title` | |
| L | 11 | `preferred_contact` | |
| M | 12 | `linkedin_url` | |
| N | 13 | `tags` | |
| O | 14 | `lead_score_override` | **Verify constant `COL_LEAD_SCORE_OVERRIDE = 14`** |
| P | 15 | `qualification_status` | **Verify constant `COL_QUALIFICATION_STATUS = 15`** |
| Q | 16 | `disqualification_reason` | **Verify constant `COL_DISQUALIFICATION_REASON = 16`** |

**Test procedure:**
1. Write a contact with all 17 fields set to distinct identifiable values.
2. Read back via `GET /customers`; verify each field maps to its expected value.
3. Verify no Contact Management field (K–N) is displaced by the new columns (O–Q).

### 8.3 Stage UUID Reference Integrity After Stage Rename

| Scenario | Action | Expected Behavior |
|----------|--------|-----------------|
| Rename stage | `PATCH /pipeline-stages/:id` with new name | All opportunities in `Opportunities` tab still have the same UUID in column E; no data migration needed |
| Read opportunity after rename | `GET /opportunities` | `stage` field contains the original UUID; frontend resolves name from `pipelineStageStore` |
| Kanban renders after rename | Pipeline page loads | Column header displays new name; cards are in correct column |
| Stage UUID deleted | Stage deleted after reassigning all Open opps | Any Won/Lost opps still referencing deleted UUID should render gracefully (e.g., "Unknown stage" or stage name omitted) |

### 8.4 Legacy Data Compatibility (Sheet1 Rows Without Columns O–Q)

| Scenario | Sheet Row State | Expected API Response |
|----------|----------------|----------------------|
| Row with only A:J (original columns) | No cells K–Q | `leadScoreOverride: null`, `qualificationStatus: 'Unqualified'`, `disqualificationReason: ''` |
| Row with A:N (Contact Management extension) | No cells O–Q | Same defaults as above for O–Q fields |
| Row with all A:Q | All cells populated | All fields returned with stored values |
| `PATCH` on legacy row advances range to A:Q | Write new values to O–Q on existing A:J row | Cells O–Q created correctly; existing A:J cells unchanged |

### 8.5 `updatedAt` Server Authority

| Scenario | Request Body | Expected Response |
|----------|-------------|------------------|
| `PATCH /opportunities/:id` with client `updatedAt` | `{ stage: 'new-uuid', updatedAt: '2020-01-01T00:00:00Z' }` | Response `updatedAt` is current server timestamp, not `2020-01-01` |
| `POST /opportunities` with client `updatedAt` | `{ ..., updatedAt: '2020-01-01T00:00:00Z' }` | Response `updatedAt` is server timestamp |
| `PATCH /quotes/:id` with client `sentAt` | `{ status: 'Sent', sentAt: '2020-01-01' }` | Response `sentAt` is server timestamp; client value ignored |

---

## 9. Performance Baselines

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Pipeline page initial load (1,000 opportunities) | Page interactive within 3 seconds after API response | Manual timing with DevTools Performance tab; throttle network to "Fast 3G" |
| Forecast metrics computation (1,000 opportunities) | `useForecastMetrics` hook computes all metrics within 50ms | `console.time` wrapper around hook computation; must not cause visible frame drop |
| Lead score badge render per contact in list (100 contacts) | No perceptible lag (<16ms per frame) on list scroll | React Profiler; `computeLeadScore` called inside `useMemo` — verify memo dependency array is correct |
| Kanban drag-drop responsiveness | Card moves within 1 frame (16ms) of pointer release; optimistic update instant | Manual test; drag ghost should track pointer without lag |
| `GET /opportunities` response time | API responds within 2 seconds for sheets with <1,500 rows | Measure from request to first byte in DevTools Network tab |
| Auto-expire PATCH burst | N stale quotes patched in parallel on mount | Confirm `Promise.all` used; verify Google Sheets API quota not hit (300 writes/min); test with 10 stale quotes |
| Pipeline by Stage table sort | Client-side sort of 50-row table completes within 16ms | Manual observation; no loading spinner needed |

---

## 10. Edge Case Catalogue

| Case | Input / State | Expected Behavior |
|------|--------------|-------------------|
| Opportunity value = 0 | `value: 0` | Accepted; "$0" displayed; included in pipeline calculations as $0 |
| Opportunity value is extremely large | `value: 999999999` | Stored and displayed; currency formatted "$999,999,999" |
| Probability = 0 | `probability: 0` | Weighted value = $0; included in deal count |
| Probability = 100 | `probability: 100` | Weighted value = full value; valid |
| close_date = today | `close_date = 2026-03-15` (today's date) | Not Overdue (today is not past); At-Risk if ≤14 days window applies |
| All 10 stages filled | 10 stages in PipelineStages tab | "Add Stage" action disabled in UI |
| Stage with 0 probability default | `probability_default: 0` | Drag-drop sets opportunity probability to 0; valid |
| Quote with 0 discount | `discount_percent: 0` | `total = subtotal`; no "0% discount" line shown in PDF |
| Quote with 100% discount | `discount_percent: 100` | `total = 0`; displayed clearly |
| Disqualification reason = exactly 500 chars | 500-char string | Accepted |
| Disqualification reason = 501 chars | 501-char string | Rejected or truncated |
| Loss reason = exactly 500 chars | 500-char string | Accepted |
| Loss reason = 501 chars | 501-char string | Rejected |
| Opportunity with no linked company | `company_id` absent | Kanban card displays contact name only; no company field shown; forecast calculation unaffected |
| Forecast page with only Won opportunities | All opportunities closed (Won) | `totalPipeline = 0`; `weightedPipeline = 0`; Win Rate may or may not show (depends on count); no crash |
| Forecast page with opportunities all closing in the past | All close_dates in the past | Expected Close This Month and Quarter = $0; no crash |
| Special characters in opportunity name | `name = 'Deal <script>alert(1)</script>'` | Stored and displayed as literal text; no XSS |
| Special characters in quote title | `title = 'Q1 "Best" Deal & More'` | Stored in sheet; JSON-safe; displayed correctly |
| Empty `line_items` array | `lineItems: []` | `subtotal = 0`, `total = 0`; quote creation succeeds |
| Very long notes field | 5,000 character notes | Stored in Google Sheets cell; displayed in UI (possibly truncated with read more) |
| Network failure on Kanban load | API unreachable when Pipeline page loads | Loading spinner transitions to error state with retry prompt; no white screen of death |
| Network failure during quote creation | API fails mid-submit | Error toast shown; quote not created; form data preserved for retry |
| Navigating to `/opportunities/:id` for a non-existent ID | Direct URL with fake UUID | Graceful not-found state; no JS crash; navigate-back option |
| PipelineStages tab has a blank row (due to a prior bug) | Sheet has a blank row between stage rows | `slice(1)` header-skip and `filter(row => row[0])` must handle; blank row skipped silently |
| Multiple browser tabs: two drag-drops simultaneously | Two tabs drag same card to different stages | Last PATCH wins; the tab that receives the server response last has the final state; no crash |

---

## 11. Exploratory Testing Charters

### Charter 1: Pipeline Kanban Drag-Drop State Integrity

- **Goal:** Investigate edge cases in drag-drop behavior, optimistic state, and rollback under unusual conditions
- **Time-box:** 45 minutes
- **Heuristics to probe:**
  - Drag a card and drop it back to the same column — does anything fire? Does the store update unnecessarily?
  - Drag a card, then immediately navigate away before the API response returns — does the rollback still execute? Is there a dangling promise?
  - Drag multiple cards in quick succession before the first PATCH responds — are all PATCHes queued? Does the store reach a consistent final state?
  - Drag a card to an empty column (no other cards) — does the column render correctly with 1 card and updated count/value?
  - With "At Risk & Overdue" filter active, drag an overdue card to a new stage — does the filter re-evaluate after the move?
  - Refresh the page immediately after a drag — is the new stage persisted in Google Sheets?

### Charter 2: Quote Status Lifecycle Boundary Probing

- **Goal:** Find unguarded status transitions and edge states in the quote lifecycle
- **Time-box:** 30 minutes
- **Heuristics to probe:**
  - Use browser DevTools to directly call `PATCH /quotes/:id` with each possible status transition and verify the 422 response shape matches the contract
  - Mark a quote Expired manually; does the auto-expire logic on next page mount attempt to re-expire it?
  - Create a quote with `valid_until` set to yesterday; load the OpportunityDetailPage; does auto-expire fire immediately?
  - Create a quote with `valid_until` set to today; load the page — boundary: is "today" considered past or not yet?
  - What happens when "Mark Accepted" is clicked and the subsequent `PATCH /opportunities/:id` for Won fails? Is the quote Accepted but the opportunity still Open? Is there a consistency warning?

### Charter 3: Lead Score Tooltip and Override Display Consistency

- **Goal:** Investigate the tooltip accuracy and visual differentiation between computed and overridden scores
- **Time-box:** 30 minutes
- **Heuristics to probe:**
  - Set an override, then update a contributing field (e.g., add a company link) — does the tooltip still show the rule breakdown, or only the override value?
  - Set override to a value that falls in a different tier than the computed score (e.g., computed = 80 Hot, override = 30 Cold) — does the badge tier reflect the override?
  - Set override to 0 — does it show "0" with the manual indicator, or does it fall back to the "–" neutral state?
  - Clear the override (set back to null) — does the score immediately recalculate from rules without a page reload?
  - Sort contacts by lead score when some have overrides and some are computed — is the sort based on the effective displayed value?

### Charter 4: Sheet Column Alignment Regression

- **Goal:** Confirm that Contact Management fields (K–N) and new Sales Pipeline fields (O–Q) are never transposed or misread after any recent changes to `sheets.service.ts`
- **Time-box:** 30 minutes
- **Heuristics to probe:**
  - Create a contact with all fields populated including `job_title`, `tags`, `linkedin_url`, `qualification_status`, and `lead_score_override`; verify the Google Sheet directly to confirm each value is in the correct column
  - Read the same contact back via `GET /customers`; verify each field in the API response matches the sheet
  - PATCH only `qualification_status`; verify the raw sheet update does not overwrite adjacent columns with blank values
  - Read existing pre-feature contacts (created before the O–Q extension) — verify they return correct defaults and no field shifting

### Charter 5: Forecast Metric Edge States

- **Goal:** Probe boundary conditions and unusual data states in the Forecast page
- **Time-box:** 30 minutes
- **Heuristics to probe:**
  - Navigate to the Forecast page when the opportunityStore is still loading — are metric cards in a loading state or do they flash "0" then update?
  - Navigate to the Forecast page when `GET /opportunities` fails — does the Forecast page show an error, or silently show $0 metrics?
  - Create an opportunity with no close_date (if the form allows it) — does it crash any forecast metric?
  - Set all opportunity close_dates to Q1 while today is Q4 — "Expected Close This Quarter" should be $0; verify
  - Close a deal as Won — verify Win Rate updates if it crosses the 3-deal threshold

### Charter 6: PDF Export Content and Filename Accuracy

- **Goal:** Verify the QuotePrintTemplate renders correctly and the print dialog produces the expected document
- **Time-box:** 20 minutes
- **Heuristics to probe:**
  - Export a PDF with a contact who has no company — does the "company" field in the PDF appear blank or crash?
  - Export a PDF with special characters in the quote title (`&`, `<`, `"`, `'`) — are they displayed correctly without HTML entities showing?
  - Export a PDF with 0 line items — does the line items table render a graceful empty state?
  - Export a PDF with 50 line items — do all items fit? Is the layout broken?
  - Verify the document title in the print dialog matches `Quote-[id-prefix]-[LastName]` exactly; test with a contact whose last name contains a space or hyphen

---

## 12. Regression Checklist

After implementing the Sales & Pipeline Management feature, re-verify the following existing behaviors:

- [ ] `GET /customers` — existing contacts still return all A:N fields correctly (Contact Management fields not shifted by O:Q extension)
- [ ] `PATCH /customers/:id` — updating existing Contact Management fields (e.g., `job_title`, `tags`) does not inadvertently overwrite O:Q cells with blank values
- [ ] Contact Kanban (Lead/Active/Churned/Archived grouping) — still loads and drag-drop works; not confused with Pipeline Kanban
- [ ] StatsRow on the existing dashboard — existing metric cards (e.g., Total Contacts, Active Contacts) still compute correctly; new cards (Qualified Leads, Quotes Sent) do not displace or break existing cards
- [ ] Authentication flow — `GET /auth/google` and callback still work; JWT still valid for all existing routes including the 9 new ones
- [ ] Contact detail panel navigation (`/contacts/:id`) — still loads; "Add Opportunity" button appears; existing interaction log, company link, and extended profile fields still render
- [ ] Company detail view — still loads; company linked to contacts that also have opportunities does not cause any rendering errors
- [ ] Duplicate detection — still triggers on email match and name+company match; not affected by the new sheet tabs
- [ ] Interaction log — `GET /interactions` still returns correctly; interactions are used by the At-Risk flag logic; verify interaction data is available to `computeOpportunityFlags`
- [ ] Google Sheets service account authorization — all new tab access (Opportunities, PipelineStages, Quotes) uses the existing service account without additional permissions
- [ ] Navigation sidebar — existing menu items (Customers, Dashboard) still present and functional; new items (Pipeline, Forecast) appear in correct position

---

## 13. Quality Exit Criteria

The Sales & Pipeline Management feature is ready to ship when all of the following conditions are met:

### Functional
- [ ] All acceptance criteria for Stories 2.1, 2.2, 2.3, 3.1 (Must stories) verified as passing
- [ ] All acceptance criteria for Stories 1.1, 1.2, 3.2, 3.3, 4.1, 4.2, 4.3 (Should/Could stories) verified as passing or explicitly deferred with documented justification
- [ ] All API contract test scenarios pass for all 9 new endpoints and 3 modified endpoints
- [ ] All quote status transition scenarios verified (both valid paths and invalid/422 paths)

### Data Integrity
- [ ] Sheet1 column index alignment test (Section 8.2) passes — all 17 columns correctly mapped with named constants
- [ ] `line_items` JSON parse failure test passes — no `GET /quotes` response fails due to a single corrupt cell
- [ ] `updatedAt` server authority verified — client-provided timestamp is ignored on both Opportunities and Quotes
- [ ] Legacy row compatibility verified — contacts without O:Q columns return correct defaults
- [ ] `lead_score` is confirmed absent from Sheet1 header row and from `GET /customers` response

### Computation Correctness
- [ ] All lead score unit test scenarios pass (Section 6.1), including all boundary cases for the 14-day recency rule
- [ ] All forecast metric unit test scenarios pass (Section 6.2), including Win Rate threshold at 0, 1, 2, and 3 closed deals
- [ ] All overdue/at-risk flag unit test scenarios pass (Section 6.3), including boundary conditions on 14-day and 7-day thresholds

### Integration
- [ ] Drag-drop optimistic update and rollback integration test passes (Section 7, Test 1)
- [ ] Quote status lifecycle end-to-end integration test passes (Section 7, Test 2)
- [ ] Stage deletion guard integration test passes (Section 7, Test 3)
- [ ] Auto-expire on mount integration test passes (Section 7, Test 4)
- [ ] First-time sheet provisioning integration test passes (Section 7, Test 5)

### Quality Standards
- [ ] Zero P0 bugs open (application crash, data loss, security bypass, unrecoverable broken state)
- [ ] Zero P1 bugs open (feature unusable, incorrect financial calculation displayed, status transition enforcement bypassed)
- [ ] All edge cases in the Edge Case Catalogue (Section 10) verified
- [ ] Regression checklist (Section 12) complete — no existing Contact Management functionality broken
- [ ] Performance baselines (Section 9) met — Forecast metrics compute within 50ms; Pipeline page interactive within 3 seconds
- [ ] Exploratory testing charters 1–6 completed and findings documented; any bugs found triaged and resolved or accepted

### Specific Gates
- [ ] `DELETE /pipeline-stages/:id` returns 409 with correct `conflictCount` when any Open opportunity references the stage — this is the most critical business-rule enforcement in the feature
- [ ] `PATCH /quotes/:id` returns 422 with `allowedTransitions` for every invalid transition in the status matrix — terminal states (Accepted, Declined, Expired) must return `allowedTransitions: []`
- [ ] The Pipeline Kanban empty state renders without errors when `opportunityStore.opportunities` is empty
- [ ] The "Not enough data" state renders for Win Rate when fewer than 3 closed deals exist in the trailing 90 days
- [ ] Auto-expire does not fire a second PATCH on revisiting a page for quotes already in Expired status
