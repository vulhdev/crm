# Test Plan: Core Contact & Account Management

**Version:** 1.0
**Date:** 2026-03-15
**Feature PRD Version:** 1.0
**Prepared by:** QA Analyst
**Status:** Draft — pending developer review before sprint start

---

## 1. Scope

### In Scope

This test plan covers all six user stories defined in the PRD:

| Story | Title |
|-------|-------|
| S1 | Extended Contact Profile (`job_title`, `preferred_contact`, `linkedin_url`, `tags`) |
| S2 | Company (Account) Entity — `Companies` sheet tab, contact-to-company linking, Company detail view |
| S3 | Interaction Log — `Interactions` sheet tab, inline entry form, 24-hour edit window |
| S4 | 360-Degree Contact View — `/contacts/:id` page, performance SLA, deep-link |
| S5 | Duplicate Detection — client-side email exact match, name+company fuzzy match |
| S6 | Duplicate Merging — side-by-side merge UI, `POST /customers/merge`, archival of discarded record |

Testing covers: functional behavior, data integrity (Google Sheets read/write), API contract verification, UX fidelity against the UX Brief wireframes and flows, accessibility (WCAG 2.1 AA), edge cases, and regression against existing features.

### Out of Scope

The following items are explicitly excluded from this test plan (per PRD "Out of Scope"):

- Email / calendar integration
- File attachments on contacts
- Account-level financial metrics
- Activity reminders and follow-up scheduling
- Bulk merge / deduplication wizard
- Multi-user collaboration or shared sheets
- Contact import (CSV / LinkedIn export)
- Company hierarchy (parent/subsidiary)
- Interaction editing beyond the 24-hour window (immutability is tested, not the audit revision feature)
- Role-based access control enforcement for the Merge action (PRD Open Question — no backend guard shipped in this iteration; frontend greyed-out display for non-Admin is in scope)

---

## 2. Risk Assessment

| Risk | Likelihood | Severity | Test Mitigation |
|------|-----------|----------|-----------------|
| Merge partial failure — interaction re-pointing succeeds but survivor/discard row write fails (or vice versa), leaving the sheet in an inconsistent state | Medium | High | Dedicated test cases that simulate API failure mid-sequence (mock 5xx on step 4 and step 6 of `MergeService`); verify both records remain unmodified on failure; verify error banner appears with correct message |
| Legacy `company` field (plain-text) displayed incorrectly after Company entity is introduced — UUID lookup applied to plain-text strings | Medium | High | Explicit test cases for contacts with plain-text company values across all surfaces: Contact Detail page, Contact list (Table/Grid/Kanban), Edit drawer, merge side-by-side view |
| UUID-shaped legacy company string incorrectly resolved as a Company lookup (the "ambiguous UUID" risk from the Tech Brief) | Low | Medium | Test case: contact whose plain-text company string happens to match the UUID regex but has no corresponding Company record — verify raw string is displayed, not an empty/errored company name |
| Google Sheets API rate limiting (429) during concurrent merge operations — `N + 3` write requests per merge | Low | Medium | Integration test: verify retry-with-backoff logic in `SheetsService` handles 429 gracefully; verify the client-side merge lock prevents concurrent submissions from the same session |
| `ensureTabsExist` missing from `DriveService` for users who provisioned their sheet before this feature shipped — Companies and Interactions tabs absent | High (certainty for existing users) | High | Test against a pre-existing spreadsheet that has only `Sheet1`; verify first API call auto-creates both new tabs and subsequent calls are served from cache |
| `last_contact_date` side-effect write fails after interaction is appended — interaction exists but contact's date is stale | Medium | Low | Test case: simulate failure on the second write in `appendInteraction`; verify interaction row exists, verify `last_contact_date` is not updated, verify no error is surfaced to the user (acceptable drift per Tech Brief) |
| React Router v6 migration breaks existing `AuthCallbackPage` which reads `window.location.search` | High (certainty) | Medium | Regression test: complete OAuth login flow end-to-end after the router migration; verify JWT is extracted and stored correctly via `useSearchParams` |
| Duplicate detection does not exclude `Archived` contacts — warning fires against records that have already been cleaned up | Medium | Medium | Test case: existing contact with matching email but `status = Archived`; verify no warning banner is shown |
| Interaction `summary` character limit (1,000) enforced only client-side — backend not validating | Low | Medium | Integration test: `POST /interactions` with `summary` > 1,000 characters directly via API (bypassing UI); verify 400 response is returned |
| `linkedin_url` validation missing on backend — client-side validation bypassed by direct API call | Low | Medium | Integration test: `PATCH /customers/:id` with `linkedin_url = "http://linkedin.com/..."` (wrong scheme) directly via API; verify 400 `BadRequestException` is returned |
| Performance SLA breach — Contact Detail page fails to load within 3 seconds at 500 contacts + 2,000 interactions | Medium | Medium | Performance test scenario documented in Section 6; must be run against a seeded sheet before ship |
| `POST /customers/merge` matched by NestJS `:id` param route before the explicit `merge` route is registered | High (certainty if route order is wrong) | High | Integration test: `POST /customers/merge` with valid body; verify it is not intercepted as `PATCH /customers/merge` with 404 |
| Duplicate warning banner focus not moved to banner on appearance — screen reader users miss the warning | Medium | High | Accessibility test: verify `role="alert"` is present on banner DOM element; verify screen reader announces banner content when it appears |

---

## 3. Test Scenarios by Story

---

### Story 1: Extended Contact Profile

#### S1-01: Happy Path — Save all four new fields on a new contact

- **Given** the user is logged in and the Add Contact drawer is open
- **When** the user fills in `Job Title`, selects `Preferred Contact = Phone`, enters a valid `LinkedIn URL` (`https://linkedin.com/in/janesmith`), enters `tags = "vip, renewal"`, and clicks Save
- **Then** the contact is created; the Contact Detail page shows all four fields correctly; the Google Sheet row includes values in columns K–N
- **Acceptance Criteria covered:** S1-AC1, S1-AC2

#### S1-02: Happy Path — Tags display as pill badges in Grid view and comma list in Table view

- **Given** a contact with `tags = "vip,renewal,q2"` exists
- **When** the user views the Contacts list in Grid view and then in Table view
- **Then** Grid view shows three pill badges (`vip`, `renewal`, `q2`); Table view shows `"vip, renewal, q2"` as compact text
- **Acceptance Criteria covered:** S1-AC5

#### S1-03: LinkedIn URL validation — invalid prefix rejected

