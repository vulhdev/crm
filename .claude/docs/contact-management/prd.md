# PRD: Core Contact & Account Management

**Version:** 1.0
**Date:** 2026-03-15
**Status:** Draft

---

## Problem Statement

The platform currently stores customer data as flat, disconnected rows in a single Google Sheet tab. There is no way to group contacts under a parent company, no structured history of interactions beyond a single free-text notes field, and no safeguard against duplicate records accumulating over time. As a result, Sales Reps waste time hunting for context before customer calls, Sales Managers cannot assess account-level health, and data quality degrades silently every time a contact is entered twice. This PRD defines the foundational data layer that turns a list of rows into a true contact and account management system.

---

## Target Users

| Persona | Relevance |
|---------|-----------|
| **Sales Rep** | Primary — logs interactions, needs full contact context at a glance |
| **Sales Manager** | Secondary — monitors account health, reviews interaction history |
| **Admin** | Tertiary — concerned with data hygiene, duplicate cleanup |

---

## User Stories

### 1. Extended Contact Profile

**As a Sales Rep, I want to store richer details about a contact (job title, preferred communication channel, LinkedIn URL, and custom tags), so that I have the full picture before reaching out without leaving the CRM.**

#### Acceptance Criteria
- [ ] The Add/Edit drawer exposes new optional fields: `job_title`, `preferred_contact` (enum: Email / Phone / LinkedIn), `linkedin_url`, and `tags` (comma-separated free text).
- [ ] All new fields are persisted as additional columns in the customer's Google Sheet (Sheet1), with headers auto-provisioned on first use.
- [ ] Existing rows without the new columns are treated as having empty values — no data loss or read errors occur.
- [ ] `linkedin_url` is validated to confirm it begins with `https://linkedin.com/` before saving; an inline error is shown on invalid input.
- [ ] Tags are displayed as pill badges on the contact card in Grid view and as a compact comma list in Table view.
- [ ] All new fields are included in the existing search filter (partial string match).

---

### 2. Company (Account) Entity

**As a Sales Rep, I want to associate contacts with a named company entity, so that I can see all contacts at the same account in one place and avoid re-entering company details for every person.**

#### Acceptance Criteria
- [ ] A new `Companies` sheet tab is provisioned in the user's Google Sheet with columns: `id` (UUID), `name`, `industry`, `website`, `notes`, `created_at`.
- [ ] The `company` field on a contact becomes a reference to a Company record (stored as the Company `id`), replacing the current plain-text string.
- [ ] The UI resolves and displays the human-readable company name everywhere the company field is currently shown.
- [ ] When creating or editing a contact, the user can either select an existing company from a searchable dropdown or type a new company name to create a new Company record inline.
- [ ] A Company detail view lists all contacts linked to that company along with their individual statuses.
- [ ] Archiving a company does not cascade-archive its contacts; contacts retain their own status and remain fully functional.
- [ ] Legacy contacts with a plain-text company string (not a UUID reference) continue to display that string without error until manually re-linked.

---

### 3. Interaction Log

**As a Sales Rep, I want to log timestamped interaction entries against a contact (call, email, meeting, note), so that I and my manager have a chronological history of everything that has happened with that contact.**

#### Acceptance Criteria
- [ ] A new `Interactions` sheet tab is provisioned with columns: `id` (UUID), `customer_id`, `type` (enum: Call / Email / Meeting / Note), `summary` (free text), `created_at` (ISO timestamp), `created_by` (user email from JWT).
- [ ] From the contact's detail view, the user can add a new interaction entry via a compact inline form (type selector + summary text field).
- [ ] The interaction list on the contact detail view is sorted chronologically, newest first.
- [ ] Adding a new interaction automatically updates the `last_contact_date` field on the parent contact row.
- [ ] Individual interaction entries cannot be deleted but can be edited within 24 hours of creation (edit timestamp is stored).
- [ ] The interaction list renders within the contact detail view; it is not a separate page navigation.
- [ ] The summary field supports a maximum of 1,000 characters; a live character counter is shown.

---

