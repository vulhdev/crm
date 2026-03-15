# PRD: Sales & Pipeline Management

**Version:** 1.0
**Date:** 2026-03-15
**Status:** Draft
**Depends on:** Core Contact & Account Management PRD (v1.0)

---

## Problem Statement

Sales Reps currently have no structured way to track deals as separate entities from contacts. The existing `status` field on a contact (`Lead | Active | Churned | Archived`) acts as a crude pipeline proxy, but it conflates contact lifecycle with deal progress, gives no visibility into deal value or close probability, and provides no forecasting signal. Sales Managers cannot see which deals are at risk, what revenue is expected to close this quarter, or where deals are stalling in the sales process. Producing a quote or proposal means exiting the CRM entirely, breaking workflow continuity and leaving no record of what was sent or accepted. This PRD defines the Sales & Pipeline Management layer that transforms the platform from a contact list into an actionable revenue-tracking tool.

---

## Target Users

| Persona | Relevance |
|---------|-----------|
| **Sales Rep** | Primary — creates and advances deals, generates quotes, manages their own pipeline |
| **Sales Manager** | Primary — monitors overall pipeline health, reviews forecast, identifies at-risk deals |
| **Admin** | Tertiary — configures sales stage definitions; not a day-to-day pipeline user |

---

## User Stories

---

### Feature Area 1: Lead Management

#### Story 1.1 — Lead Capture with Scoring

**As a Sales Rep, I want each lead contact to have a numeric lead score so that I can instantly see which prospects are worth prioritizing and which can wait.**

##### Acceptance Criteria
- [ ] A `lead_score` integer field (0–100) is added to the `Leads` sheet tab (defined below in Scope). It is optional; an unscored lead displays a neutral "–" indicator rather than 0.
- [ ] Lead score is calculated automatically client-side based on a fixed, transparent scoring model: +30 if `company` is linked to a Company entity; +20 if at least one interaction has been logged; +20 if `phone` and `email` are both populated; +15 if the lead was created in the last 14 days; +15 if `job_title` is populated. The breakdown is displayed as a tooltip on the score badge.
- [ ] The lead score badge uses three visual tiers: Hot (70–100, red), Warm (40–69, amber), Cold (0–39, gray).
- [ ] Lead score recalculates immediately on the client whenever any of the contributing fields change, without a page reload.
- [ ] Sales Reps can override the calculated score with a manual value via an inline edit on the contact detail panel. Manual overrides are stored in `lead_score_override` and displayed with a visual indicator distinguishing them from calculated scores.
- [ ] Leads can be sorted by lead score (ascending and descending) in the Table and Grid views.

---

#### Story 1.2 — Lead Qualification Workflow

**As a Sales Rep, I want to mark a lead as qualified or disqualified with a reason, so that I can clearly separate prospects worth pursuing from dead ends and keep the pipeline clean.**

##### Acceptance Criteria
- [ ] A `qualification_status` field is added to the contact record with values: `Unqualified` (default for all `Lead`-status contacts), `Qualified`, `Disqualified`.
- [ ] A `disqualification_reason` free-text field (max 500 characters) is shown only when `qualification_status = Disqualified`.
- [ ] Marking a lead as `Qualified` is a single-click action available on the contact detail panel and on the Kanban card context menu; it does not change the contact's `status` field automatically — that remains under the Rep's control.
- [ ] Marking a lead as `Disqualified` requires selecting a predefined reason category from a dropdown (Budget, Authority, Need, Timeline, Other) and optionally entering free-text detail. A confirmation step is presented before saving.
- [ ] Disqualified leads are hidden from the default Kanban and pipeline views but remain accessible via an explicit "Show disqualified" toggle filter in the Lead Management view.
- [ ] The `StatsRow` dashboard adds a "Qualified Leads" metric card showing the count of contacts with `status = Lead` and `qualification_status = Qualified`.

---

### Feature Area 2: Opportunity & Pipeline Management

#### Story 2.1 — Opportunity Entity

**As a Sales Rep, I want to create a discrete deal (Opportunity) linked to a contact and company, with its own value, stage, and close date, so that I can track revenue potential separately from the contact's lifecycle status.**

