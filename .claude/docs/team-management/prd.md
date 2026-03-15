# PRD: User & Team Management

**Version:** 1.0
**Date:** 2026-03-15
**Status:** Draft

---

## Problem Statement

The CRM platform currently operates in a strict single-user model: each person who signs in via Google OAuth receives their own isolated Google Drive folder and spreadsheet. There is no way for a Sales Manager or Admin to onboard a new Sales Rep, no shared access to team data, and no concept of a role or permission boundary. As a result, teams cannot use this platform collaboratively — every rep is a siloed island, pipeline visibility across the team is impossible, and onboarding a new hire requires them to self-discover and set up their own environment with no guardrails. This feature introduces the minimal team infrastructure — invitation, authentication, and role assignment — that transforms the platform from a personal tool into a shared team workspace.

---

## Target Users

| Persona | Role in This Feature | Primary Goal |
|---------|----------------------|--------------|
| **Admin** | Feature owner — the person responsible for configuring and governing the CRM instance | Onboard new team members quickly and enforce access boundaries |
| **Sales Manager** | Secondary — benefits from team visibility; may also send invitations if delegated | Ensure their team is set up correctly and grouped under their reporting structure |
| **Sales Rep** | End recipient of this feature — the person being invited | Sign up with minimal friction using an existing Google account and start working immediately |

---

## User Stories

### Story 1 — Invitation-Based Onboarding

**As an Admin, I want to invite a new Sales Rep by entering their email address so that they receive a secure, time-limited link to join the CRM without requiring any manual account provisioning on my part.**

#### Acceptance Criteria
- [ ] The Admin has access to a "Team" or "Members" section in the platform where they can enter one or more email addresses and click "Send Invite."
- [ ] Each submitted email address generates a unique, single-use invitation token that expires after 72 hours if unused.
- [ ] The system sends an invitation email to the provided address containing the rep's name (if entered by Admin), a welcome message, and a clearly labelled call-to-action link.
- [ ] If the Admin submits an email address that already belongs to an active team member, the UI displays an inline error ("This user is already a member") and does not send a duplicate invitation.
- [ ] If the Admin submits an email address for which a pending invitation already exists, the UI offers the option to resend/reset the invitation timer rather than creating a second token.
- [ ] The "Team" section shows all pending invitations with their recipient email, invited-on date, expiry time, and a "Revoke" action per invitation.
- [ ] Revoking a pending invitation immediately invalidates the token; any subsequent attempt to use that link shows a clear "This invitation has expired or been revoked" message.
- [ ] The invitation flow does not require the Admin to know the invitee's Google account address in advance — any email address may be entered; the invitee uses Google SSO at the point of sign-up.

---

### Story 2 — Google SSO Sign-Up via Invitation Link

**As a Sales Rep, I want to click my invitation link and sign up using my Google account in a single step so that I do not need to create or remember a separate username and password.**