### 4. 360-Degree Contact View

**As a Sales Rep, I want a single view for each contact that surfaces their profile, company affiliation, full interaction history, and key dates together, so that I can prepare for a customer conversation in under 30 seconds.**

#### Acceptance Criteria
- [ ] Clicking a contact row/card in any view (Table, Grid, Kanban) navigates to or opens a Contact Detail panel.
- [ ] The Contact Detail panel displays: full profile fields, resolved company name (linked to the Company detail view), all interaction log entries, `last_contact_date`, `created_at`, and current status with a status-change control.
- [ ] The panel is reachable via a stable URL or deep-linkable route so it can be shared between team members.
- [ ] If a contact has no interactions logged, the panel shows an empty-state prompt to log the first interaction.
- [ ] The panel loads and renders all data within 3 seconds on a standard broadband connection (data volume consistent with a typical small-team sheet of up to 500 contacts and 2,000 interactions).

---

### 5. Duplicate Detection

**As an Admin (or Sales Rep), I want the system to warn me when a contact I am adding looks like a duplicate, so that I can avoid polluting the CRM with redundant records.**

#### Acceptance Criteria
- [ ] When the user fills in the `email` field in the Add Contact form, the system checks existing contacts client-side for an exact email match (case-insensitive) and displays an inline warning banner identifying the potential duplicate by name.
- [ ] The warning banner includes a link that opens the suspected duplicate contact's detail view in a new panel, allowing side-by-side comparison.
- [ ] The user can choose to dismiss the warning and save the new contact anyway (with a deliberate confirmation step) or cancel and return to the duplicate's record.
- [ ] A secondary fuzzy match on `first_name` + `last_name` + `company` (all three must match, case-insensitive) also triggers the same warning.
- [ ] Duplicate detection runs entirely on the client against the already-fetched customer list — no additional API call is made.
- [ ] The warning does not block saving; it is advisory only.

---

### 6. Duplicate Merging

**As an Admin, I want to merge two duplicate contact records into one, so that interaction history and profile data are consolidated without losing any information.**

#### Acceptance Criteria
- [ ] A "Merge" action is available from the duplicate warning banner and from the Contact Detail panel (via an overflow/actions menu).
- [ ] The merge flow presents the two records side by side, with a field-by-field selector letting the user choose which value to keep for each field.
- [ ] All `Interactions` rows referencing the discarded contact's `customer_id` are re-pointed to the surviving contact's `id`.
- [ ] The discarded contact record is set to `status = Archived` with a `notes` annotation recording the merge event and the surviving contact's `id` (e.g., "Merged into [id] on [date]").
- [ ] The merge operation is presented as an explicit, named action — not an automatic background process.
- [ ] A confirmation dialog summarizes the changes before committing; the user must explicitly confirm.

---

## Scope

### In Scope
- Extended contact profile fields: `job_title`, `preferred_contact`, `linkedin_url`, `tags`
- Company entity (`Companies` sheet tab) with contact-to-company linkage
- Inline company creation during contact add/edit flow
- Company detail view listing linked contacts
- Interaction log (`Interactions` sheet tab) with types: Call, Email, Meeting, Note
- Auto-update of `last_contact_date` when an interaction is logged
- 360-degree Contact Detail panel (profile + company + interactions)
- Client-side duplicate detection on email (exact) and name+company (fuzzy)
- Manual duplicate merging with field-level selection
- Backward compatibility for existing plain-text `company` values

### Out of Scope (This Iteration)
- **Email / calendar integration** — pulling real sent emails or calendar events into the interaction log automatically; this requires OAuth scope expansion and is a distinct feature with significant complexity.
- **File attachments on contacts** — uploading documents or assets to a contact record; Google Drive attachment management is a separate workstream.
- **Account-level financial metrics** — total deal value, revenue per account; requires a Deals/Opportunities data model not yet defined.
- **Activity reminders and follow-up scheduling** — setting due-date tasks on interactions; a Task Management feature is out of scope here.
- **Bulk merge / deduplication wizard** — automated scanning of the entire sheet for all duplicates and bulk resolution; the current scope covers one-at-a-time merging only.
- **Multi-user collaboration on the same sheet** — the platform is per-user; shared team sheets are an Admin-tier concern deferred to a later phase.
- **Contact import (CSV / LinkedIn export)** — importing contacts in bulk; handled under a separate Import/Export feature.
- **Company hierarchy (parent/subsidiary)** — nesting companies under a parent company entity; deferred due to complexity within a flat Sheets model.
- **Interaction editing beyond 24-hour window** — to preserve audit integrity, older entries are read-only in this iteration.

