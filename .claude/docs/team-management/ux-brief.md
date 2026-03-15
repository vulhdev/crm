# UX Brief: User & Team Management

**Version:** 1.0
**Date:** 2026-03-15
**Author:** Product Designer
**Status:** Ready for UI Designer handoff

---

## User Research Summary

The CRM currently works as a single-user tool. Every person who signs in via Google OAuth is isolated — their data, their sheet, their view. Moving to a team model introduces a fundamentally new behavioral context: some users will now act on behalf of others (Admins inviting Reps), some users will land in the product for the first time through an external trigger (invitation email), and some users will gain visibility into data they do not own (Sales Managers).

Key behavioral insights drawn from the PRD personas and user stories:

**Admins are the hub of this entire feature.** Every critical path — invite, role change, team creation, deactivation — flows through them. Admin tasks are infrequent but high-stakes: a misconfigured role or a failed invite creates a support burden. The Admin UX must favor explicitness over brevity. Confirmation dialogs, status indicators, and undo paths matter more here than they do on the Sales Rep's customer list.

**Sales Reps encounter this product for the very first time via an email link.** They have zero context about the CRM, no account, and no prior relationship with the interface. The invite-acceptance flow is the first impression. Any friction — a confusing error message, a broken redirect, a mismatched email notice — will produce a support ticket or an abandoned onboarding. The invite-acceptance screen must do one job: reassure the rep they are in the right place and get them through Google OAuth in one click.

**Sales Managers are passive beneficiaries of this feature.** They do not configure teams — Admins do. Their interest is scoped pipeline visibility: "show me my team's data." The team grouping logic must surface correctly on the dashboard without requiring Managers to change any settings themselves.

**Admins will manage the member roster continuously, not just at launch.** People leave, roles change, teams restructure. The Team Management page must make these ongoing operations (role edit, deactivation, team reassignment) fast and non-disruptive — ideally inline, without navigating away from the roster.

**The last-Admin guard is a safety constraint, not a common operation.** But if it fires unexpectedly (e.g., Admin tries to demote themselves), the error must be immediately understandable and non-alarming. "You can't do that" is not enough — the message must explain why and what the Admin should do instead.

---

## User Flows

### Flow 1 — Admin Invites a New Member (Happy Path)

1. Admin navigates to the **Team** section via sidebar nav.
2. The Members tab is shown by default with the current roster and any pending invitations.
3. Admin clicks **"Invite Member"** button (top-right of page).
4. An **Invite Member drawer** slides in from the right (consistent with `CustomerDrawer` pattern).
5. Admin fills in:
   - Email address (required)
   - Display name (optional — pre-fills the invitation email greeting)
   - Role (required dropdown: Sales Rep / Sales Manager / Admin)
6. Admin clicks **"Send Invite."**
7. System validates:
   - Is the email already an active member? → Inline field error: "This email belongs to an active member."
   - Is there already a pending invite for this email? → Inline notice with "Resend Invite" option instead.
8. On success: drawer closes, toast notification: "Invitation sent to [email]."
9. The pending invitation appears immediately in the Pending Invitations section of the Members tab with status badge "Pending," invited-on date, expiry date, and a "Revoke" action.

---

### Flow 2 — Admin Resends an Existing Pending Invite

1. Admin opens the Invite Member drawer and enters an email that already has a pending invite.
2. The form shows an inline notice below the email field: "A pending invitation already exists for this email (expires [date])."
3. Two action buttons appear: **"Resend & Reset Timer"** and **"Cancel."**
4. Admin clicks "Resend & Reset Timer."
5. System invalidates old token, generates new 72-hour token, sends new email.
6. Toast: "Invitation resent to [email]. New expiry: [date]."
7. The pending invitations list updates the expiry timestamp in place.

---

### Flow 3 — Admin Revokes a Pending Invitation

