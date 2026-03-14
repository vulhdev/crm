# UX Brief: Core Contact & Account Management

**Version:** 1.0
**Date:** 2026-03-15
**Author:** Product Designer
**Status:** Ready for UI Designer handoff

---

## User Research Summary

Sales Reps using this CRM currently work against a single flat list of customer rows. Before a call they must mentally reconstruct context by scanning the Notes field — a free-text blob that mixes interaction history, contact preferences, and follow-up reminders. This is the primary pain point driving the "30-second context" goal in Story 4.

Key behavioral patterns drawn from the PRD personas:

- **Sales Reps move fast.** They open a contact record mid-conversation or 60 seconds before a call. Every extra click or scroll to find information is felt as friction. The contact detail view must front-load the most decision-relevant information (status, last contact, company, most recent interaction) before the user needs to scroll.
- **Sales Reps log interactions immediately after an event** — while memory is fresh — or not at all. The interaction log entry form must be reachable in one click from the Contact Detail view, with minimal required fields, to compete with the instinct to "just update the notes field."
- **Sales Managers scan, not read.** They look for anomalies: contacts with no recent activity, companies with multiple churned contacts. They need company-level views with aggregated signals, not individual contact editing flows.
- **Admins are infrequent but deliberate.** Duplicate detection and merging are Admin-tier tasks. These flows can afford more steps and confirmation dialogs because Admins will be methodical when executing them.
- **Existing data must not break.** Plain-text company fields, contacts without new columns, and legacy notes fields must all continue to render. The UI must gracefully handle partial data without showing blank panels or errors.

---

## Key UX Decisions

### Decision 1: Contact Detail Panel — Navigable Page Route with URL

**Recommendation: Full-page route with a stable URL (`/contacts/:id`).**

Rationale:
- The PRD explicitly requires a deep-linkable URL for team sharing. A modal or drawer cannot satisfy this without complex URL-hash workarounds.
- The 360 view contains three distinct content regions (profile, company, interaction log) that benefit from vertical scroll space rather than a compressed side panel.
- Sales Reps share contact links in Slack or email before meetings. A stable `/contacts/:id` URL is the natural solution.
- The existing CustomerDrawer remains the **edit-only** surface (opens from a pencil icon on the Contact Detail page). Clicking a contact row/card navigates to the detail page rather than opening the drawer directly — a deliberate behavior change from the current "click to edit" pattern.
- The list context is preserved via browser back navigation; the Breadcrumb on the detail page (`Contacts / [Contact Name]`) makes the path clear.

### Decision 2: Company Selector — Combobox with Inline Creation

**Recommendation: A single combobox input that functions as both a search-and-select (for existing companies) and an inline creation trigger (for new companies).**

Behavior:
- User types in the Company field. If the typed string matches existing companies, a dropdown of matches appears.
- If no match exists, the dropdown shows a single option: `+ Create "[typed name]" as a new company`.
- Selecting this option creates a minimal Company record (name only) immediately and links the contact to it. The user may later enrich the company record (industry, website, notes) from the Company Detail page.
- This pattern eliminates the need for a separate "Add Company" modal mid-flow, which would interrupt the Add Contact task.

### Decision 3: Interaction Log Placement within Contact Detail

**Recommendation: The Interaction Log occupies the right two-thirds of the Contact Detail page in a two-column layout (profile on left, timeline + entry form on right). On mobile, it stacks below the profile.**

Behavior:
- The entry form is pinned at the top of the timeline column ("sticky" above the log entries), so it is always visible without scrolling.
- The log entries scroll independently within their column if the list is long, so the profile panel does not scroll out of view.
- This reinforces that logging an interaction is a primary action, not something buried at the bottom.

### Decision 4: Duplicate Warning Banner in Add Contact Flow

**Recommendation: An inline warning banner inserted between the Email field and the Phone field, appearing immediately after the email field loses focus (on blur) if a match is detected.**

Behavior:
- The warning is advisory; it does not block form submission.
- It appears with a smooth slide-down animation and does not shift existing form content by more than one line height (compact banner format).
- The banner contains a link that opens the suspected duplicate's Contact Detail page in a **new browser tab** (not a drawer or modal), preserving the current Add Contact form state.
- A "Dismiss" action removes the banner for the session; if the user attempts to submit anyway, a **secondary confirmation modal** fires ("You are about to create a contact that may already exist...") requiring a deliberate confirm before the record is written.

### Decision 5: Side-by-Side Merge UI

**Recommendation: A dedicated full-page merge view (`/contacts/merge?a=:id&b=:id`) that shows both records in parallel columns with a radio selector per field row.**

Behavior:
- The merge view is not a modal; the scope and consequence of the action warrant full-screen focus.
- A "sticky" summary header shows "Keeping: [Name A]" or "Keeping: [Name B]" updated live as the user selects fields.
- A confirmation screen (step 2 of 2) summarizes every selected value and warns that the discarded record will be archived.
- Only Admins see the Merge button in the actions menu (enforced by role check on the frontend); Sales Reps see the Merge option greyed out with a tooltip "Requires Admin access."

