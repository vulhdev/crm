# Test Plan: User & Team Management

**Version:** 1.0
**Date:** 2026-03-15
**Feature:** User & Team Management (Invitation-Based Onboarding, Google SSO Sign-Up, Role Assignment, Team Grouping, Member Management)
**Based on:** PRD v1.0, Tech Brief v1.0, UX Brief v1.0

---

## 1. Scope

### In Scope for This Test Plan

- Invitation lifecycle: creation, email delivery, expiry, revocation, resend
- Google SSO sign-up via invitation link (Case B OAuth callback flow)
- Bootstrap Admin flow on fresh deployment
- Returning user sign-in (Case A OAuth callback flow)
- Role assignment at invite time and post-signup role editing
- Role enforcement: JWT claims, `RolesGuard` server-side, and client-side UI gating
- Last-Admin guard for both demotion and deactivation paths
- Team CRUD: create, rename, edit members/manager, delete
- Member management: display name edit, deactivation, reactivation
- Data integrity: `Users`, `Invitations`, and `Teams` tabs in the platform Google Sheet
- Federated `GET /customers` scoping by role (Sales Rep, Sales Manager, Admin)
- `owner_id` field on new customer rows
- UI/UX fidelity against wireframes, flows, error states, and empty states defined in the UX Brief
- Auth boundary enforcement for all new endpoints
- Security: JWT role claim tampering, token reuse, unauthorized route access

### Out of Scope for This Test Plan

- Per-user spreadsheet migration script (Phase 2 — not shipping in this iteration)
- Email notification on invitation acceptance (deferred feature)
- Bulk CSV invitation upload
- Audit log / timestamped history
- Non-Google auth methods
- Custom role creation
- Sales Rep peer visibility across same-team reps
- Sales Manager write access to reps' records (read-only in this iteration)
- Enterprise SSO / SCIM provisioning
- Granular field-level RBAC

---

## 2. Risk Assessment

| Risk | Likelihood | Severity | Mitigation / Test Focus |
|------|-----------|----------|------------------------|
| Bootstrap Admin misconfiguration locks out first user on a new deployment | Medium | Critical | Dedicated bootstrap test cases; verify `BOOTSTRAP_ADMIN_EMAIL` env var behavior exactly — match, mismatch, unset |
| JWT role claim staleness after role change (up to 4-hour window) | High | High | Verify role changes do not take effect mid-session; verify Admin UI displays latency warning; test that re-login reflects the new role immediately |
| Consumed invitation token can be replayed after sign-up | Medium | High | Token-reuse security test; verify `Consumed` status check on the OAuth callback path |
| Revoked invitation token still accepted by OAuth callback due to status check gap | Medium | High | Test that `Revoked` status blocks the OAuth callback at server level, not only the landing page |
| Last-Admin guard bypassed via concurrent Admin demotion by two sessions | Medium | High | Race-condition scenario in exploratory charter; verify server-side read of active Admin count on every demotion/deactivation call |
| Deactivated user can still complete an in-flight OAuth flow and receive a JWT | Medium | High | Test deactivated-user sign-in path; ensure Case A callback returns HTTP 403 for `status = Deactivated` |
| `invite_token` stripped from OAuth `state` parameter by proxy or firewall | Low | High | Integration test the full OAuth round-trip with `state`; have the copy-link fallback path tested as an alternative |
| Google Sheets concurrent write race condition on `Invitations` tab | Low | Medium | Exploratory charter; accept-risk at team size <50 but document behavior |
| `member_ids` pipe-delimited column corrupted by a name containing the pipe character | Low | Medium | Edge case: team member ID injection via pipe; verify pipe is used as delimiter and input is UUID-only |
| Federated `GET /customers` returns data from wrong rep's spreadsheet to a Sales Rep | Low | Critical | Data scoping integration tests per role; assert Sales Rep receives only rows where `owner_id` matches their CRM user id |
| `PLATFORM_SHEET_ID` env var misconfigured or missing — all team features fail silently | Medium | High | Startup validation test; verify meaningful error on missing env var |
| Email not delivered by Resend — invitation unreachable without copy-link fallback | Medium | Medium | Verify copy-link fallback UI is present and functional when Resend call fails |
| Mismatched Google email at sign-up creates orphan account with wrong email | Medium | Medium | Verify the mismatch banner appears post-signup; verify the account is created with the Google email (not the invited email) |
| Deletion of a team cascades incorrectly to member user rows in `Users` tab | Low | High | Team delete integration test: verify `Users` rows are not modified; verify `team_id` cleared on affected rows |
| Role-gated routes accessible to non-Admin by navigating directly to `/team` URL | High | High | Frontend route guard test; verify redirect to `/` with error toast for Sales Rep and Sales Manager |

---

## 3. Test Scenarios

### Story 1 — Invitation-Based Onboarding

#### S1-01: Happy path — Admin sends a new invitation
- **Given:** Admin is authenticated. No prior invitation exists for `target@example.com`.
- **When:** Admin opens Invite Member drawer, enters `target@example.com`, sets Display Name "Jane Doe", selects role "Sales Rep", and clicks "Send Invite."
- **Then:** Drawer closes. Toast reads "Invitation sent to target@example.com." A new row appears in the Pending Invitations section with status "Pending," the correct expiry (72 h from now), and a "Revoke" action. A new row exists in the `Invitations` tab with `status = Pending`, `expires_at = created_at + 72h`, a 64-character hex token, and `invited_by` matching the Admin's CRM user id.
- **AC Covered:** Story 1 AC 1, 2, 3, 6
- **Risk Level:** Low (happy path, but foundational)

#### S1-02: Duplicate active member — invite blocked
- **Given:** `alice@example.com` is an active member in the `Users` tab.
- **When:** Admin enters `alice@example.com` in the Invite Member drawer.
- **Then:** Within 500 ms of finishing input, an inline error appears below the email field: "This email belongs to an active member." "Send Invite" button remains disabled. No invitation row is written to the `Invitations` tab.
- **AC Covered:** Story 1 AC 4
- **Risk Level:** Medium

#### S1-03: Pending invite already exists — resend offered
- **Given:** `pending@example.com` has a `Pending` invitation in the `Invitations` tab expiring in 1 day 11 hours.
- **When:** Admin enters `pending@example.com` in the Invite Member drawer.
- **Then:** The form transitions to resend state. An amber inline notice displays "A pending invite already exists (expires in 1d 11h)." The Role field is hidden. Buttons shown are "Cancel" and "Resend & Reset Timer." The original "Send Invite" button is not shown.
- **AC Covered:** Story 1 AC 5
- **Risk Level:** Medium

#### S1-04: Admin resends invitation — timer reset
- **Given:** A pending invitation exists for `pending@example.com` (from S1-03 state).
- **When:** Admin clicks "Resend & Reset Timer."
- **Then:** Toast reads "Invitation resent to pending@example.com. New expiry: [date]." In the `Invitations` tab, the old token row is either replaced or marked `Revoked` and a new row is written with a new 64-character token and `expires_at = now + 72h`. The pending invitations list updates the expiry timestamp in place.
- **AC Covered:** Story 1 AC 5
- **Risk Level:** Medium

