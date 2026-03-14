---
description: Create branch, commit changes, and open a PR for a GitHub issue
argument-hint: <issue-url>
allowed-tools: Bash(git checkout:*), Bash(git branch:*), Bash(git add:*), Bash(git status:*), Bash(git diff:*), Bash(git push:*), Bash(git commit:*), Bash(git log:*), Bash(gh issue view:*), Bash(gh pr create:*), Read, Write, Edit, Glob
---

## Context

- Current branch: !`git branch --show-current`
- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Recent commits: !`git log --oneline -5`

## Arguments

The user invoked this command with: $ARGUMENTS

Parse `$ARGUMENTS` to extract:
- `issue_url`: the full GitHub issue URL (first argument, optional)

If no issue URL is provided in `$ARGUMENTS`, **ask the user for the issue URL** before proceeding.

## Your task

1. **Fetch issue details** using `gh issue view <issue_url>` to get the issue number, title, body, and labels.

2. **Determine the branch to use:**
   - Check the current branch name. If it already matches the pattern `<prefix>/<issue_number>-*` (e.g. `feat/42-add-user-auth`), stay on it — do NOT create a new branch.
   - Otherwise, create and switch to a new branch named `<branch_prefix>/<issue_number>-<slugified-issue-title>` (default prefix: `feat`), branching from the current HEAD.

3. **Stage all changes** with `git add -A` (skip if there are no uncommitted changes).

4. **Commit** with a message referencing the issue: `<type>: <short description> (closes #<issue_number>)` — derive the type and description from the diff and issue title.

5. **Push** the branch to origin with `-u` flag.

6. **Create a Pull Request** using `gh pr create` with:
   - Title referencing the issue title
   - Body that includes a summary of changes and `Closes #<issue_number>`

7. **Update documentation** in `.claude/docs/`:
   - List all files in `.claude/docs/` to see what documents exist.
   - Based on the issue title, labels, and the diff, determine which existing document is most relevant (e.g. a feature touching auth belongs in an `auth.md`, customer views in a `customer-views.md`, etc.).
   - If a relevant document exists, **read it** and **append or update** a section describing what was changed and why (referencing the issue number).
   - If no relevant document exists, **create a new one** with a meaningful filename (e.g. `kanban-board.md`, `grid-view.md`) containing:
     - A heading describing the feature/area
     - What was implemented or changed (derived from the diff and issue body)
     - The issue reference (e.g. `Closes #<issue_number>`)
   - Keep documentation concise and factual — describe what exists, not implementation plans.

Do all of the above steps. Do not ask for confirmation between steps.