---

## Navigation & Information Architecture

### Updated Site Navigation (Sidebar additions)

```
Workspace
  Dashboard           /
  Contacts            /contacts          (renamed from "Customers" — see note)
  Companies           /companies         [NEW]
```

Note on "Customers" vs "Contacts": The PRD introduces the term "Contact" throughout. The sidebar label should be updated from "Customers" to "Contacts" for consistency. This is a copy change, not a structural change — the underlying routes and components continue to function.

### Page Hierarchy

```
/contacts
  /contacts/:id                   Contact Detail Page
  /contacts/:id/edit              (optional — or edit via drawer on detail page)

/companies
  /companies/:id                  Company Detail Page

/contacts/merge                   Merge View (query params: ?a=:id&b=:id)
  (not navigable from nav — only reachable from duplicate warning or contact actions menu)
```

### Data Relationships (for IA purposes)

```
Company (1) ──── (many) Contacts
Contact  (1) ──── (many) Interactions
```

The Company Detail page is the "hub" for account-level views. The Contact Detail page is the "hub" for individual contact views. These are the two new top-level entity pages added by this feature set.

### How Companies fit into the Navigation

Companies get a first-class sidebar entry. This reflects the PRD's intent that Sales Managers scan account-level health. The Companies list view shows company name, industry, number of linked contacts, and the most recent `last_contact_date` across all linked contacts (derived client-side from the loaded contacts list).

---

## User Flows

---

### Flow 1 (Story 1): Editing Extended Contact Profile Fields

**Happy Path**

1. User is on the Contacts list page (`/contacts`).
2. User clicks the row or card for an existing contact.
3. Browser navigates to `/contacts/:id` (Contact Detail page).
4. User clicks the pencil icon (Edit) in the top-right of the profile section.
5. The existing CustomerDrawer slides in from the right, now extended with new fields (Job Title, Preferred Contact, LinkedIn URL, Tags).
6. User edits desired fields.
7. For LinkedIn URL: user types a URL. On blur, the field validates the `https://linkedin.com/` prefix. If invalid, an inline error appears beneath the field immediately; the Save button remains enabled but form will not submit while the field is invalid.
8. For Tags: user types comma-separated words. A live preview of pill badges renders below the input as the user types.
9. User clicks Save. The drawer shows a spinner, the record updates optimistically in the background, and the drawer closes. A toast notification confirms success.
10. The Contact Detail page reflects the updated values without a full page reload.

**Error Path (LinkedIn URL Validation)**

1–6. Same as above.
7. User types `http://linkedin.com/in/janesmith` (wrong scheme).
8. On blur: inline error appears — "LinkedIn URL must start with https://linkedin.com/".
9. User corrects to `https://linkedin.com/in/janesmith`. Error clears on next keystroke.
10. User saves successfully.

**Error Path (API Failure)**

1–8. Same as happy path.
9. API returns a 5xx. The spinner resolves to an error state. The drawer remains open. A toast notification appears: "Failed to save contact. Your changes are still here." The form retains all entered values.

---

### Flow 2 (Story 2): Associating a Contact with a Company

**Happy Path — Selecting an Existing Company**

1. User opens Add Contact drawer (or Edit Contact drawer for an existing contact).
2. User reaches the Company field (now a combobox instead of a plain text input).
3. User types "Acme". The dropdown populates with matching companies from the loaded companies list.
4. User clicks "Acme Inc." from the dropdown. The field resolves to the company name; the underlying value is the company's UUID.
5. User completes and saves the contact. The contact is now linked to Acme Inc. by UUID.
6. On the Contact Detail page, the company name renders as a link: "Acme Inc." → navigates to `/companies/:id`.

**Happy Path — Creating a New Company Inline**

1–3. Same as above, but no matching company exists.
4. Dropdown shows one option: `+ Create "Acme Corp" as a new company`.
5. User clicks this option. The field resolves to "Acme Corp" (name displayed, UUID assigned in background). A small indicator ("New") appears beside the field to signal this company will be created on save.
6. User saves the contact. Two writes occur: a new Company row is appended to the Companies sheet, then the contact row is written with the new company UUID.
7. On Contact Detail page, "Acme Corp" appears as a linked company. The company record exists with name only; industry, website, and notes are empty.

**Edge Case — Legacy Plain-Text Company**

1. User opens an existing contact that has a plain-text company string (pre-migration).
2. The Company field in the drawer shows the plain-text value in a neutral text style with a subtle indicator: "Legacy value — not linked to a company record."
3. User can leave it as-is (saves fine, plain text is preserved), or type to initiate a search/create flow (replacing the legacy value with a UUID reference).
4. No automatic migration occurs.

---

### Flow 3 (Story 3): Logging an Interaction

**Happy Path**