- **Given** the Edit Contact drawer is open
- **When** the user enters `http://linkedin.com/in/janesmith` (HTTP, not HTTPS) in the LinkedIn URL field and clicks out of the field
- **Then** an inline error appears: "LinkedIn URL must start with https://linkedin.com/"; the Save button does not submit
- **Acceptance Criteria covered:** S1-AC4

#### S1-04: LinkedIn URL validation — correct prefix accepted

- **Given** the Edit Contact drawer is open
- **When** the user enters `https://linkedin.com/in/janesmith` and tabs away
- **Then** no error appears; the field shows an external link icon; the form can be submitted
- **Acceptance Criteria covered:** S1-AC4

#### S1-05: Backward compatibility — existing contacts without new columns display without error

- **Given** existing contacts whose Sheet1 rows have only columns A–J (no K–N)
- **When** the user views those contacts in the list, opens a Contact Detail page, and opens the Edit drawer
- **Then** new fields appear empty (not errored); no data loss occurs in existing fields A–J
- **Acceptance Criteria covered:** S1-AC3

#### S1-06: New fields included in search filter

- **Given** a contact with `job_title = "VP Sales"` and `tags = "strategic"`
- **When** the user types "VP Sales" in the search box and separately types "strategic"
- **Then** the contact appears in filtered results in both cases
- **Acceptance Criteria covered:** S1-AC6

#### S1-07: Edge Case — LinkedIn URL validation server-enforced (bypass attempt)

- **Given** a valid JWT token
- **When** `PATCH /customers/:id` is called directly with `linkedinUrl = "ftp://linkedin.com/in/test"`
- **Then** the API returns HTTP 400 with a `BadRequestException` message
- **Acceptance Criteria covered:** S1-AC4 (server enforcement)

#### S1-08: Edge Case — Tags with special characters

- **Given** the Edit Contact drawer is open
- **When** the user enters tags containing `<script>alert(1)</script>` as a tag value
- **Then** the value is stored and displayed as literal text; no script is executed; pills render the raw string safely
- **Acceptance Criteria covered:** S1-AC2 (data integrity)

#### S1-09: Edge Case — Tags input with more than 10 tags

- **Given** the Edit Contact drawer is open
- **When** the user enters 11 comma-separated tags
- **Then** a soft warning appears ("Consider using fewer tags for clarity") but the form can still be submitted and all tags are saved
- **Acceptance Criteria covered:** UX Brief interaction note

---

### Story 2: Company (Account) Entity

#### S2-01: Happy Path — Companies tab provisioned on first use

- **Given** an existing user whose Google Sheet has only `Sheet1`
- **When** the user makes any authenticated API call after the feature ships
- **Then** a `Companies` sheet tab is created with the correct header row (`id | name | industry | website | notes | created_at`); subsequent calls do not trigger a re-creation attempt
- **Acceptance Criteria covered:** S2-AC1

#### S2-02: Happy Path — Select existing company on contact form

- **Given** a `Company` record "Acme Inc." exists in the Companies tab
- **When** the user opens the Add Contact drawer, types "Acme" in the Company combobox, and selects "Acme Inc."
- **Then** the contact is saved with the Company UUID in the `company` field; the Contact Detail page shows "Acme Inc." as a clickable link to `/companies/:id`
- **Acceptance Criteria covered:** S2-AC3, S2-AC4

#### S2-03: Happy Path — Create new company inline from contact form

- **Given** no company named "Beta LLC" exists
- **When** the user types "Beta LLC" in the Company combobox, selects `+ Create "Beta LLC" as a new company`, and saves the contact
- **Then** a new Company row is appended to the `Companies` tab; the contact row references the new Company UUID; the Contact Detail page displays "Beta LLC" as a linked company
- **Acceptance Criteria covered:** S2-AC4

#### S2-04: Happy Path — Company detail view lists all linked contacts

- **Given** three contacts are linked to "Acme Inc."
- **When** the user navigates to `/companies/:id` for "Acme Inc."
- **Then** all three contacts are listed with name, job title, status badge, and last contact date; clicking a contact row navigates to `/contacts/:id`
- **Acceptance Criteria covered:** S2-AC5

#### S2-05: Archiving a company does not cascade-archive its contacts

- **Given** "Acme Inc." has two Active contacts linked to it
- **When** the company is archived (via Edit Company drawer or PATCH endpoint)
- **Then** both contacts retain `status = Active`; they remain visible in the Contacts list; an amber banner appears on the Company Detail page stating "This company is archived. Its contacts are not affected."
- **Acceptance Criteria covered:** S2-AC6

#### S2-06: Legacy plain-text company string displayed without error

- **Given** a contact with `company = "Old Corp Text"` (a plain-text string, not a UUID)
- **When** the user views the contact in the list, on the Contact Detail page, and in the Edit drawer
- **Then** "Old Corp Text" is displayed as a plain string (not a broken link); the Edit drawer shows a "Legacy value — not linked to a company record" indicator; no error is thrown
- **Acceptance Criteria covered:** S2-AC7

#### S2-07: Edge Case — UUID-shaped legacy company string with no matching Company record

- **Given** a contact whose `company` column value is a valid UUID format string but no corresponding Company record exists in the Companies tab
- **When** the user views the Contact Detail page
- **Then** the raw UUID string is displayed (fallback behavior); no empty panel or thrown error occurs
- **Risk mitigated:** Tech Brief "UUID vs. plain-text detection is ambiguous" risk

#### S2-08: Edge Case — Company combobox keyboard navigation

- **Given** the Add Contact drawer is open with the company combobox focused
- **When** the user types a partial company name, uses arrow keys to navigate the dropdown, and presses Enter to select
- **Then** the selection is made and the combobox closes without requiring mouse interaction
- **Acceptance Criteria covered:** UX Brief keyboard interaction note

#### S2-09: Edge Case — Company with no linked contacts shows empty state

- **Given** a Company record exists with no contacts linked to it
- **When** the user navigates to `/companies/:id`
- **Then** the contacts section shows the empty state: "No contacts linked to this company yet." with a `+ Add a contact` call-to-action
- **Acceptance Criteria covered:** S2-AC5, UX Brief wireframe note

#### S2-10: Edge Case — `+ Add Contact` from Company Detail pre-fills and locks Company field

- **Given** the user is on `/companies/:id` for "Acme Inc."
- **When** the user clicks `+ Add Contact`
- **Then** the Add Contact drawer opens with the Company field pre-filled as "Acme Inc." and locked (not editable); the saved contact is linked to this company by UUID
- **Acceptance Criteria covered:** UX Brief wireframe note

