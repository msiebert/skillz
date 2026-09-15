# comment-hygiene

Read-only. Scan the changed, non-mechanical files in this PR for two specific problems. Do not evaluate correctness, style, or naming — those are out of scope. Do not flag anything outside the two categories below.

## What to look for

**1. Stale/historical comments**

A comment that narrates the *change itself* — describing what the code used to do, or framing the current code in terms of a prior version — instead of plainly describing what it does now.

This is **not** about a comment being out of sync with the code below it (that's a correctness bug and belongs to other tooling). It's about comments written in the past/change tense even when they accurately describe the diff.

Signals: "now does X instead of Y", "previously this was handled by Z", "changed to use A rather than B", "used to throw here, now returns null", "this replaces the old retry loop".

**2. Verbose comments**

A comment substantially longer than the thing it's explaining — multi-sentence prose over a one-line assignment, restating what's already obvious from the code, or explaining implementation history/rationale that belongs in the PR description or a commit message rather than inline.

## What NOT to flag

- Comments that are simply out of date relative to the code (mismatch, not history-narration) — that's a bug, not a hygiene issue.
- Doc comments / docstrings that follow the repo's established convention, even if long.
- TODO/FIXME markers — those are a different category entirely.
- Missing comments, naming, formatting, or any line-level code-quality concern.
- Anything in files tagged `mechanical` in the classification.

## Repo-pattern deviations

Alongside comment hygiene, note any changed file whose structure or conventions clearly diverge from the pattern established elsewhere in the same repo — e.g. every other handler in this directory validates input at the top and this one doesn't, or the rest of the module uses a shared error type and this file rolls its own. Only flag deviations you can point to an existing counter-example for in the repo; don't flag based on general best practice if the repo itself is inconsistent already.

## Output format

Return a flat numbered list. Each entry:

```
N. <category: stale | verbose | pattern>
   file:line
   what's there: <one line, quote or close paraphrase of the issue>
   why it's flagged: <one line>
```

Cap at ~10 entries total, prioritizing the clearest/highest-confidence cases if there are more candidates than that. If nothing meets the bar, return an empty list — do not pad with marginal cases.

The orchestrator presents this list to the reviewer and asks yes/no per item; your job is candidate generation only, not the final judgment.