##### Acceptance Criteria
- [ ] A new `Opportunities` sheet tab is provisioned in the user's Google Sheet with columns: `id` (UUID), `name` (string), `contact_id` (references `Sheet1` id), `company_id` (references `Companies` id, optional), `stage` (enum, see Story 2.2), `value` (number, currency in USD), `close_date` (ISO date), `probability` (integer 0–100), `notes` (text), `created_at` (ISO timestamp), `updated_at` (ISO timestamp), `status` (enum: `Open | Won | Lost`).
- [ ] An Opportunity can be created from the Contact Detail panel via an "Add Opportunity" action. The `contact_id` is pre-populated.
- [ ] Opportunity `name` is required (max 200 characters). `value`, `close_date`, and `stage` are required. All other fields are optional.
- [ ] `probability` defaults to a stage-preset value (see Story 2.2) but can be overridden manually (0–100).
- [ ] An Opportunity can be marked Won or Lost from the Opportunity detail view or the Kanban board. Marking Lost requires a loss reason (free text, max 500 characters).
- [ ] Closed (Won or Lost) opportunities are excluded from the active pipeline Kanban but remain accessible via a "Closed Deals" filter.
- [ ] The Contact Detail panel shows a linked opportunities list (name, stage, value, close date) with a direct link to each Opportunity's detail view.

---

#### Story 2.2 — Customizable Sales Stages

**As a Sales Rep (or Admin), I want to define the stages that deals move through so that the pipeline reflects my actual sales process rather than a generic template.**

##### Acceptance Criteria
- [ ] A default set of five stages is provisioned: `Prospecting` (20%), `Qualification` (40%), `Proposal Sent` (60%), `Negotiation` (80%), `Closing` (90%). The percentage is the default close probability for that stage.
- [ ] Stages are stored in a `PipelineStages` sheet tab with columns: `id` (UUID), `name` (string), `probability_default` (integer 0–100), `order` (integer), `created_at`.
- [ ] The user can add, rename, reorder, and delete custom stages via a Settings panel. Deleting a stage that has associated opportunities is blocked; the user is shown how many opportunities are affected and prompted to reassign them first.
- [ ] Stage order controls the left-to-right column order on the Pipeline Kanban board.
- [ ] Renaming a stage is reflected immediately on all existing opportunities without any data migration step (stages are stored by `id` reference, not name string, in the Opportunities tab).
- [ ] The UI limits the total number of stages to 10 to keep the Kanban board usable.

---

#### Story 2.3 — Pipeline Kanban Board

**As a Sales Rep, I want a visual Kanban board of all open opportunities grouped by stage so that I can see my full pipeline at a glance and drag deals between stages.**

##### Acceptance Criteria
- [ ] A dedicated "Pipeline" page/view renders all open (`status = Open`) opportunities as cards grouped into columns by `stage`.
- [ ] Each opportunity card displays: `name`, `value` (formatted as currency), `contact` name, `company` name (if set), `close_date`, and `probability`.
- [ ] Cards are draggable between stage columns using the existing `@dnd-kit` library. Dropping a card onto a new column updates the opportunity's `stage` (and `probability` to the new stage's default, unless the user had a manual override in place) via `PATCH /opportunities/:id`.
- [ ] Optimistic updates are applied immediately on drag-drop (consistent with the existing Kanban behavior for contacts) and rolled back silently on API failure with a toast error notification.
- [ ] Each stage column header shows the total count of opportunities and the sum of `value` for deals in that stage.
- [ ] The board supports a search/filter bar to filter visible cards by: contact name, company name, and close date range.
- [ ] The Pipeline page is accessible from the main navigation alongside the existing Customers dashboard.

---

### Feature Area 3: Sales Forecasting

#### Story 3.1 — Pipeline Value Summary

**As a Sales Manager, I want to see a summary of expected revenue from the current open pipeline so that I can assess whether the team is on track to hit targets.**

##### Acceptance Criteria
- [ ] A "Forecast" section is added to the Dashboard (or as a dedicated Forecast page, per UX decision) displaying the following read-only metrics:
  - **Total Pipeline Value** — sum of `value` across all open opportunities.
  - **Weighted Pipeline Value** — sum of (`value` x `probability / 100`) across all open opportunities.
  - **Expected Close This Month** — weighted value of opportunities with `close_date` in the current calendar month.
  - **Expected Close This Quarter** — weighted value of opportunities with `close_date` in the current calendar quarter.
