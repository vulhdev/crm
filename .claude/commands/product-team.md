You are orchestrating the **product-team** for the CRM platform. The team has four specialized agents:

- **product-owner** — defines the PRD: problem statement, user stories, and acceptance criteria. Focuses purely on **what** and **why** — no tech decisions.
- **tech-lead** — reviews the PRD and produces a **Tech Brief**: architecture decisions, stack choices, technical constraints, and API design. Owns all technology decisions so the product-owner doesn't have to.
- **product-designer** — maps user flows, wireframes, and interaction design **after** the PRD is ready.
- **qa-analyst** — produces acceptance test scenarios, risk assessment, and quality exit criteria **after** the PRD, Tech Brief, and UX Brief are ready.

The full workflow and artifact handoff chain are in `.claude/teams/product-team.md`.

## Context: Read docs before starting

**Before spawning any agent**, read the relevant docs in `.claude/docs/` to ground the team in what already exists:

1. List all files in `.claude/docs/` to see what documents are available.
2. Read `overview.md` for the full platform architecture and feature list.
3. Read any other doc whose filename suggests relevance to the requested feature (e.g. `customer-views.md` for anything related to how customers are displayed).
4. Pass the relevant doc content to each agent as **"Existing context"** so they don't re-design what already exists.

---

## How to use this team

If the user provides a feature idea or research request, delegate it to the correct agent(s) using the Agent tool.

**All features follow this order: Product Owner → CTO + Product Designer (parallel) → QA Analyst.**

---

## Output folder

Before spawning any agent, derive a **short** kebab-case slug from the feature name — 1–3 words max, no filler words (e.g. `customer-filters`, `auth`, `kanban`) — and create a dedicated output folder:

```
.claude/docs/<feature-slug>/
```

Instruct every agent to **write their artifact to that folder**:

| Agent | File |
|-------|------|
| `product-owner` | `.claude/docs/<feature-slug>/prd.md` |
| `tech-lead` | `.claude/docs/<feature-slug>/tech-brief.md` |
| `product-designer` | `.claude/docs/<feature-slug>/ux-brief.md` |
| `qa-analyst` | `.claude/docs/<feature-slug>/test-plan.md` |

Each file must be written with the Write tool before the agent returns. Pass the target file path explicitly in every agent prompt.

---

### Standard feature: new request from scratch
1. Read `.claude/docs/` (see above).
2. Derive the feature slug and create `.claude/docs/<feature-slug>/`.
3. Spawn `product-owner` — pass the feature idea/goal + relevant doc content + output path. Returns a **PRD** saved to `prd.md`.
4. Spawn `tech-lead` + `product-designer` **in parallel** — both receive the PRD + relevant doc content + their output paths. Returns a **Tech Brief** (`tech-brief.md`) and a **UX Brief** (`ux-brief.md`).
5. Spawn `qa-analyst` — pass the PRD + Tech Brief + UX Brief + relevant doc content + output path. Returns a **Test Plan** saved to `test-plan.md`.

### Parallel design + QA (requirements already defined externally):
1. Read `.claude/docs/` (see above).
2. Derive the feature slug and create `.claude/docs/<feature-slug>/`.
3. Spawn `tech-lead` + `product-designer` + `qa-analyst` **in parallel** — all receive the existing requirements doc + relevant doc content + their respective output paths.

### Analysis / discovery only (no implementation planned yet):
1. Read `.claude/docs/` (see above).
2. Derive the feature slug and create `.claude/docs/<feature-slug>/`.
3. Spawn `product-owner` — returns a PRD with open questions surfaced, saved to `prd.md`.
4. Spawn `tech-lead` + `product-designer` **in parallel** — CTO surfaces technical unknowns, designer surfaces UX unknowns.
5. Hold for stakeholder review before spawning `qa-analyst` or handing off to `develop-team`.

---

### Handing off to develop-team

Once the product-team finishes, the combined outputs feed the `develop-team`:

| product-team output | develop-team consumer |
|--------------------|-----------------------|
| PRD | `senior-fe-developer`, `senior-be-developer` (for context) |
| Tech Brief | `senior-be-developer`, `senior-fe-developer` (architecture guidance) |
| UX Brief | `ui-designer` (visual specs), `senior-fe-developer` (implementation) |
| Test Plan | `qc-agent` (writes automated tests aligned to acceptance criteria) |

---

## After the plan is complete: create a GitHub issue

Once all agents have finished and their files are saved under `.claude/docs/<feature-slug>/`, **ask the user**:

> "The product plan is ready. Would you like me to create a GitHub issue for this feature?"

If the user confirms, create a GitHub issue using `gh issue create` with:

- **Title**: concise feature title derived from the PRD (e.g. `feat: <feature name>`)
- **Body** (use a HEREDOC): structured markdown combining the key outputs:

```
## Problem Statement
[from PRD]

## User Stories
[from PRD]

## Acceptance Criteria
[from PRD — as a checklist]

## Tech Notes
[key architecture decisions and constraints from Tech Brief]

## UX Notes
[key flows and interaction design points from UX Brief]

## Test Plan Summary
[risk highlights and exit criteria from Test Plan]

## Out of Scope
[from PRD]
```

- **Labels**: apply relevant labels if they exist (e.g. `enhancement`, `feature`). Use `gh label list` first to check available labels; skip labelling if none match.

After creating the issue, print the issue URL so the user can open it.

---

If no specific task is given, show the team overview and ask which feature or problem area to analyze.
