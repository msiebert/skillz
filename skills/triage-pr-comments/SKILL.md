---
name: triage-pr-comments
description: Pull the unresolved review comments on a PR and decide which are actually worth fixing, with a one-line rationale for each — the judgment layer in front of /fix-pr. Use when the user asks to triage PR comments, review unresolved comments, decide which comments to address, assess whether greptile/bot comments are worth it, or "make a plan to resolve the comments (not all need fixing)".
---

# Triage PR Comments

This skill produces a **verdict and a plan**, not a pile of edits. `/fix-pr` blindly
resolves every comment; this skill goes in front of it and answers the question the
user keeps actually asking: _"which of these are worth fixing, and why?"_

It does **not** modify code by default. It ends with a recommended plan and offers to
hand off to `/fix-pr` or implement the agreed-upon subset.

## How to run

### 1. Resolve the target PR

- If the user passed a PR number → use it.
- Otherwise → detect from the current branch:
  `gh pr view --json number,headRefName,title,url`
  If no PR exists for the branch, say so and stop.

Capture `{owner}/{repo}` from `gh repo view --json nameWithOwner` (or assume
`mixpanel/analytics` when working in that repo).

### 2. Fetch the _unresolved_ comments

Three sources — merge them, then drop anything already resolved:

- **Inline review comments:**
  `gh api repos/{owner}/{repo}/pulls/{n}/comments --paginate`
- **Top-level discussion:** `gh pr view {n} --comments`
- **Resolved-state filter (GraphQL)** — review threads carry an `isResolved` flag
  that the REST endpoints above do not expose. Query it and discard resolved
  threads so the triage list only contains live items:

  ```
  gh api graphql -f query='
    query($owner:String!,$repo:String!,$pr:Int!){
      repository(owner:$owner,name:$repo){
        pullRequest(number:$pr){
          reviewThreads(first:100){
            nodes{ isResolved isOutdated path line
              comments(first:1){ nodes{ author{login} body url } } }
          }
        }
      }
    }' -F owner={owner} -F repo={repo} -F pr={n}
  ```

Include bot reviewers (e.g. **greptile**) — the user explicitly triages those, not
just human comments. Note any thread flagged `isOutdated`; outdated threads are
strong "Skip" candidates.

### 3. (Optional) Fold in CI

Only if the user asked to also handle CI: run `gh pr checks {n}` and add failing
checks to the plan as their own line items. For anything beyond a quick mention,
defer to the `/fix-ci` skill rather than duplicating its logic here.

### 4. Classify each comment

Read the referenced `file:line` for enough context to judge. Then present a table
**grouped by verdict**:

| #   | Comment (summary) | Location              | Verdict     | Rationale                                                     |
| --- | ----------------- | --------------------- | ----------- | ------------------------------------------------------------- |
| 1   | …                 | `path/to/file.py:123` | **Fix**     | Real bug: None deref on the deny path                         |
| 2   | …                 | `path/to/file.ts:44`  | **Skip**    | Nit on code outside this PR's scope; outdated thread          |
| 3   | …                 | `service.py:88`       | **Discuss** | Valid concern but changes the API contract — needs the author |

Verdicts:

- **Fix** — correct and in-scope; should be addressed in this PR.
- **Skip** — wrong, stylistic noise, outdated, or out of this PR's scope. Always say _why_ so the user can overrule.
- **Discuss** — legitimate but needs a decision (scope, tradeoff, design) before acting.

Explicitly state that **not every comment needs fixing**, and lean on the
project's `CLAUDE.md` "minimal, targeted change" guidance when judging scope.

### 5. Recommend, don't auto-fix

End with: the list of **Fix** items as a proposed plan, and an offer to either
hand off to `/fix-pr` or implement the **Fix** set directly once the user approves
the verdicts.

## Constraints

- **Never** mark comments resolved on GitHub — defer to the human reviewer (same as `/fix-pr`).
- Do not edit code in this skill; it is read-and-judge only until the user approves a plan.
- If a comment is ambiguous, mark it **Discuss** rather than guessing.