- [ ] All four metrics update in real-time as the Zustand store changes (no additional API call required; computed from fetched opportunity data).
- [ ] Each metric is displayed as a `MetricCard` (consistent with the existing `StatsRow` components) with a label, formatted value (USD), and a secondary count of deals contributing to that metric.
- [ ] Values are formatted with locale-appropriate currency formatting (e.g., `$12,450`). The currency is USD and is not user-configurable in this iteration.

---

#### Story 3.2 — Deal Velocity & Win Rate Metrics

**As a Sales Manager, I want to see how long deals typically take to close and what percentage are being won so that I can identify pipeline health problems and coach reps accordingly.**

##### Acceptance Criteria
- [ ] The Forecast section includes two additional metrics:
  - **Win Rate** — percentage of closed opportunities (`status = Won`) out of all closed opportunities (`Won + Lost`) in the trailing 90 days. Displayed as a percentage with the count of Won vs Lost as supporting text.
  - **Average Deal Age** — average number of days from `created_at` to `updated_at` (for closed deals) or from `created_at` to today (for open deals), computed across all open opportunities. Displayed as whole days.
- [ ] Both metrics are computed entirely client-side from the fetched opportunities list with no additional API endpoints.
- [ ] If there are fewer than 3 closed deals in the trailing 90 days, the Win Rate metric displays "Not enough data" rather than a potentially misleading percentage.
- [ ] A "Pipeline by Stage" breakdown table is displayed below the metric cards, showing for each stage: stage name, deal count, total value, weighted value, and average days in stage. Columns are sortable client-side.

---

#### Story 3.3 — Close Date Risk Flagging

**As a Sales Manager, I want overdue and at-risk opportunities highlighted automatically so that I can take action before deals slip without having to scan every card manually.**

##### Acceptance Criteria
- [ ] An opportunity is flagged as **Overdue** if `close_date` is in the past and `status = Open`. Overdue cards on the Pipeline Kanban are marked with a red date indicator.
- [ ] An opportunity is flagged as **At Risk** if `close_date` is within the next 14 days and no interaction has been logged against the linked contact in the last 7 days. At-Risk cards display an amber warning indicator.
- [ ] Both flags are computed client-side from the fetched data; no new API call is needed.
- [ ] A dedicated "At Risk & Overdue" filter on the Pipeline Kanban board surfaces only flagged cards. The filter button displays the count of flagged deals as a badge.
- [ ] Clicking a flagged card opens the Opportunity detail view, which surfaces the linked contact's recent interaction log directly (using the `Interactions` tab from the Contact Management feature) so the Rep can immediately see and log follow-up activity.

---

### Feature Area 4: Quote & Proposal Management

#### Story 4.1 — Quote Creation

**As a Sales Rep, I want to generate a structured quote from within an Opportunity so that I can produce a professional, consistent document without leaving the CRM or building one manually each time.**

##### Acceptance Criteria
- [ ] A "Create Quote" action is available on any open Opportunity's detail view.
- [ ] A new `Quotes` sheet tab is provisioned with columns: `id` (UUID), `opportunity_id`, `contact_id`, `company_id`, `title` (string), `line_items` (JSON array: `[{description, quantity, unit_price}]`), `subtotal` (computed), `discount_percent` (number 0–100), `total` (computed), `notes` (text), `status` (enum: `Draft | Sent | Accepted | Declined | Expired`), `valid_until` (ISO date), `created_at`, `updated_at`.
- [ ] The quote creation form pre-populates `contact_id`, `company_id`, and `opportunity_id` from the parent opportunity. The contact's name and company name are shown as read-only context.
- [ ] The user can add multiple line items (description, quantity, unit price). `subtotal` and `total` are computed fields displayed live as the user types; they are not directly editable.
- [ ] A `discount_percent` field (0–100) applies a flat discount to the subtotal. The discount amount and final total are shown separately for transparency.
- [ ] `valid_until` defaults to 30 days from the creation date. The field is editable.
- [ ] Saving the quote creates the row in the `Quotes` tab with `status = Draft`. An Opportunity can have multiple quotes (e.g., revised versions), all visible in a "Quotes" section on the Opportunity detail view.

---

#### Story 4.2 — Quote Status Tracking

**As a Sales Rep, I want to track whether a sent quote has been accepted or declined so that I can follow up at the right time and know which quotes are driving closed deals.**