1. User navigates to a Contact Detail page (`/contacts/:id`).
2. In the Interaction Log column (right side), an entry form is visible at the top: a Type selector (Call / Email / Meeting / Note) and a Summary textarea with character counter.
3. User selects "Call" from the Type selector.
4. User types a summary (e.g., "Discussed renewal pricing. Follow up in 2 weeks."). Character counter shows e.g. "52 / 1000".
5. User clicks "Log Interaction". A loading indicator appears briefly. The new entry appears at the top of the log list. The `last_contact_date` field on the profile panel updates to today's date.
6. The entry form resets to its default state (Type: Call, Summary: empty).

**Empty State (No Interactions Yet)**

1. User navigates to a Contact Detail page for a contact with no logged interactions.
2. The Interaction Log column shows an empty-state prompt: "No interactions yet. Log the first one above."
3. The entry form at the top is always visible regardless of whether there are existing entries.

**Error Path (Summary Too Long)**

1. User types a summary exceeding 1,000 characters (paste operation).
2. The character counter turns to an error color (e.g. "1,043 / 1,000"). The "Log Interaction" button is disabled.
3. User trims the text. Once under 1,000 chars, the counter returns to normal and the button re-enables.

**Editing an Interaction (Within 24 Hours)**

1. User sees an interaction entry in the log. Within 24 hours of its `created_at`, an "Edit" link appears on hover.
2. User clicks Edit. The entry transforms to an inline edit form (same Type selector + Summary textarea, pre-filled). A "Cancel" link and "Save" button appear.
3. User edits and saves. The entry updates in place. An "Edited" label appears beside the timestamp.
4. After 24 hours: the Edit link no longer appears. The entry is read-only.

---

### Flow 4 (Story 4): Navigating the 360-Degree Contact View

**Happy Path**

1. User is on any contact list view (Table, Grid, or Kanban).
2. User clicks a contact name or card (not the edit/pencil icon — that still opens the edit drawer directly).
3. Browser navigates to `/contacts/:id`. A skeleton loading state covers both columns while data loads.
4. Within 3 seconds, the page renders: left column shows profile fields, right column shows the interaction log with entry form.
5. User can change the contact's status via an inline status selector in the profile column (same dropdown as the existing StatusBadge, now editable inline).
6. User clicks the company name link — navigates to `/companies/:id`. Browser back returns to the contact detail page.
7. User shares the URL (`/contacts/:id`) with a colleague via Slack. The colleague lands directly on the same contact detail page.

**Loading State**

- Both columns show skeleton placeholders: avatar circle, 3 text-line skeletons for profile, 2-3 entry skeletons in the log column.
- Skeleton persists until all three data fetches (contact, company, interactions) resolve. If any fetch is slow, the skeleton remains; partial data is not shown to avoid layout shift.

**Error State**

- If the contact ID is not found (404): the page shows a centered "Contact not found" message with a "Back to Contacts" link.
- If the API returns an error: a banner at the top of the page reads "Failed to load contact data. Retry?" with a retry button. The rest of the page is blank.

---

### Flow 5 (Story 5): Duplicate Detection During Add Contact

**Happy Path (Duplicate Found)**

1. User opens the Add Contact drawer.
2. User fills in First Name, Last Name, and then types in the Email field.
3. On blur from the Email field, the system runs a client-side check against the loaded contacts list (case-insensitive exact match).
4. A duplicate is found. A yellow warning banner slides in below the Email field:

   > "A contact with this email already exists: **Jane Smith** (Acme Inc.) — Active.
   > [View contact] &nbsp; [Dismiss]"

5. User clicks "View contact" — the existing contact's detail page opens in a new browser tab. The Add Contact drawer remains open.
6. User reviews and decides to cancel: clicks Cancel in the drawer. No new contact is created.

**Alternative Path (User Proceeds Despite Warning)**

1–4. Same as above.
5. User dismisses the warning banner.
6. User completes the form and clicks Save.
7. A confirmation modal appears:

   > "Save anyway?"
   > "A contact with a matching email already exists (Jane Smith). Are you sure you want to create a new contact?"
   > [Cancel] &nbsp; [Create anyway]

8. User clicks "Create anyway." The contact is saved. No further duplicate check runs.

**Fuzzy Match Path (Name + Company)**

1–2. User fills in First Name, Last Name, and Company (using the combobox). No matching email found.
2b. On blur from the Company combobox (or immediately after all three fields are non-empty), a secondary fuzzy check runs: case-insensitive comparison of first_name + last_name + company.
3. A match is found. The same warning banner appears with the fuzzy match label: "A contact with the same name and company already exists: **Jane Smith** (Acme Inc.)".
4. Same proceed/dismiss flow as above.

**No Duplicate Found**

- No banner appears. The form behaves as today.

---

### Flow 6 (Story 6): Merging Duplicate Contacts

**Entry Point A: From Duplicate Warning Banner**

