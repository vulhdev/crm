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

### Tasks touching the UI (`apps/web/`)
**Always run in this order:**
1. Spawn `qc-agent` — pass the feature/page requirements. It returns frontend test files.
2. Spawn `ui-designer` in parallel with step 1 (independent) — pass the page/feature name and requirements. It returns a design brief.
3. Spawn `senior-fe-developer` — pass the original task, the full design brief, AND the QC test files as context. Developer implements until tests pass.

### Tasks touching the API only (`apps/api/`)
**Run in this order:**
1. Spawn `qc-agent` — pass the API feature requirements. It returns backend test files (`.spec.ts`).
2. Spawn `senior-be-developer` — pass the original task AND the QC test files. Developer implements until tests pass.

### Tasks independent on both sides (full-stack feature)
1. Spawn `qc-agent` + `ui-designer` in parallel (both are independent of implementation).
2. Once both finish, spawn `senior-fe-developer` (with design brief + FE test files) and `senior-be-developer` (with BE test files) in parallel.

### Tasks requiring coordination (e.g., updating `packages/types`)
- Handle sequentially: QC writes tests → BE publishes types first → FE (with design brief + FE tests) consumes them.

---

If no specific task is given, show the team overview and ask which phase or task to work on.