##### Acceptance Criteria
- [ ] Quote `status` can be manually advanced through the following allowed transitions only: `Draft → Sent`, `Sent → Accepted`, `Sent → Declined`, `Sent → Expired`, `Draft → Expired`. Backward transitions are blocked.
- [ ] Advancing a quote to `Sent` status records the current timestamp in a `sent_at` field in the `Quotes` tab.
- [ ] When a quote is marked `Accepted`, a confirmation prompt asks the user whether to automatically mark the parent Opportunity as `Won`. The user can accept or decline this suggestion.
- [ ] Quotes with `status = Sent` and `valid_until` in the past are automatically marked `Expired` client-side the next time the Opportunity detail view is loaded (a pending PATCH is queued to sync the status update to the sheet).
- [ ] The Opportunity detail view shows all linked quotes with their name, total value, status badge, and `valid_until` date in a compact list. No separate Quotes list view is built in this iteration.
- [ ] The `StatsRow` dashboard adds a "Quotes Sent" metric card showing the count of quotes in `Sent` status created in the last 30 days.

---

#### Story 4.3 — Quote Export to PDF

**As a Sales Rep, I want to export a quote as a PDF so that I can send it to a prospect via email in a professional format.**

##### Acceptance Criteria
- [ ] A "Export PDF" action is available on any quote in `Draft` or `Sent` status.
- [ ] The PDF is generated client-side using a print-optimized React component rendered into a PDF via a browser print dialog or a PDF generation library (e.g., `react-to-print` or equivalent). No server-side rendering is required.
- [ ] The exported PDF includes: CRM user's name and email (from the JWT payload) as the sender, contact name and company as the recipient, quote title, line items table (description, quantity, unit price, line total), subtotal, discount (if any), total, valid until date, and any notes.
- [ ] The PDF filename defaults to `Quote-[QuoteID]-[ContactLastName].pdf`.
- [ ] Exporting a PDF does not change the quote's status. Advancing to `Sent` remains a deliberate manual action.

---

## Scope

### In Scope

**Lead Management**
- Lead score calculation (rule-based, client-side) with Hot/Warm/Cold visual tiers
- Manual lead score override stored in `Leads` sheet tab extension
- Qualification status (`Unqualified / Qualified / Disqualified`) with disqualification reason
- Disqualified lead filtering from default views
- "Qualified Leads" metric card on StatsRow dashboard

**Opportunity & Pipeline Management**
- `Opportunities` sheet tab with full deal entity schema
- Opportunity creation from the Contact Detail panel
- `PipelineStages` sheet tab with default and customizable stages
- Stage management UI (add, rename, reorder, delete with guard)
- Pipeline Kanban board (dedicated page, `@dnd-kit` drag-drop, optimistic updates)
- Opportunity detail view (name, value, stage, close date, probability, notes, linked quotes, contact interactions)
- Won/Lost closing flow with loss reason capture

**Sales Forecasting**
- Pipeline value summary metrics (total, weighted, this month, this quarter)
- Win Rate and Average Deal Age metrics (trailing 90-day window)
- Pipeline by Stage breakdown table
- Overdue and At-Risk deal flagging with visual indicators on Kanban cards
- At-Risk & Overdue filter on the Pipeline Kanban

**Quote & Proposal Management**
- Quote creation form linked to Opportunity, with line items, discount, and validity date
- `Quotes` sheet tab schema
- Quote status lifecycle tracking (`Draft → Sent → Accepted / Declined / Expired`)
- Auto-expire stale Sent quotes client-side on view load
- PDF export (client-side, print-to-PDF)
- "Quotes Sent" metric card on StatsRow dashboard

### Out of Scope (This Iteration)

- **Multi-user pipeline collaboration** — the platform is per-user; shared team pipelines, deal assignment to other reps, and activity feeds across users are deferred.
- **Email integration for quote delivery** — sending the quote PDF via email directly from the CRM requires Gmail API scope expansion; the Rep exports the PDF and sends it manually.
- **E-signature or contract acceptance workflow** — legally binding e-signature (DocuSign, HelloSign, etc.) integration is a separate, high-complexity workstream.
- **Revenue targets and quota tracking** — setting and tracking against a personal or team quota requires additional configuration surfaces and reporting not in scope here.
- **AI-assisted probability scoring** — machine-learning-derived close probability using historical deal data; the rule-based default and manual override covers this iteration.
- **Historical pipeline snapshots** — showing how the pipeline looked at a prior date for trend comparison; Google Sheets does not support versioned snapshots natively without a separate log tab.
- **Multi-currency support** — all monetary values are displayed in USD. Currency configuration is deferred.
- **Recurring revenue / subscription deal tracking** — MRR/ARR deal modeling; out of scope for this iteration.
- **Product catalog / price book** — a reusable library of products for populating quote line items; Reps enter line items manually in this iteration.
- **Approval workflow for quotes** — a manager review-and-approve step before a quote is sent; requires multi-user role awareness.
- **Quote versioning with change history** — each new edit creates a new quote record; diff tracking between versions is deferred.
- **Sales activity reminders and tasks** — due-date task management on opportunities; covered under a future Task Management feature.
- **Mobile-optimized Pipeline Kanban** — the Kanban board is designed for desktop; responsive mobile layout for drag-drop is deferred.

