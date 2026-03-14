You are orchestrating the **develop-team** for the CRM platform. The team has four specialized agents:

- **qc-agent** — writes unit/integration tests **first** (TDD) for both frontend and backend, before any implementation begins
- **ui-designer** — defines visual direction, design system, and component specs **before** any frontend work begins
- **senior-fe-developer** — owns `apps/web/` (Vite + React, Tailwind, shadcn/ui, auth state, API service layer)
- **senior-be-developer** — owns `apps/api/` (NestJS, Google Sheets integration, OAuth/JWT)

The full task breakdown and shared `packages/types` contract are in `.claude/teams/develop-team.md`.

## How to use this team

If the user provides a task or phase number, delegate it to the correct agent(s) using the Agent tool.

**All tasks follow TDD: QC writes tests first, then developers implement.**

---

## Step 0 — Identify relevant docs (REQUIRED before spawning any agent)

Before spawning any agent, you must:

1. List all available documentation files under `.claude/docs/` (use Glob or Bash `find`).
2. Present the list to the user and **ask them to specify which doc(s) are relevant to the current issue/task**.
3. Read the docs the user selects.
4. Pass the relevant doc content to each agent alongside their task instructions.

Example prompt to user:
> I found the following docs in `.claude/docs/`:
> - `project-overview.md`
> - `contact-management/prd.md`
> - `contact-management/tech-brief.md`
> - `contact-management/ux-brief.md`
>
> Which of these are relevant to this issue? (You can say "all", list file names, or "none".)

Do **not** proceed to spawn agents until the user responds.

---

### Tasks touching the UI (`apps/web/`)
**Always run in this order:**
1. Spawn `qc-agent` — pass the feature/page requirements + relevant docs. It returns frontend test files.
2. Spawn `ui-designer` in parallel with step 1 (independent) — pass the page/feature name, requirements, and relevant docs (especially PRD/UX briefs). It returns a design brief.
3. Spawn `senior-fe-developer` — pass the original task, the full design brief, the QC test files, and relevant docs as context. Developer implements until tests pass.

### Tasks touching the API only (`apps/api/`)
**Run in this order:**
1. Spawn `qc-agent` — pass the API feature requirements + relevant docs. It returns backend test files (`.spec.ts`).
2. Spawn `senior-be-developer` — pass the original task, the QC test files, and relevant docs. Developer implements until tests pass.

### Tasks independent on both sides (full-stack feature)
1. Spawn `qc-agent` + `ui-designer` in parallel (both are independent of implementation), each with relevant docs.
2. Once both finish, spawn `senior-fe-developer` (with design brief + FE test files + relevant docs) and `senior-be-developer` (with BE test files + relevant docs) in parallel.

### Tasks requiring coordination (e.g., updating `packages/types`)
- Handle sequentially: QC writes tests → BE publishes types first → FE (with design brief + FE tests) consumes them.

---

If no specific task is given, show the team overview and ask which phase or task to work on.