#### S1-05: Revoke pending invitation
- **Given:** A pending invitation for `target@example.com` exists.
- **When:** Admin clicks "Revoke" on that invitation row, then confirms "Confirm Revoke."
- **Then:** The row fades out and is removed. Toast reads "Invitation to target@example.com has been revoked." In the `Invitations` tab, the row `status` is `Revoked`. The pending count decrements by 1.
- **AC Covered:** Story 1 AC 6, 7
- **Risk Level:** Medium

#### S1-06: Expired token rejected at landing page
- **Given:** An invitation token was created 73 hours ago. Its `expires_at` is in the past. `status` is still `Pending` (passive expiry — no cron flips the status).
- **When:** The invite recipient navigates to `/invite/[token]`.
- **Then:** The InviteErrorPage renders. Heading: "This invitation is no longer valid." No "Sign in with Google" button is shown. A "Contact your Admin" link or email is displayed. No user row is created.
- **AC Covered:** Story 1 AC 7; Story 2 AC 6
- **Risk Level:** High

#### S1-07: Revoked token rejected at landing page
- **Given:** An invitation token with `status = Revoked`.
- **When:** The invite recipient navigates to `/invite/[token]`.
- **Then:** InviteErrorPage renders with the same "no longer valid" message. No sign-in option. No account created.
- **AC Covered:** Story 1 AC 7
- **Risk Level:** High

---

### Story 2 — Google SSO Sign-Up via Invitation Link

#### S2-01: Happy path — rep accepts invitation via Google SSO
- **Given:** A valid `Pending` invitation token exists for `rep-invited@example.com`. Rep has a Google account `rep-google@gmail.com`.
- **When:** Rep navigates to `/invite/[token]`, sees the valid invite page, clicks "Sign in with Google," completes OAuth consent.
- **Then:** OAuth callback creates a new `Users` row with `email = rep-google@gmail.com`, `role` matching the invitation, `status = Active`. The `Invitations` row is updated to `status = Consumed` with `consumed_at` set. A JWT is issued. Rep is redirected to the Dashboard. An informational banner reads "Your account was created using rep-google@gmail.com. Contact your Admin if this is incorrect." The `Users` tab in the platform sheet reflects the new row immediately.
- **AC Covered:** Story 2 AC 1, 2, 3, 4, 7
- **Risk Level:** Critical (core sign-up path)

#### S2-02: Matching email — no mismatch banner shown
- **Given:** A valid `Pending` invitation for `rep@example.com`. Rep signs in with Google account `rep@example.com`.
- **When:** Rep completes the OAuth flow.
- **Then:** Rep is redirected to Dashboard. No email-mismatch banner appears.
- **AC Covered:** Story 2 AC 4
- **Risk Level:** Low

#### S2-03: Consumed token — blocked from re-use
- **Given:** Token `status = Consumed`.
- **When:** The same rep navigates to `/invite/[token]` again.
- **Then:** Page renders the consumed variant: "You've already accepted this invitation." A "Go to dashboard" link appears. No sign-in button. No new `Users` row is created.
- **AC Covered:** Story 2 AC 5
- **Risk Level:** High (token reuse)

#### S2-04: Returning user sign-in (Case A — no invite token)
- **Given:** `rep@example.com` already has an Active row in `Users`.
- **When:** Rep navigates to the standard login page and signs in with Google.
- **Then:** OAuth callback finds the existing `Users` row by `google_id`. JWT is issued with `sub = Users.id` and correct `role`. Rep is redirected to Dashboard.
- **AC Covered:** Story 2 AC 7
- **Risk Level:** Medium

#### S2-05: Deactivated user attempts sign-in
- **Given:** User row exists with `status = Deactivated`.
- **When:** Deactivated user attempts to sign in via Google OAuth (no invite token).
- **Then:** OAuth callback returns HTTP 403. Frontend displays an error message "Account deactivated." No JWT is issued.
- **AC Covered:** Story 5 AC 2
- **Risk Level:** High

#### S2-06: Unknown Google account attempts sign-in without invite
- **Given:** `Users` tab contains no row matching the Google account attempting to sign in. No invite token is in the OAuth state.
- **When:** Unknown user completes Google OAuth.
- **Then:** OAuth callback returns HTTP 403 with message "No account found. Contact your Admin for an invitation." No JWT issued. No `Users` row created.
- **AC Covered:** PRD Scope — self-service sign-up disabled
- **Risk Level:** High

#### S2-07: Invite Accept page renders valid token context
- **Given:** A valid `Pending` invitation exists, created by Admin "Alice Martin" for role "Sales Rep" with display name hint "John."
- **When:** Prospective rep navigates to `/invite/[token]`.
- **Then:** Page shows: CRM logo, "You've been invited to join [Org Name]," "Invited by: Alice Martin (Admin)," "Your role will be: Sales Rep," a single "Sign in with Google" button, the expiry date, and a "Having trouble? Contact [admin-email]" footer. No form fields. No password field.
- **AC Covered:** Story 2 AC 1, 2; UX Brief Flow 4
- **Risk Level:** Medium

#### S2-08: Invite Accept page shows loading state during token validation
- **Given:** Rep navigates to `/invite/[token]`.
- **When:** The frontend issues `GET /invitations/validate/:token` on mount.
- **Then:** A centered spinner renders on a blank white page. No partial content is flashed before the response returns. After the response returns, the correct state (valid or error) is rendered.
- **AC Covered:** UX Brief InviteAcceptPage interaction notes
- **Risk Level:** Low

#### S2-09: Member status updates to Active after successful sign-up
- **Given:** Admin is viewing the Members tab with a "Pending" invitation row for `rep@example.com`.
- **When:** Rep completes Google SSO sign-up.
- **Then:** After a page refresh on the Admin's session, the invitation row has moved from the "Pending Invitations" section. A new Active member row appears in the Active Members section with the correct name, role, and team (if any).
- **AC Covered:** Story 2 AC 8
- **Risk Level:** Medium

---

### Story 3 — Role Assignment

#### S3-01: Role pre-assigned from invitation on sign-up
- **Given:** An invitation was created with `role = Sales Manager`.
- **When:** Invitee completes Google SSO sign-up.
- **Then:** The new `Users` row has `role = Sales Manager`. The JWT issued carries `role = "Sales Manager"`.
- **AC Covered:** Story 3 AC 2
- **Risk Level:** High

#### S3-02: Admin changes a member's role — valid change
- **Given:** Member "Bob Chen" has `role = Sales Rep`.
- **When:** Admin clicks Bob's role badge in the Members table, selects "Sales Manager" from the dropdown, and confirms.
- **Then:** The `Users` tab row is updated to `role = Sales Manager` and `updated_at` is refreshed. The badge updates in place to "Sales Manager." Toast: "Bob Chen's role updated to Sales Manager."
- **AC Covered:** Story 3 AC 3
- **Risk Level:** Medium

