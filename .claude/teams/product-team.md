# product-team

A three-agent team for researching, analyzing, and defining product features for the CRM platform. The Product Owner defines requirements; the Product Designer maps user experience; the QA Analyst defines quality standards. Their outputs feed directly into the `develop-team` workflow.

## Agents

| Agent | File | Owns | When |
|-------|------|------|------|
| `product-owner` | `.claude/agents/product-owner.md` | PRD — problem statement, user stories, acceptance criteria | **First** — defines what to build and why |
| `product-designer` | `.claude/agents/product-designer.md` | UX Brief — user flows, wireframes, interaction design | **After PRD** — translates requirements into UX structure |
| `qa-analyst` | `.claude/agents/qa-analyst.md` | Test Plan — acceptance scenarios, risk assessment, exit criteria | **After PRD + UX Brief** — defines quality standards |

## Workflow

```
product-owner ──► (PRD)
                    │
                    ▼
product-designer ──► (UX Brief)          ← reads PRD
                    │
                    ▼
qa-analyst ──► (Test Plan)               ← reads PRD + UX Brief
                    │
                    ▼
         ┌──────────────────────┐
         │  develop-team input  │
         │  PRD + UX Brief +    │
         │  Test Plan           │
         └──────────────────────┘
```

### Standard feature workflow (new feature from scratch):
1. **Spawn `product-owner`** — pass the feature idea/request. Returns a PRD.
2. **Spawn `product-designer`** — pass the PRD. Returns a UX Brief.
3. **Spawn `qa-analyst`** — pass the PRD + UX Brief. Returns a Test Plan.
4. Hand off PRD + UX Brief + Test Plan to the `develop-team`.

### Lightweight workflow (requirements already known):
1. **Spawn `product-designer` + `qa-analyst` in parallel** — both receive the existing requirements.
2. Hand off combined outputs to `develop-team`.

### Analysis-only workflow (researching a problem, no implementation yet):
1. **Spawn `product-owner`** — produce a PRD with open questions highlighted.
2. **Spawn `product-designer`** — produce UX flows to surface unknowns.
3. Review outputs with stakeholders before proceeding to QA or implementation.

---

## Output Artifacts

| Artifact | Produced by | Consumed by |
|----------|-------------|-------------|
| PRD (Product Requirements Document) | `product-owner` | `product-designer`, `qa-analyst`, `develop-team` |
| UX Brief | `product-designer` | `qa-analyst`, `ui-designer` (in develop-team), `senior-fe-developer` |
| Test Plan | `qa-analyst` | `qc-agent` (in develop-team), `senior-fe-developer`, `senior-be-developer` |

---

## CRM Feature Areas

Features that the product-team commonly analyzes:

| Area | Description |
|------|-------------|
| Customer CRUD | Adding, editing, archiving customers |
| Pipeline Views | List, Grid, Kanban views with filters and sort |
| Dashboard Metrics | KPIs, recent activity, pipeline health |
| Authentication | Google OAuth login, session management |
| Status Lifecycle | Lead → Active → Churned → Archived transitions |
| Notifications | Toast feedback, error states, loading states |