---

### Story 3: Interaction Log

#### S3-01: Happy Path — Log a new interaction

- **Given** the user is on a Contact Detail page
- **When** the user selects type "Call", enters a summary, and clicks "Log Interaction"
- **Then** a new row is appended to the `Interactions` tab with the correct `customer_id`, type, summary, `created_at` (ISO timestamp), and `created_by` (user email from JWT); the entry appears at the top of the log list; the contact's `last_contact_date` is updated to today
- **Acceptance Criteria covered:** S3-AC1, S3-AC2, S3-AC4

#### S3-02: Interactions tab provisioned on first use

- **Given** an existing user whose sheet has no `Interactions` tab
- **When** `POST /interactions` is called for the first time
- **Then** the `Interactions` tab is created with the correct header row (`id | customer_id | type | summary | created_at | created_by | edited_at`) before the row is appended
- **Acceptance Criteria covered:** S3-AC1

#### S3-03: Interaction list sorted chronologically, newest first

- **Given** a contact has three interactions logged on different dates
- **When** the user views the Contact Detail page
- **Then** the most recent interaction appears at the top of the log; the order matches descending `created_at`
- **Acceptance Criteria covered:** S3-AC3

#### S3-04: Empty state when no interactions exist

- **Given** a newly created contact with no interactions
- **When** the user navigates to the Contact Detail page
- **Then** the entry form is visible at the top of the log column; below it, the empty-state message reads "No interactions logged yet."; no error is displayed
- **Acceptance Criteria covered:** S3-AC6, UX Brief Flow 3 empty state

#### S3-05: Character counter and 1,000-character limit enforced

- **Given** the Interaction entry form is visible
- **When** the user types text, the character counter updates live; when text reaches 1,001 characters, the "Log Interaction" button is disabled and the counter shows an error state
- **Then** after trimming to under 1,000 characters, the button re-enables
- **Acceptance Criteria covered:** S3-AC7

#### S3-06: 1,000-character limit enforced server-side

- **Given** a valid JWT token
- **When** `POST /interactions` is called directly with a `summary` of 1,001 characters
- **Then** the API returns HTTP 400
- **Risk mitigated:** character limit bypass via direct API call

#### S3-07: Happy Path — Edit interaction within 24-hour window

- **Given** an interaction was logged less than 24 hours ago
- **When** the user hovers over the entry and clicks "Edit", modifies the summary, and saves
- **Then** the entry updates in place; an "Edited" label appears beside the timestamp; the `edited_at` column in the Interactions tab is updated
- **Acceptance Criteria covered:** S3-AC5

#### S3-08: Edit affordance hidden after 24-hour window

- **Given** an interaction was logged more than 24 hours ago
- **When** the user views the Contact Detail page
- **Then** no "Edit" affordance appears on that entry (client-side check on `createdAt`)
- **Acceptance Criteria covered:** S3-AC5

#### S3-09: 24-hour edit window enforced server-side

- **Given** an interaction with `created_at` more than 24 hours in the past
- **When** `PATCH /interactions/:id` is called directly with a new summary
- **Then** the API returns HTTP 403 with message "Interaction can no longer be edited"
- **Acceptance Criteria covered:** S3-AC5 (server enforcement), Tech Brief backend note

#### S3-10: `last_contact_date` side-effect write acceptable failure

- **Given** `POST /interactions` succeeds in appending the interaction row but the subsequent `PATCH` to `Sheet1` `last_contact_date` fails
- **When** the user views the Contact Detail page
- **Then** the interaction row exists in the log; `last_contact_date` remains at its previous value (acceptable drift); no error is surfaced to the user (no breaking UI state)
- **Risk mitigated:** Tech Brief `last_contact_date` side-effect write failure

#### S3-11: Edge Case — All four interaction types can be selected and saved

- **Given** the Interaction entry form is open
- **When** the user selects each of Call, Email, Meeting, and Note in turn and logs an interaction for each
- **Then** all four interaction rows are saved to the Interactions tab with the correct `type` value; each type renders with its distinct icon in the log list
- **Acceptance Criteria covered:** S3-AC1

---

### Story 4: 360-Degree Contact View

#### S4-01: Happy Path — Navigate to Contact Detail from Table, Grid, and Kanban views

- **Given** the user is on the Contacts list in each view mode
- **When** the user clicks a contact name/card (not the edit/pencil icon)
- **Then** the browser navigates to `/contacts/:id`; the URL matches the contact's `id`; the page renders profile, company, and interaction log
- **Acceptance Criteria covered:** S4-AC1

#### S4-02: All profile fields rendered on Contact Detail page

- **Given** a contact with all fields populated (including new S1 fields, a linked company, and interaction history)
- **When** the user views `/contacts/:id`
- **Then** the page displays: full name, email, phone, job title, preferred contact, LinkedIn URL (as external link), tags (as pills), resolved company name (linked to `/companies/:id`), status (inline editable), `last_contact_date`, `created_at`, notes, and all interaction entries
- **Acceptance Criteria covered:** S4-AC2

#### S4-03: Deep-link — stable URL accessible by sharing

- **Given** a contact at `/contacts/abc-123`
- **When** a user pastes `https://app.example.com/contacts/abc-123` into a browser (after authenticating)
- **Then** the Contact Detail page loads directly for that contact without requiring navigation from the list
- **Acceptance Criteria covered:** S4-AC3

#### S4-04: 404 state — contact ID not found

- **Given** the user navigates to `/contacts/nonexistent-id`
- **When** the API returns a 404
- **Then** the page shows "Contact not found" with a "Back to Contacts" link; no broken layout or unhandled error
- **Acceptance Criteria covered:** S4-AC4 (implied), UX Brief Flow 4 error state

#### S4-05: API error state with retry

- **Given** the API returns a 500 on the contact fetch
- **When** the Contact Detail page attempts to load
- **Then** an error banner reads "Failed to load contact data. Retry?" with a retry button; the page does not show partial data
- **Acceptance Criteria covered:** UX Brief Flow 4 error state

#### S4-06: Skeleton loading state shown during data fetch

- **Given** the user navigates to `/contacts/:id`
- **When** the data fetches are in-flight
- **Then** both columns show skeleton placeholders (avatar circle, text-line skeletons, entry skeleton); no partial data is shown until all three fetches resolve
- **Acceptance Criteria covered:** UX Brief Flow 4 loading state

#### S4-07: Archived contact banner

- **Given** a contact with `status = Archived`
- **When** the user navigates to `/contacts/:id`
- **Then** a full-width amber banner reads "This contact is archived." with a "Restore" button; the rest of the page remains functional
- **Acceptance Criteria covered:** UX Brief wireframe note