#### Acceptance Criteria
- [ ] Clicking the invitation link opens the CRM sign-up page with the invitation context pre-loaded (e.g., inviting organization name, inviting admin's name).
- [ ] The sign-up page presents a single "Sign in with Google" button; no separate form fields for email, name, or password are required.
- [ ] Completing Google OAuth consent automatically creates a CRM user account linked to that Google identity and marks the invitation token as consumed.
- [ ] If the Google account used differs from the email address the invitation was sent to, the system records the actual Google email as the user's primary identity but still accepts the sign-up (with an informational note on the confirmation screen).
- [ ] A user who signs in via a consumed invitation token is redirected to the main CRM dashboard, not the sign-up screen.
- [ ] Attempting to use an expired or revoked invitation link before signing in shows a clear error page with instructions to contact the Admin for a new invite; no partial account is created.
- [ ] After a successful sign-up, the new Sales Rep can immediately sign in on any subsequent visit using the standard "Sign in with Google" button without needing an invitation link again.
- [ ] The Admin who sent the invitation receives no notification when the invitation is accepted (deferred to a future notification feature), but the member's status in the Team section updates from "Pending" to "Active" automatically.

---

### Story 3 — Role Assignment

**As an Admin, I want to assign a role to each team member (Sales Rep or Sales Manager) so that the platform can enforce appropriate access boundaries and surface the right views to the right people.**

#### Acceptance Criteria
- [ ] The platform supports exactly three roles in this iteration: `Admin`, `Sales Manager`, and `Sales Rep`.
- [ ] When sending an invitation, the Admin selects the intended role for the invitee from a dropdown; the role is pre-assigned upon sign-up completion.
- [ ] The Admin can change a member's role at any time from the Team section; the change takes effect on the member's next page load or session refresh.
- [ ] Only users with the `Admin` role can access the Team section, send invitations, and change roles.
- [ ] A `Sales Manager` role grants read access to all team members' customer data and the ability to view (but not edit) other reps' records.
- [ ] A `Sales Rep` role grants access only to that individual's own customer records by default.
- [ ] The platform must always have at least one `Admin` user; the system prevents the last Admin from being demoted or removed.
- [ ] Role assignments are persisted in a dedicated `Users` sheet tab (see Scope), not inferred from the JWT alone.
- [ ] The JWT issued at login encodes the user's current role; role-gated UI elements are hidden/shown based on this JWT claim, with server-side enforcement as the authoritative check.

---

### Story 4 — Team Grouping & Assignment

**As an Admin, I want to organize Sales Reps into named teams so that a Sales Manager can be associated with a specific subset of reps and view only their team's pipeline.**

#### Acceptance Criteria
- [ ] The Admin can create, rename, and delete named teams from the Team section.
- [ ] When creating or editing a team, the Admin can assign any number of Sales Reps and exactly one Sales Manager to that team.
- [ ] A Sales Rep may belong to at most one team at a time; if reassigned to a new team, they are automatically removed from their previous team.
- [ ] A Sales Manager may oversee more than one team.
- [ ] A Sales Manager's dashboard view defaults to showing aggregated data for all teams they oversee, with the ability to filter down to a single team.
- [ ] Deleting a team does not delete or archive any member accounts; members revert to an "unassigned" state.
- [ ] If no teams have been created, the platform behaves as if all reps belong to a single default team visible to all managers; no team-scoping logic is applied.
- [ ] Team name, team membership, and manager assignment are stored in a `Teams` sheet tab.

---

### Story 5 — Member Management (Edit & Remove)

**As an Admin, I want to edit a team member's profile details and remove members who have left the organization so that the team roster accurately reflects the current sales team.**

#### Acceptance Criteria
- [ ] The Admin can update a member's display name and role from the Team section.
- [ ] The Admin can deactivate a member account; deactivated users immediately lose the ability to sign in and are no longer counted against any team or role quota.
- [ ] Deactivating a member does not delete their customer records; those records remain accessible to the Admin and any Sales Manager overseeing that rep's team.
- [ ] A deactivated member is shown in the Team section with a "Deactivated" badge and a "Reactivate" action; they are excluded from all active-member counts and dropdowns.
- [ ] Hard deletion of a user account is not available in this iteration; deactivation is the only removal action.
- [ ] The Admin cannot deactivate themselves if they are the only remaining active Admin.

---

## Scope

### In Scope
- Invitation-based onboarding: token generation, email delivery, expiry, revocation
- Google SSO as the sole sign-up and sign-in method for all team members
- Three roles: `Admin`, `Sales Manager`, `Sales Rep`
- Role assignment at invitation time with post-signup role editing by Admin
- Team creation and membership assignment (rep-to-team, manager-to-team)
- A `Users` sheet tab to persist user identities, roles, and status
- A `Teams` sheet tab to persist team definitions and membership
- Member deactivation (soft removal) by Admin
- Role-gated access: Sales Reps see only their own data; Sales Managers see their team's data; Admins see all data
- JWT role claims for client-side UI gating, with server-side enforcement as the authority

### Out of Scope (This Iteration)
- **Self-service sign-up without an invitation** — open registration is intentionally disabled; all users must be invited by an Admin to prevent unauthorized access.
- **Non-Google authentication methods** — username/password, SSO via Microsoft, Okta, or other providers; Google OAuth is the only supported method in this iteration.
- **Email notification on invitation acceptance** — the Admin does not receive an alert when an invite is used; the Team section roster update is the only signal.
- **Granular, field-level permissions (RBAC)** — fine-grained control over which fields a rep can view or edit is out of scope; the three-role model is the full permission surface for this iteration.
- **Audit log** — a timestamped history of all role changes, team reassignments, and invitation events is deferred.
- **SSO / SCIM provisioning for enterprise identity providers** — provisioning via Okta, Azure AD, or SCIM-compatible directories is an enterprise-tier feature not in scope.
- **Password recovery or account unlocking** — not applicable since the only auth method is Google OAuth.
- **Bulk invitation upload (CSV)** — inviting multiple users via a file upload; the current scope supports entering individual email addresses only.
- **Territory-based assignment** — assigning reps to geographic or vertical territories as a structured entity distinct from teams; territories can be approximated with team names for now.
- **Custom role creation** — Admins cannot define new roles beyond the three provided; custom permission sets are deferred.
- **Multi-instance or organization-level isolation** — this feature assumes a single shared CRM instance per team; multi-tenant organization management is out of scope.

---

## Priority

| Story | Priority | Rationale |
|-------|----------|-----------|
| 1. Invitation-Based Onboarding | Must | Without a controlled onboarding path, no team member can join the platform; this is the entry gate for all other team features |
| 2. Google SSO Sign-Up via Invitation | Must | Directly depends on Story 1; completing the sign-up flow is required before any team member can use the CRM; zero friction login is a stated platform-level requirement |
| 3. Role Assignment | Must | Required to gate access correctly; without roles, all users would have identical access and Sales Managers could not be distinguished from Sales Reps |
| 4. Team Grouping & Assignment | Should | High value for Sales Managers who need scoped pipeline visibility, but the platform functions without teams if all reps and managers see all data; can follow Stories 1–3 |
| 5. Member Management (Edit & Remove) | Should | Necessary for ongoing Admin operations (offboarding leavers), but does not block initial team setup; can ship in the same iteration as Story 4 or immediately after |

---

## Open Questions

1. **Shared vs. per-user Google Sheets:** The current architecture provisions one Google Sheet per user. A team model implies shared data visibility (e.g., a Sales Manager reading a rep's sheet). Should the platform migrate to a single shared sheet per team, or should the backend federate reads across individual rep sheets? This is the most architecturally consequential decision and must be resolved before engineering begins.

2. **Invitation email sender identity:** What email address should the invitation be sent from? Using a CRM platform address (e.g., `noreply@crm-platform.com`) requires SMTP or transactional email configuration (e.g., SendGrid, Resend). Does the platform currently have a transactional email provider? If not, should the invitation be sent via the inviting Admin's Gmail account (using their OAuth token), or is a platform email address acceptable as a new infrastructure dependency?

3. **Token storage for Users and Teams:** The `Users` and `Teams` data must be accessible across all users in the team, not stored in a personal Drive folder. Where should this shared metadata live — a dedicated Admin-owned Google Sheet (created at organization setup), or a separate backend store? If it is a Google Sheet, who owns the Drive folder it lives in?

4. **First Admin bootstrap:** When a brand-new organization onboards, who creates the first Admin account? Is there a super-admin setup screen before invitations are possible, or does the first person to authenticate via Google OAuth on a fresh deployment automatically become the Admin?

5. **Sales Manager data access granularity:** The acceptance criteria state that a Sales Manager sees all records for reps on their team. Should the manager be able to edit those records, or only view them? If a manager spots a stale status on a rep's account, can they update it directly? Clarifying read vs. read-write for managers will affect the permission model.

6. **Rep access to other reps' data:** By default, Sales Reps see only their own records. Should there be any peer visibility (e.g., a rep can see accounts assigned to a colleague for handover purposes)? If so, is that a team-level setting or an admin-controlled override per record?

7. **Invitation email content ownership:** Should the Admin be able to customize the invitation email body (e.g., add a personal message), or is a fixed template sufficient for this iteration?

8. **Role change latency:** The acceptance criteria state that a role change takes effect on the member's next page load or session refresh. If a rep is actively using the platform when their role is changed, they will continue with stale permissions until they refresh. Is this acceptable, or does the platform need to push an invalidation signal to active sessions?

9. **Team deletion with active members:** The current spec states that deleting a team reverts members to "unassigned." Should unassigned reps lose Sales Manager oversight entirely (no manager can see their data) until reassigned, or should they fall back to all Admin and Manager visibility by default?

---

## Success Metrics

- **Invitation completion rate:** Percentage of sent invitations that are accepted (invitation link clicked and sign-up completed) within the 72-hour window. Target: 80% or above, indicating the email delivery and sign-up flow has acceptable friction.
- **Time-to-first-login:** Median time between an Admin sending an invitation and the invitee completing sign-up. Target: under 10 minutes, validating that the Google SSO path is genuinely low-friction.
- **Onboarding support requests:** Number of support tickets or Admin-raised issues related to team member sign-up failures or access problems in the first 30 days post-launch. Target: zero critical (access-blocking) issues; fewer than 5 non-critical issues.
- **Role assignment accuracy:** Percentage of active team members with a non-default role explicitly assigned (i.e., not left in a state of "unassigned"). Target: 100% within one week of team setup, measured via the `Users` sheet.
- **Team coverage:** Percentage of active Sales Reps assigned to at least one team. Target: 90% within 30 days of the team grouping feature being available, indicating Admins are actively organizing their roster.
- **Unauthorized access incidents:** Number of recorded cases where a user accessed data outside their role boundary. Target: zero, validated through API-level access log review at 30 and 90 days post-launch.
