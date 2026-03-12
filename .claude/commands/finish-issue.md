---
description: Create branch, commit changes, and open a PR for a GitHub issue
argument-hint: <issue-number> [branch-prefix]
allowed-tools: Bash(git checkout:*), Bash(git branch:*), Bash(git add:*), Bash(git status:*), Bash(git diff:*), Bash(git push:*), Bash(git commit:*), Bash(git log:*), Bash(gh issue view:*), Bash(gh pr create:*)
---

## Context

- Current branch: !`git branch --show-current`
- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Recent commits: !`git log --oneline -5`

## Arguments

The user invoked this command with: $ARGUMENTS

Parse `$ARGUMENTS` to extract:
- `issue_number`: the GitHub issue number (required, first argument)
- `branch_prefix`: optional branch prefix (default: `feat`)

If no issue number is provided, ask the user for one.

## Your task

1. **Fetch issue details** using `gh issue view <issue_number>` to get the title and use it for the branch name and PR description.

2. **Create and switch to a new branch** named `<branch_prefix>/<issue_number>-<slugified-issue-title>` (e.g., `feat/42-add-user-auth`). If already on a non-main branch, skip this step and use the current branch.

3. **Stage all changes** with `git add -A` (skip if there are no uncommitted changes).

4. **Commit** with a message referencing the issue: `<type>: <short description> (closes #<issue_number>)` — derive the type and description from the diff and issue title.

5. **Push** the branch to origin with `-u` flag.

6. **Create a Pull Request** using `gh pr create` with:
   - Title referencing the issue title
   - Body that includes a summary of changes and `Closes #<issue_number>`

Do all of the above in a single message with multiple tool calls. Do not ask for confirmation between steps.