1. User sees the duplicate warning banner in the Add Contact drawer.
2. User clicks "Merge with existing" (an additional action in the banner, visible to Admins only).
3. The drawer closes. Browser navigates to `/contacts/merge?a=new&b=:existingId` (the "new" record is the currently-entered but unsaved form data, held in memory).
4. The merge view renders side-by-side. Left column: the new (unsaved) contact. Right column: the existing contact.

**Entry Point B: From Contact Detail Page**

1. User is on a Contact Detail page (`/contacts/:id`).
2. User clicks the overflow/actions menu (three-dot icon, top-right of the page).
3. User selects "Find duplicates & merge."
4. A small search panel opens: "Enter the ID or search for the contact to merge with." User types a name or email; a short list of matches appears.
5. User selects a match. Browser navigates to `/contacts/merge?a=:thisId&b=:matchId`.

**Merge Flow (Steps 1 and 2)**

**Step 1 — Field Selection**

1. The merge view shows a two-column layout (see wireframe below). Each row is a field.
2. A "Keep left" / "Keep right" radio button appears on each row. The system pre-selects the value that is more populated (non-empty preferred; more recently updated preferred as a tiebreaker).
3. A sticky header bar reads: "Merging: [Left Name] + [Right Name] → Survivor: [Selected Name]"
4. At the bottom, two buttons: [Cancel] and [Review merge (step 2 of 2)].

**Step 2 — Confirmation**

1. A summary panel shows the final merged record values as a single-column preview.
2. Below: "The following will happen:
   - [Right contact name] will be archived with note: 'Merged into [Left contact ID] on [date]'
   - [N] interaction entries will be re-associated to [Left contact name]."
3. Two buttons: [Back to edit] and [Confirm merge].
4. User clicks Confirm merge. A full-page loading state covers the screen while the writes execute (two sheet mutations: archive the loser, update interaction rows). On success, browser navigates to the surviving contact's detail page. A success toast reads: "Merge complete. [N] interactions re-linked."

**Error Path (Merge Write Fails)**

1. Mid-merge, the API returns an error.
2. The loading overlay clears. An error banner reads: "Merge failed. No changes were made. Please try again." Both original records remain intact.

---

## Wireframes

---

### Wireframe 1: Extended Add/Edit Contact Drawer

Width: 440px, slides in from right. Form scrolls vertically within the body.

```
+------------------------------------------+
| Edit Contact                        [X]  |
| Last updated Mar 10, 2026                |
+------------------------------------------+
|                                          |
|  First Name *          Last Name *       |
|  [Jane              ] [Smith           ] |
|                                          |
|  Email *                                 |
|  [jane@example.com                    ]  |
|                                          |
|  [!] DUPLICATE WARNING BANNER            |
|  +-----------------------------------------+
|  | ! A contact with this email exists:    |
|  |   Jane Smith (Acme) — Active           |
|  |   [View contact]          [Dismiss]    |
|  +-----------------------------------------+
|                                          |
|  Phone                 Job Title  [NEW]  |
|  [+1 555 000 0000    ] [VP Sales        ]|
|                                          |
|  Company                                 |
|  [Search or create company...      v]    |
|   +-dropdown when typing-----------+     |
|   | Acme Inc.                      |     |
|   | Acme Corp.                     |     |
|   | + Create "Acme Ltd" as new co. |     |
|   +--------------------------------+     |
|                                          |
|  Preferred Contact [NEW]  LinkedIn [NEW] |
|  [Email          v      ] [https://li.. ]|
|                            inline error  |
|                            if invalid    |
|                                          |
|  Status *              Last Contact      |
|  [Active         v    ] [2026-03-10   ]  |
|                                          |
|  Tags  [NEW]                             |
|  [vip, renewal, q2    ]                  |
|  [vip] [renewal] [q2]    <- live preview |
|                                          |
|  Notes                                   |
|  [                                    ]  |
|  [                                    ]  |
|                                          |
+------------------------------------------+
|  [Cancel]                      [Save]    |
+------------------------------------------+
```

Notes for UI Designer:
- Duplicate warning banner: amber/yellow background, warning icon, compact single-line layout.
- Tags input: plain text field; pill badges render below in real time.
- Company combobox: looks like a select trigger but opens a searchable list with a creation option at the bottom.
- LinkedIn field: shows a link icon on the left when populated and valid.
- New fields are not visually segregated from existing fields (no "Advanced" section). All fields are equally accessible.

---

### Wireframe 2: Contact Detail Page (360 View)

Route: `/contacts/:id`

