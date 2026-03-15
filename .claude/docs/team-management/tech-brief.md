# Tech Brief: User & Team Management

**Version:** 1.0
**Date:** 2026-03-15
**Status:** Draft

---

## Architecture Overview

This feature touches every layer of the monorepo and represents the most structurally significant change since the platform was created. The impact is as follows:

- **`packages/types`** — new shared interfaces for `CrmUser`, `Team`, `Invitation`, updated `JwtPayload` with `role` and `userId` claims
- **`apps/api`** — new `UsersModule`, `TeamsModule`, `InvitationsModule`; changes to `AuthModule` (Google callback, JWT signing); new `RolesGuard`; new `AdminSheetsService` that uses the Service Account instead of per-user OAuth tokens; changes to `CustomersController` to enforce data-scoping by role
- **`apps/web`** — new Team Management section (Admin only); invite acceptance page; role-aware route guards; updated Zustand auth store to carry role claim

### Architectural Decision: Shared vs. Per-User Sheets

**Decision: Migrate to a single Service-Account-owned spreadsheet as the platform's shared database, plus per-user customer spreadsheets owned by the Service Account.**

The current model — where each user's customer data lives in a spreadsheet provisioned under their personal Google Drive using their OAuth token — does not scale to multi-user access. A Sales Manager cannot read a rep's spreadsheet because the rep's OAuth token is not available to the manager's session.

The resolution is:

1. **A single platform-level spreadsheet** (the "platform sheet") is created once, owned and accessed exclusively via the Service Account. It holds three tabs: `Users`, `Teams`, and `Invitations`. This spreadsheet is identified by a new environment variable `PLATFORM_SHEET_ID`.

