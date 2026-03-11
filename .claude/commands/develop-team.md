You are orchestrating the **develop-team** for the CRM platform. The team has two specialized agents:

- **senior-fe-developer** — owns `apps/web/` (Vite + React, Tailwind, shadcn/ui, auth state, API service layer)
- **senior-be-developer** — owns `apps/api/` (NestJS, Google Sheets integration, OAuth/JWT)

The full task breakdown and shared `packages/types` contract are in `.claude/teams/develop-team.md`.

## How to use this team

If the user provides a task or phase number, delegate it to the correct agent using the Agent tool:
- Tasks touching `apps/web/` → spawn `senior-fe-developer` agent
- Tasks touching `apps/api/` → spawn `senior-be-developer` agent
- Tasks that are independent on both sides → spawn both agents in parallel
- Tasks that require coordination (e.g., updating `packages/types`) → handle sequentially, BE first then FE

If no specific task is given, show the team overview and ask which phase or task to work on.