#### S3-03: Role change takes effect on next sign-in (JWT staleness)
- **Given:** Bob Chen is signed in with a JWT carrying `role = Sales Rep`. Admin changes Bob's role to "Sales Manager."
- **When:** Bob's current session remains active without a sign-out.
- **Then:** Bob continues to behave as a Sales Rep until his JWT expires (max 4 hours) or he signs out and back in. After sign-in, the new JWT carries `role = Sales Manager`. (Observe: no forced session invalidation occurs.)
- **AC Covered:** Story 3 AC 3; Tech Brief JWT Role Claim section
- **Risk Level:** High (known accepted limitation — verify behavior matches spec)

#### S3-04: Only Admins can access the Team section
- **Given:** A user with `role = Sales Rep` is signed in.
- **When:** The user navigates directly to `/team`.
- **Then:** User is redirected to `/` (Dashboard) with an error toast. The "Team" sidebar item is not visible in the nav.
- **AC Covered:** Story 3 AC 4
- **Risk Level:** High

#### S3-05: Only Admins can access the Team section — Sales Manager
- **Given:** A user with `role = Sales Manager` is signed in.
- **When:** User navigates to `/team`.
- **Then:** Same behavior as S3-04 — redirect to Dashboard, no nav item visible.
- **AC Covered:** Story 3 AC 4
- **Risk Level:** High

#### S3-06: Last-Admin guard — demotion blocked (server-side)
- **Given:** Only one Active Admin exists (user id `admin-1`).
- **When:** `PATCH /users/admin-1` is called with `role = Sales Rep`.
- **Then:** API returns HTTP 422. Body contains a descriptive error. The `Users` row is not modified.
- **AC Covered:** Story 3 AC 7
- **Risk Level:** Critical

#### S3-07: Last-Admin guard — demotion blocked (UI-side)
- **Given:** Only one Active Admin ("Alice Martin") exists and Admin is viewing the Members tab.
- **When:** Admin clicks Alice's role badge.
- **Then:** The role dropdown does not contain "Sales Rep" or "Sales Manager" options. An inline message reads "You are the only Admin. Assign Admin to another member first."
- **AC Covered:** Story 3 AC 7; UX Brief Last-Admin Guard section
- **Risk Level:** High

#### S3-08: Role written to `Users` sheet — not inferred from JWT alone
- **Given:** A member's role is changed via `PATCH /users/:id`.
- **When:** Backend processes the request.
- **Then:** The `Users` tab row reflects the new role. If the JWT for that user still carries the old role (within the 4-hour window), the server-side `RolesGuard` uses the role from the JWT (as designed), not a per-request sheet lookup. After re-sign-in, the new role is read from the `Users` sheet into the new JWT.
- **AC Covered:** Story 3 AC 8, 9; Tech Brief JWT Role Claim section
- **Risk Level:** High

#### S3-09: Sales Rep sees only own customer records
- **Given:** Sales Rep "Bob" (CRM id `user-bob`) is signed in. The platform has customer rows for Bob and for another rep "Dana."
- **When:** Bob calls `GET /customers`.
- **Then:** Only rows where `owner_id = user-bob` are returned. Dana's rows are not present in the response.
- **AC Covered:** Story 3 AC 6
- **Risk Level:** Critical

#### S3-10: Sales Manager sees all team members' customer records
- **Given:** Sales Manager "Carol" oversees Team Alpha (members: Bob, Dana). No teams exist for other reps.
- **When:** Carol calls `GET /customers`.
- **Then:** Rows for Bob and Dana are returned. Rows for reps outside Team Alpha are not returned.
- **AC Covered:** Story 3 AC 5
- **Risk Level:** High

#### S3-11: Admin sees all customer records
- **Given:** Admin is signed in. Multiple reps exist across multiple teams.
- **When:** Admin calls `GET /customers`.
- **Then:** All customer rows across all reps' spreadsheets are returned. No rep's data is excluded.
- **AC Covered:** Story 3 AC 5 (Admin context)
- **Risk Level:** High

#### S3-12: Sales Manager fallback — no teams exist
- **Given:** No teams have been created. Sales Manager "Carol" exists.
- **When:** Carol calls `GET /customers`.
- **Then:** All reps' data is returned (fallback rule per PRD Story 4 AC 7 and Tech Brief).
- **AC Covered:** Story 4 AC 7
- **Risk Level:** Medium

---

### Story 4 — Team Grouping & Assignment

#### S4-01: Happy path — Admin creates a new team
- **Given:** Active Sales Manager "Carol" and active Sales Reps "Bob" and "Dana" exist (unassigned).
- **When:** Admin opens Create Team drawer, enters name "Team Alpha," selects Carol as Manager, selects Bob and Dana as Members, and clicks "Create Team."
- **Then:** Drawer closes. Toast: "Team 'Team Alpha' created." A team card for "Team Alpha" appears on the Teams tab showing Carol as manager and Bob/Dana as members. A new row in the `Teams` tab has `name = Team Alpha`, `manager_id = Carol's user id`, `member_ids = <bob-id>|<dana-id>`. Bob and Dana's `team_id` in `Users` tab is updated to Team Alpha's id.
- **AC Covered:** Story 4 AC 1, 2, 8
- **Risk Level:** Medium

#### S4-02: Sales Rep moved from old team on reassignment
- **Given:** Bob is currently a member of "Team Alpha." A new "Team Beta" is being created.
- **When:** Admin creates Team Beta and includes Bob in the Members field.
- **Then:** Bob's membership in Team Alpha is removed (Bob's id removed from `member_ids` in Team Alpha row). Bob's id appears in Team Beta's `member_ids`. Bob's `team_id` in `Users` tab reflects Team Beta. An inline notice in the drawer while Bob is being selected: "[Bob Chen] will be moved from Team Alpha."
- **AC Covered:** Story 4 AC 3
- **Risk Level:** High

#### S4-03: Sales Manager can oversee multiple teams
- **Given:** Carol is already the manager of Team Alpha.
- **When:** Admin creates Team Beta and assigns Carol as manager.
- **Then:** Both Team Alpha and Team Beta have `manager_id = Carol's user id`. Carol's own `team_id` in `Users` is not affected (managers are not "members" in the same sense as reps).
- **AC Covered:** Story 4 AC 4
- **Risk Level:** Medium

#### S4-04: Admin edits team name and members
- **Given:** Team Alpha exists with Carol as manager and Bob as sole member.
- **When:** Admin opens the Edit Team drawer for Team Alpha, changes the name to "Team Alpha — West," adds Dana to members, and clicks "Save Changes."
- **Then:** Drawer closes. Toast: "Team 'Team Alpha — West' updated." The team card reflects the new name and Dana is shown in the member avatars. `Teams` tab row is updated for both `name` and `member_ids`.
- **AC Covered:** Story 4 AC 1 (rename), 2 (membership edit)
- **Risk Level:** Medium

