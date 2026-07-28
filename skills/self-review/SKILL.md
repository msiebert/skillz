---
name: self-review
description: Spin up an agent team to review the PR on the current branch before you hand it to a human — one agent audits test coverage and edge cases, one checks the PR description against the code and any linked Linear ticket, and one hunts the single most likely bug. Findings are independently verified before being presented, with an option to draft inline PR comments. Use when the user asks to self-review, review my own PR, sanity-check this branch before requesting review, or "run self-review".
---

# Self Review

A pre-human-review pass over the PR on the current branch. Three specialized subagents look at it from different angles, the orchestrator independently verifies each finding (an agent's claim is not automatically trusted), and only survivors get shown to the user. This is not a style/hygiene pass — see `mixpanel-review` for that. This skill is about correctness, coverage, and whether the PR does what it says it does.

## How to run

### 1. Identify the review target

- Get the current branch's PR: `gh pr view --json number,title,body,url,headRefName,baseRefName`.
- If no PR exists yet, fall back to `git diff <base>...HEAD` (default base `master`) and proceed without a PR title/body — tell the user you're reviewing the branch diff, not a PR.
- Get the diff: `gh pr diff <n>` if a PR exists, otherwise `git diff <base>...HEAD`.
- Get the changed-file list: `gh pr diff <n> --name-only` or `git diff --name-only <base>...HEAD`.

### 2. Find a linked Linear ticket

Look for a ticket ID (e.g. `MIX-1234`) in, in this order: the branch name, the PR title, the PR body. If found, note it for the description-consistency agent to fetch. If not found, don't invent one — the agent will report its absence.

### 3. Fan out

Dispatch these three subagents **in parallel** (single message, multiple Agent tool calls), each given the diff, changed-file list, PR title/body, and (if found) the Linear ticket ID:

- `agents/test-coverage-reviewer.md` — are the automated tests complete, and what edge cases are missing?
- `agents/description-consistency-reviewer.md` — does the PR description match the code, and are the Linear ticket's requirements actually met?
- `agents/risk-hotspot-reviewer.md` — dig into the single place in the diff most likely to have a real bug.

Each subagent's prompt is the corresponding file's content, with the diff/context appended.

### 4. Independently verify every finding

Do not forward subagent claims as-is. For each finding (skip rows the agent itself marked `satisfied`/`NO_*_FOUND`/`NO_*_FINDINGS`):

- Re-read the actual file/line yourself.
- Confirm the claimed behavior is real: for a coverage gap, check the test file doesn't already cover it elsewhere; for a description mismatch, re-read the exact PR body wording; for the risk-hotspot finding, walk through the failure scenario yourself and confirm it actually reproduces given the surrounding code (not just the diff hunk).
- Mark each finding `CONFIRMED` (you verified it holds) or `PLAUSIBLE` (real concern, but you couldn't fully verify without running code/tests) or drop it if you determine it's wrong.
- If you're uncertain, prefer spawning a quick adversarial check (a fresh agent instructed to try to refute the specific claim) over guessing, when the finding is a "blocking" one.

### 5. Present findings to the user

Group by the three lenses, most severe first within each group. For every finding include: file:line, one-sentence summary, the failure scenario or requirement text, and the suggested fix. Note verification status (CONFIRMED vs PLAUSIBLE). If a lens came back clean, say so briefly — don't omit it silently.

### 6. Offer to draft inline PR comments

After presenting the report, ask whether the user wants findings drafted as inline PR review comments. Do NOT post anything without explicit confirmation — draft first, then post only on a second, explicit go-ahead.

When drafting/posting:

- Use a single `POST /repos/{owner}/{repo}/pulls/{n}/reviews` call with `event: COMMENT` and a `comments[]` array (one per finding with a known file+line), not N separate drive-by comments.
- Findings without a resolvable line go in the review `body` as a "General notes" section.
- The review `body` must start with the literal line `Response by The Claudefather:` followed by a blank line, then a short summary (e.g. "1 blocking, 2 should-fix, 1 worth-asking"), per the user's global posting-on-behalf-of instructions. No persona voice or flavor text in the posted content itself — plain professional review prose.
- Inline comment body per finding:
  ```
  **[severity]** _(lens: <test-coverage | description-consistency | risk-hotspot>)_

  <summary>

  **Suggestion:** <suggestion>
  ```
- Get `commit_id` from `gh pr view <n> --json headRefOid -q .headRefOid`.
- Build the JSON payload and print it for the user to spot-check BEFORE calling the API (dry run first). Only call after explicit go-ahead.
- If the API call fails (stale SHA, line not in diff), report the failure and the specific finding back to the user rather than silently dropping it.

## Design notes

- **Verify, don't relay.** The whole point of this skill is to catch things a human reviewer would catch — that requires the orchestrator to actually check subagent claims, not just format them.
- **One hotspot, not a scattershot.** The risk-hotspot agent is deliberately scoped to one or two spots so it goes deep instead of skimming the whole diff like the other two agents already do.
- **Fan out, don't sequentialize.** The three lenses are independent; dispatch them together.
