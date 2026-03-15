## UX Brief: Sales & Pipeline Management

### User Research Summary

Sales reps operate under constant time pressure. Their primary behavioral patterns observed from the persona model are:

- They open the CRM to check "what needs action today" — overdue deals, at-risk accounts, and leads to follow up on. The dashboard is a task launcher, not a reporting tool.
- They resist multi-step forms. Any flow requiring more than 3 clicks to log a status change will be skipped, leading to stale data.
- They work contact-first, not deal-first. A rep thinks "I just spoke to Sarah at Acme" before thinking "I need to update Opportunity #42." The entry point for deal management must be the contact panel.
- Managers scan, they do not read. The forecast page must answer "how is the quarter going?" in under 5 seconds without scrolling.
- Admins configure stages rarely (once at setup, then occasionally). That flow can tolerate more steps but must be protected against accidental data loss.

Workarounds observed in the current system: reps use the Notes field to track deal values and stage because there is no structured opportunity entity. This produces unqueryable data and makes pipeline reporting impossible. The contact Kanban (grouped by Lead status) is being used as a proxy pipeline board, which conflates lead qualification with deal progression.

The Sales & Pipeline Management feature separates these two concerns — lead qualification stays contact-centric, while opportunity/deal management gets its own dedicated pipeline board — which matches how experienced sales teams think about their funnel.

---

### Information Architecture

#### Navigation Structure