#### S4-05: Admin deletes a team
- **Given:** Team Alpha exists with 4 members.
- **When:** Admin selects "Delete Team" from the team card, the confirmation modal displays the 4 member avatars and warns they will become unassigned. Admin confirms.
- **Then:** Team card fades out. Toast: "Team 'Team Alpha' deleted. 4 members are now unassigned." The `Teams` tab row is deleted. The 4 rep rows in `Users` have their `team_id` cleared. The reps' accounts are not deactivated or deleted. An "Unassigned (4)" pseudo-card appears on the Teams tab.
- **AC Covered:** Story 4 AC 6
- **Risk Level:** High

#### S4-06: Teams tab empty state
- **Given:** No teams have been created.
- **When:** Admin navigates to the Teams tab.
- **Then:** A full-page centered empty state with the grid/team icon, "No teams created yet," and a "Create Team" primary button is shown. No table or cards are rendered.
- **AC Covered:** UX Brief empty state table
- **Risk Level:** Low

#### S4-07: Manager dropdown shows "No managers available" when none exist
- **Given:** No users with `role = Sales Manager` exist in the `Users` tab.
- **When:** Admin opens the Create Team drawer and clicks the Manager dropdown.
- **Then:** The dropdown shows the disabled option "No managers available. Invite a Sales Manager first." No manager can be selected.
- **AC Covered:** UX Brief empty states
- **Risk Level:** Low

---

### Story 5 — Member Management

#### S5-01: Admin edits member display name
- **Given:** Member "Bob Chen" exists.
- **When:** Admin clicks Bob's display name in the Members table, edits to "Robert Chen," and presses Enter.
- **Then:** The name updates in place to "Robert Chen." Toast: "Profile updated." The `Users` tab row shows `first_name = Robert`, `updated_at` refreshed.
- **AC Covered:** Story 5 AC 1
- **Risk Level:** Low

#### S5-02: Admin deactivates a member
- **Given:** Member "Bob Chen" is Active and has customer records.
- **When:** Admin clicks three-dot menu for Bob, selects "Deactivate," and confirms in the modal.
- **Then:** Bob's row in the Members table grays out and shows "Deactivated" badge. Menu now shows "Reactivate" instead of "Deactivate." Toast: "Bob Chen has been deactivated." `Users` tab row has `status = Deactivated`. Bob cannot sign in (S2-05 verified separately). Bob's customer records remain accessible to Admins and Bob's team's Sales Manager.
- **AC Covered:** Story 5 AC 2, 3, 4
- **Risk Level:** High

#### S5-03: Deactivated member excluded from dropdowns
- **Given:** Bob Chen is deactivated.
- **When:** Admin opens the Create Team drawer or Invite drawer.
- **Then:** Bob does not appear in the Members multi-select in the Create Team drawer. Bob does not affect active-member counts. The Invite drawer does not flag Bob's email as an "existing active member."
- **AC Covered:** Story 5 AC 4
- **Risk Level:** Medium

#### S5-04: Admin reactivates a member
- **Given:** Bob Chen is deactivated.
- **When:** Admin selects "Reactivate" from Bob's three-dot menu.
- **Then:** No confirmation dialog appears. Bob's row updates immediately to Active styling. "Deactivated" badge is replaced by "Active" (or equivalent). Menu reverts to standard options. Toast: "Bob Chen has been reactivated." `Users` tab row has `status = Active`, `updated_at` refreshed.
- **AC Covered:** Story 5 AC 4; UX Brief Flow 12
- **Risk Level:** Low

#### S5-05: Last-Admin guard — deactivation option hidden in UI
- **Given:** Only one Active Admin ("Alice Martin") exists. Alice is viewing her own row or another Admin is viewing Alice's row.
- **When:** User opens the three-dot menu for Alice.
- **Then:** The "Deactivate" option is absent from the menu — it does not appear at all (not disabled, not greyed out).
- **AC Covered:** Story 5 AC 6; UX Brief Last-Admin Guard section
- **Risk Level:** Critical

#### S5-06: Last-Admin guard — deactivation blocked server-side
- **Given:** Only one Active Admin exists.
- **When:** `PATCH /users/:id/deactivate` is called for that Admin's user id.
- **Then:** API returns HTTP 422 with a descriptive error. `Users` row is not modified.
- **AC Covered:** Story 5 AC 6
- **Risk Level:** Critical

#### S5-07: Hard delete is not available
- **Given:** Any member exists.
- **When:** Admin inspects the three-dot menu and the API.
- **Then:** No "Delete" option appears in the UI. `DELETE /users/:id` endpoint does not exist (or returns 404/405). Deactivation is the only removal action available.
- **AC Covered:** Story 5 AC 5
- **Risk Level:** Medium

---

### Bootstrap Admin Flow

#### S6-01: First sign-in on empty `Users` tab — matching BOOTSTRAP_ADMIN_EMAIL
- **Given:** `Users` tab is empty. `BOOTSTRAP_ADMIN_EMAIL = alice@example.com`. User signs in with Google account `alice@example.com`.
- **When:** OAuth callback fires with no invite token.
- **Then:** A new `Users` row is created with `role = Admin`, `status = Active`. JWT is issued. Alice is redirected to the Dashboard as Admin. The Team nav item is visible.
- **AC Covered:** Tech Brief Bootstrap Admin section
- **Risk Level:** Critical

#### S6-02: First sign-in on empty `Users` tab — non-matching email
- **Given:** `Users` tab is empty. `BOOTSTRAP_ADMIN_EMAIL = alice@example.com`. User signs in with Google account `bob@example.com`.
- **When:** OAuth callback fires.
- **Then:** HTTP 403 is returned. A message directs the user to contact the system owner. No `Users` row is created.
- **AC Covered:** Tech Brief Bootstrap Admin section
- **Risk Level:** Critical

#### S6-03: BOOTSTRAP_ADMIN_EMAIL has no effect once Users tab is populated
- **Given:** At least one Admin row exists in `Users`. `BOOTSTRAP_ADMIN_EMAIL` is still set.
- **When:** A new, uninvited Google account signs in.
- **Then:** The bootstrap path is not triggered. Case A (returning user) logic runs. HTTP 403 is returned because no matching `Users` row exists.
- **AC Covered:** Tech Brief Bootstrap Admin section
- **Risk Level:** High

---

## 4. Security Test Cases

### SEC-01: JWT role claim tampering — privilege escalation attempt
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Authenticate as a Sales Rep and capture the JWT. | JWT received. | |
| 2 | Decode the JWT payload. Manually modify `role` from `"Sales Rep"` to `"Admin"`. | Payload modified client-side. | |
| 3 | Re-sign or use the tampered token (without the JWT secret it cannot be re-signed). | Token signature is invalid. | |
| 4 | Send `GET /team` (Admin-only endpoint) with the tampered token in the `Authorization` header. | API returns HTTP 401 (invalid signature) or HTTP 403 (role mismatch). No Admin data is returned. | |

