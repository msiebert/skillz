---
name: sync-master
description: Fetch the latest master, merge it into the current branch, and resolve any conflicts following the repo's conventions. Use when the user asks to pull master and fix conflicts, merge master into this branch, sync with master, or "pull latest master, merge into branch, fix any conflicts".
---

# Sync Master

Bring the current branch up to date with `master` via a merge (never a rebase — repo
policy forbids rewriting history once a PR is open), resolve conflicts preserving
both sides' intent, and regenerate anything the merge invalidated.

## How to run

### 1. Pre-flight

- Note the current branch: `git -C <repo> rev-parse --abbrev-ref HEAD`.
- Check for a dirty tree: `git -C <repo> status --short`. If there are uncommitted
  changes, surface them and ask whether to stash or commit first — do not silently
  blow them away.

### 2. Fetch + merge

```
git -C <repo> fetch origin master
git -C <repo> merge origin/master
```

Merge, **not** rebase. Never force-push.

### 3. Resolve conflicts

If the merge stops with conflicts:

- `git -C <repo> diff --name-only --diff-filter=U` to list conflicted files.
- For each, resolve preserving **both** intents — the branch's change and master's.
  When unsure how two changes should combine, prefer the surrounding code's existing
  pattern, and flag the file for the user rather than guessing on anything load-bearing.
- After resolving: `git -C <repo> add <file>`, then `git -C <repo> commit` (keep the
  default merge-commit message).

### 4. Post-merge regeneration

If the merge pulled in changes to generated inputs, regenerate so the tree is consistent:

- `.proto` changed → `make -B -C protobuf`, `make -C go protobufs`,
  `make -C backend/arb/common/pb protobufs`
- `/kube/` changed → `just kube`
- lockfile inputs changed → regenerate the lockfile (don't hand-merge it)

### 5. Sanity check

Run cheap lint/tests on the merged result where applicable (`just check <file>`,
`just lint-py <file>.py`, `just pytest <file>.py`). Conflicts in code are the most
common source of a post-merge break.

### 6. Report

List the conflicted files and how each was resolved, plus any regen that ran. Do
**not** push automatically — let the user review the merge first, unless they
explicitly asked to push.

## Constraints

- **Never force-push** and **never rewrite history** after a PR exists (per `analytics/CLAUDE.md`).
- **Never run `mix deploy`** — decline and defer to the user.
- If a conflict is genuinely ambiguous or load-bearing, stop and ask rather than guessing.
