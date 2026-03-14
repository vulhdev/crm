---
description: Create a new branch for a GitHub issue based on the latest main branch
argument-hint: <issue-url> [branch-prefix]
allowed-tools: Bash(git fetch:*), Bash(git checkout:*), Bash(git branch:*), Bash(git log:*), Bash(gh issue view:*)
---

## Arguments

The user invoked this command with: $ARGUMENTS

Parse `$ARGUMENTS` to extract:
- `issue_url`: the full GitHub issue URL (required, first argument)
- `branch_prefix`: optional branch prefix (default: `feat`)

If no issue URL is provided, ask the user for one.

## Your task

1. **Fetch issue details** using `gh issue view <issue_url>` to get the issue number and title.

2. **Update main branch** by running `git fetch origin main` to ensure you have the latest commits.

3. **Create and switch to a new branch** from `origin/main` named `<branch_prefix>/<issue_number>-<slugified-issue-title>`:
   - Slugify the title: lowercase, replace spaces and special characters with hyphens, trim leading/trailing hyphens, collapse multiple hyphens into one, max 50 chars.
   - Example: issue #12 "Add user authentication" → `feat/12-add-user-authentication`
   - Run: `git checkout -b <branch_name> origin/main`

4. **Confirm** by printing the new branch name and the latest commit it is based on (`git log --oneline -1`).

Do all of the above in a single message with multiple tool calls. Do not ask for confirmation between steps.