### SEC-02: Invitation token reuse after consumption
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Accept a valid invitation and complete Google SSO sign-up. Token is now `Consumed`. | Account created, JWT issued. | |
| 2 | Navigate to `/invite/[same-token]`. | Page renders consumed state: "You've already accepted this invitation." No sign-in button. | |
| 3 | Attempt `GET /invitations/validate/[same-token]` directly. | Returns `{ valid: false, reason: "consumed" }`. | |
| 4 | Attempt to initiate OAuth with `GET /auth/google?invite_token=[same-token]`. | OAuth callback validates token, finds `Consumed`, redirects to `/invite/error?reason=consumed`. No new `Users` row created. | |

### SEC-03: Unauthorized access — Sales Rep directly calls Admin endpoint
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Sign in as Sales Rep. Capture the valid JWT. | JWT with `role = "Sales Rep"`. | |
| 2 | `POST /invitations` with valid body, Bearer token in header. | HTTP 403 Forbidden. No invitation created. | |
| 3 | `GET /users` with Bearer token. | HTTP 403 Forbidden. | |
| 4 | `PATCH /users/:id/deactivate` with a valid user id. | HTTP 403 Forbidden. | |
| 5 | `POST /teams` with valid body. | HTTP 403 Forbidden. | |
| 6 | `DELETE /teams/:id` with a valid team id. | HTTP 403 Forbidden. | |

### SEC-04: Unauthenticated access to protected endpoints
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Call `GET /customers` with no Authorization header. | HTTP 401 Unauthorized. | |
| 2 | Call `POST /invitations` with no Authorization header. | HTTP 401 Unauthorized. | |
| 3 | Call `GET /users` with no Authorization header. | HTTP 401 Unauthorized. | |
| 4 | Call `GET /invitations/validate/:token` with no Authorization header. | HTTP 200 (this endpoint is public). Response contains token validity data. | |
| 5 | Navigate to `/invite/[token]` in browser with no CRM session. | Page renders normally (public route). | |

### SEC-05: Sales Manager cannot write to another rep's customer record
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Sign in as Sales Manager Carol. | JWT with `role = "Sales Manager"`. | |
| 2 | `PATCH /customers/:id` where `:id` belongs to a customer owned by rep Bob. | HTTP 403 Forbidden. Record not modified. | |

### SEC-06: Sales Rep cannot read another rep's customer record
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Sign in as Sales Rep Bob. | JWT with `role = "Sales Rep"`. | |
| 2 | `GET /customers` — verify response contains only Bob's `owner_id` rows. | No rows with a different `owner_id` are returned. | |
| 3 | Attempt `GET /customers/:id` where `:id` belongs to Dana's record. | HTTP 403 Forbidden or 404. Record not returned. | |

### SEC-07: Expired JWT rejected
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Obtain a valid JWT. Wait until the 4-hour expiry window has passed (or use a test-issued short-TTL token). | JWT is expired. | |
| 2 | Call `GET /customers` with the expired JWT. | HTTP 401 Unauthorized. | |

### SEC-08: Revoked invitation token — OAuth callback path rejected
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Admin revokes an invitation for `target@example.com`. Token `status = Revoked`. | Revocation confirmed. | |
| 2 | Construct the OAuth initiation URL: `GET /auth/google?invite_token=[revoked-token]`. Open in browser. | OAuth flow initiates. | |
| 3 | Complete Google consent. | OAuth callback validates token, finds `Revoked`, redirects to `/invite/error?reason=revoked`. No `Users` row created. | |

---

## 5. Integration Test Cases

### INT-01: `Users` tab read and write on sign-up
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Complete Google SSO sign-up via a valid invitation. | | |
| 2 | Open the platform Google Sheet, navigate to the `Users` tab. | A new row exists with all 10 columns populated: `id` (UUID), `google_id`, `email`, `first_name`, `last_name`, `role`, `status = Active`, `team_id` (empty), `created_at`, `updated_at`. | |
| 3 | Verify `id` is a valid UUID (not empty, not the Google id). | The `sub` claim in the issued JWT matches `Users.id`. | |

### INT-02: `Invitations` tab write on invite creation
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Admin sends an invitation via `POST /invitations`. | HTTP 201. | |
| 2 | Inspect the `Invitations` tab in the platform sheet. | A new row with all 9 columns: `token` (64-char hex), `email`, `role`, `invited_by`, `first_name`, `status = Pending`, `created_at`, `expires_at` (exactly 72h after `created_at`), `consumed_at` (empty). | |

### INT-03: `Invitations` tab — token consumed on sign-up
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Invitee completes Google SSO sign-up. | | |
| 2 | Inspect the `Invitations` tab row for that token. | `status = Consumed`, `consumed_at` is set to the ISO timestamp of sign-up completion. | |

### INT-04: `Invitations` tab — token revoked
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Admin revokes a pending invitation. | | |
| 2 | Inspect the `Invitations` tab row. | `status = Revoked`. The row is not deleted. `consumed_at` remains empty. | |

### INT-05: `Teams` tab write on team creation
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Admin creates a team named "Team Alpha" with manager Carol and members Bob, Dana. | HTTP 201. | |
| 2 | Inspect the `Teams` tab. | New row: `id` (UUID), `name = Team Alpha`, `manager_id = Carol's CRM id`, `member_ids = <bob-id>|<dana-id>`, `created_at`, `updated_at`. | |
| 3 | Inspect the `Users` tab for Bob and Dana. | Both rows have `team_id` updated to Team Alpha's id. | |

### INT-06: `Teams` tab write on team deletion
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Admin deletes "Team Alpha." | HTTP 200. | |
| 2 | Inspect the `Teams` tab. | Team Alpha row is removed (or marked deleted, per implementation). | |
| 3 | Inspect `Users` rows for Bob and Dana. | `team_id` is cleared/empty for both. Rows are not deleted. `status` is unchanged. | |

### INT-07: `Users` tab update on deactivation and reactivation
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Admin deactivates Bob. | HTTP 200. | |
| 2 | Inspect `Users` tab for Bob. | `status = Deactivated`, `updated_at` refreshed. | |
| 3 | Admin reactivates Bob. | HTTP 200. | |
| 4 | Inspect `Users` tab for Bob. | `status = Active`, `updated_at` refreshed again. | |

### INT-08: `owner_id` set on new customer rows
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Sign in as Sales Rep Bob (CRM id `user-bob`). | JWT with `sub = user-bob`. | |
| 2 | `POST /customers` with a new customer payload. | HTTP 201. | |
| 3 | Inspect the new row in Bob's customer spreadsheet. | `owner_id = user-bob` in the new column. | |