```
+--------------------------------------------------------+
| [<- Contacts]   Jane Smith                 [...] [Edit]|
+--------------------------------------------------------+
|                          |                             |
|  PROFILE                 |  INTERACTION LOG            |
|  ----------------------  |  -------------------------  |
|  [Avatar: JS]            |  +--- Entry form ----------+|
|  Jane Smith              |  | Type: [Call       v]    ||
|  VP Sales                |  | Summary:                ||
|  jane@example.com        |  | [                     ] ||
|  +1 555 000 0000         |  | [                     ] ||
|                          |  | 52 / 1000               ||
|  Company                 |  | [Log Interaction]       ||
|  [Acme Inc.] ->link      |  +------------------------+|
|                          |                             |
|  Status                  |  --- Mar 10, 2026 ---       |
|  [Active     v]          |  Call  by you               |
|  (inline editable)       |  Discussed renewal pricing. |
|                          |  Follow up in 2 weeks.      |
|  Preferred Contact       |  [Edit within 24h]          |
|  Email                   |                             |
|                          |  --- Mar 05, 2026 ---       |
|  LinkedIn                |  Meeting  by sarah@co.com   |
|  [linkedin.com/in/js]    |  Intro call. Positive       |
|  (external link icon)    |  response to product demo.  |
|                          |                             |
|  Tags                    |  --- Feb 28, 2026 ---       |
|  [vip] [renewal] [q2]    |  Email  by you              |
|                          |  Sent follow-up proposal.   |
|  Last Contact            |                             |
|  Mar 10, 2026            |                             |
|                          |                             |
|  Created                 |                             |
|  Jan 15, 2026            |                             |
|                          |                             |
|  Notes                   |                             |
|  [Legacy notes text...]  |                             |
|                          |                             |
+--------------------------|-----------------------------+
```

Notes:
- Left column is ~35% width; right column is ~65%. On viewports below 1024px, stacks vertically (profile above, log below).
- The `[...]` three-dot menu in the top-right contains: "Find duplicates & merge", "Archive contact", "Copy contact link".
- The `[Edit]` button opens the CustomerDrawer in edit mode.
- The status selector on the profile is an inline dropdown (same mechanism as Kanban drag-drop status change) — no drawer required for a status update.
- The company name is a hyperlink navigating to `/companies/:id`.
- Empty state for log: the entry form remains visible; below it, a muted message: "No interactions logged yet."
- If the contact is Archived, a full-width amber banner at the top reads: "This contact is archived." with a "Restore" button.

---

### Wireframe 3: Company Detail Page

Route: `/companies/:id`

```
+--------------------------------------------------------+
| [<- Companies]  Acme Inc.              [...] [Edit]    |
+--------------------------------------------------------+
|                                                        |
|  COMPANY INFO                                          |
|  ------------------------------------------------      |
|  Industry:   SaaS                                      |
|  Website:    [acme.com]  (external link)               |
|  Notes:      Key strategic account.                    |
|  Created:    Jan 15, 2026                              |
|                                                        |
+--------------------------------------------------------+
|                                                        |
|  CONTACTS AT THIS COMPANY           [+ Add Contact]    |
|  ------------------------------------------------      |
|                                                        |
|  [Avatar] Jane Smith      VP Sales   [Active]          |
|           jane@ex.com                Last: Mar 10      |
|                                                        |
|  [Avatar] Tom Lee         Director   [Lead  ]          |
|           tom@ex.com                 Last: Feb 20      |
|                                                        |
|  [Avatar] Ana Ruiz        Eng Lead   [Churned]         |
|           ana@ex.com                 Last: Dec 3       |
|                                                        |
|  [empty state if no contacts]                          |
|  "No contacts linked to this company yet."             |
|  [+ Add a contact]                                     |
|                                                        |
+--------------------------------------------------------+
```

Notes:
- The "Edit" button opens a right-side drawer for editing company fields (name, industry, website, notes). The company edit drawer is a simpler, shorter form than the contact drawer.
- "+ Add Contact" opens the Add Contact drawer with the Company field pre-filled and locked to this company.
- Clicking a contact row navigates to `/contacts/:id`.
- Each contact row shows: Avatar, Full Name, Job Title, Status badge, Last Contact Date.
- If a company is archived, a banner reads: "This company is archived. Its contacts are not affected."

---

### Wireframe 4: Companies List Page

Route: `/companies`

```
+--------------------------------------------------------+
| Companies                          [+ Add Company]     |
| 12 companies                                           |
+--------------------------------------------------------+
|                                                        |
|  [Search companies...                              ]   |
|                                                        |
|  NAME          INDUSTRY   CONTACTS  LAST ACTIVITY      |
|  --------------------------------------------------    |
|  Acme Inc.     SaaS           3     Mar 10, 2026       |
|  Beta Corp     Fintech         1     Feb 20, 2026       |
|  Gamma LLC     Healthcare      5     Mar 12, 2026       |
|  ...                                                   |
|                                                        |
|  [Empty state if no companies]                         |
|  "No companies yet."                                   |
|  "Add a company or link one while adding a contact."   |
|  [+ Add Company]                                       |
|                                                        |
+--------------------------------------------------------+
```

Notes:
- Sortable columns: Name, Industry, Contacts count, Last Activity.
- Clicking a row navigates to `/companies/:id`.
- "Last Activity" is derived client-side: the most recent `last_contact_date` among all linked contacts.
- No Grid or Kanban view for Companies — list view only in this iteration.
- "+ Add Company" opens a simple company creation drawer (name, industry, website, notes).