---

## Priority

| Story | Priority | Rationale |
|-------|----------|-----------|
| 1. Extended Contact Profile | Must | Directly unblocks richer data capture; low complexity, builds on existing Add/Edit drawer; no schema dependency on other stories |
| 2. Company (Account) Entity | Must | Required for B2B use cases; unblocks the Company detail view and account-level reporting in future |
| 3. Interaction Log | Must | Core differentiator between a spreadsheet and a CRM; required for the 360 view story to have meaningful content |
| 4. 360-Degree Contact View | Must | The primary surface that delivers the "single source of truth" value proposition; depends on Stories 2 and 3 |
| 5. Duplicate Detection | Should | High data-hygiene value with low implementation cost (client-side only, no new API); prevents the most common data quality failure mode |
| 6. Duplicate Merging | Could | Valuable but higher complexity (multi-record write across two sheet tabs); can ship after detection is live and validated |

---

## Open Questions

1. **Company tab provisioning:** Should the `Companies` tab and `Interactions` tab be created eagerly at account setup time (alongside the existing `Sheet1`), or lazily on first use? Eager creation is simpler to manage but adds overhead for users who never use these features.

2. **Contact Detail panel — modal vs. page route:** Should the 360-degree view be a side panel/drawer (keeping the list context visible) or a full navigable page with a stable URL? A stable URL is better for deep-linking but a side panel maintains workflow continuity. Needs UX decision before design begins.

3. **Legacy company field migration:** Do we want to offer a one-time migration prompt that converts existing plain-text `company` strings into proper Company entity records, or leave that as a manual action for the user? An automated migration reduces friction but risks creating junk Company records for inconsistently entered names.

4. **Interaction edit window:** The 24-hour edit window is an assumption based on audit hygiene. Does the business want any edit window at all, or is immutability preferred from the start? Should edits be tracked as revisions?

5. **Tag vocabulary:** Should tags be free-form text only (current proposal) or should users be able to define a fixed tag list at the account/admin level for consistency across the team? Free-form is faster to ship but can degrade into inconsistent labeling.

6. **Merge permissions:** Should merge be available to all Sales Reps, or restricted to Admins only? The data consequence (archiving a record and rewriting interaction history) is significant.

7. **Performance baseline for Interaction log:** The acceptance criterion references up to 2,000 interactions for the load time SLA. What is the realistic upper bound for a power user on this platform, and is a client-side pagination or virtual list needed from day one?

---

## Success Metrics

- **Contact completeness rate:** Percentage of contacts with at least one interaction logged within 7 days of creation. Target: 60% within 60 days of feature launch (baseline: 0% today, as no interaction log exists).
- **Duplicate record rate:** Percentage of contacts sharing an exact email with another active contact. Target: below 3% (currently unmeasured; first measurement taken at feature launch as baseline).
- **Time-to-context:** Qualitative/session-recording measure of how long a Sales Rep spends finding relevant context before a customer interaction. Target: under 30 seconds as stated in Story 4 (validated via user testing).
- **Company linkage adoption:** Percentage of non-Archived contacts linked to a Company entity (not a legacy plain-text string) within 30 days. Target: 50%.
- **Merge action usage:** Number of merge operations completed per week as a proxy for data hygiene engagement. Reviewed at 30 days post-launch; low usage may indicate detection warnings are insufficient or the merge flow has too much friction.
- **Error rate on new sheet tabs:** Zero read/write errors attributable to the `Companies` or `Interactions` tab schema in the first 30 days, monitored via API error logs.