---

## New Sheet Tabs Required

| Sheet Tab | Purpose | Key Columns |
|-----------|---------|-------------|
| `Opportunities` | Core deal entity | id, name, contact_id, company_id, stage, value, close_date, probability, notes, status, created_at, updated_at |
| `PipelineStages` | User-defined stage configuration | id, name, probability_default, order, created_at |
| `Quotes` | Quote / proposal records | id, opportunity_id, contact_id, company_id, title, line_items (JSON), subtotal, discount_percent, total, notes, status, valid_until, sent_at, created_at, updated_at |

Lead scoring and qualification fields (`lead_score`, `lead_score_override`, `qualification_status`, `disqualification_reason`) are added as new columns to the existing `Sheet1` contact schema, consistent with how the Contact Management PRD extended `Sheet1` with `job_title`, `preferred_contact`, `linkedin_url`, and `tags`.

---

## New API Routes Required

| Method | Path | Action |
|--------|------|--------|
| GET | `/opportunities` | Fetch all rows from `Opportunities` tab |
| POST | `/opportunities` | Append new opportunity row |
| PATCH | `/opportunities/:id` | Update opportunity fields |
| GET | `/pipeline-stages` | Fetch all rows from `PipelineStages` tab |
| POST | `/pipeline-stages` | Append new stage row |
| PATCH | `/pipeline-stages/:id` | Update stage name, probability, or order |
| DELETE | `/pipeline-stages/:id` | Delete stage (guarded: blocked if opportunities exist) |
| GET | `/quotes` | Fetch all rows from `Quotes` tab |
| POST | `/quotes` | Append new quote row |
| PATCH | `/quotes/:id` | Update quote fields or status |

All routes are protected by the existing `JwtAuthGuard`. The backend accesses the user's Google Sheet using the user's own OAuth tokens (consistent with the existing `SheetsService` pattern).

---

## Priority

| Story | Priority | Rationale |
|-------|----------|-----------|
| 2.1 — Opportunity Entity | Must | The foundational data entity for all pipeline, forecasting, and quoting features; nothing else in this PRD ships without it |
| 2.2 — Customizable Sales Stages | Must | Required to make the Opportunity entity meaningful; default stages ship with the entity; the management UI can follow closely behind |
| 2.3 — Pipeline Kanban Board | Must | The primary surface Sales Reps interact with daily; the core visual deliverable of this feature set and the primary driver of adoption |
| 3.1 — Pipeline Value Summary | Must | The primary value for Sales Managers; computed from already-fetched opportunity data, so implementation cost is low relative to business value |
| 1.1 — Lead Scoring | Should | High prioritization value for Sales Reps but depends on good Opportunity data first; client-side computation limits backend complexity |
| 1.2 — Lead Qualification Workflow | Should | Keeps the pipeline clean by separating dead leads; important for forecast accuracy but lower urgency than core pipeline visibility |
| 3.2 — Win Rate & Deal Velocity | Should | Adds coaching and diagnostic value for Sales Managers; computed from existing data with no new data model requirements |
| 3.3 — Close Date Risk Flagging | Should | Proactive deal health monitoring; high value with relatively low implementation cost; depends on Opportunity and Interaction data being available |
| 4.1 — Quote Creation | Should | Significant workflow improvement; keeps the Rep in the CRM rather than switching to a spreadsheet or Word document; the `Quotes` tab adds schema complexity |
| 4.2 — Quote Status Tracking | Should | Closes the loop on quote outcomes; directly informs Win/Loss analysis; depends on 4.1 |
| 4.3 — Quote PDF Export | Could | Improves presentation quality but is not strictly required for the core workflow; Rep can produce a manual quote outside the CRM as a workaround while this is deferred |