#### S4-08: Inline status change on Contact Detail page

- **Given** the user is on `/contacts/:id` for an Active contact
- **When** the user clicks the status pill and selects "Churned"
- **Then** an optimistic update immediately shows "Churned" in the badge; the API call updates the Sheet row; a success toast confirms; on failure, the badge rolls back to "Active"
- **Acceptance Criteria covered:** S4-AC2, UX Brief interaction note

---

### Story 5: Duplicate Detection

#### S5-01: Happy Path — Email exact match triggers warning banner

- **Given** a contact with `email = "jane@example.com"` (Active status) exists in the loaded list
- **When** the user types `JANE@EXAMPLE.COM` (different case) in the Email field of the Add Contact drawer and tabs away
- **Then** a yellow warning banner appears below the Email field identifying "Jane Smith · Acme Inc. · Active"; no additional API call is made (verified by network inspection)
- **Acceptance Criteria covered:** S5-AC1, S5-AC5

#### S5-02: Warning banner — "View contact" opens in new tab, preserves form

- **Given** the duplicate warning banner is visible
- **When** the user clicks "View contact"
- **Then** the duplicate's Contact Detail page opens in a new browser tab; the Add Contact drawer remains open with all entered values intact
- **Acceptance Criteria covered:** S5-AC2

#### S5-03: Dismiss warning and proceed — confirmation modal fires on submit

- **Given** the duplicate warning banner is visible
- **When** the user clicks "Dismiss" (banner disappears) then fills the form and clicks Save
- **Then** the "Save anyway?" confirmation modal appears; clicking "Create anyway" creates the contact; clicking "Cancel" returns focus to the form without closing the drawer
- **Acceptance Criteria covered:** S5-AC3, UX Brief Flow 5

#### S5-04: Warning does not block save — user can submit without dismissing

- **Given** the duplicate warning banner is visible (not dismissed)
- **When** the user clicks Save without dismissing the banner
- **Then** the confirmation modal fires; the user can still confirm and create the contact
- **Acceptance Criteria covered:** S5-AC6

#### S5-05: Fuzzy match — name + company triggers warning

- **Given** a contact `first_name = "Jane"`, `last_name = "Smith"`, `company = UUID of "Acme Inc."` exists
- **When** the user enters `First Name = "JANE"`, `Last Name = "SMITH"`, and selects `Company = "Acme Inc."` in the Add Contact drawer (no email match)
- **Then** the warning banner appears with "A contact with the same name and company already exists: Jane Smith (Acme Inc.)"
- **Acceptance Criteria covered:** S5-AC4

#### S5-06: No warning for Archived contacts

- **Given** a contact with `email = "archived@example.com"` and `status = Archived`
- **When** the user enters `archived@example.com` in the Add Contact drawer
- **Then** no duplicate warning banner appears
- **Acceptance Criteria covered:** Tech Brief duplicate detection filter note (`status !== 'Archived'`)

#### S5-07: No duplicate found — form behaves normally

- **Given** no contacts match the entered email or name+company combination
- **When** the user fills the Add Contact form
- **Then** no banner appears; the form submits directly without a confirmation modal
- **Acceptance Criteria covered:** S5-AC5 (no false positives)

#### S5-08: Duplicate detection is client-side only (no extra API call)

- **Given** the browser network tab is open
- **When** the duplicate email check runs on blur
- **Then** no new network request to `/customers` or any other endpoint is made; the check operates against the already-loaded store data
- **Acceptance Criteria covered:** S5-AC5

#### S5-09: Edge Case — Email match with one-character case difference

- **Given** a contact with `email = "Test@Example.Com"`
- **When** the user types `test@example.com` in the email field
- **Then** the warning banner triggers (case-insensitive match)
- **Acceptance Criteria covered:** S5-AC1 (case-insensitive)

---

### Story 6: Duplicate Merging

#### S6-01: Happy Path — Full merge from Contact Detail page actions menu

- **Given** two duplicate contacts exist (Contact A: survivor, Contact B: discarded)
- **When** the Admin opens the three-dot menu on Contact A's detail page, selects "Find duplicates & merge", searches for Contact B, and is navigated to `/contacts/merge?a=:idA&b=:idB`
- **Then** the merge view renders with both contacts side-by-side; all fields are displayed with radio buttons for selection
- **Acceptance Criteria covered:** S6-AC1

#### S6-02: Happy Path — Field-level selection in merge view

- **Given** the merge view is open for two contacts with different values in most fields
- **When** the user selects individual field values from each contact
- **Then** the survivor preview header updates live with the current selections; each row has exactly one radio selected; the review button becomes available
- **Acceptance Criteria covered:** S6-AC2

#### S6-03: Happy Path — Confirm merge: interaction rows re-pointed

- **Given** Contact B has 3 interaction rows referencing its `customer_id`
- **When** the Admin completes the merge flow and clicks "Confirm merge"
- **Then** all 3 interaction rows in the Interactions tab have their `customer_id` updated to Contact A's `id`; Contact A's total interaction count in the UI is the sum of both contacts' interactions
- **Acceptance Criteria covered:** S6-AC3

#### S6-04: Happy Path — Discard record archived with merge annotation

- **Given** a merge is confirmed with Contact A as survivor and Contact B as discarded
- **When** the merge completes
- **Then** Contact B's row in Sheet1 has `status = Archived`; Contact B's `notes` field contains the annotation "Merged into [Contact A id] on [ISO date]"; the user is navigated to `/contacts/:idA` with a success toast
- **Acceptance Criteria covered:** S6-AC4

#### S6-05: Confirmation dialog summarizes changes before commit

- **Given** the user has completed field selection on step 1 of merge
- **When** the user clicks "Review merge (step 2 of 2)"
- **Then** step 2 shows a summary panel with the full merged record preview, the archival annotation text, and the count of interactions to be re-linked; the "Confirm merge" button is the primary action
- **Acceptance Criteria covered:** S6-AC6

#### S6-06: Merge failure — no changes made, both records intact

- **Given** the API returns a 500 error during merge execution
- **When** the loading overlay clears
- **Then** the error banner reads "Merge failed. No changes were made. Please try again."; Contact A and Contact B both remain unmodified in the Sheet
- **Acceptance Criteria covered:** S6-AC6 (safety), UX Brief Flow 6 error path
- **Risk mitigated:** Partial merge failure (highest-priority risk)

#### S6-07: Merge is an explicit named action — not automatic

