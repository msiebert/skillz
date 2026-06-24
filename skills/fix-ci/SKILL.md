---
name: fix-ci
description: Pull the failing CI checks for a PR or branch, read the failing job logs, diagnose the root cause, and fix it. Use when the user asks to fix CI, fix the broken tests on a PR, "get the CI results and fix them", fix the ci failures for the branch, or when a Stop-hook condition is "fix the CI for this PR".
---

# Fix CI

Turn a red PR green: find the failing checks, read the actual logs, fix the cause in
the working tree, and verify. Works on the analytics monorepo's recurring failure
modes without re-discovering them each time.

## How to run

### 1. Resolve the target

- PR number argument → use it.
- Otherwise → current branch: `gh pr view --json number,headRefName,url`.

### 2. List the checks and find what failed

```
gh pr checks {n}
```

For the failing ones, get the run and its failing logs:

```
gh pr checks {n} --json name,state,link
gh run view <run-id> --json jobs
gh run view <run-id> --log-failed
```

`--log-failed` is the fast path — it prints only the failing steps. Read the actual
error, do not guess from the check name.

### 3. Diagnose

Trace each failure from the log to the responsible code in the working tree. Read
the failing test/assertion and the code under test before changing anything. A
failing check is one of: a test, a lint/format gate, a build, or infra/flake.

### 4. Fix

Make the **minimal, targeted** change (per `analytics/CLAUDE.md`). Watch for the
recurring monorepo failure modes:

- **Stale generated bindings** — if a `.proto` changed, regenerate and commit the
  output:
  - Python: `make -B -C protobuf`
  - Go: `make -C go protobufs`
  - C (protobuf-c): `make -C backend/arb/common/pb protobufs`
- **Lint/format gates:**
  - Python: `just lint-py <file>.py`
  - TypeScript: `npm run lint-fix`
  - single-file check: `just check <file>`
- **Lockfile / dependency drift** — regenerate the lockfile rather than hand-editing.
- **`/kube/` changes** — recompile with `just kube` (only edit `.libsonnet`/`.jsonnet`).
- **Infra flakes (e.g. "Terraform user-not-found")** — before assuming the branch
  caused it, check whether `master` is also failing the same check. If master is
  red too, it is not your branch's fault; report that instead of forcing a fix.

### 5. Verify locally

Re-run the failing check locally where cheap:

- Python tests: `just pytest <file>.py`
- Go/C++: `bazel test <target>`
- lint: `just check <file>` / `npm run lint-fix`

### 6. Report

Summarize each failure → root cause → fix, and flag anything that needs manual
action (secrets, infra, flaky reruns). Push only if the user asked.

## Constraints

- **Never run `mix deploy`** (per `analytics/CLAUDE.md`) — if a fix seems to require
  it, decline and tell the user to run it themselves.
- Do not rewrite git history on a branch that already has a PR; fix forward with new commits.
- If the failure is a genuine infra flake outside the diff, say so rather than inventing a code change.