### INT-09: Passive expiry — expired token treated as invalid at read time
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Locate an `Invitations` row where `expires_at < now` and `status = Pending` (no cron job has run). | Row exists. | |
| 2 | Call `GET /invitations/validate/[token]`. | Returns `{ valid: false, reason: "expired" }`. Backend does not require the status column to be `Expired` — it computes effective expiry from the timestamp. | |

### INT-10: Platform sheet access uses Service Account credentials
| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Review backend logs or add a trace during a `Users` tab read/write. | The `google.auth.GoogleAuth` service account credentials are used, not any user's OAuth token. | |
| 2 | Call `GET /users` as Admin. | Response returns without requiring any user's OAuth refresh token to be present. | |

---

## 6. UI/UX Acceptance Checks

### UX-01: Team section not visible to non-Admin roles
| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Sign in as Sales Rep — inspect sidebar navigation | "Team" nav item is absent | |
| Sign in as Sales Manager — inspect sidebar navigation | "Team" nav item is absent | |
| Sign in as Admin — inspect sidebar navigation | "Team" nav item is visible | |

### UX-02: Members tab default state
| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Admin navigates to `/team` | Members tab is shown by default without any manual tab selection | |
| Active members section is visible with member count | Count matches active `Users` rows | |
| Pending Invitations section is visible | Count matches `Pending` rows in `Invitations` tab | |
| Pending Invitations section is hidden when no pending invites exist | Section does not render (no empty section heading) | |
| Deactivated members appear at the bottom of Active Members section with Deactivated badge | Members with `status = Deactivated` are visually distinct at reduced opacity | |

### UX-03: Members tab empty state
| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Newly bootstrapped org — Admin is the only user, no one else invited | The Admin's own row is shown; a prompt below the table reads "Invite your first team member" with CTA button | |

### UX-04: Expiry countdown warning states
| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Pending invitation expiring in 25 hours | Countdown badge in normal/neutral state | |
| Pending invitation expiring in 20 hours | Countdown badge shifts to amber/warning state | |
| Pending invitation expiring in 45 minutes | Countdown badge shifts to critical/urgent state with warning icon | |

### UX-05: Invite Member drawer behavior
| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| "Send Invite" button is disabled until email and role are populated | Button is in disabled state before both required fields are filled | |
| Role hint text below role dropdown updates when role selection changes | Hint reflects the access level for the selected role | |
| Closing the drawer with partially filled form (X or Escape) | No confirmation prompt; form state is discarded; no invite is sent | |
| API error on invite send | Button returns to active state; error banner appears inside drawer | |
| Drawer opens from "Invite Member" button; closes; focus returns to "Invite Member" button | Focus management is correct | |

### UX-06: Role inline edit behavior
| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Clicking a role badge in the Members table (as Admin) | Dropdown replaces badge; focus is set to dropdown immediately | |
| Pressing Escape during inline role edit | Edit cancelled; original badge restored; no API call made | |
| Pressing Enter to confirm role change | API call made; spinner replaces badge during save; badge updates on success | |
| API failure on role save | Badge reverts to original; inline error "Could not update role. Please try again." | |

### UX-07: Deactivate Member confirmation modal
| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Modal body mentions the member's name and team name | Dynamic content correct | |
| If member is unassigned, modal omits team reference | "Her customer records will remain accessible to Admins." | |
| Initial modal focus is on "Cancel" button | Focus lands on Cancel, not Deactivate | |
| Escape key dismisses modal | Modal closes; no deactivation occurs | |

### UX-08: Delete Team confirmation modal
| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Modal shows up to 5 member avatars plus overflow count | Correct member avatars displayed | |
| "Members are not deleted" copy is present | Warning copy accurate | |
| Initial modal focus is on "Cancel" | Focus lands on Cancel, not Delete Team | |

### UX-09: Create / Edit Team drawer behavior
| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Manager dropdown lists only active Sales Managers | No Sales Reps or Admins in the manager dropdown | |
| Members multi-select lists only active Sales Reps | No managers or Admins in the members multi-select | |
| Reps currently on another team show "(currently in [Team Name])" label | Label present for already-assigned reps | |
| Drawer title changes to "Edit Team" and CTA to "Save Changes" in edit mode | Edit mode header and button correct | |
| Inline notice shown if selected rep(s) will be moved from another team | Passive notice text: "[N] rep(s) will be moved from their current team." | |

### UX-10: InviteAcceptPage interaction
| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| No sidebar, no nav — standalone centered layout | Full-page layout with no CRM chrome | |
| Loading spinner shows while token is being validated | No partial content flashed before API response | |
| Google button is the only interactive element on valid invite page | No email/password form fields present | |
| Expiry date is displayed in a readable format | Example: "March 17, 2026 at 3:00 PM" | |
| Layout renders cleanly at 375px viewport width | No overflow, no truncated elements on mobile | |

### UX-11: InviteErrorPage states
| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Expired token → error page shows expiry explanation | Copy references 72-hour validity window | |
| Revoked token → error page shows revocation explanation | Copy references Admin revocation | |
| Consumed token → distinct message: "You've already accepted this invitation." | "Go to dashboard" link present, no sign-in button | |
| "Already have an account? Sign in here" link goes to LoginPage | Link navigates to login | |
| No "Try again" or "Request new invite" self-service option | Neither option is present | |

### UX-12: Email mismatch banner on Dashboard
| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Sign up with Google account different from invite email | Informational banner appears at top of Dashboard | |
| Banner message includes the actual Google email used | Dynamic email address shown | |
| Banner can be dismissed | Dismiss action works | |
| After dismissal, banner does not re-appear on page refresh | Dismissed state persisted in localStorage | |
| Banner is not a blocking modal | Dashboard is fully usable while banner is visible | |

### UX-13: Accessibility checks
| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Three-dot menu button aria-label includes member name | `aria-label="More actions for [Member name]"` | |
| Revoke button aria-label includes email | `aria-label="Revoke invitation for [email]"` | |
| Inline confirmation after revoke click announces to screen reader | `role="alert"` on the inline confirmation element | |
| Role badges use text labels, not color alone | "Admin", "Sales Manager", "Sales Rep" text always present | |
| Status badges use text or icon in addition to color | Badge label always present; color is supplementary | |
| Expiry countdown uses `aria-live="polite"` | Screen reader announces countdown updates without interrupting | |
| Deactivated row label includes "Deactivated" | `aria-label` on row's leading element includes member name and status | |
| Confirmation modals trap focus | Tab key cycles within modal; focus does not escape | |
| Invite Member drawer traps focus | Tab key cycles within drawer | |

---

## 7. Edge Case Catalogue