---

### Wireframe 5: Duplicate Warning Banner (inline in Add Contact Drawer)

```
+------------------------------------------+
|  Email *                                 |
|  [jane@example.com                    ]  |
|                                          |
|  +----------------------------------------+
|  | [!]  Possible duplicate found          |
|  |      Jane Smith · Acme Inc. · Active   |
|  |      [View contact ->]    [Dismiss X]  |
|  +----------------------------------------+
|                                          |
|  Phone                  Job Title        |
|  ...                                     |
+------------------------------------------+
```

Notes:
- Banner slides down below the email field; it pushes subsequent fields down rather than overlapping.
- The "View contact" link uses `target="_blank"` — does not close the drawer.
- "Dismiss" removes the banner for this session.
- On form submit while banner is active (not dismissed): a separate confirmation modal fires before the API call.

---

### Wireframe 6: Save-Anyway Confirmation Modal

Appears on form submission when a duplicate warning has not been dismissed.

```
+----------------------------------------+
|  Create duplicate contact?             |
|                                        |
|  A contact with the same email         |
|  already exists:                       |
|                                        |
|  Jane Smith · Acme Inc. · Active       |
|  jane@example.com                      |
|                                        |
|  [View existing contact]               |
|                                        |
|  Are you sure you want to create a     |
|  new, separate contact record?         |
|                                        |
|  [Cancel]          [Create anyway]     |
+----------------------------------------+
```

Notes:
- "Create anyway" is a destructive-secondary style button (not red, but not the primary teal either — use a neutral dark style to signal deliberateness without alarm).
- "Cancel" returns focus to the Add Contact form (does not close the drawer).
- "View existing contact" opens the duplicate in a new tab.

---

### Wireframe 7: Merge View — Step 1 (Field Selection)

Route: `/contacts/merge?a=:id&b=:id`

```
+------------------------------------------------------------------+
| Merge Contacts                                     [Cancel]      |
| Step 1 of 2: Choose which values to keep                         |
+------------------------------------------------------------------+
|  SURVIVOR PREVIEW: Jane Smith (Acme Inc.)  [updates live]        |
+------------------------------------------------------------------+
|                                                                  |
|  FIELD          CONTACT A (keep?)     CONTACT B (keep?)          |
|  ---------------------------------------------------------------  |
|  First Name     (o) Jane              ( ) Jane                  |
|  Last Name      (o) Smith             ( ) Smith                  |
|  Email          (o) jane@ex.com       ( ) j.smith@work.com       |
|  Phone          (o) +1 555 000 0000   ( ) [empty]                |
|  Job Title      ( ) [empty]           (o) VP Sales               |
|  Company        (o) Acme Inc.         ( ) Acme Inc.              |
|  Pref. Contact  (o) Email             ( ) Phone                  |
|  LinkedIn       ( ) [empty]           (o) linkedin.com/in/js     |
|  Tags           (o) vip, renewal      ( ) vip, q2                |
|  Status         (o) Active            ( ) Active                 |
|  Notes          (o) Renewal discuss.  ( ) Old customer           |
|                                                                  |
|  Interactions   Merging 2 entries     +  3 entries = 5 total     |
|  (read-only)    from Contact B will be re-linked to Contact A    |
|                                                                  |
+------------------------------------------------------------------+
|  [Cancel]                     [Review merge  (step 2 of 2) ->]   |
+------------------------------------------------------------------+
```

Notes:
- Radio buttons per row, one per column; at least one must be selected per row.
- The survivor preview header updates in real time as the user makes selections.
- For fields where both contacts have the same value, the row is collapsed by default and shows "Same value: Jane" with an expand toggle (reduces visual noise).
- Empty values are visually dimmed and their radio button is de-emphasized but still selectable.
- Interactions row is informational only — always merged (no choice to discard interactions).

---

### Wireframe 8: Merge View — Step 2 (Confirmation)

```
+------------------------------------------------------------------+
| Merge Contacts                                     [Cancel]      |
| Step 2 of 2: Review and confirm                                  |
+------------------------------------------------------------------+
|                                                                  |
|  MERGED RECORD PREVIEW                                           |
|  ------------------------------------------------                |
|  Jane Smith · VP Sales · jane@ex.com                             |
|  +1 555 000 0000 · Acme Inc. · Active                            |
|  Tags: vip, renewal                                              |
|  LinkedIn: linkedin.com/in/js                                    |
|                                                                  |
|  WHAT WILL HAPPEN                                                |
|  ------------------------------------------------                |
|  + The record above will be saved as Contact A (Jane Smith)      |
|  + Contact B (Jane Smith, j.smith@work.com) will be archived     |
|    with note: "Merged into [contact-a-id] on 2026-03-15"         |
|  + 3 interaction entries from Contact B will be                  |
|    re-linked to Contact A (total: 5 interactions)                |
|                                                                  |
|  This action cannot be undone automatically.                     |
|  Contact B will remain accessible in archived records.           |
|                                                                  |
+------------------------------------------------------------------+
|  [<- Back to edit]                         [Confirm merge]       |
+------------------------------------------------------------------+
```