1. Admin finds the pending invitation row in the Members tab.
2. Admin clicks the **"Revoke"** action (link-style button in the row's action column).
3. An inline confirmation appears within the row: "Revoke this invitation? The link will stop working immediately." with **"Confirm Revoke"** and **"Cancel"** buttons.
4. Admin confirms.
5. The row is removed from the pending list with a brief fade-out animation.
6. Toast: "Invitation to [email] has been revoked."

---

### Flow 4 — Sales Rep Accepts Invitation (Happy Path)

1. Rep receives invitation email. Rep clicks the CTA link.
2. Browser opens the CRM at `/invite/[token]` — the **Invite Accept page.**
3. Page validates the token server-side before rendering.
4. If valid: page displays:
   - CRM platform name / logo
   - "You've been invited to join [Org Name]" heading
   - "Invited by: [Admin display name]"
   - "Your role will be: [Role]"
   - A single **"Sign in with Google"** button
   - Fine-print: "By signing in, you accept the invitation and create your account."
5. Rep clicks "Sign in with Google."
6. Google OAuth consent screen opens (standard flow).
7. On success: OAuth callback creates the user account, marks invitation token as consumed, issues JWT.
8. Rep is redirected to **DashboardPage** (the standard post-login destination).
9. If the Google account email differs from the invite email: a one-time **informational banner** appears at the top of the dashboard: "Your account was created using [google-email]. If this was not intentional, contact your Admin." Banner can be dismissed and does not block usage.

---

### Flow 5 — Sales Rep Uses Expired or Revoked Invitation Link

1. Rep clicks invite link.
2. Browser opens `/invite/[token]`.
3. Token validation fails (expired or revoked).
4. Page displays the **Invite Error page** (no partial account created):
   - Clear heading: "This invitation link is no longer valid."
   - Explanation: "The link may have expired (invitations are valid for 72 hours) or been revoked by your Admin."
   - Single action: **"Contact your Admin"** (mailto link or copy-to-clipboard of Admin email if available from token metadata).
   - Secondary: "Already have an account? Sign in here" link → LoginPage.
5. No sign-in button is shown. No account creation is possible from this state.

---

### Flow 6 — Sales Rep Attempts to Re-use a Consumed Invitation Token

1. Rep (already signed up) clicks the same invite link again.
2. Token is marked as consumed. Page detects consumed state.
3. Page displays: "You've already accepted this invitation."
4. Single action: **"Go to dashboard"** → redirects to LoginPage (where they can sign in normally).

---

### Flow 7 — Admin Changes a Member's Role

1. Admin is on the Members tab of the Team section.
2. Admin locates the member row.
3. Admin clicks the role badge or "Edit" icon in the member row.
4. The role cell enters **inline edit mode**: a dropdown replaces the badge, pre-selected to current role.
5. Admin selects a new role from the dropdown (Admin / Sales Manager / Sales Rep).
6. If Admin attempts to change the only active Admin to a lower role:
   - Dropdown reverts immediately.
   - Inline error below the row: "Cannot demote the only Admin. Assign Admin role to another member first."
7. On valid selection: Admin clicks the checkmark (confirm) icon or presses Enter.
8. System saves. The role badge updates in place.
9. Toast: "[Member name]'s role updated to [Role]."

---

### Flow 8 — Admin Creates a New Team

1. Admin navigates to the **Teams tab** within the Team section.
2. Admin clicks **"Create Team."**
3. A **Create Team drawer** slides in.
4. Admin enters:
   - Team name (required)
   - Manager (optional dropdown — shows all active Sales Managers)
   - Members (optional multi-select — shows all active Sales Reps, with "unassigned" reps distinguished)
5. Admin clicks **"Create Team."**
6. System creates the team. Any rep previously on another team is silently moved (no destructive confirmation needed — this is a reassignment, not a deletion).
7. Drawer closes. New team card appears on the Teams tab.
8. Toast: "Team '[name]' created."

---

### Flow 9 — Admin Edits an Existing Team

1. Admin clicks the three-dot menu (or "Edit" button) on a team card.
2. The same Create/Edit Team drawer opens, pre-filled with current values.
3. Admin modifies name, manager, or members.
4. Admin clicks **"Save Changes."**
5. Drawer closes. Team card updates in place.
6. Toast: "Team '[name]' updated."

---

### Flow 10 — Admin Deletes a Team

1. Admin clicks the three-dot menu on a team card and selects "Delete Team."
2. A **modal confirmation dialog** appears (not inline — deletion is more consequential than revocation):
   - "Delete [Team Name]?"
   - Warning copy: "Members will not be deleted. They will become unassigned until added to another team."
   - Member avatar row (up to 5 avatars + overflow count) to make the impact tangible.
   - **"Delete Team"** (destructive style) and **"Cancel"** buttons.
3. Admin confirms.
4. Team card fades out and is removed.
5. Toast: "Team '[name]' deleted. [N] members are now unassigned."

---

### Flow 11 — Admin Deactivates a Member

1. Admin locates the member row in the Members tab.
2. Admin clicks the three-dot menu in the member row and selects **"Deactivate."**
3. A **modal confirmation dialog** appears:
   - "[Member name] will immediately lose access to the CRM."
   - "Their customer records will remain accessible to Admins and their team's Sales Manager."
   - If member is the only active Admin: the option does not appear in the menu at all (guard enforced at UI level, not just validation).
   - **"Deactivate"** (destructive style) and **"Cancel."**
4. Admin confirms.
5. Member row updates in place: name grays out, status badge changes to "Deactivated," three-dot menu changes to show "Reactivate" instead of "Deactivate."
6. Toast: "[Member name] has been deactivated."

---

### Flow 12 — Admin Reactivates a Member

1. Admin locates the deactivated member row (shown with "Deactivated" badge).
2. Admin opens the three-dot menu and selects **"Reactivate."**
3. No confirmation dialog — reactivation is not a destructive action.
4. Member row updates immediately: status badge returns to "Active," full color returns, menu reverts to standard options.
5. Toast: "[Member name] has been reactivated."

---

### Flow 13 — Admin Edits Member Display Name

1. Admin locates the member row.
2. Admin clicks the member's display name or an "Edit" icon.
3. The name cell enters inline edit mode: a text input replaces the display name, pre-filled.
4. Admin edits and presses Enter or clicks the confirm checkmark.
5. Name updates in place.
6. Toast: "Profile updated."

---

## Information Architecture

### Navigation

The Team section is a new top-level item in the sidebar navigation, visible only to users with the `Admin` role. Sales Managers and Sales Reps do not see this nav item.

```
Sidebar Nav
├── Dashboard         (all roles)
├── Contacts          (all roles)
├── Pipeline          (all roles)
└── Team              (Admin only)
    ├── Members tab   (default)
    └── Teams tab
```

The Team section contains two tabs. Members is the default tab. Both tabs live under the `/team` route, distinguished by `?tab=members` (default) and `?tab=teams`.

### Page Hierarchy

```
/login                        → LoginPage (existing)
/auth/callback                → AuthCallbackPage (existing)
/dashboard                    → DashboardPage (existing)
/team                         → TeamPage (new)
  ?tab=members                → MembersTab (default)
  ?tab=teams                  → TeamsTab (new)
/invite/[token]               → InviteAcceptPage (new)
/invite/error                 → InviteErrorPage (new — or inline state on InviteAcceptPage)
```

### Data Relationships (rendered in UI)

- A **Member** has: display name, email, role badge, status badge (Active / Pending / Deactivated), team assignment, invited-on date.
- A **Pending Invitation** has: email, role, invited-on date, expiry date, revoke action. It is shown in the Members tab, visually grouped below active members.
- A **Team** has: name, manager (one), members (many), member count. Teams live on the Teams tab as cards.

---

## Wireframes

### TeamPage — Members Tab (Default State)

```
+-----------------------------------------------------------------------+
| [Sidebar Nav]  | Team                                                  |
|                +-------------------------------------------------------+
| Dashboard      | [Members] [Teams]   (tab bar)                         |
| Contacts       +-------------------------------------------------------+
| Pipeline       |                                                       |
| Team  <---     | Active Members (12)              [+ Invite Member]    |
|                | +-------------------------------------------------+   |
|                | | Avatar | Name          | Role      | Team    | ... ||
|                | +-------------------------------------------------+   |
|                | | [A]    | Alice Martin  | Admin     | —       | ... ||
|                | | [B]    | Bob Chen      | Sales Rep | Team A  | ... ||
|                | | [C]    | Carol James   | Mgr       | Team B  | ... ||
|                | | [D]    | Dana Patel    | Sales Rep | —       | ... ||
|                | |   ...  |               |           |         |     ||
|                | +-------------------------------------------------+   |
|                |                                                       |
|                | Pending Invitations (3)                               |
|                | +-------------------------------------------------+   |
|                | | Email             | Role      | Expires   | Act  ||
|                | +-------------------------------------------------+   |
|                | | john@example.com  | Sales Rep | 2d 4h     | Rvk ||
|                | | sara@company.io   | Sales Mgr | 1d 11h    | Rvk ||
|                | | tom@biz.net       | Sales Rep | 0d 3h     | Rvk ||
|                | +-------------------------------------------------+   |
|                |                                                       |
+-----------------------------------------------------------------------+
```

Notes:
- "..." column is a three-dot icon menu per row (Edit Name, Change Role, Deactivate / Reactivate).
- Role is shown as a badge (not plain text) to allow color-independent identification.
- Status is implicit via section grouping (Active Members vs. Pending Invitations vs. presence of Deactivated badge inline in Active Members section).
- Expiry countdown in Pending Invitations turns to a warning state (amber badge) when under 24 hours remain.
- "Rvk" = Revoke link-style button.
- The Active Members count and Pending Invitations count update in real time after operations.

---

### TeamPage — Members Tab (Empty State — No Members Yet)

```
+-----------------------------------------------------------------------+
| [Sidebar Nav]  | Team                                                  |
|                +-------------------------------------------------------+
|                | [Members] [Teams]                                     |
|                +-------------------------------------------------------+
|                |                                                       |
|                |   +-------------------------------------------+      |
|                |   |                                           |      |
|                |   |   [Person+ icon]                          |      |
|                |   |                                           |      |
|                |   |   No team members yet                     |      |
|                |   |                                           |      |
|                |   |   Invite your first team member to        |      |
|                |   |   get started.                            |      |
|                |   |                                           |      |
|                |   |   [+ Invite Member]   (primary button)   |      |
|                |   |                                           |      |
|                |   +-------------------------------------------+      |
|                |                                                       |
+-----------------------------------------------------------------------+
```

Note: This state applies only to a newly bootstrapped organization where the Admin is the only user. The Admin themselves appears in the roster, so this zero-state occurs only before the Admin invites anyone else. Consider: should the Admin row be shown in the list immediately (making the empty state moot)? Recommend showing the Admin's own row always, so the "empty" state becomes "only you" with an invite prompt below.

---

### TeamPage — Teams Tab (Populated State)

```
+-----------------------------------------------------------------------+
| [Sidebar Nav]  | Team                                                  |
|                +-------------------------------------------------------+
|                | [Members] [Teams]                                     |
|                +-------------------------------------------------------+
|                |                                          [Create Team] |
|                |                                                       |
|                | +---------------------+  +---------------------+     |
|                | | Team Alpha          |  | Team Beta           |     |
|                | |                     |  |                     |     |
|                | | Manager:            |  | Manager:            |     |
|                | | [A] Alice Martin    |  | [C] Carol James     |     |
|                | |                     |  |                     |     |
|                | | Members (4):        |  | Members (2):        |     |
|                | | [B][D][E][F]        |  | [G][H]              |     |
|                | |                     |  |                     |     |
|                | |        [Edit]  [...] |  |        [Edit]  [...] |    |
|                | +---------------------+  +---------------------+     |
|                |                                                       |
|                | +---------------------+                              |
|                | | Unassigned (2)      |                              |
|                | | [I][J]              |                              |
|                | | Dana Patel          |                              |
|                | | Ivan Korr           |                              |
|                | +---------------------+                              |
|                |                                                       |
+-----------------------------------------------------------------------+
```

Notes:
- Cards use a consistent size; overflow beyond the visible grid scrolls the page.
- "Unassigned" is a read-only pseudo-card (no edit/delete actions) that shows reps not yet on any team.
- Member avatars are stacked (overlapping) with a "+N" overflow label if more than 5.
- Three-dot menu on each card: Edit, Rename, Delete.
- "Edit" and three-dot coexist for discoverability — Edit is the primary action, three-dot holds secondary (Rename, Delete).

---

### TeamPage — Teams Tab (Empty State)

```
+-----------------------------------------------------------------------+
| [Sidebar Nav]  | Team                                                  |
|                +-------------------------------------------------------+
|                | [Members] [Teams]                                     |
|                +-------------------------------------------------------+
|                |                                                       |
|                |   +-------------------------------------------+      |
|                |   |                                           |      |
|                |   |   [Grid/team icon]                        |      |
|                |   |                                           |      |
|                |   |   No teams created yet                    |      |
|                |   |                                           |      |
|                |   |   Create a team to group your reps        |      |
|                |   |   under a Sales Manager.                  |      |
|                |   |                                           |      |
|                |   |   [Create Team]   (primary button)        |      |
|                |   |                                           |      |
|                |   +-------------------------------------------+      |
|                |                                                       |
+-----------------------------------------------------------------------+
```

---

### Invite Member Drawer (Right-side Panel)

```
+----------------------------------+
| Invite Member              [X]   |
+----------------------------------+
|                                  |
| Email address *                  |
| +------------------------------+ |
| | john@example.com             | |
| +------------------------------+ |
|                                  |
| Display name (optional)          |
| +------------------------------+ |
| | John Smith                   | |
| +------------------------------+ |
|                                  |
| Role *                           |
| +------------------------------+ |
| | Sales Rep              [v]   | |
| +------------------------------+ |
| Sales Reps see only their own    |
| customer records.                |
|                                  |
|                                  |
| [Cancel]         [Send Invite]   |
+----------------------------------+
```

Notes:
- Role hint text updates dynamically based on selected role to clarify access level.
- "Send Invite" button is disabled until email is populated and role is selected.
- If a pending invite exists for the entered email, the form transitions to the Resend state (see Flow 2 wireframe below).

---

### Invite Member Drawer — Resend State

```
+----------------------------------+
| Invite Member              [X]   |
+----------------------------------+
|                                  |
| Email address *                  |
| +------------------------------+ |
| | john@example.com             | |
| +------------------------------+ |
| [!] A pending invite exists for  |
|     this email (expires in 1d    |
|     11h).                        |
|                                  |
| [Cancel]   [Resend & Reset Timer]|
+----------------------------------+
```

Note: Role field is hidden in resend state — the original role is preserved. If Admin wants to change the role before resending, they must revoke the old invite first and create a new one.

---

### Create / Edit Team Drawer

```
+----------------------------------+
| Create Team                [X]   |
+----------------------------------+
|                                  |
| Team name *                      |
| +------------------------------+ |
| | Team Alpha                   | |
| +------------------------------+ |
|                                  |
| Manager                          |
| +------------------------------+ |
| | Select manager...      [v]   | |
| +------------------------------+ |
| Sales Managers only. A manager   |
| can oversee multiple teams.      |
|                                  |
| Members                          |
| +------------------------------+ |
| | Search or select reps...     | |
| | [Bob Chen]  [Dana P.]  [+3]  | |
| +------------------------------+ |
| Reps can belong to one team      |
| at a time.                       |
|                                  |
| [Cancel]        [Create Team]    |
+----------------------------------+
```

Notes:
- Manager dropdown lists only active users with the Sales Manager role.
- Members multi-select lists only active users with the Sales Rep role.
- Reps currently on another team are shown with a label "(currently in [Team Name])" to give Admin visibility before reassigning.
- On edit mode, the drawer title changes to "Edit Team" and the CTA to "Save Changes."

---

### InviteAcceptPage — Valid Token State

```
+-----------------------------------------------------------------------+
|                                                                       |
|                   [CRM Logo]                                          |
|                                                                       |
|           You've been invited to join Acme Sales CRM                 |
|                                                                       |
|           Invited by: Alice Martin (Admin)                            |
|           Your role: Sales Rep                                        |
|                                                                       |
|   +-------------------------------------------------------------+    |
|   |                                                             |    |
|   |          [Google "G" logo]  Sign in with Google            |    |
|   |                                                             |    |
|   +-------------------------------------------------------------+    |
|                                                                       |
|   By signing in, you'll create your CRM account and accept           |
|   this invitation. No password required.                             |
|                                                                       |
|   Invitation expires: March 17, 2026 at 3:00 PM                      |
|                                                                       |
+-----------------------------------------------------------------------+
```

Notes:
- This is a standalone, full-page, centered layout — no sidebar, no nav. Minimal chrome.
- Expiry date is shown to create appropriate urgency without alarm.
- No email/password form. The Google button is the only action.
- Footer: "Having trouble? Contact [admin-email]."

---

### InviteErrorPage — Expired / Revoked Token

```
+-----------------------------------------------------------------------+
|                                                                       |
|                   [CRM Logo]                                          |
|                                                                       |
|           This invitation is no longer valid                          |
|                                                                       |
|           This link may have expired (invitations are valid           |
|           for 72 hours) or been revoked by your Admin.               |
|                                                                       |
|   +---------------------------------------------+                   |
|   |   Contact your Admin for a new invite        |                   |
|   |   admin@acme.com    [Copy email]             |                   |
|   +---------------------------------------------+                   |
|                                                                       |
|           Already have an account?  Sign in here                     |
|                                                                       |
+-----------------------------------------------------------------------+
```

Notes:
- "Sign in here" links to the standard LoginPage.
- If Admin email is derivable from token metadata even after expiry, surface it here. Otherwise show a generic "contact your Admin" message.
- Do not show a "Try again" or "Request new invite" self-service flow — the PRD scopes out self-service. Only the Admin can resend.

---

### Deactivate Member Confirmation Modal

```
+-----------------------------------------------+
|  Deactivate Alice Martin?                      |
+-----------------------------------------------+
|                                                |
|  Alice will immediately lose access to         |
|  the CRM.                                      |
|                                                |
|  Her customer records will remain              |
|  accessible to Admins and Team Alpha's         |
|  Sales Manager.                                |
|                                                |
|             [Cancel]   [Deactivate]            |
+-----------------------------------------------+
```

Notes:
- "Deactivate" button uses destructive styling (distinct from primary — no specific color assigned here; UI Designer to determine).
- Team name in the body is dynamic. If rep is unassigned: "Her customer records will remain accessible to Admins."
- Modal is dismissed on Cancel or Escape key.

---

### Delete Team Confirmation Modal

```
+-----------------------------------------------+
|  Delete Team Alpha?                            |
+-----------------------------------------------+
|                                                |
|  The team will be removed.                     |
|                                                |
|  4 members will become unassigned:             |
|  [B] [D] [E] [F]  (avatar row)                |
|                                                |
|  Members are not deleted — they can be         |
|  added to another team at any time.            |
|                                                |
|             [Cancel]   [Delete Team]           |
+-----------------------------------------------+
```

---

## Interaction Design Notes

### Members Table

- **Hover state on row:** Subtle row highlight to indicate interactivity; three-dot menu icon becomes visible (hidden by default to reduce visual noise).
- **Inline role edit:** Clicking the role badge (for Admin users) replaces the badge with a dropdown in place. Focus is set to the dropdown immediately. Pressing Escape cancels and restores the original badge. Pressing Enter or Tab confirms. A spinner replaces the badge during the save operation.
- **Inline name edit:** Same pattern as role edit. Input occupies the name cell. Validation: name must not be blank.
- **Three-dot menu:** Positioned at the row's trailing edge. Opens a small popover menu. Closes on outside click or Escape. For the only active Admin, the "Deactivate" item is absent from the menu (not disabled — absent, to avoid confusion).
- **Deactivated rows:** Rendered at reduced opacity with a "Deactivated" badge. Sorted to the bottom of the Active Members section (or hidden behind a "Show deactivated members" toggle if the list grows long).

### Pending Invitations Section

- **Expiry countdown:** Shows a human-readable relative time ("2d 4h"). Updates every minute while the page is open. When under 24 hours: badge background shifts to warning state. When under 1 hour: badge shifts to critical/urgent state.
- **Revoke action:** Renders as a link-style button ("Revoke") in the row. On click, an inline confirmation replaces the "Revoke" button within the row itself (not a modal) — keeps the user in context without a disruptive overlay for a minor operation.
- **After revoke confirmation:** The row animates out (fade + height collapse). The pending count decrements.

### Invite Member Drawer

- **Email field:** Debounced validation (500ms after last keystroke) checks for existing member or pending invite. If active member detected: red field border, inline error. If pending invite detected: amber field border, inline notice with resend option.
- **Role dropdown:** Includes a short description line below the drawer's role select that updates to describe that role's access level, helping Admins make the right choice.
- **Send Invite button:** Disabled state until required fields are valid. On click: button shows a spinner, disabled, for the duration of the API call. On success: drawer closes, toast fires. On API error: button returns to active state, error banner appears inside the drawer.
- **Drawer close:** If the Admin has partially filled the form and clicks X or presses Escape, no confirmation is needed (invite was not sent; no destructive action occurred). The form state is discarded.

### Create / Edit Team Drawer

- **Member multi-select:** Tag-style input. Typing filters the rep list. Selecting adds a tag chip. Backspace on empty input removes the last chip. Chips for reps currently on another team include a "(Team Name)" suffix.
- **On reassignment notice:** If a rep being added is currently on another team, the drawer does not block the action but shows a passive inline notice: "[N] rep(s) will be moved from their current team." This persists until dismissed or the rep is removed from the selection.
- **Team name field:** Validated on submit — cannot be blank. Duplicate name check is server-side; if a duplicate name is returned as an API error, the field shows an inline error.

### InviteAcceptPage

- **Token validation:** Occurs server-side before any content is rendered. While validating: page shows a minimal loading state (spinner centered on white page) — do not flash partial content.
- **Google button:** Standard Google OAuth button treatment. On click: full-page redirect to Google consent screen. No spinner needed — the page navigation is immediate feedback.
- **Email mismatch banner (post-signup):** Shown on the Dashboard after redirect, not on the InviteAcceptPage itself. It is a dismissible informational banner, not a blocking modal. Dismissal state is stored in localStorage (do not re-show on subsequent sessions).

### Role Change Latency Behavior

- When a role is changed, the Admin sees the badge update immediately (optimistic UI).
- The affected member will not see the change until their next page load or manual refresh.
- No in-session invalidation in this iteration. The UI Designer should not add any "force refresh" prompt to the role edit flow — the latency is acceptable per PRD and surfacing it would create unnecessary anxiety.

### Last-Admin Guard

- At the UI level: the "Deactivate" option is removed from the three-dot menu for the only active Admin. The role dropdown for that Admin does not include "Sales Rep" or "Sales Manager" options if they are the sole Admin.
- The guard message, if somehow triggered via a race condition: inline error below the role dropdown: "You are the only Admin. Assign Admin to another member before changing your role."
- This guard fires before any API call — it is a client-side read of the current Admin count from the loaded member list, not a server round-trip (server also enforces it, but UI should prevent the attempt proactively).

---

## Error States

| Scenario | Where It Appears | Message |
|----------|-----------------|---------|
| Invite sent to existing active member | Inline below email field (drawer) | "This email belongs to an active member." |
| Invite sent to email with pending invite | Inline below email field (drawer) | "A pending invite already exists (expires [date]). Resend?" |
| Expired invitation link | InviteErrorPage | "This invitation is no longer valid." + expiry explanation |
| Revoked invitation link | InviteErrorPage | "This invitation is no longer valid." + revocation explanation (same UI, different copy variant) |
| Consumed invitation link | InviteErrorPage variant | "You've already accepted this invitation. Go to dashboard." |
| Mismatched Google email at sign-up | Dashboard informational banner (post-signup) | "Your account was created using [google-email]. Contact your Admin if this is incorrect." |
| Last-Admin demotion attempt | Inline below role dropdown | "You are the only Admin. Assign Admin to another member first." |
| Last-Admin deactivation attempt | Deactivate option absent from menu (prevented, not just blocked) | — |
| API failure on invite send | Error banner inside Invite drawer | "Could not send invitation. Please try again." |
| API failure on role save | Inline error below role dropdown, role badge reverts | "Could not update role. Please try again." |
| API failure on team save | Error banner inside team drawer | "Could not save team. Please try again." |
| Duplicate team name | Inline below team name field | "A team with this name already exists." |
| Network offline during any operation | Toast (persistent until dismissed) | "You appear to be offline. Changes could not be saved." |

---

## Empty States

| Location | Trigger | Empty State Treatment |
|----------|---------|----------------------|
| Members tab — Active Members | Only the Admin is on the roster (no other members invited yet) | Section heading shows "(1)" with Admin row visible; prompt below the table: "Invite your first team member" with inline CTA button |
| Members tab — Pending Invitations | No pending invites exist | Section is hidden entirely (do not show an empty section heading) |
| Teams tab | No teams have been created | Full-page centered empty state illustration with "Create Team" CTA (see wireframe above) |
| Teams tab — Unassigned card | All reps are assigned to teams | Unassigned pseudo-card is hidden entirely |
| Role dropdown in Create Team | No Sales Managers exist yet | Dropdown shows "No managers available. Invite a Sales Manager first." (disabled option, non-selectable) |
| Members multi-select in Create Team | No Sales Reps exist yet | Input shows "No reps available. Invite Sales Reps first." |

---

## Accessibility Considerations

### Keyboard Navigation

- **Members table:** Full keyboard navigation via Tab/Shift+Tab across rows. Three-dot menu opens on Enter or Space when the menu button is focused. Arrow keys navigate menu items. Escape closes the menu and returns focus to the menu button.
- **Inline role edit:** When clicking a role badge activates edit mode, focus is automatically placed on the dropdown. Tab moves focus to the confirm/cancel icons. Escape cancels edit mode and returns focus to the badge.
- **Invite Member drawer:** Focus is trapped within the drawer while open. On open, focus moves to the first field (email). On close (X or Cancel), focus returns to the "Invite Member" button that opened it.
- **Create Team drawer:** Same focus trap pattern as Invite Member drawer.
- **Confirmation modals:** Focus is trapped in the modal. Initial focus on the "Cancel" button (safer default). Escape triggers Cancel.
- **InviteAcceptPage:** Single focusable element (Google button). No keyboard trap needed.

### Screen Reader Labels

- Three-dot menu button: `aria-label="More actions for [Member name]"` — not just "More" or "..."
- Role badge (when clickable): `aria-label="Role: Sales Rep. Click to change."` for Admin users; plain text for non-Admin.
- Revoke button in pending invitations row: `aria-label="Revoke invitation for [email]"` — not just "Revoke."
- Inline confirmation after revoke click: `role="alert"` so screen readers announce the confirmation prompt.
- Avatar stacks: `aria-label="[Name], [Name], and 3 more members"` on the avatar group container.
- Expiry countdown badges: include `aria-live="polite"` on the countdown container so updates are announced without interrupting the user.
- Deactivated row: include `aria-label="[Member name], Deactivated"` on the row's leading element.

### Color-Independent Status Indicators

- Role badges must use both color and a text label — never color alone. "Admin", "Sales Manager", "Sales Rep" must be readable in monochrome.
- Status badges (Active, Pending, Deactivated) must use icons or text suffixes in addition to background color, so they communicate state without relying on hue.
- Expiry countdown warning states (amber at <24h, critical at <1h) must use an icon (e.g., clock or warning triangle) alongside the color change.
- Deactivated member rows use reduced opacity, but the "Deactivated" badge label must remain full contrast (opacity reduction alone is not accessible for status communication).

### Responsiveness Notes

- The Members table compresses to hide lower-priority columns (Team, Invited-on date) on narrow viewports. Name, Role, and three-dot menu are always visible.
- The Teams tab card grid shifts from 2-column to 1-column on narrow viewports.
- The Invite/Create Team drawers occupy full screen width on mobile (same as `CustomerDrawer` pattern).
- The InviteAcceptPage is mobile-first by nature — the rep may open the email on a phone. The layout must center-align cleanly at 375px viewport width with the Google button spanning full width.

---

## UX Handoff Notes for UI Designer

The following visual decisions are deferred to the UI Designer and are explicitly not resolved in this UX Brief:

1. **Role badge colors:** Three distinct, accessible colors are needed for `Admin`, `Sales Manager`, and `Sales Rep` badges. These should be harmonious with the existing `StatusBadge` color system used for customer statuses (`Lead`, `Active`, `Churned`, `Archived`). Recommend extending the existing badge component with three new variants rather than creating a separate component.

2. **Status badge for member states:** Two new status badge variants are needed beyond the existing customer statuses: `Pending` (invitation sent, not accepted) and `Deactivated` (soft-removed member). The visual weight of `Deactivated` should feel clearly different from `Active` — consider muted/grayscale treatment.

3. **Expiry countdown warning and critical states:** The amber (<24h) and urgent (<1h) color treatments for expiry badges need to be defined. These should be consistent with any other "warning" patterns in the design system.

4. **Destructive action button styling:** "Deactivate," "Delete Team," and "Revoke" (confirm) actions require a visually distinct destructive treatment. The existing CRM UI has not yet needed a destructive button variant — this is the first feature to introduce one. Define a consistent destructive button style here and document it in the design system for reuse.

5. **Deactivated row treatment:** The wireframes specify "reduced opacity" for deactivated member rows. The exact opacity level and whether additional visual treatments (e.g., strikethrough on name, grayscale avatar) are used is a visual decision.

6. **Team card design:** The Teams tab uses a card layout not present elsewhere in the CRM. The card needs: a header area (team name), a manager section, a member avatar stack, and an action zone. Reference the existing `MetricCard` for structural inspiration but the layout will need to be distinct.

7. **InviteAcceptPage branding:** This is the first externally-facing page of the CRM — the first thing a new team member sees. The visual treatment should convey professionalism and trust. Consider whether the page uses the same chrome as the `LoginPage` or introduces a welcome-specific layout.

8. **Avatar component:** Member avatars (initials-based or photo) appear throughout the Members table, team cards, and confirmation modals. The existing `avatarPalette.ts` utility can provide color seeds. The UI Designer should define avatar sizes (S/M/L), the stacked avatar overlap style, and the "+N overflow" label.

9. **Three-dot menu icon and popover:** The three-dot (kebab) menu pattern is consistent with existing CRM table rows but may not have been visually defined. Confirm the icon, popover shadow, and item spacing are consistent with any existing menus.

10. **Empty state illustration style:** The empty states for Members tab and Teams tab reference icons (person+, grid). Whether these are icon-only, illustrated, or use a light SVG illustration is a visual design decision that sets the tone for the entire onboarding experience.