- **Given** a duplicate warning banner is visible in the Add Contact drawer
- **When** the user interacts with the banner
- **Then** no automatic merge occurs; the only paths are "View contact", "Dismiss", and (for Admins) "Merge with existing" which navigates to the explicit merge view
- **Acceptance Criteria covered:** S6-AC5

#### S6-08: Merge button greyed out for non-Admin users

- **Given** a Sales Rep (non-Admin) is on a Contact Detail page
- **When** the user opens the three-dot overflow menu
- **Then** the "Find duplicates & merge" option is visible but greyed out with a tooltip: "Requires Admin access"; the option is not clickable
- **Acceptance Criteria covered:** UX Brief Decision 5 (role check on frontend)

#### S6-09: "Same value" rows collapsed in merge view

- **Given** two contacts have identical `first_name` values
- **When** the merge view renders
- **Then** the `first_name` row is collapsed by default showing "Same value on both records: Jane" with an expand toggle; expanding shows the radio buttons
- **Acceptance Criteria covered:** UX Brief merge view wireframe note

#### S6-10: Edge Case — Merge with contact that has zero interactions

- **Given** Contact B (to be discarded) has no interaction rows
- **When** the merge is confirmed
- **Then** the merge completes without error; the confirmation step shows "0 interaction entries will be re-linked"; Contact B is archived
- **Acceptance Criteria covered:** S6-AC3 (zero-interaction edge case)

---

## 4. Acceptance Test Cases

---

### AC-S1-01: Add/Edit drawer exposes new optional fields

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Open Add Contact drawer | Drawer renders with fields: Job Title, Preferred Contact (dropdown), LinkedIn URL, Tags | |
| 2 | Leave all four new fields blank and save | Contact saved successfully; no validation error on optional fields | |
| 3 | Open Edit Contact drawer for the saved contact | All four new fields are empty (not errored); existing fields unchanged | |

---

### AC-S1-02: New fields persisted to Google Sheet with auto-provisioned headers

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Confirm Sheet1 has headers in A–J only (pre-feature state) | `SHEET_RANGE = Sheet1!A:J` (legacy state confirmed) | |
| 2 | Save a contact with all four new fields populated | API call succeeds; Sheet1 header row now contains `job_title`, `preferred_contact`, `linkedin_url`, `tags` in columns K–N | |
| 3 | Inspect the new contact row in the Sheet | Columns K–N contain the correct values in the correct positions | |
| 4 | View the contact on the Contact Detail page | All four new fields display correctly | |

---

### AC-S1-04: LinkedIn URL validation

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Open Edit Contact drawer; enter `http://linkedin.com/in/test` | Enter value and tab away | |
| 2 | Observe field state | Red border + inline error "LinkedIn URL must start with https://linkedin.com/" | |
| 3 | Correct the value to `https://linkedin.com/in/test` and type one character | Inline error clears | |
| 4 | Save the form | Save succeeds; valid URL stored | |
| 5 | Call `PATCH /customers/:id` directly with `linkedinUrl = "ftp://linkedin.com/in/test"` | API returns HTTP 400 | |

---

### AC-S2-01: Companies sheet tab provisioned

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Use an account whose sheet was created before this feature shipped (no Companies tab) | Confirm Companies tab is absent in the spreadsheet | |
| 2 | Make any authenticated API call (e.g., `GET /customers`) | `ensureTabsExist` runs; Companies tab is created | |
| 3 | Inspect the spreadsheet | Companies tab exists with correct header row: `id \| name \| industry \| website \| notes \| created_at` | |
| 4 | Make a second authenticated API call | No second `spreadsheets.get` call is made (cached flag); no duplicate tab created | |

---

### AC-S2-06: Archiving a company does not cascade-archive its contacts

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create Company "Acme Inc." and link 2 Active contacts to it | Setup confirmed | |
| 2 | PATCH the company to archived state | Company record updated | |
| 3 | Navigate to `/companies/:id` | Amber banner: "This company is archived. Its contacts are not affected." | |
| 4 | Navigate to `/contacts` and filter for both linked contacts | Both contacts still show `status = Active` | |
| 5 | Open each contact's detail page | No archival banner; full functionality available | |

---

### AC-S3-04: Adding an interaction updates `last_contact_date`

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Note the current `last_contact_date` for a contact (e.g., "2026-02-01") | Value confirmed | |
| 2 | Log a new interaction from the Contact Detail page | API call to `POST /interactions` succeeds | |
| 3 | Observe `last_contact_date` on the Contact Detail profile panel | Updated to today's date | |
| 4 | Inspect the contact row in Sheet1 | `last_contact_date` column reflects today's date | |

---

### AC-S3-05: Interaction entries cannot be deleted; can be edited within 24 hours

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Log an interaction | Entry appears in the log | |
| 2 | Observe the entry UI | No "Delete" affordance present | |
| 3 | While within 24 hours: hover over entry | "Edit" link appears | |
| 4 | Click Edit, modify summary, save | Entry updates in place; "Edited" label appears; `edited_at` in Sheet is populated | |
| 5 | Call `PATCH /interactions/:id` on an entry older than 24 hours (or simulate by clock) | API returns HTTP 403 "Interaction can no longer be edited" | |

---

### AC-S4-05: Contact Detail panel loads within 3 seconds

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Seed the test sheet with 500 contact rows (all with new fields populated) | Sheet contains 500 contacts | |
| 2 | Seed the Interactions tab with 2,000 rows referencing various contacts | Sheet contains 2,000 interactions | |
| 3 | Navigate to a Contact Detail page with network throttled to standard broadband (50 Mbps) | `DOMContentLoaded` + data render completes | |
| 4 | Measure time from navigation start to full content render (skeleton replaced by data) | Total time ≤ 3,000 ms | |
| 5 | Repeat 3 times and take the median | Median ≤ 3,000 ms | |

---

### AC-S5-01: Email duplicate detection — exact match, case-insensitive

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Confirm a contact with `email = "jane@example.com"` exists and is Active | Setup confirmed | |
| 2 | Open Add Contact drawer; type `JANE@EXAMPLE.COM` in Email field | Field populated | |
| 3 | Tab away from email field | Warning banner slides in below Email field: identifies Jane Smith by name and company | |
| 4 | Open browser network tab; observe no new API call fired | No network request to `/customers` or similar | |

---

