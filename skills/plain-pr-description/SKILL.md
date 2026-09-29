---
name: plain-pr-description
description: Rewrite a PR description in plain language for a reviewer who knows nothing about the codebase, with short Test plan and Deployment plan sections, then apply it with gh. Use when the user asks to clean up, simplify, update, or make concise the PR description, "do the PR description cleanup", or make it clear what's going on in this PR.
---

# Plain PR Description

Rewrite the current branch's PR description so a reviewer with zero codebase context
understands what the PR does and why, at a high level. Keep the repo's four required
sections, cut implementation detail, and correct anything the old description gets wrong.

## How to run

### 1. Gather the facts

- PR metadata: `gh pr view [<number>] --json number,title,body,url,baseRefName,files`.
- The real diff is against the PR's **base branch**, which may be another PR's branch in a
  stack, not master: `git diff origin/<baseRefName>...HEAD --stat`, then read the diffs
  of the files that carry the behavior change.
- Commits on the branch: `git log --oneline origin/<baseRefName>..HEAD`. Later commits
  often change things the old description still describes (renamed fields, split
  counters). The new description must match the final code, not the first commit.
- The deployment mechanism for every surface the PR touches. Don't guess: check the
  service runbook under `docs/products/<name>/RUNBOOK.md`, `deploy-*.yaml` workflows, or
  a past PR that touched the same area (e.g. `git log origin/master -- <dir>`, then
  `gh pr view <n> --json body`). Terraform monitoring changes (dashboards, alerts) go out
  via `terrateam apply` after approval, separate from the service deploy.
- What testing actually happened in this conversation (devbox runs, manual checks). Only
  check a box for testing that was really done.

### 2. Write the description

Template, in this order:

```
## Why

1-2 sentences: the problem today, and what this PR makes possible, in plain language.

## What

- **Bold lead-in.** One or two plain sentences per bullet. At most 5 bullets.

Stacked on #<base PR>.   (only if the base is another PR)

## Test plan

- [x] Unit tests for <what they cover, in plain terms>.
- [x] Devbox: <what was run and what was confirmed>.

## Deployment plan

- <What deploys, and how: auto on merge / manual / terrateam apply>. Note ordering on a stacked base.
- Verify: <what to look at post-deploy>.
- Rollback: <exact command(s) an opslead can run>.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Style rules:

- Write for someone who has never opened the codebase. Describe behavior and outcomes,
  not files, functions, classes, or field names. A span or project name is fine when the
  reviewer needs it to go look at the result.
- Each **What** bullet leads with a bold verb phrase ("**Trace every recall.**").
- **Test plan**: aim for 2 checked items (unit + devbox/manual). Drop unchecked
  post-deploy items that the Deployment plan's verify step already covers. If an
  important case was not tested manually, say so to the user instead of adding an
  unchecked box.
- **Deployment plan**: about 3 bullets (mechanism, verify, rollback). Cover every
  surface that ships separately (service, dashboards, configmaps).
- No mannered prose, no hedging, no ticket numbers beyond what the template needs.
- Hard limits from the repo: at most 400 words and 3000 characters total.

### 3. Apply it

- Write the body to a file in the scratchpad directory (e.g. `pr-<number>-body.md`).
- `gh pr edit <number> --body-file <path>`.
- Don't change the title unless asked. Don't touch draft status.

### 4. Report

In a few lines: link the PR, one line per section describing what changed, and call out
facts you corrected from the old description (stale field names, a missing deploy
surface) plus any testing gap you left out of the Test plan.