| Case | Input / State | Expected Behavior |
|------|--------------|-------------------|
| Email field with leading/trailing whitespace in invite form | `" john@example.com "` | Backend trims whitespace before processing; invitation created for `john@example.com` |
| Invite email is the same as `BOOTSTRAP_ADMIN_EMAIL` | Admin invites their own bootstrap email | Backend creates a second `Pending` invitation; if Admin is already Active in `Users` tab, the duplicate-active-member check fires instead |
| Team name with special characters | `"Team <Alpha> & West"` | Stored and displayed as literal text; no XSS execution |
| Team name that is blank | `""` or whitespace only | `POST /teams` returns HTTP 422; "Team name is required" inline error in drawer |
| Duplicate team name | A second team named "Team Alpha" already exists | `POST /teams` returns HTTP 422; inline error "A team with this name already exists" |
| Member display name with special characters | `<script>alert(1)</script>` | Stored as literal text; displayed escaped; no script execution |
| Member display name edited to blank | Admin clears name field and confirms | Validation: name must not be blank; save is blocked; inline validation error |
| `member_ids` in Teams tab with a CRM user id containing a pipe character | Malformed UUID in `member_ids` | CRM user ids are UUIDs (hex + hyphens only) — no pipe possible; validate UUID format on write |
| Sales Manager with no assigned teams calls `GET /customers` | Manager exists but has no `team_id` assignments | Fallback applies: returns all reps' data per PRD Story 4 AC 7 |
| Admin calls `GET /customers` when no reps have SA-owned spreadsheets yet (migration Phase 1) | All existing users still have `sheet_ownership = user` | During Phase 1, federated read only covers SA-owned sheets; response may be empty for existing users — this is documented Phase 1 behavior |
| Invitation sent to an address with a consumed invitation | Token is `Consumed` (not `Pending`) | Duplicate check only fires for `Pending` invitations; a new invitation can be sent |
| Admin attempts to invite themselves | Admin's own email entered in invite drawer | Inline error: "This email belongs to an active member." No invitation created |
| Token URL opened in a private/incognito window | Valid token, user has no existing session | Page renders the invite acceptance UI normally; no session required to view the page |
| Rep clicks invite link and declines Google OAuth consent | OAuth consent declined by user | OAuth callback receives an error from Google; rep is redirected back to the invite page (or an error page); no `Users` row is created |
| Two Admins simultaneously try to deactivate the second-to-last Admin | Race condition on last-Admin guard | Server reads active Admin count before proceeding; one request succeeds, the other returns HTTP 422 — accept the risk at this scale; document it |
| `RESEND_API_KEY` is missing or Resend call fails | Email not delivered | Copy-link fallback: invitation token/link is shown in the API response and surfaced in the Admin UI so the Admin can share it manually; toast or error banner informs Admin of the email failure |
| Network offline during invite send | Browser has no connectivity | Persistent "You appear to be offline" toast shown; drawer button returns to active state; no partial invite created |
| Invitation email CTA link contains a non-hex character (URL encoding issue) | `%20` or other encoded character in token | Token validation fails gracefully; InviteErrorPage renders; no crash |
| `PLATFORM_SHEET_ID` is set but the `Users` tab does not exist | Misconfiguration | API startup or first request returns a meaningful error; application does not silently continue with undefined behavior |
| Admin adds more than 20 members to a single team | Large `member_ids` pipe-delimited string | Operation succeeds; note in documentation that >20 members will prompt reconsideration of data model |
| Sales Rep's customer spreadsheet has rows with empty `owner_id` (pre-migration) | Legacy rows before `owner_id` column was added | Server-side scoping does not crash; rows with empty `owner_id` are excluded from Sales Rep's own view (they cannot be attributed) or returned with a warning — specify expected behavior clearly before shipping |

---

## 8. Exploratory Testing Charters

### Charter 1: Invitation Token Lifecycle End-to-End
- **Goal:** Probe the full token lifecycle — creation, landing page rendering, OAuth round-trip, consumption, attempted reuse — looking for state inconsistencies, partial account creation, or token leakage.
- **Time-box:** 45 minutes
- **Heuristics:**
  - Create an invitation and immediately try to use it before the email arrives (copy the token from the Admin UI link fallback).
  - Accept the invitation and then try all four error-path URLs: expired, revoked, consumed, and a completely fabricated 64-char hex string.
  - Rapid-fire: open the invitation link in two browser tabs simultaneously and click "Sign in with Google" in both. Check whether two `Users` rows are created.
  - Verify the copy-link fallback is functional when Resend API is not configured.

### Charter 2: Role Enforcement Boundary Probing
- **Goal:** Verify that server-side role enforcement is the authoritative check by probing every role-gated endpoint with incorrect role JWTs.
- **Time-box:** 30 minutes
- **Heuristics:**
  - Use all three roles (Admin, Sales Manager, Sales Rep) against every new endpoint and record which return 403 vs. 200.
  - Attempt `PATCH /users/:id` as Sales Manager — should be 403.
  - Attempt `GET /users` as Sales Rep — should be 403.
  - Attempt `DELETE /teams/:id` as Sales Manager — should be 403.
  - Change a user's role via the Admin UI and immediately (without the affected user signing out) probe the affected endpoints again from the old session — verify stale JWT behavior matches the documented 4-hour window.

### Charter 3: Last-Admin Guard Under Pressure
- **Goal:** Attempt to reach a zero-Admin state through every available path and verify the guard holds at every layer.
- **Time-box:** 30 minutes
- **Heuristics:**
  - Scenario A: only one Admin — try to demote via role edit UI.
  - Scenario B: only one Admin — try to deactivate via UI.
  - Scenario C: only one Admin — call `PATCH /users/:id` and `PATCH /users/:id/deactivate` directly via API with a valid Admin JWT.
  - Scenario D: two Admins — demote one to Sales Manager, then try to demote the last.
  - Scenario E: two Admins — deactivate one, then try to deactivate the other.
  - At every step, verify the `Users` tab still has at least one Active Admin row.

### Charter 4: Google Sheets Data Integrity
- **Goal:** Observe direct sheet reads and writes during Team Management operations to identify data loss, corruption, or race condition artifacts.
- **Time-box:** 45 minutes
- **Heuristics:**
  - After every write operation, open the platform sheet directly and verify the row content against the API response.
  - Create, edit, and delete a team in rapid sequence — verify no orphan rows.
  - Send multiple invitations in quick succession — verify each gets a unique token row.
  - Deactivate and immediately reactivate a user — verify `status` and `updated_at` are correct after both operations.
  - Check that `member_ids` in the `Teams` tab correctly reflects reassignments (old team loses the id, new team gains it).