2. **Per-user customer spreadsheets** continue to exist, but they are provisioned and owned by the Service Account (not the user's personal Drive). The Service Account creates the spreadsheet on first login and retains write access. Users lose direct Drive access to their own sheets — all CRM reads and writes go through the API. `DriveService` is updated to use the Service Account auth client rather than the user's OAuth token.

3. **Data-scoping is enforced server-side**: when a Sales Manager or Admin calls `GET /customers`, the backend federates reads across the spreadsheets of all reps in scope, using the Service Account credential.

This approach:
- Removes the dependency on per-user OAuth tokens for Drive/Sheets operations, eliminating the need to store `accessToken`/`refreshToken` in the JWT
- Gives the Service Account consistent, durable access to all data regardless of whether a user's OAuth token has expired
- Requires a one-time migration of existing per-user spreadsheets to Service Account ownership (see Migration Path section)

---

## API Design

### New Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/invitations` | Create and send a new invitation | JWT (Admin only) |
| GET | `/invitations` | List all pending/expired invitations | JWT (Admin only) |
| DELETE | `/invitations/:token` | Revoke a pending invitation | JWT (Admin only) |
| POST | `/invitations/:token/resend` | Reset expiry and resend the invitation email | JWT (Admin only) |
| GET | `/invitations/validate/:token` | Validate a token before OAuth (public) | None |
| GET | `/users` | List all CRM users | JWT (Admin or Sales Manager) |
| GET | `/users/me` | Get the current user's own profile | JWT (any role) |
| PATCH | `/users/:id` | Update display name or role | JWT (Admin only) |
| PATCH | `/users/:id/deactivate` | Deactivate a member account | JWT (Admin only) |
| PATCH | `/users/:id/reactivate` | Reactivate a member account | JWT (Admin only) |
| GET | `/teams` | List all teams | JWT (Admin or Sales Manager) |
| POST | `/teams` | Create a new team | JWT (Admin only) |
| PATCH | `/teams/:id` | Rename a team or update manager/membership | JWT (Admin only) |
| DELETE | `/teams/:id` | Delete a team (members revert to unassigned) | JWT (Admin only) |

### Modified Endpoints

| Method | Path | Change |
|--------|------|--------|
| GET | `/auth/google/callback` | Must now check for `invite_token` in session/state; if present, look up the invitation, create the user row in `Users` tab, mark token consumed; if absent, deny sign-in unless user already exists in `Users` tab |
| GET | `/customers` | Must now scope results by role: Sales Rep sees own data only; Sales Manager sees all reps in their teams; Admin sees all |
| POST | `/customers` | Must now record `owner_id` (the rep's CRM user id) on each new customer row |
| PATCH | `/customers/:id` | Must now verify that the requesting user owns the record (or is Admin/Manager) |

---

### Request / Response Shapes

```typescript
// POST /invitations
interface CreateInvitationDto {
  email: string;
  role: CrmRole;
  firstName?: string; // optional display name hint shown in invitation email
}

interface InvitationResponse {
  token: string;
  email: string;
  role: CrmRole;
  invitedBy: string;     // userId of the Admin who sent it
  createdAt: string;     // ISO timestamp
  expiresAt: string;     // ISO timestamp (createdAt + 72h)
  status: 'Pending' | 'Consumed' | 'Revoked' | 'Expired';
}

// GET /invitations
type ListInvitationsResponse = InvitationResponse[];

// GET /invitations/validate/:token  — public, called by the invite landing page
interface ValidateTokenResponse {
  valid: boolean;
  email: string;          // the email the invite was sent to
  role: CrmRole;
  organizationName?: string;
  inviterName?: string;
  reason?: 'expired' | 'revoked' | 'consumed'; // present when valid=false
}

// GET /users
interface CrmUserResponse {
  id: string;
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: CrmRole;
  status: UserStatus;
  teamId?: string;
  createdAt: string;
}
type ListUsersResponse = CrmUserResponse[];

// PATCH /users/:id
interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  role?: CrmRole;
}

// POST /teams
interface CreateTeamDto {
  name: string;
  managerId?: string;   // userId of a Sales Manager
  memberIds?: string[]; // userIds of Sales Reps
}

interface TeamResponse {
  id: string;
  name: string;
  managerId?: string;
  memberIds: string[];
  createdAt: string;
}

// PATCH /teams/:id
interface UpdateTeamDto {
  name?: string;
  managerId?: string;
  memberIds?: string[];
}

// Updated JWT payload
interface JwtPayload {
  sub: string;        // CRM user id (UUID from Users sheet, NOT googleId)
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: CrmRole;      // NEW
  // accessToken and refreshToken removed — no longer needed client-side
}
```

---

## Data Model Changes

### New `Users` Tab (in platform sheet)

Header row (tab name: `Users`):

```
id | google_id | email | first_name | last_name | role | status | team_id | created_at | updated_at
```

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Platform-assigned CRM user id; this replaces `googleId` as the primary key used in JWT `sub` |
| `google_id` | string | Google profile id — used to match the returning OAuth user |
| `email` | string | Google account email recorded at sign-up |
| `first_name` | string | From Google profile at sign-up, editable by Admin |
| `last_name` | string | From Google profile at sign-up, editable by Admin |
| `role` | enum | `Admin`, `Sales Manager`, `Sales Rep` |
| `status` | enum | `Active`, `Deactivated` |
| `team_id` | string | ID of the team the user belongs to; empty if unassigned |
| `created_at` | ISO timestamp | When the account was created |
| `updated_at` | ISO timestamp | Last mutation timestamp |

### New `Invitations` Tab (in platform sheet)

Header row (tab name: `Invitations`):

```
token | email | role | invited_by | first_name | status | created_at | expires_at | consumed_at
```

| Column | Type | Notes |
|--------|------|-------|
| `token` | string | Cryptographically random string (32 bytes, hex-encoded via `crypto.randomBytes`) |
| `email` | string | Email address the invitation was sent to |
| `role` | enum | Role that will be assigned on sign-up |
| `invited_by` | string | CRM user id of the inviting Admin |
| `first_name` | string | Optional hint provided by Admin |
| `status` | enum | `Pending`, `Consumed`, `Revoked`, `Expired` |
| `created_at` | ISO timestamp | |
| `expires_at` | ISO timestamp | `created_at + 72 hours` |
| `consumed_at` | ISO timestamp | Set when the invitee completes sign-up; empty until then |

### New `Teams` Tab (in platform sheet)

Header row (tab name: `Teams`):

```
id | name | manager_id | member_ids | created_at | updated_at
```

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | |
| `name` | string | Human-readable team name |
| `manager_id` | string | CRM user id of the assigned Sales Manager; empty if unassigned |
| `member_ids` | string | Pipe-delimited list of CRM user ids (`userId1\|userId2`) — avoids adding a many-to-many join sheet |
| `created_at` | ISO timestamp | |
| `updated_at` | ISO timestamp | |

### Changes to Existing Customer Rows (`Sheet1`)

Add one column to every user's customer spreadsheet:

```
id | first_name | last_name | email | phone | company | status | last_contact_date | notes | created_at | owner_id
```

`owner_id` is the CRM user id (`Users.id`) of the Sales Rep who owns the record. This is required for server-side data scoping. Existing rows will have `owner_id` empty until the migration runs (see Migration Path).

---

## Auth Flow Changes

### First Admin Bootstrap

On a fresh deployment, the `Users` sheet is empty. The backend must have a bootstrap mechanism to create the first Admin without an invitation:

- Add a `BOOTSTRAP_ADMIN_EMAIL` environment variable. On the Google OAuth callback, if the `Users` tab is empty **and** the authenticated Google email matches `BOOTSTRAP_ADMIN_EMAIL`, the callback creates the first Admin row and issues a JWT normally.
- If the tab is empty and the email does not match, the callback returns HTTP 403 with a message directing the user to contact the system owner.
- Once at least one Admin exists, `BOOTSTRAP_ADMIN_EMAIL` has no further effect and can be left set or unset.

### Updated OAuth Callback Flow

The Google OAuth callback path (`GET /auth/google/callback`) must handle two cases:

**Case A — Returning user (normal sign-in):**
1. Extract `googleId` from the Google profile.
2. Look up the `Users` tab for a row where `google_id` matches.
3. If found and `status = Active`, issue a JWT with role and CRM user id.
4. If found and `status = Deactivated`, return HTTP 403 ("Account deactivated").
5. If not found, return HTTP 403 ("No account found. Contact your Admin for an invitation.").

**Case B — Invitation redemption:**
1. The invite landing page redirects to `GET /auth/google?invite_token=<token>`. The token is passed to the OAuth flow via the `state` parameter.
2. In `GoogleStrategy.authorizationParams()`, append `state` when `invite_token` is present in the request query.
3. In the callback, if `state` contains an `invite_token`:
   a. Validate the token (exists in `Invitations`, status is `Pending`, not expired).
   b. If invalid, redirect to `/invite/error?reason=<expired|revoked|consumed>`.
   c. If valid, create a new row in `Users` with the role from the invitation, status `Active`.
   d. Mark the `Invitations` row as `Consumed` and set `consumed_at`.
   e. Issue a JWT and redirect to the dashboard.

**JWT payload change:** The `sub` claim must become the CRM `Users.id` UUID (not the Google id). The `role` claim is added. The `accessToken` and `refreshToken` fields are removed from the JWT — they are no longer needed because all Sheets access goes through the Service Account.

---

## Token & Email Strategy

### Invitation Token Storage

Tokens are stored as rows in the `Invitations` tab of the platform sheet. There is no in-memory or external cache. On validation, the backend reads the full `Invitations` tab (which will be small — tens to low hundreds of rows), finds the matching token, and checks status and expiry.

Token generation: `crypto.randomBytes(32).toString('hex')` — 64-character hex string. This is already available in Node.js without additional dependencies.

**Expiry enforcement is passive:** There is no cron job that flips rows from `Pending` to `Expired`. Instead, the validation logic checks `expires_at < now` at read time and treats such rows as expired. The `status` column reflects the last explicitly set state (`Pending`, `Consumed`, `Revoked`); the effective state for read purposes is computed as `status === 'Pending' && expiresAt > now`.

### Transactional Email

The platform currently has no SMTP configuration. **Resend** (`resend` npm package) is the recommended provider:

- Free tier: 3,000 emails/month — sufficient for team invitation volumes.
- SDK is minimal: `new Resend(apiKey).emails.send({...})` — no heavy dependency.
- Requires adding `RESEND_API_KEY` to `.env`.
- Sender domain: a verified domain or the Resend-provided sandbox address (`onboarding@resend.dev`) for early development.

A `MailService` is added to `apps/api` as a standalone injectable (not a NestJS module) responsible for sending the invitation email. It is injected into `InvitationsService`. The email template is a fixed HTML string in the service — custom email body content is out of scope per the PRD.

**Alternative if Resend is not approved:** The invitation token can be displayed to the Admin directly in the API response and shown in the UI ("Copy this link and share it manually"). This eliminates the email dependency entirely and unblocks development while the email provider decision is made. The `InvitationsService` should be designed with a `MailService` interface so the transport is swappable.

---

## Role Enforcement

### Guards

Add a `RolesGuard` to `apps/api/src/auth/`:

```typescript
// Usage on a controller method
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin')
@Post('/invitations')
```

`RolesGuard` reads the role from `request.user.role` (populated by `JwtStrategy.validate`) and compares it against the `@Roles(...)` decorator metadata. It throws `ForbiddenException` if the role is insufficient. `JwtAuthGuard` must run first to populate `request.user`.

The `@Roles()` decorator is defined in `apps/api/src/auth/roles.decorator.ts` using `SetMetadata`.

### Role Hierarchy for Customer Data Scoping

`GET /customers` must scope results based on the requesting user's role:

- `Sales Rep`: the controller passes `ownerId = user.sub` to `SheetsService`. Only the rep's own spreadsheet is read, and only rows where `owner_id = user.sub` are returned.
- `Sales Manager`: the controller looks up the manager's teams, collects all `memberIds`, fetches each rep's spreadsheet via the Service Account, and returns the union. If no teams exist, returns all reps' data (per PRD fallback rule).
- `Admin`: reads all user spreadsheets (iterates the `Users` tab) and returns the union.

This federated read is the most expensive operation in the system — see Technical Constraints.

### JWT Role Claim vs. Live Enforcement

**Decision: JWT carries the role claim; server-side re-validation against the `Users` sheet is not performed on every request.**

Role changes take effect on the member's next sign-in (next JWT issuance), not on next page load. The PRD acceptance criteria say "next page load or session refresh" — this is achievable without per-request sheet lookups if the frontend refreshes the JWT on page load when the stored token is approaching expiry.

**Mitigation for role-change latency:** set JWT expiry to **4 hours** (down from a longer default). Admins changing a role should be informed in the UI that the change takes effect within 4 hours or on the affected user's next sign-in. A forced sign-out mechanism is deferred (see Out of Scope).

**Last-Admin protection:** the `PATCH /users/:id` and `PATCH /users/:id/deactivate` handlers must read the `Users` tab to count active Admins before allowing the change. If the result would leave zero active Admins, return HTTP 422 with a descriptive error.

---

## Frontend Technical Notes

### New Routes

| Path | Component | Guard |
|------|-----------|-------|
| `/invite/:token` | `InviteAcceptPage` | None (public) |
| `/invite/error` | `InviteErrorPage` | None (public) |
| `/team` | `TeamManagementPage` | JWT + Admin role |
| `/team/users` | `UsersTab` | JWT + Admin role |
| `/team/invitations` | `InvitationsTab` | JWT + Admin role |
| `/team/teams` | `TeamsTab` | JWT + Admin role |

### Auth Store Changes (Zustand)

The existing `crm_token` in localStorage continues to be used. The Zustand auth store must be updated to:
- Decode `role` from the JWT payload on load (use `jwt-decode` — already likely available, or add it as a lightweight dependency)
- Expose `role` and `userId` (`sub`) alongside the existing fields
- Provide a `hasRole(role: CrmRole): boolean` selector for UI gating

### Invite Acceptance Page

`InviteAcceptPage` receives the token from the URL path. On mount, it calls `GET /invitations/validate/:token`. If valid, it renders a "Sign in with Google" button that links to `GET /auth/google?invite_token=<token>`. If invalid, it redirects to `/invite/error?reason=<reason>`.

No form fields are needed — the Google button is the entire sign-up UI.

### Team Management Page

Recommended shadcn/ui components: `Tabs` (Users / Invitations / Teams), `Table`, `Dialog` (invite form, create team form), `Badge` (role, status), `DropdownMenu` (role change, deactivate actions), `AlertDialog` (confirmation for deactivation and team deletion).

State: a dedicated `useTeamStore` Zustand slice (or co-located React Query hooks) for users, invitations, and teams. These are Admin-only views so the data volume is small — full lists are acceptable without pagination in this iteration.

### Role-Gated UI

Role-gated route protection: create a `ProtectedRoute` wrapper component that reads `role` from the auth store. If the user's role is insufficient, redirect to `/` with an error toast.

Customer list: hide/show columns or action buttons based on role. Sales Reps see no "assigned to" column. Sales Managers see a read-only view of other reps' records.

---

## Backend Technical Notes

### New Modules

- **`UsersModule`** — `UsersController`, `UsersService`. `UsersService` wraps all reads and writes to the `Users` tab via `AdminSheetsService`.
- **`TeamsModule`** — `TeamsController`, `TeamsService`. Same pattern.
- **`InvitationsModule`** — `InvitationsController`, `InvitationsService`, `MailService`. Handles token lifecycle and email dispatch.

All three modules import `AdminSheetsService` from a new `AdminSheetsModule` (or it can be a globally provided service — the `forRoot` pattern is not needed here given the single platform sheet).

### New `AdminSheetsService`

This is a new service distinct from the existing `SheetsService`. The existing `SheetsService` uses per-user OAuth2 credentials. `AdminSheetsService` uses the Google Service Account key (already available as `GOOGLE_SERVICE_ACCOUNT_KEY` / `GOOGLE_SERVICE_ACCOUNT_EMAIL` in `.env`) via `google.auth.GoogleAuth`. It is the sole accessor of the platform sheet and all user customer spreadsheets that have been migrated to Service Account ownership.

The existing `SheetsService` remains in place during migration but its `buildSheetsClient` method will eventually be removed once per-user OAuth token storage is retired.

### Changes to `AuthModule`

- `AuthService.login()` gains a `CrmUser` lookup step: after Google OAuth resolves, look up the user in the `Users` tab by `google_id`. If found and active, build the `JwtPayload` with `role` and `sub = Users.id`.
- `GoogleStrategy` must thread the `invite_token` through the OAuth `state` parameter. Use `passReqToCallback: true` in the strategy constructor and read `req.query.invite_token` in `authorizationParams`.
- `JwtStrategy.validate()` returns the payload as-is; downstream guards read `request.user.role`.

### `DriveService` Migration

`DriveService` currently uses the authenticated user's OAuth credentials. After this feature, it must use the Service Account for all `drive.files.create` and `drive.files.update` calls. The `accessToken` / `refreshToken` parameters to `getOrCreateSpreadsheet` are removed; the method uses `google.auth.GoogleAuth` instead. The per-user spreadsheet is created in a Service Account-owned Drive folder.

### Environment Variables (New)

| Variable | Purpose |
|----------|---------|
| `PLATFORM_SHEET_ID` | ID of the shared platform Google Sheet containing `Users`, `Invitations`, `Teams` tabs |
| `BOOTSTRAP_ADMIN_EMAIL` | Google email that is promoted to Admin on first sign-in if `Users` tab is empty |
| `RESEND_API_KEY` | Transactional email API key |
| `RESEND_FROM_ADDRESS` | Sender address for invitation emails |

---

## Technical Constraints

- **Google Sheets API quota:** The default quota is 300 read requests per minute per project. Federated reads for `GET /customers` as Admin (one API call per user) will hit this limit at around 300 active users in a burst. For this iteration's target team size (under 50 users), this is not a concern but must be documented and revisited before scaling.
- **Sheets as a lock-free store:** There is no row-level locking in Google Sheets. Concurrent writes to the `Users` or `Invitations` tabs (e.g., two Admins creating invitations simultaneously) can result in row overwrites. This is an inherent limitation of the Sheets-as-database approach. Mitigate by ensuring append operations use `spreadsheets.values.append` (which is atomic per Google's implementation) rather than read-then-write patterns where possible.
- **Invitation token in URL:** The 64-character hex token is passed in the URL. This is acceptable for a team-internal tool but the invite link should be treated as a secret credential — document this in the Admin UI with a warning not to share the link publicly.
- **JWT size:** Adding `role` to the payload is trivial. Removing `accessToken` and `refreshToken` actually reduces JWT size.
- **Google OAuth `state` parameter:** Passing `invite_token` via `state` requires that the `GoogleStrategy` serializes and deserializes it correctly through the OAuth round-trip. The `state` value must be URL-safe; use the raw hex token directly (it is already URL-safe).
- **CORS:** The `InviteAcceptPage` is a public frontend route. No new CORS configuration is needed beyond the existing API setup.
- **Browser compatibility:** No new browser APIs are introduced. `jwt-decode` and `crypto.randomBytes` (Node, server-side only) have no compatibility concerns.

---

## Migration Path

The existing per-user spreadsheets are owned by individual users' Google Drive accounts and accessed via their OAuth tokens. After this feature, the Service Account owns all spreadsheets.

### Phase 1 — Parallel operation (ship with this feature)

- New user sign-ins (via invitation) provision their customer spreadsheet using the Service Account from the start.
- Existing users who sign in continue to use the old `DriveService` flow (per-user OAuth) until their spreadsheet is migrated.
- The `CustomersController` detects whether the requesting user's spreadsheet is SA-owned by checking a flag stored in the `Users` row (`sheet_ownership: 'user' | 'service_account'`). Add `sheet_id` and `sheet_ownership` columns to the `Users` tab.

### Phase 2 — Migration script (follow-on task, not in this iteration's scope)

- A one-time script (run by an Admin or as a `nestjs-command` CLI task) iterates existing users, prompts them to re-authenticate (to obtain their OAuth token one last time), copies their spreadsheet content into a new SA-owned spreadsheet, updates the `Users` row with `sheet_id` and `sheet_ownership = service_account`, and stores the new `sheet_id`.
- After migration, `DriveService`'s per-user OAuth path is removed.

**Impact on current functionality during Phase 1:** Existing users are unaffected. Role-scoped `GET /customers` for Sales Managers and Admins will only federate across SA-owned spreadsheets; user-owned spreadsheets are excluded from cross-team views until migrated. This is acceptable for a first ship because team features only apply to newly invited members.

---

## Technical Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Google OAuth `state` parameter stripping by certain OAuth proxy or firewall configurations | Low | Test in the target deployment environment early; have a fallback where the invite token is stored in a short-lived server-side session keyed on OAuth `nonce` |
| Concurrent Admin writes to `Invitations`/`Users` tabs causing row corruption | Low | Append operations are safe; update operations (mark token consumed) use row-indexed writes which can collide under race conditions. Accept the risk at team sizes under 50; document it. |
| Resend free tier limits or account verification delays blocking invitation emails | Medium | Build the "copy link" fallback into the UI from day one so Admins can share tokens without email if needed |
| Per-user spreadsheet migration never completing, leaving a permanent two-tier architecture | Medium | Design `sheet_ownership` flag cleanly so Phase 2 can be executed incrementally; do not block Phase 1 ship on this |
| JWT role claim staleness (role changed but old JWT still valid for up to 4 hours) | Medium | Acceptable per PRD; communicate the latency in the Admin UI. Forced sign-out is deferred |
| `BOOTSTRAP_ADMIN_EMAIL` misconfiguration on fresh deploy locks out all users | Low | Add a startup log warning if `PLATFORM_SHEET_ID` is set but `Users` tab is empty and `BOOTSTRAP_ADMIN_EMAIL` is not configured |
| Google Service Account losing access to user-owned spreadsheets after transfer | Low | Use Drive API `files.update` with `transferOwnership` or `addParents` during migration; test in a staging Drive before production run |
| `member_ids` pipe-delimited column in `Teams` tab becomes difficult to manage at scale | Low | Acceptable for team sizes under 50. If teams exceed ~20 members, consider a dedicated `TeamMembers` tab in a future iteration |

---

<<<<<<< Updated upstream
=======
## Implementation Status

### `packages/types` — ✅ Shipped (PR #28, closes #23)

All shared types defined in this section have been implemented and merged into `packages/types/src/index.ts`. A Jest test suite (46 tests, `ts-jest`) was added alongside the types. `Customer`, `CreateCustomerDto`, `UpdateCustomerDto`, and `GoogleUser` are unchanged.

### Backend auth & Service Account migration — ✅ Shipped (PR #29, closes #24)

- `AdminSheetsService` added: uses `google.auth.GoogleAuth` with Service Account credentials; provisions `Users`, `Invitations`, `Teams` tabs in `PLATFORM_SHEET_ID` on startup.
- `AuthService` rewritten: `login(googleUser, crmUser)` signs JWT with `sub = Users.id` and `role`; new methods `findUserByGoogleId()`, `findOrCreateBootstrapAdmin()`, `processInviteToken()`.
- `AuthController` OAuth callback implements Case A (returning user), Case B (invite redemption via OAuth `state`), and Bootstrap Admin; all failure paths return 403.
- `GoogleStrategy` updated with `passReqToCallback: true` and `invite_token` threaded through OAuth `state`.
- `RolesGuard` + `@Roles()` decorator added; Admin is superuser.
- `CustomersController` updated: role-scoped `GET /customers`; `owner_id` stamped on `POST`; Phase 1 `sheet_ownership` routing preserved.
- JWT expiry reduced to `4h`. TDD: 57 tests across 6 spec files.

---

>>>>>>> Stashed changes
## Shared Types to Define First (`packages/types`)

Before either team begins implementation, the following types must be merged into `packages/types/src/index.ts`:

```typescript
export type CrmRole = 'Admin' | 'Sales Manager' | 'Sales Rep';
export type UserStatus = 'Active' | 'Deactivated';
export type InvitationStatus = 'Pending' | 'Consumed' | 'Revoked';

export interface CrmUser {
  id: string;
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: CrmRole;
  status: UserStatus;
  teamId?: string;
  sheetId?: string;
  sheetOwnership?: 'user' | 'service_account';
  createdAt: string;
  updatedAt: string;
}

export interface Invitation {
  token: string;
  email: string;
  role: CrmRole;
  invitedBy: string;
  firstName?: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
}

export interface Team {
  id: string;
  name: string;
  managerId?: string;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}

// Updated — accessToken and refreshToken removed; role and googleId added
export interface JwtPayload {
  sub: string;       // CRM user UUID (Users.id)
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: CrmRole;
}
```

The existing `GoogleUser` interface is unchanged (it is only used inside the auth flow before the JWT is issued). The existing `JwtPayload` interface is replaced by the updated version above.

---

## Out of Scope (Technical)

- Per-request `Users` sheet lookup to enforce live role changes — deferred in favor of JWT claim with 4-hour expiry
- Forced session invalidation / token revocation mechanism
- Migration script for existing per-user spreadsheets (Phase 2 — follow-on task)
- Pagination for `/users`, `/teams`, `/invitations` endpoints — full lists are acceptable at target team sizes
- Custom email templates or Admin-authored invitation message bodies
- Audit log table/tab for role changes and invitation events
- `DELETE /users/:id` hard deletion endpoint
- Team-scoped customer visibility for Sales Reps (peer visibility between reps on the same team)
- Sales Manager write access to reps' customer records — read-only in this iteration