### AC-S6-03 & AC-S6-04: Merge re-points interactions and archives discarded contact

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create Contact A (survivor) and Contact B (discarded) with 3 interactions on Contact B | Setup confirmed in Sheet | |
| 2 | Navigate to merge view for A and B; select field values; click Review | Step 2 summary shows 3 interactions to re-link | |
| 3 | Click Confirm merge | Loading overlay appears; "Merging contacts... Do not close this tab." displayed | |
| 4 | Wait for completion | Browser navigates to `/contacts/:idA`; success toast: "Merge complete. 3 interactions re-linked." | |
| 5 | Inspect Interactions tab in Sheet | All 3 former Contact B interaction rows now have `customer_id = Contact A's id` | |
| 6 | Inspect Contact B's Sheet row | `status = Archived`; `notes` field contains "Merged into [idA] on [ISO date]" | |
| 7 | Navigate to `/contacts/:idA` Interaction log | Total 3 interactions visible (Contact B's interactions now on Contact A) | |

---

## 5. Edge Case Catalogue

| Case | Input / State | Expected Behavior |
|------|--------------|-------------------|
| Empty contacts list | No contacts in Sheet | Contacts list shows empty state; no errors in console; Add Contact drawer opens normally |
| Empty Companies list | No companies in Sheet | Company combobox shows only `+ Create "..." as a new company` option; Companies list page shows empty state |
| Empty Interactions tab | No interactions for any contact | All Contact Detail pages show empty-state log prompt; no read errors |
| Contact with all new fields empty | Only legacy columns A–J populated | New fields display as empty on Contact Detail; no "undefined" or "null" rendered |
| Tag pill with comma in value | `tags = ",,vip,,,"` | Extra commas are handled gracefully; empty segments are not rendered as blank pills |
| Tags field with only whitespace | `tags = "   "` | Treated as empty; no pills rendered; stored as empty string |
| LinkedIn URL — valid `https://linkedin.com/` exactly (no path) | `linkedinUrl = "https://linkedin.com/"` | Accepted as valid (starts with the required prefix) |
| LinkedIn URL — subdomain | `linkedinUrl = "https://uk.linkedin.com/in/test"` | Fails validation (does not start with `https://linkedin.com/`); inline error shown |
| Interaction summary at exactly 1,000 characters | 1,000-char string submitted | Accepted by both client and server |
| Interaction summary at 1,001 characters | 1,001-char string submitted | Blocked client-side (button disabled); blocked server-side (HTTP 400) |
| Interaction summary empty string | Empty `summary` field | "Log Interaction" button is disabled; `POST /interactions` with empty summary returns HTTP 400 |
| Contact Detail for a contact with 0 interactions | `customerId` has no rows in Interactions tab | Empty state prompt shown; entry form still visible and functional |
| Merge — both contacts have empty value for a field | e.g., both have no `phone` | Row is shown as "Same value on both records: (empty)"; either radio can be selected; merge proceeds |
| Merge — survivor has no interactions, discarded has interactions | Survivor: 0 interactions; Discarded: 5 | After merge, survivor shows 5 interactions; confirmation step shows "5 interactions will be re-linked" |
| Merge — discarded has 0 interactions | Discard: 0 interactions | Merge completes; confirmation step shows "0 interaction entries will be re-linked"; no batchUpdate call for interactions is needed |
| Duplicate detection — email field cleared after warning | User clears the email field after banner appears | Warning banner is dismissed/hidden |
| Duplicate detection — re-entering same email | User re-types the duplicate email after having cleared it | Banner reappears on blur |
| Duplicate warning — both email AND name+company match | Same record triggers both detection passes | Only one banner shown (email match takes precedence per UX Brief) |
| Pagination / large dataset — 500 contacts in list | All 500 loaded client-side | Duplicate detection runs against all 500 without perceptible delay; list renders without crash |
| Contact Detail — API unreachable (network offline) | Fetch fails on page load | Error banner with retry button shown; no unhandled error; skeleton clears |
| Company combobox — search with special characters | User types `<script>` in company search | Rendered as literal text in dropdown; no script injection |
| Auth — accessing `/contacts/:id` without JWT | Unauthenticated request to API | API returns HTTP 401; frontend redirects to login page |
| Auth — JWT expired mid-session | JWT expires while user is on the Contact Detail page | Next API call (e.g., log interaction) returns 401; user is redirected to login; no data loss of unsaved form content is acceptable |
| Sheet1 column order disrupted | Columns K–N missing or reordered manually in the Sheet | `rowToCustomer` reads by index; if K–N are absent, new fields return empty string; if reordered, data may be misread — this is a known risk of positional column reading, documented in Tech Brief |
| Interactions tab — `customer_id` references a deleted (non-existent) contact | Orphaned interaction row | `GET /interactions` returns the row; client-side filtering by `customerId` simply returns no results for that id; no crash |

---

## 6. Integration Test Points

The following API endpoint contracts must be verified as part of integration testing. These should be executed against the running NestJS API with a real (test) Google Sheet, using a valid JWT.

### Authentication

| Test | Endpoint | Condition | Expected |
|------|----------|-----------|----------|
| INT-AUTH-01 | `GET /customers` | No Authorization header | HTTP 401 |
| INT-AUTH-02 | `GET /companies` | Expired JWT | HTTP 401 |
| INT-AUTH-03 | `POST /interactions` | Valid JWT | HTTP 201 |

### Extended Customer Fields

| Test | Endpoint | Condition | Expected |
|------|----------|-----------|----------|
| INT-CUST-01 | `GET /customers` | Sheet rows with no columns K–N | Response objects include `jobTitle: ""`, `preferredContact: ""`, `linkedinUrl: ""`, `tags: ""` |
| INT-CUST-02 | `POST /customers` | Body with all new fields | HTTP 201; Sheet row has values in columns K–N |
| INT-CUST-03 | `PATCH /customers/:id` | `linkedinUrl = "http://linkedin.com/in/x"` | HTTP 400 |
| INT-CUST-04 | `PATCH /customers/:id` | `linkedinUrl = "https://linkedin.com/in/x"` | HTTP 200; Sheet updated |
| INT-CUST-05 | `PATCH /customers/:id` | `linkedinUrl = ""` (empty) | HTTP 200; empty string accepted |

### Companies

| Test | Endpoint | Condition | Expected |
|------|----------|-----------|----------|
| INT-CO-01 | `GET /companies` | Empty Companies tab (header row only) | HTTP 200; empty array `[]` |
| INT-CO-02 | `POST /companies` | Valid `CreateCompanyDto` | HTTP 201; new row in Companies tab with generated UUID and `created_at` |
| INT-CO-03 | `POST /companies` | Missing required `name` field | HTTP 400 |
| INT-CO-04 | `PATCH /companies/:id` | Update `industry` and `website` | HTTP 200; correct row updated in Companies tab |
| INT-CO-05 | `PATCH /companies/:id` | Non-existent company `id` | HTTP 404 |

### Interactions

| Test | Endpoint | Condition | Expected |
|------|----------|-----------|----------|
| INT-INT-01 | `GET /interactions` | 2,000 interaction rows | HTTP 200; array of 2,000 objects; response time ≤ 5 seconds |
| INT-INT-02 | `POST /interactions` | Valid `CreateInteractionDto` | HTTP 201; row appended to Interactions tab; parent contact's `last_contact_date` updated in Sheet1 |
| INT-INT-03 | `POST /interactions` | `summary` = 1,001 characters | HTTP 400 |
| INT-INT-04 | `POST /interactions` | `type = "InvalidType"` | HTTP 400 |
| INT-INT-05 | `PATCH /interactions/:id` | Within 24-hour window; valid `summary` | HTTP 200; `edited_at` populated in Interactions tab |
| INT-INT-06 | `PATCH /interactions/:id` | Beyond 24-hour window | HTTP 403 "Interaction can no longer be edited" |
| INT-INT-07 | `PATCH /interactions/:id` | Non-existent interaction `id` | HTTP 404 |

### Merge

| Test | Endpoint | Condition | Expected |
|------|----------|-----------|----------|
| INT-MERGE-01 | `POST /customers/merge` | Valid `MergeCustomersDto`; Contact B has 3 interactions | HTTP 200; survivor row updated; 3 interaction rows re-pointed; Contact B archived with annotation |
| INT-MERGE-02 | `POST /customers/merge` | `survivorId` does not exist | HTTP 404 |
| INT-MERGE-03 | `POST /customers/merge` | `discardedId` does not exist | HTTP 404 |
| INT-MERGE-04 | `POST /customers/merge` | `survivorId === discardedId` | HTTP 400 |
| INT-MERGE-05 | Route ordering test: `POST /customers/merge` | Route registered before `PATCH /customers/:id` | HTTP 200 from merge handler (not matched as `id = "merge"`) |

---

## 7. Performance Tests

### P-01: Contact Detail Page Load Time SLA

**Goal:** Verify that `/contacts/:id` loads all content within 3 seconds under the stated data volume.

**Pre-conditions:**
- Google Sheet seeded with exactly 500 contact rows (all columns A–N populated with realistic data)
- Interactions tab seeded with exactly 2,000 rows, distributed across multiple contacts; the target contact for the test has 50 interactions
- All three Zustand stores are cold (page refreshed; no cached data)
- Network: standard broadband (50 Mbps download, no artificial throttling)
- Test device: mid-range laptop (not a developer machine with elevated specs)

**Measurement method:**
- Use browser Performance API: measure from `navigationStart` to the point where skeleton is replaced by real content (observable via a `data-testid="contact-detail-loaded"` attribute added to the container)
- Alternatively, use Lighthouse or WebPageTest with the above conditions

**Pass criteria:**
- Median of 5 runs: total content render ≤ 3,000 ms
- No individual run exceeds 4,500 ms (1.5x the SLA as an absolute ceiling)

**Failure criteria:**
- If median exceeds 3,000 ms, file a P1 performance bug; investigate whether the bottleneck is in `GET /interactions` response time, client-side filtering of 2,000 rows, or rendering

---

### P-02: Companies List Derived Columns (Client-Side)

**Goal:** Verify that the Companies list page renders the `Last Activity` column (derived client-side from contacts) without perceptible delay.

**Pre-conditions:** 50 companies each with 10 linked contacts (500 contacts total); all `last_contact_date` values populated

**Pass criteria:** Companies list page renders within 1,000 ms of navigation; `Last Activity` column populated for all rows without a secondary loading state

---

### P-03: Duplicate Detection Performance Under 500 Contacts

**Goal:** Verify that the client-side duplicate check on the email field does not cause perceptible lag.

**Pre-conditions:** 500 contacts loaded in `customerStore`

**Measurement:** Time from email field blur event to banner appearance (or confirmation of no match)

**Pass criteria:** ≤ 100 ms (imperceptible to user)

---

## 8. Accessibility Tests

The following tests target WCAG 2.1 Level AA compliance for the three highest-risk new surfaces.

### A-01: Duplicate Warning Banner

| Check | WCAG Criterion | Test Method | Pass/Fail |
|-------|---------------|-------------|-----------|
| Banner has `role="alert"` | 4.1.3 Status Messages | Inspect DOM; confirm `role="alert"` on banner element | |
| Screen reader announces banner immediately on appearance without requiring focus | 4.1.3 Status Messages | Test with NVDA (Windows) or VoiceOver (macOS); enter duplicate email; confirm banner content is read aloud | |
| Warning communicated by both icon and text (not color alone) | 1.4.1 Use of Color | Inspect banner: must have warning icon (!) AND text description; color alone cannot be the only indicator | |
| Banner has sufficient color contrast (amber text/icon on amber background) | 1.4.3 Contrast (Minimum) | Use a contrast checker on the warning palette; text contrast ≥ 4.5:1 | |
| "View contact" and "Dismiss" links are keyboard-accessible | 2.1.1 Keyboard | Tab to banner; verify both actions are reachable and activatable via Enter/Space | |
| Focus is moved to banner on appearance | 2.4.3 Focus Order | Tab through form after banner appears; confirm focus position includes banner | |

---

### A-02: Merge Confirmation Dialog (Step 2)

| Check | WCAG Criterion | Test Method | Pass/Fail |
|-------|---------------|-------------|-----------|
| Merge radio buttons have descriptive `aria-label` | 1.3.1 Info and Relationships | Inspect DOM: each radio must have `aria-label` like "Keep Email from Contact A: jane@example.com" | |
| "Same value" collapsed rows accessible to screen reader | 1.3.1 Info and Relationships | Screen reader must announce the "same value" state; the collapsed row must not be invisible to AT | |
| Loading overlay announces state change | 4.1.3 Status Messages | Confirm `aria-live="assertive"` on overlay text "Merging contacts..."; screen reader announces on appearance | |
| "Confirm merge" button has accessible name | 4.1.2 Name, Role, Value | Button `accessible name = "Confirm merge"`; not just icon/visual | |
| Back navigation from step 2 to step 1 is keyboard-accessible | 2.1.1 Keyboard | Tab to "Back to edit" button; Enter navigates back | |
| Page title updates on step transition | 2.4.2 Page Titled | `<title>` changes from "Merge Contacts — Step 1" to "Merge Contacts — Step 2" | |

---

### A-03: Interaction Log Form

| Check | WCAG Criterion | Test Method | Pass/Fail |
|-------|---------------|-------------|-----------|
| Type selector has `aria-label="Interaction type"` | 1.3.1 Info and Relationships | Inspect DOM on the select/combobox element | |
| Character counter has `aria-live="polite"` | 4.1.3 Status Messages | Screen reader announces counter updates as user types (non-intrusive, polite) | |
| "Log Interaction" button is disabled (not just visually) when summary is empty or over limit | 4.1.2 Name, Role, Value | Inspect button `disabled` attribute; confirm `aria-disabled="true"` if using `aria-disabled` pattern instead | |
| "Edit" link on log entries is accessible via keyboard | 2.1.1 Keyboard | Tab through log entries; "Edit" link on entry within 24-hour window is focusable and activatable | |
| Inline edit form is announced when it replaces the entry | 4.1.3 Status Messages | Screen reader must announce that the entry has entered edit mode | |
| Empty state message is not hidden from AT | 1.3.1 Info and Relationships | Inspect DOM: empty state text not `aria-hidden`; screen reader reads "No interactions logged yet." | |

---

### A-04: General Keyboard Navigation — Contact Detail Page

| Check | WCAG Criterion | Test Method | Pass/Fail |
|-------|---------------|-------------|-----------|
| Defined tab order: back-link → edit → overflow menu → status selector → LinkedIn → interaction form → log entries | 2.4.3 Focus Order | Tab through the entire page; confirm visual and logical order match | |
| Status selector `aria-label` includes current value and affordance hint | 4.1.2 Name, Role, Value | Inspect: `aria-label="Contact status: Active. Click to change."` with `aria-haspopup="listbox"` | |
| Overflow menu button `aria-label` is descriptive | 4.1.2 Name, Role, Value | Inspect: `aria-label="Contact actions menu"` (not "...") | |
| LinkedIn external link has `target="_blank"` announced to AT | 2.4.4 Link Purpose | Link text or `aria-label` includes indication it opens in a new tab (e.g., "(opens in new tab)") | |

---

## 9. Regression Checklist

The following existing features must be re-verified after this feature ships to confirm no regressions were introduced.

- [ ] **Google OAuth login flow** — complete login from the Google OAuth redirect through JWT issuance and storage; verify `AuthCallbackPage` works correctly under React Router v6 (`useSearchParams` replacing `window.location.search`)
- [ ] **Contacts list — Table view** — loads, displays, and sorts all contacts; `SHEET_RANGE` change from `A:J` to `A:N` does not break existing column mapping
- [ ] **Contacts list — Grid view** — contact cards render; existing fields display correctly; new fields display as empty on legacy contacts
- [ ] **Contacts list — Kanban view** — drag-and-drop status change still works; status update API call `PATCH /customers/:id` succeeds
- [ ] **Add Contact** — existing fields (first name, last name, email, phone, company, status, notes) save correctly; no new required fields block the existing flow
- [ ] **Edit Contact** — existing contacts can be edited without losing data in columns A–J; existing `company` plain-text values are preserved
- [ ] **Search / filter on Contacts list** — existing search across name, email, phone, company, notes still works; new fields are additionally searchable but do not break existing searches
- [ ] **Status badge component** — existing read-only StatusBadge in Contacts list is unaffected by the new interactive StatusBadge on Contact Detail page
- [ ] **Silent optimistic update (Kanban)** — the optimistic update mechanism from the last feature (PR #70cdb2b) is not broken by new Zustand stores or router changes
- [ ] **JWT Auth Guard** — all three new endpoints (`/companies`, `/interactions`, `/customers/merge`) are protected; unauthenticated requests return 401
- [ ] **`DriveService.findOrCreateSpreadsheet`** — new users still get their spreadsheet provisioned correctly, now with three tabs on first creation; the new `ensureTabsExist` path does not break the existing spreadsheet creation path
- [ ] **`SheetsService.rowToCustomer`** — existing rows with 10 columns (A–J) are still parsed correctly after the range expansion to A–N

---

## 10. Quality Exit Criteria

The feature may not ship until all of the following conditions are met.

### Mandatory (P0 — blocks ship)

- [ ] All 39 test scenarios in Section 3 have been executed and pass
- [ ] All Acceptance Test Cases in Section 4 pass
- [ ] Zero P0 bugs open (data loss, security bypass, broken auth, merge partial failure producing permanently inconsistent Sheet state)
- [ ] Zero P1 bugs open (feature unusable for its primary use case, performance SLA failure, accessibility blocker for WCAG AA)
- [ ] INT-MERGE-05 (route ordering) verified — `POST /customers/merge` is not matched as `PATCH /customers/merge` (`:id = "merge"`)
- [ ] Merge partial failure scenario (S6-06) tested and verified — both records are unmodified when the API returns an error
- [ ] Legacy plain-text company display verified across all surfaces (S2-06, S2-07)
- [ ] Backward compatibility for existing contacts without new columns verified (S1-05, INT-CUST-01)
- [ ] `ensureTabsExist` verified for pre-existing sheets (AC-S2-01, step 4)
- [ ] Performance SLA test (P-01) passes — median Contact Detail page load ≤ 3 seconds at 500 contacts + 2,000 interactions
- [ ] Regression checklist complete — all items checked and passing
- [ ] Duplicate detection confirmed to exclude Archived contacts (S5-06)
- [ ] Server-side enforcement of LinkedIn URL validation (S1-07, INT-CUST-03) verified
- [ ] Server-side enforcement of 24-hour interaction edit window (S3-09, INT-INT-06) verified

### Recommended (P2 — should be resolved before ship, but QA Lead may grant exception with documented justification)

- [ ] All accessibility tests in Section 8 pass (at minimum: `role="alert"` on duplicate banner, `aria-label` on merge radio buttons, `aria-live` on character counter and merge overlay)
- [ ] All Edge Case Catalogue entries have been manually or programmatically verified
- [ ] P-02 (Companies list derived columns) and P-03 (duplicate detection under 500 contacts) performance tests pass
- [ ] "Merge" greyed out with tooltip for non-Admin users (S6-08) verified on frontend

### Out of Criteria (not blocking this iteration)

- Pagination / virtual scroll for interactions list (deferred per PRD — revisit if production interaction count per contact exceeds 200)
- Role-based access control enforcement for merge on the backend (PRD Open Question — deferred; frontend-only guard is in scope and tested)
- Automated migration of legacy plain-text company strings (explicitly out of scope in PRD)