### Charter 5: Federated Customer Data Scoping
- **Goal:** Verify that `GET /customers` returns exactly the right set of records for each role and that no data leaks across role boundaries.
- **Time-box:** 45 minutes
- **Heuristics:**
  - Set up: Admin, one Sales Manager (Carol) overseeing Team Alpha (Bob, Dana), one Sales Manager (Eve) overseeing Team Beta (Frank), one unassigned rep (Gary).
  - As Bob: verify only Bob's customer records are returned.
  - As Carol: verify Bob's and Dana's records are returned, but not Frank's or Gary's.
  - As Eve: verify Frank's records are returned, but not Bob's or Dana's.
  - As Admin: verify all records across all reps are returned.
  - Reassign Dana from Team Alpha to Team Beta. Verify Carol no longer sees Dana's records; Eve now sees them.
  - Deactivate Bob. Verify Carol no longer sees Bob in active contexts, but Bob's customer records are still visible to Carol (per PRD AC — records remain accessible).

### Charter 6: InviteAcceptPage at Viewport Extremes
- **Goal:** Verify the first-impression page for new reps renders correctly across device sizes and under slow network conditions.
- **Time-box:** 20 minutes
- **Heuristics:**
  - Test at 375px (mobile), 768px (tablet), 1280px (desktop) viewport widths.
  - Use browser devtools to throttle network to "Slow 3G" — verify loading spinner is shown and no blank flash occurs.
  - Test with a valid token and an invalid token on each viewport.
  - Verify the Google button is full-width on mobile and spans acceptably on desktop.
  - Confirm no horizontal scrollbar appears at 375px.

### Charter 7: Accessibility and Keyboard Navigation
- **Goal:** Verify the Members tab, drawers, and modals are fully operable without a mouse.
- **Time-box:** 30 minutes
- **Heuristics:**
  - Tab through the entire Members table — verify logical tab order.
  - Open a three-dot menu via keyboard (Enter/Space on focused menu button), navigate items with arrow keys, close with Escape.
  - Open the Invite Member drawer via keyboard, fill fields, submit, and close — verify focus trap and focus return.
  - Open the Deactivate confirmation modal — verify initial focus is on Cancel, Escape dismisses.
  - Verify screen reader announces the inline revoke confirmation with `role="alert"`.

---

## 9. Regression Checklist

The following existing features must be re-verified after this change ships, as they are directly affected by the architectural changes (Service Account ownership, JWT payload change, `GET /customers` scoping, `owner_id` column addition).

- [ ] **Existing user sign-in (Google OAuth):** Users who signed in before this feature must still be able to sign in. Case A callback flow must correctly handle both SA-owned and user-owned spreadsheets during Phase 1 parallel operation.
- [ ] **Customer list (`GET /customers`):** Existing Sales Rep accounts with existing customer rows should see their own data after the role-scoping change is applied. Verify rows with empty `owner_id` do not cause crashes or unexpected filtering.
- [ ] **Add customer (`POST /customers`):** New customer rows must now include `owner_id`. Verify existing rows without `owner_id` still load without error.
- [ ] **Update customer (`PATCH /customers/:id`):** Verify the ownership check does not break updates for legitimate owners. Verify the endpoint remains inaccessible to unauthenticated users.
- [ ] **JWT structure:** The `accessToken` and `refreshToken` fields have been removed from the JWT payload and `sub` now carries a CRM UUID instead of a Google id. Verify any frontend code reading these fields from the JWT does not break (Zustand auth store, any token-decode logic).
- [ ] **Sidebar navigation:** Verify the existing Dashboard, Contacts, and Pipeline items remain visible and functional for all roles. The Team item is new and Admin-only.
- [ ] **OAuth redirect and callback flow:** The `state` parameter is now used to pass `invite_token`. Verify that the standard sign-in flow (no invite token) correctly passes through `state` as empty or null without breaking the callback.
- [ ] **Zustand auth store:** The `role` and `userId` fields are new. Verify the store initializes correctly for existing stored JWTs that predate these fields (graceful degradation — treat missing `role` as lowest privilege or redirect to login).
- [ ] **`DriveService` for new user sign-ups:** New users (invited) get their customer spreadsheet provisioned by the Service Account. Verify `DriveService` correctly creates SA-owned spreadsheets for new sign-ups without depending on user OAuth tokens.
- [ ] **Environment variable validation on startup:** The addition of `PLATFORM_SHEET_ID`, `BOOTSTRAP_ADMIN_EMAIL`, `RESEND_API_KEY`, and `RESEND_FROM_ADDRESS` should not cause startup failures if they are provided; missing required vars (`PLATFORM_SHEET_ID`) should fail loudly.

---

## 10. Quality Exit Criteria

The following conditions must all be met before the User & Team Management feature is considered ready to ship.

### Functional Exit Criteria
- [ ] All acceptance criteria for Stories 1–5 have a corresponding passing test case documented in this plan (or a recorded manual verification).
- [ ] Bootstrap Admin flow (S6-01, S6-02, S6-03) passes on a clean deployment with an empty `Users` tab.
- [ ] The invitation lifecycle (create → deliver → accept → consume) completes end-to-end without any manual data correction.
- [ ] Revocation and expiry both block OAuth completion at the server level (not only at the landing page).
- [ ] The last-Admin guard blocks all paths to a zero-Admin state at both UI and API levels.

### Security Exit Criteria
- [ ] All Security Test Cases (SEC-01 through SEC-08) pass.
- [ ] No role-gated endpoint returns data to a lower-privileged caller under any tested condition.
- [ ] A consumed, revoked, or expired invitation token cannot be used to create a new user account via any path (direct API, OAuth state parameter, fabricated request).

### Data Integrity Exit Criteria
- [ ] All Integration Test Cases (INT-01 through INT-10) pass against the live platform Google Sheet.
- [ ] No operation produces orphan rows or inconsistent state across `Users`, `Invitations`, and `Teams` tabs.
- [ ] Team deletion clears `team_id` on affected `Users` rows without deleting or deactivating those rows.
- [ ] `owner_id` is correctly set on all new customer rows created after this feature ships.

### UX Exit Criteria
- [ ] All UI/UX Acceptance Checks (UX-01 through UX-13) pass against the implemented frontend.
- [ ] InviteAcceptPage renders without errors at 375px viewport width.
- [ ] All error messages match the exact copy specified in the UX Brief error states table.
- [ ] All empty states (Members tab, Teams tab, Manager dropdown, Members multi-select) render correctly when their triggering conditions are met.
- [ ] Keyboard navigation and focus management pass the Charter 7 accessibility exploratory session with no P0 findings.

### Regression Exit Criteria
- [ ] All items in the Regression Checklist above are verified as passing.
- [ ] No P0 or P1 bugs are open against existing features (customer list, customer add/edit, OAuth sign-in).

### Bug Severity Gate
- [ ] Zero P0 bugs open (system unusable, data loss, security breach, complete auth failure).
- [ ] Zero P1 bugs open (core user flow broken: cannot send invite, cannot accept invite, cannot sign in, role enforcement bypassed).
- [ ] P2 bugs (degraded experience, UI inconsistency, non-critical error message mismatch) are documented and triaged; none block ship unless volume exceeds 5 open items.

---

*Test Plan authored by QA Analyst. For questions or scenario gaps, contact the Product Owner (PRD) or Product Designer (UX Brief).*
