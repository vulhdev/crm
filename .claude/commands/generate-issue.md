---
description: Generate a GitHub issue (with optional sub-issues) from a docs file or folder
argument-hint: <doc-file-or-folder-path>
allowed-tools: Read, Bash(gh issue create:*), Bash(gh issue view:*), Bash(gh label list:*), Bash(gh issue list:*), Glob
---

## Arguments

The user invoked this command with: $ARGUMENTS

Parse `$ARGUMENTS` to extract:
- `doc_path`: path to a documentation/specification **file** or **folder** (required)

If no path is provided, ask the user for one before proceeding.

## Your task

### Step 1 — Read the doc content

Determine whether `doc_path` is a file or a folder:

- **File**: read it directly.
- **Folder**: use Glob to list all files inside (`<doc_path>/**/*`), then read each file. Treat all files together as a single unified body of requirements — note the filename of each as context (e.g. `prd.md` → requirements, `tech-brief.md` → technical constraints, `ux-brief.md` → UX flows, `test-plan.md` → acceptance criteria).

After reading, synthesize the full picture: goals, user stories, requirements, technical notes, acceptance criteria, UX flows, etc.

### Step 2 — Assess complexity

Decide whether the work described is **simple** or **complex**:

- **Simple**: a single, well-scoped task that one developer can implement in a focused session (e.g. a single UI component, one API endpoint, a small bug fix).
- **Complex**: involves multiple distinct concerns that can be developed independently or in parallel (e.g. frontend + backend + auth, multi-step feature, cross-cutting refactor). Use this rule of thumb: if the doc describes **3 or more independent workstreams**, treat it as complex.

### Step 3 — Check available labels

Run `gh label list` to see which labels exist. Note any that are relevant (e.g. `enhancement`, `feature`, `frontend`, `backend`, `bug`).

### Step 4 — Create the issue(s)

#### If **simple** → create one issue

Use `gh issue create` with:

- **Title**: concise action-oriented title derived from the doc (e.g. `feat: <short description>`)
- **Body** (HEREDOC):

```
## Overview
[1-2 sentence summary of what needs to be done]

## Acceptance Criteria
- [ ] [criterion 1]
- [ ] [criterion 2]
- [ ] ...

## Technical Notes
[key implementation details, constraints, or references from the doc — omit if none]

## References
- Source: `<doc_path>`
```

- **Labels**: apply any matching labels found in step 3; skip if none match.

---

#### If **complex** → create one parent issue + sub-issues

**Parent issue** — the umbrella task:

- **Title**: `feat: <feature name>` (high-level)
- **Body** (HEREDOC):

```
## Overview
[1-3 sentence description of the full feature]

## Scope
[bullet list of the main areas of work]

## Sub-tasks
<!-- filled in below after sub-issues are created -->

## References
- Doc: `<doc_file>`
```

- **Labels**: apply any matching labels.

After creating the parent issue, note its issue number (`PARENT_NUMBER`).

**Sub-issues** — one per independent workstream identified in the doc:

For each sub-issue, use `gh issue create` with:

- **Title**: `<parent title> — <workstream name>` (e.g. `feat: customer filters — backend API`)
- **Body** (HEREDOC):

```
## Parent issue
#<PARENT_NUMBER>

## Overview
[what this workstream covers]

## Acceptance Criteria
- [ ] [criterion 1]
- [ ] [criterion 2]
- [ ] ...

## Technical Notes
[implementation details specific to this workstream — omit if none]

## References
- Doc: `<doc_file>`
```

- **Labels**: apply relevant labels per workstream (e.g. `frontend`, `backend`).

After all sub-issues are created, **edit the parent issue body** to replace the `<!-- filled in below -->` line with the actual sub-issue list:

```
## Sub-tasks
- [ ] #<sub1_number> — <sub1 title>
- [ ] #<sub2_number> — <sub2 title>
- [ ] ...
```

Use `gh issue edit <PARENT_NUMBER> --body "$(cat <<'EOF' ... EOF)"` to update the parent.

### Step 5 — Print results

Print the URL(s) of every issue created so the user can open them directly.