Notes:
- "Confirm merge" is the primary action button (teal).
- After clicking, a full-overlay loading spinner covers the page ("Merging contacts...").
- On success: navigate to `/contacts/:survivorId` with a success toast.
- On failure: overlay clears, error banner appears at top; both records are unmodified.

---

## Interaction Design Notes

### CustomerDrawer (Extended)

- **Company combobox:**
  - Default state: shows placeholder "Search or create a company..."
  - Typing: dropdown opens showing filtered company names. Minimum 1 character to show results.
  - No results: dropdown shows only `+ Create "[query]" as a new company`.
  - After selection: field shows company name. A small checkmark icon confirms linkage. For legacy plain-text values, field shows text with a yellow "Legacy" badge.
  - Keyboard: arrow keys navigate dropdown; Enter selects; Escape closes dropdown without selecting.

- **Tags input:**
  - Typing produces a plain text field. Commas trigger pill rendering below the input (live preview, no interaction needed).
  - Pills are not independently clickable in the add/edit form (editing is done by modifying the raw text field).
  - Maximum recommended: 10 tags. Beyond 10, a soft warning ("Consider using fewer tags for clarity") appears but does not block saving.

- **LinkedIn URL field:**
  - Validation fires on blur, not on change (avoid red border while the user is still typing the URL).
  - Valid URL: field shows an external link icon; clicking the icon opens LinkedIn in a new tab.
  - Invalid URL: red border + inline error message below field.

- **Duplicate Warning Banner:**
  - Appears with a 150ms slide-down transition after the email field loses focus.
  - Only one banner shown at a time. If both email match and fuzzy name+company match fire, the email match banner takes precedence.
  - Dismissed state persists only for the current drawer session; closing and reopening the drawer resets the dismiss state.

### Contact Detail Page

- **Status selector (inline on profile):**
  - Renders as a StatusBadge-style pill that, when clicked, opens a dropdown of status options.
  - On selection: optimistic update (badge updates immediately), then API call in background. Toast on success. Rollback on failure.
  - Behavior is identical to the existing Kanban drag-drop status change mechanism — the same code path should be used.

- **Interaction entry form:**
  - Type selector defaults to "Call" on each page load.
  - Summary textarea auto-expands up to ~6 lines, then scrolls internally.
  - "Log Interaction" button is disabled when Summary is empty or over 1,000 chars.
  - After successful log: form resets, new entry animates in at the top of the log list with a brief highlight (1-second background fade) to draw the eye.

- **Interaction log entries:**
  - Sorted newest-first always. No user-facing sort control in this iteration.
  - Each entry shows: type icon (phone/email/meeting/note), author (you / other email), timestamp (relative: "2 days ago"; absolute on hover), summary text.
  - Entries older than 24 hours: no edit affordance. Entries within 24 hours: "Edit" appears on hover.
  - Edit mode: transforms entry to an inline form (same fields). Saves in place. Cancel reverts.

- **Three-dot overflow menu:**
  - Options: "Find duplicates & merge" (Admin only; greyed out with tooltip for Sales Reps), "Archive contact" (with confirmation dialog), "Copy contact link" (copies URL to clipboard, toast confirms).

### Merge View

- **Field row pre-selection logic:** For each field, pre-select the non-empty value. If both are non-empty, pre-select the value from the contact with the more recent `last_contact_date`. If both are equal, pre-select Contact A (left column).
- **"Same value" collapsed rows:** Rows where both values are identical are visually merged into a single read-only row ("Same value on both records: Jane") to reduce noise. A small toggle lets the user expand and see the radio buttons if needed.
- **Progress indicator:** "Step 1 of 2" and "Step 2 of 2" labels in the page header. No progress bar (only 2 steps).
- **Loading overlay during commit:** prevents any user interaction while writes are in flight. Shows a centered spinner and the label "Merging contacts... Do not close this tab."

### Companies List and Company Detail

- **Companies list search:** filters client-side against the loaded companies list (name and industry fields). No debounce needed given expected list sizes.
- **Company edit drawer:** identical pattern to CustomerDrawer but shorter (4 fields: name, industry, website, notes). Uses the same shadcn Sheet component.
- **Contact row in Company Detail:** clicking a row navigates to `/contacts/:id`. Hovering shows a subtle row highlight. No inline edit from the Company Detail page — all contact edits go through the Contact Detail page.

---

## Accessibility Considerations

### Keyboard Navigation

