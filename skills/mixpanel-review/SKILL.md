---
name: mixpanel-review
description: Review a Mixpanel PR for the recurring design, correctness, and test-coverage smells the team flags in code review. Dispatches a parallel team of specialized subagents (test-coverage expert, design reviewer, hygiene reviewer); each loads only the pattern files relevant to its lens, so the orchestrator never reads the full pattern corpus. Use when the user asks to review a PR, review the current diff, audit test coverage, or run a Mixpanel-style review.
---

# Mixpanel Review

A directed, index-driven PR review skill. The pattern corpus encodes "if you see X, look for Y" rules harvested from past Mixpanel code reviews. **The orchestrator does not read the patterns** — it only reads `patterns/INDEX.md` to decide who needs what, then dispatches subagents that each load a small subset.

## How to run

When invoked:

### 1. Identify the review target

- If the user passed a PR number → `gh pr diff <n> --repo mixpanel/analytics` for the diff, `gh pr view <n> --json files,title,body` for context.
- Otherwise → use the current branch's diff against `master` (`git diff master...HEAD`) and `gh pr view --json files,title,body` if a PR exists.

### 2. Quick triage (orchestrator only)

Read `patterns/INDEX.md`. Using ONLY the file list from the diff (not the contents), decide which of the three subagents are warranted:

- **test-coverage-expert** — dispatch if any `test_*.py`, `*.test.ts`, `*.spec.ts`, `*_test.go`, or test fixtures changed.
- **design-reviewer** — dispatch if any non-test source files changed.
- **hygiene-reviewer** — always dispatch; cheap and catches the things humans miss late.

If a category has no relevant files, skip it. Do not pad.

### 3. Fan out

Use the Task tool to dispatch the chosen subagents **in parallel** (single message, multiple Task calls), `subagent_type: "general-purpose"`. Each subagent prompt is the corresponding `agents/<name>.md` file, with the diff and changed-file list appended.

Each subagent:

- Reads its own agent file for instructions.
- Reads ONLY the pattern files listed in that agent file.
- Returns a structured findings list (see format in each agent file).

### 4. Collate

Receive subagent outputs. Deduplicate any overlapping findings. Produce a single review report grouped by severity:

- **Blocking** — correctness bugs, missing test coverage on new behavior, asymmetric error handling.
- **Should-fix** — design smells, naming concerns, graceful-degradation gaps.
- **Hygiene** — stray references, unrelated style changes, scope creep.

For each finding, include: file path, line (if known), the pattern name it matched, and a one-sentence explanation. Do not paste the pattern file content into the report.

### 5. Output

Present the report to the user in the chat, grouped by severity. Include file:line for each finding.

### 6. Offer to post to the PR

After presenting the report, ask the user whether to post the findings as comments on the PR. Do NOT post without explicit confirmation. If the user already said "post to PR" / "comment on the PR" / similar when invoking, treat that as the confirmation but still show the report first so they can veto.

Posting rules:

- **One PR review, many inline comments.** Use a single `POST /repos/{owner}/{repo}/pulls/{n}/reviews` call with `event: COMMENT` and an array of `comments[]` entries, one per finding that has a known file+line. This groups them as a single review instead of N drive-by comments.
- **Findings without a line** (line: "—") go in the review `body` as a bulleted "General notes" section, not as inline comments (the reviews API rejects inline comments without a line).
- **Review body** starts with the literal line `Response by The Claudefather:` followed by a blank line, then a short summary (counts by severity, e.g. "2 blocking, 3 should-fix, 1 hygiene"), then the General notes section if any. This prefix is required for any message posted on the user's behalf and overrides anything else.
- **Inline comment body** for each finding:
  ```
  **[severity]** _(pattern: <pattern-name>)_

  <one_liner>

  **Suggestion:** <suggestion>
  ```
  No persona voice, no flavor text, no emojis in posted content. Plain professional review prose only.
- **Commit SHA.** The reviews API needs `commit_id` set to the PR head SHA. Get it from `gh pr view <n> --json headRefOid -q .headRefOid`.
- **How to call gh.** The nested `comments[]` array is awkward with `-f` flags; build a JSON payload and pipe it: `gh api -X POST repos/{owner}/{repo}/pulls/{n}/reviews --input -`. Read the owner/repo from `gh pr view <n> --json url` or assume `mixpanel/analytics` if the orchestrator already used it for the diff.
- **Dry-run first.** Before calling the API, print the JSON payload you're about to send so the user can spot-check it. Only post after they say go.

If the API call fails (e.g., line not in the diff, stale SHA), report the failure and the offending finding back to the user — don't silently drop it.

## Design notes

- **Index, not corpus.** The orchestrator reads `INDEX.md` (one line per pattern); subagents read individual pattern files only when their lens applies. New patterns added to `patterns/` must be registered in `INDEX.md` AND in the relevant `agents/<name>.md` reading list.
- **Pattern files are small and uniform.** Each has: Trigger, Look for, Why it matters, Suggest. Subagents pattern-match the diff against the trigger, then apply the rule.
- **Fan out, don't sequentialize.** Subagents run in parallel because their lenses are independent.