The existing navigation hosts a single "Dashboard" page. The new feature introduces four new top-level routes and one settings sub-route. The sidebar (or top nav, per the UI Designer's discretion) gains the following entries:

```
Sidebar Navigation
├── Dashboard          /dashboard          (existing)
├── Pipeline           /pipeline           (NEW — primary for Sales Reps)
├── Forecast           /forecast           (NEW — primary for Sales Managers)
├── Contacts           /contacts           (existing DashboardPage refactored)
└── Settings
    ├── General        /settings/general   (existing)
    └── Stages         /settings/stages    (NEW — Admin only)
```

The `/opportunities/:id` route is a full-page detail view, navigated to from an Opportunity card click. It does not appear in the sidebar.

#### Route Map

```
/dashboard                    — StatsRow + contact table/grid/kanban (existing)
/pipeline                     — Pipeline Kanban by deal stage (NEW)
/forecast                     — Forecast metrics + breakdown table (NEW)
/opportunities/:id            — Opportunity detail + quotes + interactions (NEW)
/settings/stages              — Stage CRUD management (NEW)
```

#### Data Relationships

```
Contact (existing)
  ├── lead_score          (integer 0-100, derived or manual override)
  ├── qualification_status (Qualified | Disqualified | Unqualified)
  ├── disqualification_reason (BANT enum + free text)
  └── Opportunities[]     (one Contact → many Opportunities)
        ├── name
        ├── value (USD)
        ├── stage_id → PipelineStage
        ├── close_date
        ├── probability %
        ├── status (Open | Won | Lost)
        ├── loss_reason
        └── Quotes[]
              ├── title
              ├── line_items[]
              ├── discount %
              ├── valid_until
              └── status (Draft | Sent | Accepted | Declined | Expired)

PipelineStage
  ├── id
  ├── name
  ├── order (integer)
  └── deal_count (computed)
```

#### How New Pages Fit Existing Shell

The existing `DashboardPage.tsx` app shell (header, sidebar, main content area) wraps all pages. New pages slot into the `<main>` content zone. The `StatsRow` component on the Dashboard is extended with two new MetricCards ("Qualified Leads", "Quotes Sent") but is not duplicated onto the Pipeline or Forecast pages — those pages have their own metric layouts.

---

### Key User Flows

#### Flow A: Creating an Opportunity from a Contact

**Entry point:** Contact Detail panel (360-degree view, accessible from Table, Grid, or Kanban row click)

```
1. Rep clicks a contact row/card → Contact Detail panel opens (right-side drawer, existing pattern)
2. Rep sees "Opportunities" section near the bottom of the Contact Detail panel
   - If no opportunities exist: empty state with "Add Opportunity" button
   - If opportunities exist: compact list of opportunity cards + "Add Opportunity" button
3. Rep clicks "Add Opportunity"
4. Opportunity Drawer opens (shadcn Sheet, same pattern as CustomerDrawer)
   - Contact field: pre-populated and read-only (locked to current contact)
   - Company field: pre-populated from contact's company, editable
   - Name field: focused/empty, required
   - Value (USD): numeric input, required
   - Stage: Select dropdown defaulting to first stage
   - Close Date: date picker, required
   - Probability %: auto-populated from stage default, editable
   - Notes: optional textarea
5. Rep fills required fields and clicks "Save Opportunity"
6. System performs optimistic update:
   - Drawer closes immediately
   - Opportunity appears in the Opportunities list on Contact Detail
   - Toast: "Opportunity created"
7. Background API call completes:
   - On success: no visible change (optimistic state confirmed)
   - On failure: toast "Failed to save — click to retry", opportunity card shows error state, optimistic entry rolled back

Edge case — Rep leaves required field empty:
   - Inline validation on Save click: red border + helper text under empty required fields
   - Drawer stays open, focus moves to first invalid field
   - No API call made

Edge case — Close date in the past:
   - Inline warning (amber, not blocking): "Close date is in the past. This deal will appear as Overdue."
   - Rep can still save
```

#### Flow B: Advancing a Deal via Drag-Drop, Won/Lost Closing

**Entry point:** Pipeline page (`/pipeline`)

```
Happy Path — Moving to a non-terminal stage:
1. Rep views Pipeline Kanban
2. Rep grabs an Opportunity card by clicking and holding
3. @dnd-kit activates: card lifts with subtle shadow, column highlights on hover
4. Rep drags card to a different stage column and drops
5. Optimistic update: card moves immediately, stage column headers recompute counts/values
6. Toast: "Deal moved to [Stage Name]"
7. API PATCH call fires in background
   - On failure: card animates back to original column, toast "Move failed — try again"

Won Path:
1. Rep drags card to the "Won" column (or uses card action menu → "Mark as Won")
2. System shows a lightweight confirmation inline:
   - Small popover on the card: "Mark [Deal Name] as Won? [Confirm] [Cancel]"
   - No full modal — keeps it fast
3. Rep clicks Confirm
4. Optimistic update: card moves to Won column, status badge updates to "Won" (green)
5. Toast: "Deal won! [Deal Name]"

Lost Path:
1. Rep drags card to "Lost" column (or uses card action menu → "Mark as Lost")
2. A compact modal appears (not a full-page modal — centered overlay, small):
   +------------------------------------------+
   | Mark as Lost                          [X] |
   +------------------------------------------+
   | Loss Reason (required)                    |
   | [ Select reason v ]                       |
   |   - Price
   |   - Competitor
   |   - No Budget
   |   - Timing
   |   - No Decision
   |   - Other                                 |
   |                                           |
   | Additional Notes (optional)               |
   | [                                       ] |
   |                                           |
   | [Cancel]              [Mark as Lost]      |
   +------------------------------------------+
3. Rep selects reason, optionally adds notes, clicks "Mark as Lost"
4. Optimistic update: card moves to Lost column, status badge "Lost" (muted/gray)
5. Toast: "Deal marked as lost"
6. Card is hidden from default view (Lost deals filtered out by default)
   - "Show Won/Lost" toggle in filter bar reveals them

Error — Rep drops card to Lost without going through modal:
   - The drop action triggers the modal before committing the move
   - If rep closes modal without saving: card animates back to original column
```

#### Flow C: Creating and Sending a Quote

**Entry point:** Opportunity Detail page (`/opportunities/:id`)

```
1. Rep opens Opportunity Detail page (from Pipeline card click)
2. Rep sees "Quotes" section showing existing quotes or empty state
3. Rep clicks "Create Quote"
4. Quote Drawer opens (shadcn Sheet, full-height right panel):
   - Title field: focused, required
   - Line Items table (see Quote Builder section for detail)
   - Discount %: numeric input, default 0
   - Valid Until: date picker, required
   - Notes: optional textarea
   - Live totals panel: Subtotal, Discount Amount, Total
5. Rep adds line items (see Flow detail in Quote Builder section)
6. Rep clicks "Save as Draft"
7. Drawer closes, quote appears in Quotes list with "Draft" badge
8. Rep views the quote in the Quotes list, clicks "Send"
9. Confirmation popover on the quote card: "Mark quote as Sent? This will notify the contact. [Send] [Cancel]"
10. Rep confirms → quote status transitions to "Sent" badge
11. Toast: "Quote marked as sent"

Quote becomes Accepted/Declined:
1. Rep opens Opportunity Detail, finds the Sent quote
2. Uses action menu on quote card: "Mark as Accepted" or "Mark as Declined"
3. No additional fields required for Accepted
4. Declined: optional free-text reason field in a small inline form
5. Status badge transitions accordingly

Auto-expire flow (handled on page load):
1. Rep navigates to Opportunity Detail
2. System checks all Sent quotes with valid_until < today
3. Expired quotes are silently updated to "Expired" status in the background
4. If any quotes were expired: amber banner "1 quote expired since your last visit" appears at top of Quotes section
   - Banner dismissible with X

PDF Export:
1. Rep clicks "Export PDF" on a Draft or Sent quote card
2. react-to-print triggers browser print dialog with a print-optimized quote layout
3. No server roundtrip — client-side only
4. Disabled (grayed out with tooltip "PDF not available for this status") for Accepted/Declined/Expired quotes
```

#### Flow D: Qualifying or Disqualifying a Lead

**Entry point:** Contact Detail panel (from any contact surface)

```
Qualifying:
1. Rep opens Contact Detail panel for a contact with "Unqualified" status
2. Lead Score badge visible at top of panel: e.g., "Hot 82" in red
3. Rep clicks "Qualify" button (one-click, prominent in the header action row)
4. Optimistic update: qualification_status → "Qualified", button disappears, green "Qualified" badge appears
5. Toast: "Contact qualified"
6. "Qualified Leads" MetricCard on Dashboard increments

Disqualifying:
1. Rep opens Contact Detail panel
2. Rep clicks "Disqualify" button (secondary style, less prominent than Qualify)
3. Compact inline form expands below the action row (not a modal):
   +--------------------------------------------+
   | Disqualify Contact                         |
   | Reason: [ Select BANT reason v ]           |
   |   - Budget (no budget)
   |   - Authority (no decision-maker access)
   |   - Need (no clear need identified)
   |   - Timing (wrong time)
   |   - Other                                  |
   | Notes: [                                 ] |
   | [Cancel]                  [Confirm]        |
   +--------------------------------------------+
4. Rep selects reason + optional notes, clicks Confirm
5. Contact qualification_status → "Disqualified", inline form collapses
6. Badge shows "Disqualified" (muted)
7. Contact is hidden from the default contact list (same pattern as Archived contacts)
   - "Show Disqualified" toggle in CustomerFilters reveals them

Edge case — Rep tries to create an Opportunity for a Disqualified contact:
   - "Add Opportunity" button is present but shows amber warning inline: "This contact is disqualified. Are you sure you want to add an opportunity? [Add Anyway]"
```

#### Flow E: Reviewing the Forecast

**Entry point:** Forecast page (`/forecast`) — primary for Sales Managers

```
1. Manager clicks "Forecast" in sidebar
2. Page loads:
   a. MetricCards row renders with skeleton loaders (6 cards)
   b. Pipeline by Stage table renders with skeleton rows
3. Data loads:
   a. MetricCards populate (Total Pipeline, Weighted Pipeline, Expected Close This Month, Expected Close This Quarter, Win Rate, Avg Deal Age)
   b. Table populates with stage breakdown rows
4. Manager scans MetricCards — no interaction needed for overview
5. Manager clicks a column header in the Pipeline by Stage table to sort
   - Client-side sort, instant (no reload)
6. Manager clicks a stage row in the table
   - Navigates to /pipeline with that stage pre-filtered in the filter bar
7. Manager sees "At Risk & Overdue" count badge on the Pipeline link in the sidebar
   - Clicking navigates to /pipeline with At Risk + Overdue filter active

Empty state (no deals in pipeline):
   - MetricCards show "$0" or "0%" values (not skeleton — real zeros)
   - Table shows: "No deals in pipeline yet. Add opportunities from a contact."
   - Link in empty state navigates to /contacts

Error state (API failure):
   - MetricCards show error icon + "Could not load" text
   - Retry button below cards
   - Table shows error state independently with its own retry
```

#### Flow F: Responding to an At-Risk Alert

**Entry point:** Pipeline page — "At Risk & Overdue" filter button, or Forecast page sidebar badge

```
1. Rep sees "At Risk & Overdue (7)" button in Pipeline filter bar (count badge)
2. Rep clicks the button
3. Filter activates: Pipeline Kanban now shows only At-Risk (amber) and Overdue (red) cards
4. Rep identifies a specific card — e.g., an amber-bordered card for "Acme - Enterprise License"
5. Rep clicks the card to open Opportunity Detail
6. Rep sees the Interaction Log (linked from Contact) — last interaction was 9 days ago
7. Rep clicks "Log Interaction" (or navigates to Contact Detail from the Opportunity page)
8. Rep logs a call/email interaction
9. Rep returns to Pipeline page
10. The card is no longer At-Risk (interaction within 7 days now satisfied)
11. The "At Risk & Overdue" count badge decrements

At-Risk indicator logic:
   - At-Risk condition: close_date ≤ 14 days from today AND no interaction logged in past 7 days AND status = Open
   - Overdue condition: close_date < today AND status = Open
   - These are computed client-side after data fetch — no separate API call
```

#### Flow G: Stage Management

**Entry point:** Settings → Stages (`/settings/stages`) — Admin only

```
Happy Path — Adding a stage:
1. Admin navigates to /settings/stages
2. Sees list of existing stages in order with drag handles
3. Clicks "Add Stage" button
4. Inline form appears at bottom of list:
   [ Stage Name_________________ ] [Add]
5. Admin types name, clicks Add
6. Stage appears at end of list
7. Toast: "Stage added"

Reordering:
1. Admin drags stage row up/down using drag handle (@dnd-kit)
2. Optimistic reorder in the list
3. API call fires, order persists

Renaming:
1. Admin clicks stage name text (inline edit pattern)
2. Text becomes an input field in place
3. Admin edits, presses Enter or clicks away to save
4. Optimistic update — text reverts to label

Deleting:
1. Admin clicks trash icon on a stage row
2. System checks: are there deals in this stage?
   - If deals exist: action is blocked. Toast/inline error: "Cannot delete — [N] deals are in this stage. Move deals first."
   - Delete icon is disabled (grayed, tooltip explaining why) when deals exist
3. If no deals: confirmation popover appears on the icon:
   "Delete [Stage Name]? This cannot be undone. [Delete] [Cancel]"
4. Admin confirms → stage removed from list

10-stage limit:
   - "Add Stage" button becomes disabled when 10 stages exist
   - Tooltip on disabled button: "Maximum 10 stages reached. Delete a stage to add a new one."
```

#### Flow H: PDF Export

**Entry point:** Opportunity Detail page → Quote card

```
1. Rep locates a Draft or Sent quote in the Quotes list
2. Quote card shows "Export PDF" action (button or icon in card action row)
3. Rep clicks "Export PDF"
4. react-to-print generates a print view in a hidden DOM node
5. Browser native print dialog opens
6. Rep prints or saves as PDF
7. No state change on the quote, no API call

States:
   - Export PDF available: Draft, Sent
   - Export PDF disabled (grayed icon + tooltip): Accepted, Declined, Expired
   - Loading state: brief spinner on the button during print preparation (< 1 second typically)
```

---

### Screen & Component Specifications

#### PipelinePage (`/pipeline`)

**Layout:**

```
+-------------------------------------------------------------------+
| App Shell: Sidebar + Top Header                                   |
+-------------------------------------------------------------------+
| Page Header                                                       |
|  [Pipeline]                         [+ Add Opportunity]           |
+-------------------------------------------------------------------+
| Filter Bar                                                        |
|  [Search by contact/company...]  [Close Date range]              |
|  [At Risk & Overdue (N)] toggle                [Show Won/Lost]   |
+-------------------------------------------------------------------+
| Kanban Board (horizontal scroll on overflow)                      |
|                                                                   |
| +------------+ +------------+ +------------+ +------------+       |
| | Stage 1    | | Stage 2    | | Stage 3    | | Stage 4    |  ... |
| | 4 deals    | | 2 deals    | | 7 deals    | | 1 deal     |       |
| | $42,000    | | $18,500    | | $310,000   | | $5,000     |       |
| +------------+ +------------+ +------------+ +------------+       |
| | [Card]     | | [Card]     | | [Card]     | |            |       |
| | [Card]     | |            | | [Card]     | |            |       |
| | [Card]     | |            | | [Card]     | |            |       |
| +------------+ +------------+ +------------+ +------------+       |
|                                                                   |
+-------------------------------------------------------------------+
```

**States:**
- Loading: Skeleton columns with skeleton cards (3 columns, 2 skeleton cards each)
- Empty (no stages configured): Centered empty state — "No pipeline stages configured. Go to Settings > Stages to set up your pipeline." with link button.
- Empty (stages exist but no deals): Columns render, each with empty state inside: "+ Add Opportunity" drop target area at bottom of each column
- Error: Full-width error banner above the board with retry button
- Filtered to zero results: Board shows empty columns, filter bar shows "Clear filters" link

**Interactions:**
- "Add Opportunity" (top right): opens Opportunity Drawer with contact field unfilled (user must search/select contact)
- Search filter: debounced 300ms, filters cards client-side
- Close Date range: two date inputs (from/to), client-side filter
- "At Risk & Overdue" button: toggle — active state shows distinct background, filters board
- "Show Won/Lost" toggle: default OFF; when ON, adds Won and Lost columns at the end of the board (or overlaid on the same scroll)

#### OpportunityCard

**Anatomy:**

```
+-----------------------------------------------+
| [LeadScoreBadge]              [At-Risk amber] |
| Deal Name (bold, truncated at 2 lines)        |
| Contact Name · Company Name                   |
| $Value (formatted)  |  Stage Probability %    |
| Close: Mar 28, 2026     [Overdue red label]   |
+-----------------------------------------------+
           (drag handle — entire card is draggable)
```

**States:**
- Default: white card, subtle border
- Overdue: red left-border stripe + "Overdue" red label on close date
- At-Risk: amber left-border stripe + amber warning icon in top-right
- Dragging: elevated shadow, slight rotation (2deg), opacity 0.9 on ghost
- Hovered: subtle shadow increase, pointer cursor
- Won: green left-border, "Won" badge, card dimmed if in default view toggle mode
- Lost: gray left-border, "Lost" badge, hidden unless "Show Won/Lost" is active

**Interactions:**
- Click card (not drag): navigate to `/opportunities/:id`
- Long press or drag: initiate @dnd-kit drag
- Three-dot action menu (visible on hover): "Mark as Won", "Mark as Lost", "Edit", "Delete"

#### OpportunityDetailPage (`/opportunities/:id`)

**Layout:**

```
+-------------------------------------------------------------------+
| [← Back to Pipeline]                                             |
+-------------------------------------------------------------------+
| HEADER ROW                                                        |
|  Deal Name (h1, editable inline)        [Won] [Lost] [Edit]      |
|  Contact: Sarah Chen @ Acme Corp (linked)                        |
|  Stage: [Proposal] → probability 60%                             |
+-------------------------------------------------------------------+
|  LEFT COLUMN (2/3 width)    | RIGHT COLUMN (1/3 width)           |
|                              |                                    |
|  DETAILS CARD               | ACTIVITY TIMELINE                  |
|  Value: $24,000             |  (read-only, linked from Contact   |
|  Close Date: Apr 15, 2026   |   interaction log — shows all      |
|  Probability: 60%           |   interactions for this contact,   |
|  Notes: [editable]          |   most recent first)               |
|                              |                                    |
|  QUOTES SECTION             |                                    |
|  [+ Create Quote]           |                                    |
|  [Quote Card list]          |                                    |
|                              |                                    |
+-----------------------------+------------------------------------+
```

**States:**
- Loading: skeleton for all sections
- Error loading opportunity: full-page error with "Go back" link
- Empty quotes: "No quotes yet. Create your first quote." with Create Quote button

**Quote Card in list:**

```
+-----------------------------------------------+
| Quote Title                   [Draft badge]   |
| Total: $22,800  |  Valid until: Apr 1, 2026   |
| [Export PDF]  [Send]  [Edit]  [Delete]        |
+-----------------------------------------------+
```

Action visibility by status:
- Draft: Export PDF, Send, Edit, Delete
- Sent: Export PDF, Mark Accepted, Mark Declined, Delete
- Accepted: View only, no actions except view/expand
- Declined: View only
- Expired: View only, amber "Expired" badge with expiry date

#### ForecastPage (`/forecast`)

**Layout:**

```
+-------------------------------------------------------------------+
| Page Header                                                       |
|  [Forecast]               [This Month ▾] (period selector)       |
+-------------------------------------------------------------------+
| METRICS ROW (6 cards, horizontal)                                 |
| +----------+ +----------+ +----------+ +----------+ +------+ +------+
| | Total    | | Weighted | | Close    | | Close    | | Win  | | Avg  |
| | Pipeline | | Pipeline | | This Mo. | | This Q.  | | Rate | | Deal |
| |          | |          | |          | |          | |      | | Age  |
| | $485,000 | | $214,000 | | $62,000  | | $180,000 | | 34%  | | 18d  |
| +----------+ +----------+ +----------+ +----------+ +------+ +------+
+-------------------------------------------------------------------+
| PIPELINE BY STAGE TABLE                                           |
|                                                                   |
| Stage          | Deals | Total Value | Weighted Value | Avg Age  |
| --------------|-------|-------------|----------------|---------- |
| Prospecting    |   12  |   $48,000   |   $14,400      |   22d    |
| Qualification  |    8  |   $92,000   |   $36,800      |   15d    |
| Proposal       |    5  |  $204,000   |  $122,400      |    8d    |
| Negotiation    |    3  |  $141,000   |  $112,800      |    4d    |
|                                                                   |
| (clicking a row navigates to /pipeline filtered to that stage)   |
+-------------------------------------------------------------------+
| AT RISK SUMMARY (conditional — only shows if At-Risk count > 0)  |
|  Amber banner: "7 deals are At Risk or Overdue → View on Pipeline"|
+-------------------------------------------------------------------+
```

**MetricCard specs (reusing/extending MetricCard.tsx):**
- Each card: label, primary value (large), optional secondary label (e.g., "vs last month +12%")
- Loading state: skeleton pulse on value area
- Error state: "—" value with small error icon and tooltip "Could not compute"
- The 6 cards required: Total Pipeline, Weighted Pipeline (sum of value * probability), Expected Close This Month, Expected Close This Quarter, Win Rate (won / (won + lost) * 100), Avg Deal Age (days since opportunity created for Open deals)

**Pipeline by Stage table:**
- Sortable columns: client-side only, no API call
- Sort indicator: up/down chevron on active column header
- Row hover: subtle highlight, pointer cursor indicating clickability
- Empty: single row "No deals" with link to Pipeline

#### StageSettingsPage (`/settings/stages`)

**Layout:**

```
+-------------------------------------------------------------------+
| Settings > Stages                                                 |
| Manage your pipeline stages. Changes apply immediately.          |
+-------------------------------------------------------------------+
| [+ Add Stage]  (disabled + tooltip when at 10 stages)           |
+-------------------------------------------------------------------+
| ≡  Prospecting                                    [Edit] [🗑]   |
| ≡  Qualification                                  [Edit] [🗑]   |
| ≡  Proposal                                       [Edit] [🗑]   |
| ≡  Negotiation                                    [Edit] [🗑]   |
| ≡  Closed                                         [Edit] [🗑 disabled]|
|    (tooltip: "3 deals in this stage")                            |
+-------------------------------------------------------------------+
| Add Stage (inline form, appears below list on button click):     |
| [Stage name_______________________________] [Add] [Cancel]       |
+-------------------------------------------------------------------+
```

**Interactions:**
- Drag handle (≡): @dnd-kit sortable, reorders list
- Edit: inline — stage name text becomes an input, confirm on Enter or blur
- Delete icon: disabled (grayed) if deals exist, active if empty stage
- Disabled delete icon: tooltip "N deals in this stage — move or close them first"

#### QuoteDrawer

**Layout (shadcn Sheet, full-height right panel):**

```
+----------------------------------------------+
| Create Quote                             [X]  |
+----------------------------------------------+
| Title *                                       |
| [Quote title____________________________]    |
|                                               |
| LINE ITEMS                                    |
| Description       | Qty | Unit Price | Total |
| [_______________] | [1] | [$_______] | $0    |
| [_______________] | [1] | [$_______] | $0    |
| [+ Add Line Item]                            |
|                                               |
| Discount %                                    |
| [0______] %                                  |
|                                               |
| Valid Until *                                 |
| [Date picker__________________]              |
|                                               |
| Notes                                         |
| [___________________________________________] |
| [___________________________________________] |
|                                               |
+----------------------------------------------+
| TOTALS (sticky footer inside panel)          |
| Subtotal:              $0                    |
| Discount:             -$0                    |
| ─────────────────────────────               |
| Total:                 $0                    |
+----------------------------------------------+
| [Cancel]                  [Save as Draft]    |
+----------------------------------------------+
```

**Line Items table behavior:**
- Each row: Description (text input), Qty (number, min 1), Unit Price (number, min 0), Total (computed, read-only)
- Row total = Qty * Unit Price, computed live on each keystroke
- Subtotal = sum of all row totals
- Discount amount = Subtotal * (discount % / 100)
- Total = Subtotal - Discount amount
- All live computations are client-side with no debounce (instant)
- "Add Line Item" link: appends a new empty row, focuses Description field of new row
- Delete row: trash icon on each row (hidden for the first row if it is the only row — must have at least one line item)
- Minimum 1 line item enforced on Save: validation error inline if all line items are empty

**States:**
- Empty (new quote): single empty line item row, totals all $0
- Populated: rows filled, totals computed
- Validation error: red border on required empty fields (Title, Valid Until, at least one line item with description)
- Saving: Save button shows spinner, all fields disabled
- Save error: toast "Failed to save quote", fields re-enabled

#### LeadScoreBadge

**Anatomy:**

```
Hot: [ Hot 82 ▲ ]  (red background, white text, flame-style or arrow indicator)
Warm: [ Warm 55 ]  (amber background, dark text)
Cold: [ Cold 24 ]  (gray background, dark text)
```

**Score ranges:**
- Hot: 70–100 (red badge)
- Warm: 40–69 (amber badge)
- Cold: 0–39 (gray badge)

**Tooltip on hover:**

```
+--------------------------------+
| Lead Score: 82                 |
|                                |
| Email engagement:    +20       |
| Call activity:       +15       |
| Company size fit:    +25       |
| Recent activity:     +22       |
|                                |
| [Override score manually]      |
+--------------------------------+
```

"Override score manually" in tooltip: inline text link that opens the manual override form.

**Manual override interaction (on Contact Detail panel):**
1. User hovers LeadScoreBadge → tooltip appears
2. User clicks "Override score manually" in tooltip
3. Tooltip closes; inline edit field replaces the badge in the Contact Detail header:
   `[ 82 ] [Save] [Cancel]`
   - Input: number, 0–100
   - Score badge shows a small "edited" indicator (pencil icon) after override is set
   - Manual override persists; system-computed score is displayed separately below: "System score: 78"
4. User enters new value, clicks Save
5. Badge updates to new value with the "edited" indicator
6. Toast: "Score overridden to [value]"
7. "Reset to system score" link appears below the badge (click to remove override, revert to computed)

---

### Pipeline Kanban Design

#### Column Layout

Each stage is a column. Columns are horizontally scrollable on the page — the board overflows horizontally, not vertically. Each column has a fixed width (approximately 280px) and a maximum height equal to the viewport minus the header/filter bar. The column body is vertically scrollable within that height.

```
+---------------------+
| COLUMN HEADER       |
|---------------------|
| Stage Name     (i)  |
| 4 deals · $42,000   |
+---------------------+
| [Card]              |
| [Card]              |
| [Card]              |
|                     |
| [+ Add deal here]   |  ← drop target area at bottom of column
+---------------------+
```

Column header:
- Stage name (bold)
- Info icon (i): tooltip showing default probability % for this stage
- Deal count + total value (computed from visible cards)
- Column header is sticky — stays visible when card list scrolls

Drop target area at column bottom:
- Always present as the last "slot" in a column
- Shows a dashed border when a card is being dragged over the column
- Shows "Drop here" text label during active drag

#### Card Anatomy (detailed)

```
+-----------------------------------------------+
| [At-Risk icon]              [Lead Score badge] |
|                                               |
| Deal Name                                     |
| (truncated at 2 lines, full name in tooltip)  |
|                                               |
| Contact: Sarah Chen                           |
| Company: Acme Corp                            |
|                                               |
| $24,000                          60%          |
|                                               |
| Close: Apr 15, 2026   [Overdue] or [At Risk]  |
|                                               |
+-----------------------------------------------+
```

- All text truncated with ellipsis at overflow; full value in native title tooltip
- Value formatted with currency symbol and comma separators
- Probability shown as percentage, right-aligned
- Close date: plain text if future + healthy; red with "Overdue" label if past + Open; amber with "At Risk" label if within 14 days + no recent interaction

#### Drag-Drop Behavior (@dnd-kit)

- Drag initiated: 200ms delay to distinguish click from drag (avoids accidental drags)
- Drag active: card becomes a semi-transparent "ghost" in original position; a solid dragged clone follows the cursor
- Column highlight: when dragging over a column, the column body shows a light background highlight + dashed border
- Drop preview: a placeholder slot shows where the card will land in the target column's card order
- Drop on same column: reorders within the column (order persisted to API)
- Drop on terminal stage (Won or Lost): triggers respective confirmation flow before committing
- Drop outside any column: card snaps back to original position with animation

#### Filter Bar

```
+-------------------------------------------------------------------+
| [Search contact, company...  ] [From date] [To date]            |
| [At Risk & Overdue (7)]                     [Show Won/Lost]      |
+-------------------------------------------------------------------+
```

- Search: debounced 300ms, matches contact name and company name, client-side
- Date range (From/To): filters by close_date range, client-side
- "At Risk & Overdue (N)": toggle button with count badge; count computed client-side; when active shows only qualifying cards
- "Show Won/Lost": toggle; default OFF; when ON, Won and Lost stage columns appear at the far right of the board (always after all Open-stage columns)
- Active filter count indicator: if any filter is active, show "X filters active" label near the filter bar with "Clear all" link

---

### Forecast Section Design

#### MetricCard Specifications (extending existing MetricCard.tsx)

The 6 required MetricCards for the Forecast page follow the same Card component pattern as StatsRow but may be larger (wider) since there are 6 on one row at typical viewport widths. At narrower viewports they wrap to 2 columns (3 rows of 2).

| Card | Value | Secondary Label |
|---|---|---|
| Total Pipeline | Sum of all Open deal values | "N open deals" |
| Weighted Pipeline | Sum of (value * probability) for Open deals | None |
| Expected Close This Month | Sum of Open deal values with close_date in current month | "N deals" |
| Expected Close This Quarter | Sum of Open deal values with close_date in current quarter | "N deals" |
| Win Rate | Won / (Won + Lost) * 100 | "Last 90 days" |
| Avg Deal Age | Average days since created_at for Open deals | "days" |

**Loading state:** skeleton rectangles for value and secondary label
**Error state:** "—" in place of value, error icon, tooltip "Could not compute — data may be incomplete"
**Zero state:** Show "$0" or "0%" or "0 days" — not an error, just genuinely empty

#### Pipeline by Stage Table

Columns: Stage Name | Deals | Total Value | Weighted Value | Avg Age (days)

- All columns sortable client-side (ascending/descending toggle)
- Default sort: by stage order (pipeline order, not alphabetical)
- Row click: navigate to `/pipeline` with that stage pre-selected in filter
- Table footer row: Totals row (sum of Deals, Total Value, Weighted Value; Avg Age is an average of averages — or median if available)
- No pagination — pipeline stages are bounded at 10

---

### Quote Builder Design

#### Line Items Table UX

The line items table is a lightweight inline spreadsheet. Each row is an HTML table row with inputs, not a separate modal per item. Keyboard navigation is important: Tab moves from field to field across columns, and Tab on the last field of the last row triggers "Add Line Item."

Row structure: `[Description] [Qty] [Unit Price] [Total (read-only)] [Delete icon]`

- Description: text input, full width within its column, no character limit enforced at UI level
- Qty: number input, min=1, integer only (no decimals)
- Unit Price: number input, min=0, allows 2 decimal places, formatted as currency on blur
- Total: computed display (`Qty * UnitPrice`), formatted as currency, not editable
- Delete icon: trash icon, only visible on row hover (to reduce visual noise); always visible on touch devices
- Minimum 1 row enforced — the delete icon on the sole remaining row is disabled with tooltip "A quote must have at least one line item"

#### Live Computed Totals

The totals panel (sticky at bottom of the drawer) updates on every keystroke:
- Subtotal recomputes immediately when any Qty or Unit Price changes
- Discount amount recomputes when Subtotal changes or Discount % changes
- Total recomputes as a result
- No debounce — computation is pure client-side arithmetic, latency is zero
- If Total is negative (edge case: discount > 100%), Total displays in red with a warning "Total cannot be negative. Check your discount."

#### Status Badge Transitions

```
Draft ──[Send]──→ Sent ──[Accept]──→ Accepted
                    │
                    └──[Decline]──→ Declined
                    │
                    └──[auto-expire]──→ Expired
```

- Transitions are one-way — no reverting a Sent quote to Draft
- Send action: requires at least one line item and a Valid Until date
- Accept/Decline: available from the quote card action menu on Sent quotes
- Expired: computed on page load, no user action required

#### PDF Export

The print layout (rendered by react-to-print in a hidden div) contains:
- Company logo placeholder (or text name if no logo)
- Quote title, date created, valid until date
- "To:" contact name and company
- Line items table (description, qty, unit price, total)
- Subtotal, discount, total
- Notes section (if populated)
- Quote status watermark (DRAFT or SENT, large, diagonal, light opacity) — helps distinguish from finalized documents

---

### Lead Scoring UX

#### Badge Placement by Surface

**Contact Table (existing table view):**
- New column "Score" inserted between "Status" and "Last Contact" columns
- Column is sortable — clicking header sorts by lead_score ascending/descending
- Cell shows the LeadScoreBadge component (compact variant — no label, just the score number in the colored badge)
- Column can be hidden via column visibility control (if one exists) to preserve table density

**Contact Grid (card view):**
- Badge appears in the top-right corner of each Contact card
- Does not replace the StatusBadge — both are visible (Status bottom-left, LeadScore top-right)

**Contact Kanban (existing Kanban grouped by contact status):**
- Badge appears in the top-right of each contact card, same as Grid view
- Small size to minimize visual noise given card density

**Contact Detail Panel (360-degree view):**
- Badge appears prominently in the contact header row, adjacent to the contact name
- Full variant (includes "Hot/Warm/Cold" label + numeric score)
- Tooltip enabled on hover
- Manual override controls accessible from here only

#### Tooltip Design

Tooltip appears on hover with a 400ms delay (to avoid accidental triggers during scanning). It is a popover-style component (not a native browser tooltip) to support the "Override score manually" interactive link.

Content:
- Header: "Lead Score: [N]"
- Score breakdown list (one line per signal contributing to the score)
- Footer link: "Override score manually" — text link, triggers override flow

On mobile/touch: tooltip content is accessible via an info (i) icon tap that opens a bottom sheet with the same content.

#### Manual Override Inline Form

Appears in-place within the Contact Detail header, replacing the badge temporarily:

```
Lead Score:  [82]  [Save]  [Cancel]
             (input, 0-100)
```

- Input validates: must be 0–100, integer
- Save: updates score, shows badge with pencil/override indicator, shows "Reset to system score" link below
- Cancel: reverts to displaying the badge, no change
- After override: system-computed score is shown in small text below the badge: "System score: 78"
- "Reset to system score" click: removes override, badge returns to system score, no override indicator

---

### Responsive Considerations

#### Desktop-Only Features (≥1024px)

- **Pipeline Kanban** (`/pipeline`): Horizontal multi-column drag-drop is desktop-only per PRD. On tablet/mobile, the Pipeline page falls back to a list view grouped by stage (accordion or flat list with a stage label). Drag-drop is disabled on touch screens smaller than 1024px.
- **Quote line items table**: The multi-column table is desktop-optimized. On tablet (768–1023px), the table compresses but remains functional. On mobile, each line item renders as a stacked card (description above, qty/price on one row, delete icon top-right of card).
- **Forecast MetricCards**: 6-across row on desktop collapses to 2-across (3 rows) on tablet and 1-across (6 rows) on mobile.

#### Tablet Support (768px–1023px)

- Pipeline: list view by stage (accordion). Each stage header is collapsible with deal count + value shown.
- Opportunity Detail: left/right column layout stacks vertically (details above, activity below, quotes at bottom).
- Filter bar: collapses to a single "Filters" button that opens a filter drawer.

#### Mobile Support (<768px)

- Pipeline: list view only. Each deal is a card in a flat list. Stage filter at top (Select dropdown). No drag-drop.
- Forecast: all MetricCards stacked, table scrollable horizontally (sticky Stage Name column).
- Quote Drawer: full-screen sheet (100% viewport height and width), line items as stacked cards.
- LeadScoreBadge: full variant on Contact Detail (phone layout), compact variant on list items.

---

### Interaction Design Patterns

#### Optimistic Updates

All state changes that are likely to succeed should be reflected immediately in the UI, with the API call fired in the background. The pattern:

1. Apply change to local Zustand store immediately
2. Fire API call
3. On success: no visible change (optimistic state confirmed)
4. On failure: roll back the Zustand store to pre-change state, show error toast with "Retry" action

Optimistic updates apply to: card drag-drop (stage change), Won/Lost marking, lead qualification, quote status transitions, stage reordering in settings.

Optimistic updates do NOT apply to: creating a new opportunity or quote (must wait for server-generated ID), deleting (requires confirmation first, then fires and waits).

#### Loading States

- **Page initial load**: skeleton layouts that match the shape of the populated state. Never show a spinner alone for a full page — always use content-shaped skeletons.
- **MetricCards**: skeleton rectangle for the value area only (label is known and static).
- **Kanban board**: skeleton columns (3 columns with 2 skeleton cards each) during initial load.
- **Drawer open**: if a drawer must load data before showing (e.g., editing an existing opportunity), show a skeleton inside the drawer — not a blank panel.
- **Button actions**: replace button label with a spinner + "Saving..." text. Button becomes disabled. Other interactive elements on the page remain active.

#### Empty States

Each empty state must:
1. Explain why there is nothing here (no data exists, or active filter eliminated results)
2. Offer a clear next action (primary CTA button or link)

Specific empty states:
- Pipeline — no stages: "Set up your pipeline first. Go to Settings > Stages." [Go to Settings]
- Pipeline — stages exist, no deals: columns render, each with "No deals in this stage" + drop zone
- Pipeline — filter active, no results: "No deals match your filters." [Clear filters]
- Forecast — no deals: "$0 / 0" across all MetricCards, table shows "No deals in pipeline yet." [Add a deal from a contact]
- Opportunity Detail — no quotes: "No quotes created yet." [Create Quote]
- Settings Stages — no stages: "No stages configured. Add your first stage below." with input focused

#### Error Patterns

- **Toast notifications** (bottom-right, 4 second auto-dismiss): used for transient results — success confirmations, non-critical errors
- **Inline validation**: shown on form field blur or Submit attempt — red border + helper text below field
- **Blocking error banners**: used when a page cannot load its primary data — full-width amber/red banner at top of content area with retry button
- **Inline card error state**: when an optimistic update fails, the affected card gets a red error border + small error icon. Tooltip on icon: "Last update failed. [Retry]"
- **Confirmation patterns**: destructive or irreversible actions (delete stage, mark as Lost) use a popover or compact inline modal — not a full-screen modal — to minimize interruption

#### Toast Message Patterns

```
Success: "Opportunity moved to Proposal"
Success: "Quote marked as Sent"
Success: "Lead qualified"
Error:   "Failed to move deal — try again" [Retry]
Error:   "Failed to save quote"
Warning: "1 quote expired since your last visit" (dismissible amber banner, not a toast)
```

---

### Accessibility Considerations

#### Keyboard Navigation

- Pipeline Kanban: when drag-drop keyboard mode is active (@dnd-kit supports this natively), Tab navigates between cards, Space/Enter activates a card for keyboard drag, Arrow keys move the activated card between columns, Escape cancels
- QuoteDrawer line items: Tab key traverses Description → Qty → Unit Price → (auto-add row on Tab from last field) → next row Description
- Stage Settings list: drag handles are keyboard-accessible (same @dnd-kit keyboard pattern as Kanban)
- All modals/drawers: focus is trapped within the open panel; Escape closes the panel; focus returns to the trigger element on close
- Filter bar: all filter controls reachable via Tab; toggle buttons have clear on/off ARIA states

#### Screen Reader Labels

- LeadScoreBadge: `aria-label="Lead score: Hot, 82 out of 100"` — not just the visual color
- At-Risk indicator on card: `aria-label="At risk: close date approaching with no recent interaction"`
- Overdue indicator: `aria-label="Overdue: close date has passed"`
- Drag handle: `aria-label="Drag to reorder [Stage Name]"`
- Delete stage button (disabled): `aria-disabled="true"` + `aria-describedby` pointing to the tooltip text explaining why it is disabled
- Quote status badges: `aria-label="Quote status: Draft"` (not just a color-coded badge)
- Column header sort button: `aria-sort="ascending"` or `aria-sort="descending"` or `aria-sort="none"`

#### Color-Independent Status Indicators

- Lead score: hot/warm/cold distinction conveyed by label text ("Hot", "Warm", "Cold") + numeric score, not only badge color
- Overdue: red color + "Overdue" text label + bold close date, not only color
- At-Risk: amber color + warning icon (triangle with !) + tooltip text
- Quote status: text badge label always present ("Draft", "Sent", "Accepted", "Declined", "Expired"), not only color
- Won/Lost deal cards: text badge + left-border stripe + status label — three independent indicators

---

### Component Inventory

#### New Components

| Component | Location | Description |
|---|---|---|
| `LeadScoreBadge` | `components/leads/LeadScoreBadge.tsx` | Hot/Warm/Cold badge with tooltip and manual override trigger |
| `LeadScoreTooltip` | `components/leads/LeadScoreTooltip.tsx` | Popover tooltip with score breakdown and override link |
| `LeadScoreOverrideForm` | `components/leads/LeadScoreOverrideForm.tsx` | Inline edit form for manual score override |
| `QualificationActions` | `components/leads/QualificationActions.tsx` | Qualify/Disqualify buttons + disqualification inline form |
| `OpportunityCard` | `components/pipeline/OpportunityCard.tsx` | Draggable deal card for Kanban board |
| `PipelineColumn` | `components/pipeline/PipelineColumn.tsx` | Stage column wrapper (header + droppable card list) |
| `PipelineBoard` | `components/pipeline/PipelineBoard.tsx` | @dnd-kit DndContext wrapper for the full board |
| `PipelineFilters` | `components/pipeline/PipelineFilters.tsx` | Filter bar for Pipeline page |
| `WonLostModal` | `components/pipeline/WonLostModal.tsx` | Compact overlay for loss reason capture |
| `OpportunityDrawer` | `components/opportunities/OpportunityDrawer.tsx` | shadcn Sheet for creating/editing opportunities |
| `OpportunityList` | `components/opportunities/OpportunityList.tsx` | Compact list of opportunities on Contact Detail panel |
| `QuoteDrawer` | `components/quotes/QuoteDrawer.tsx` | Full-height shadcn Sheet for quote creation/editing |
| `QuoteLineItems` | `components/quotes/QuoteLineItems.tsx` | Line items table with live computed totals |
| `QuoteTotals` | `components/quotes/QuoteTotals.tsx` | Sticky totals footer panel inside QuoteDrawer |
| `QuoteCard` | `components/quotes/QuoteCard.tsx` | Quote summary card with status badge and actions |
| `QuotePrintLayout` | `components/quotes/QuotePrintLayout.tsx` | Hidden print-optimized layout for react-to-print |
| `ForecastMetrics` | `components/forecast/ForecastMetrics.tsx` | 6-MetricCard row specific to Forecast page |
| `PipelineByStageTable` | `components/forecast/PipelineByStageTable.tsx` | Sortable breakdown table |
| `AtRiskBanner` | `components/forecast/AtRiskBanner.tsx` | Conditional amber summary banner |
| `StageSettingsList` | `components/settings/StageSettingsList.tsx` | Sortable stage list with inline edit and delete |
| `StageSettingsItem` | `components/settings/StageSettingsItem.tsx` | Single stage row in settings list |
| `AddStageForm` | `components/settings/AddStageForm.tsx` | Inline form for adding a new stage |

#### Components to Extend

| Existing Component | Extension Required |
|---|---|
| `CustomerDrawer.tsx` | Add Opportunities section to display `OpportunityList` and "Add Opportunity" button |
| `StatsRow.tsx` | Add "Qualified Leads" MetricCard and "Quotes Sent" MetricCard slots |
| `CustomerFilters.tsx` | Add "Show Disqualified" toggle (parallel to existing "Show Archived" if present) |
| `CustomerKanban.tsx` | Add `LeadScoreBadge` to contact cards; ensure it does not conflict with the new Pipeline Kanban |
| `MetricCard.tsx` | Add support for `secondaryLabel` prop; add error state with icon and tooltip; ensure skeleton loading variant |
| `StatusBadge.tsx` | Extend to support Opportunity status values (Open, Won, Lost) and Quote status values (Draft, Sent, Accepted, Declined, Expired) in addition to existing contact statuses |

#### New Zustand Stores

| Store | File | Responsibility |
|---|---|---|
| `usePipelineStore` | `stores/pipelineStore.ts` | Opportunities list, stage list, optimistic drag-drop state, filter state for Pipeline page |
| `useForecastStore` | `stores/forecastStore.ts` | Computed forecast metrics (derived from pipeline data), period selection |
| `useQuoteStore` | `stores/quoteStore.ts` | Quotes per opportunity, auto-expire logic trigger on load |
| `useStageStore` | `stores/stageStore.ts` | Pipeline stages CRUD, order management |

Note: Lead score and qualification status can be added as fields to the existing customer/contact store rather than requiring a new store.

#### New Hooks

| Hook | File | Responsibility |
|---|---|---|
| `useDragDrop` | `hooks/useDragDrop.ts` | Encapsulates @dnd-kit sensors, collision detection config, and optimistic update coordination for Pipeline Kanban |
| `useOpportunityFilters` | `hooks/useOpportunityFilters.ts` | Derives filtered opportunity list from pipeline store + active filter state; computes At-Risk/Overdue flags |
| `useForecastMetrics` | `hooks/useForecastMetrics.ts` | Pure computation — takes opportunity list, returns all 6 MetricCard values |
| `useQuoteAutoExpire` | `hooks/useQuoteAutoExpire.ts` | On mount, checks Sent quotes against today's date, fires PATCH for expired ones, returns count of expired for banner |
| `useLeadScore` | `hooks/useLeadScore.ts` | Computes or returns lead score (system or override), provides override mutation function |
| `usePrintQuote` | `hooks/usePrintQuote.ts` | Wraps react-to-print, manages print ref, loading state for export action |
| `useStageConstraints` | `hooks/useStageConstraints.ts` | Returns whether a stage can be deleted (checks deal count), and whether the 10-stage limit is reached |

---

### UX Handoff Notes for UI Designer

The following visual decisions must be made by the UI Designer. This UX Brief does not define them — it only specifies the states and behaviors that those visual treatments must support.

**Color and style decisions required:**

1. **LeadScoreBadge colors**: Three distinct colors for Hot (suggested: red/rose), Warm (suggested: amber), Cold (suggested: slate/gray). Must be distinguishable without relying solely on hue (use text labels as primary differentiator — colors reinforce, not replace).

2. **Overdue vs At-Risk visual treatment on cards**: Two distinct visual indicators on the OpportunityCard. One (Overdue) should convey urgency/past-due; one (At-Risk) should convey caution/warning. Left-border stripe color and label badge color must be distinct from each other and from the Won/Lost states.

3. **Won/Lost card treatment**: Won cards in a revealed "Show Won/Lost" view should read as positive/completed. Lost cards should read as closed/inactive. Consider opacity reduction and/or desaturation to visually de-emphasize closed deals.

4. **Pipeline stage column header style**: The column header (stage name + deal count + total value) needs a treatment that is visually distinct from the cards below it but cohesive with the board. Sticky positioning means it overlaps card scroll — it needs a background that prevents cards from showing through.

5. **Quote status badge palette**: Five states (Draft, Sent, Accepted, Declined, Expired) need five distinct badges. Accepted = positive; Declined = negative/closed; Expired = neutral/stale; Draft = neutral/in-progress; Sent = active/pending-action.

6. **Drag-drop active state**: The dragged card clone and the drop target placeholder need visual treatment (shadow elevation, opacity, dashed border) that is clear without being jarring.

7. **Forecast page layout**: The 6-MetricCard row is wide. The UI Designer should decide whether cards are equal-width or whether some (e.g., Total Pipeline) receive more visual prominence. The current MetricCard.tsx style should be the baseline.

8. **Print-optimized quote layout**: The QuotePrintLayout component needs a style that looks professional in black-and-white print (no color-dependent information in the print view). The status watermark (DRAFT / SENT) should be legible but clearly a background element.

9. **Modal/popover hierarchy**: The WonLostModal is described as a "compact overlay" (not full-screen). The UI Designer must define the overlay backdrop opacity and the modal sizing so it reads as a focused sub-interaction rather than a page-blocking interruption.

10. **Disabled state for delete button (Stages)**: The disabled delete icon must clearly communicate "unavailable" without looking broken. Consider a tooltip-trigger style that invites the user to hover to understand why, rather than a flat gray icon with no affordance.

11. **At-Risk badge on sidebar nav**: The sidebar navigation entry for Pipeline shows a count badge when At-Risk or Overdue deals exist. The badge style (notification dot vs. number badge vs. text) should be consistent with any existing notification patterns in the app shell.

12. **Settings page visual hierarchy**: The Stage Settings page is an admin surface. It can tolerate slightly more information density than the Sales Rep surfaces. The UI Designer should consider whether the Settings area uses a distinct layout shell (e.g., narrower content width, settings-specific sidebar) or inherits the main app shell.

---

**File path for this document:** `/Users/lehuyvu/Research/crm/.specifications/ux-brief-sales-pipeline-management.md`