- **Contact Detail page:** Tab order: back-link → edit button → overflow menu → status selector → LinkedIn link → interaction entry form (type select → summary → submit button) → log entries (each entry focusable, Edit link tabbable when visible).
- **Add/Edit Drawer:** Tab order follows visual top-to-bottom field order. Company combobox: Tab opens and closes the dropdown; arrow keys navigate items; Enter selects; Escape closes without selecting.
- **Merge view:** Tab order: field rows top-to-bottom; within each row, left radio then right radio; then next row. "Review" and "Confirm" buttons reachable by Tab.
- **Duplicate warning banner:** when it appears, focus should be moved to the banner (not just visually rendered) so screen reader users are informed immediately.

### Screen Reader Labels

- **Duplicate warning banner:** `role="alert"` so screen readers announce it immediately on appearance, without requiring focus.
- **Interaction type selector:** `aria-label="Interaction type"`.
- **Character counter:** `aria-live="polite"` so counter updates are announced as the user types.
- **Merge radio buttons:** each radio button's `aria-label` should include field name and value, e.g. `aria-label="Keep Email from Contact A: jane@example.com"`.
- **Overflow menu button:** `aria-label="Contact actions menu"` (not just "..." which is meaningless to a screen reader).
- **Status selector pill:** `aria-label="Contact status: Active. Click to change."` with `aria-haspopup="listbox"`.
- **Loading overlay on merge:** `aria-live="assertive"` on the loading message so that the transition is announced.

### Color-Independent Status Indicators

- **StatusBadge** already uses text labels inside colored pills — do not rely on color alone.
- **Duplicate warning banner** uses a warning icon (!) as well as the amber color — icon + text ensures the warning is perceivable without color vision.
- **Merge view "pre-selected" radio:** selected value must be indicated by the radio button state (not color alone); the currently-selected value text may also use bold weight for additional clarity.
- **LinkedIn validation error:** red border + inline error message text below — both color and text communicate the error.
- **"New company" indicator** in the Company combobox: uses the text label "New" in addition to any color badge.

---

## UX Handoff Notes for UI Designer

### Visual Decisions Required

1. **Duplicate warning banner color:** The banner should use an amber/warning palette (not red, which is reserved for errors). Needs: background color, border color, icon color, and text color within the existing design token set.

2. **Status badge as interactive control:** On the Contact Detail page, the StatusBadge transforms from a read-only pill to a clickable dropdown. The UI Designer must define the visual affordance that communicates interactivity (e.g., a subtle chevron icon appended, a hover ring, a cursor change). This must not look like a broken/orphaned badge when hovered.

3. **Interaction log entry type icons:** Four types need distinct icons: Call (phone), Email (envelope), Meeting (calendar or people), Note (document). These should be consistent with the existing Lucide icon set in use.

4. **Tags pill badges on Contact cards (Grid view):** The PRD specifies tags display as pill badges on the card. The UI Designer must define pill size, spacing, truncation behavior (e.g., show first 2 tags then "+N more"), and how they integrate with the existing card layout without breaking the card height consistency.

5. **Merge view layout:** The side-by-side merge table needs a clean three-column grid (field label | Contact A | Contact B). Needs: row alternating backgrounds (or dividers) for readability, a clear selected/unselected visual state for radio options, and dimmed styling for empty values.

6. **Company combobox (vs plain Input):** The company field in the drawer needs a visual treatment that communicates it is a combobox (searchable + creatable), distinct from a plain text input. The existing shadcn Select component should be extended or a combobox pattern chosen. This component needs a "New" badge state for inline-created companies.

7. **Contact Detail page two-column layout:** The split between profile (35%) and interaction log (65%) needs defined breakpoints and a stacked mobile layout. The entry form within the log column needs a visual distinction from the log entries below it (e.g., a card/panel container vs. flat list).

8. **Archived contact state:** The amber "This contact is archived" banner needs a design consistent with the existing warning/notice pattern. Includes the "Restore" action button.

9. **Legacy company field indicator:** A visual treatment for the "legacy, unlinked" company value state in the combobox. Should be subtle (not alarming) but informative. Consider a small badge or muted italic text.

10. **Merge confirmation "Confirm merge" button:** This is a high-consequence action but not a destructive one (the loser is archived, not deleted). It should use the primary button style (teal) with deliberate sizing, not the red "destructive" style — the visual weight comes from context and the confirmation step, not button color.

### Component Reuse Notes (for consistency)

- The **CustomerDrawer** (shadcn Sheet, 440px, right-side) pattern is reused for: Edit Contact, Add Contact, Edit Company, Add Company. All four drawer types should look identical structurally.
- The **StatusBadge** component is reused in: Contact Detail page (interactive), Company Detail contact rows (read-only), Merge view (read-only per-row).
- The **EmptyState** component pattern (centered icon + message + CTA) is reused for: empty interaction log, empty company contacts list, empty companies list page.
- The **toast notification** pattern (existing) is reused for: interaction logged, contact merged, company created, status changed, copy link.
- The **skeleton loading** pattern (existing) is extended for: Contact Detail page (both columns), Company Detail page.