---

## Open Questions

1. **Opportunity-to-Contact cardinality:** The current model assumes one contact per opportunity. Should an opportunity support multiple contacts (e.g., a buying committee at a large account)? Adding a junction table now is more expensive but avoids a later migration.

2. **Lead scoring model:** The proposed rule-based scoring model is a starting point. Does the sales team have an existing qualification framework (e.g., BANT, MEDDIC) that should inform the scoring rules? Incorrect weightings will undermine Rep trust in the scores immediately.

3. **`Sheet1` column extension:** Adding `lead_score`, `lead_score_override`, `qualification_status`, and `disqualification_reason` to `Sheet1` continues the pattern from the Contact Management PRD. At what column count does the team want to evaluate migrating the contact schema to a dedicated, more structured tab? The current approach works but becomes unwieldy past ~20 columns.

4. **Stage deletion guard behavior:** The current spec blocks deletion of a stage with associated opportunities and requires the user to reassign them first. Is a bulk "move all deals in this stage to [new stage]" convenience action needed in the same flow, or is manual reassignment acceptable?

5. **Forecast currency:** USD is hardcoded for this iteration. How quickly does multi-currency become a real user need? If it is near-term, the `Opportunities` and `Quotes` tabs should be designed with a `currency` column from the start even if the UI only supports USD today.

6. **Quote line items as JSON:** Storing line items as a JSON array in a single Google Sheets cell is pragmatic but limits the ability to query or filter by individual line item properties in future. Is a separate `QuoteLineItems` tab preferred for extensibility, accepting the added complexity of a multi-tab write operation?

7. **PDF generation approach:** Client-side `react-to-print` is the lowest-complexity option but gives limited control over pagination and layout. Is a polished, branded PDF output a hard requirement at launch, or is a clean but basic layout acceptable for the first iteration?

8. **Pipeline Stages provisioning:** Should the five default stages be provisioned eagerly when the `PipelineStages` tab is first created, or should the tab start empty and prompt the user to configure their process? Eager defaults lower the time-to-first-value but may feel prescriptive.

9. **At-Risk flagging thresholds:** The "no interaction in 7 days" threshold for At-Risk deals is an assumption. What interaction cadence do the target sales teams actually maintain? The wrong threshold will result in either constant noise (too sensitive) or no actionable alerts (too lenient).

10. **Won/Lost opportunity visibility:** Closed opportunities are excluded from the active Pipeline Kanban. Should there be a dedicated "Closed Deals" view or report, or is a filter toggle on the existing Pipeline view sufficient?

---

## Success Metrics

- **Pipeline adoption rate:** Percentage of contacts with `status = Lead` or `status = Active` that have at least one linked Opportunity within 30 days of feature launch. Target: 40% of active contacts within 60 days.

- **Pipeline Kanban engagement:** Number of drag-drop stage transitions per active user per week. Baseline: 0 (feature does not exist). Target: 5+ transitions per user per week by day 30, indicating the board is being used as a primary workflow surface rather than a novelty.

- **Forecast accuracy:** Ratio of actual Won deal value in a calendar month to the Weighted Pipeline Value projected at the start of that month. Measured from month 2 onwards (month 1 used to establish baseline). Target: within 30% of projected value, improving over time as users refine probability inputs.

- **Win rate visibility:** Sales Manager actively views the Forecast section at least once per week. Measured via page-view analytics. Target: 80% of weeks where the Sales Manager logs in, they view the Forecast section.

- **Quote creation adoption:** Percentage of Opportunities with `status = Won` that have at least one linked Quote record. Target: 50% within 90 days of launch, rising as Reps build the quoting habit.

- **At-Risk alert action rate:** Percentage of deals flagged At-Risk where an interaction is logged within 48 hours of the flag appearing. Target: 30% within the first 60 days (establishes whether the flagging mechanism is changing behavior or being ignored).

- **Lead qualification completeness:** Percentage of `Lead`-status contacts that have a `qualification_status` value other than `Unqualified` within 14 days of the lead being created. Target: 60% within 60 days of launch.

- **Schema error rate:** Zero read/write errors attributable to the `Opportunities`, `PipelineStages`, or `Quotes` sheet tabs in the first 30 days post-launch, monitored via API error logs.
