---
description: Deep PR review with Jira requirement verification
allowed-tools: Bash(git:*), Bash(gh:*), Bash(claude:*), Read, Grep, Glob, Task, WebFetch
model: opus
---

# Deep PR Review

Perform a comprehensive review of the current branch's PR, combining two independent code review tools and verifying Jira requirements are met with test coverage.

## Prerequisites Check

Before starting, verify all prerequisites. If any are missing, tell the user exactly what to run and stop.

1. **PR exists**: Run `gh pr view --json number,title,url,body,baseRefName,headRefName`. If no PR exists, stop and tell the user to create one first.

2. **Plugins installed**: Check that the following slash commands are available. If either is missing, tell the user to install them:
   - `/code-review:code-review` — install with: `claude plugin install code-review@claude-plugins-official`
   - `/pr-review-toolkit:review-pr` — install with: `claude plugin install pr-review-toolkit@claude-plugins-official`

3. **Atlassian MCP server**: Check if Jira/Atlassian MCP tools are available. If not, tell the user to install it and restart:
   ```
   claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp
   ```

If any prerequisite is missing, list ALL missing prerequisites in one message and stop. Do not proceed with a partial setup.

## Step 1: Gather PR Context

1. Capture the PR metadata from the `gh pr view` output above (number, title, URL, body, base branch, head branch).
2. Run `git diff --name-only $(gh pr view --json baseRefName --jq .baseRefName)...HEAD` to get the list of changed files.

## Step 2: Detect Jira Ticket

Try to automatically detect the Jira ticket key from the PR metadata. Look for a pattern like `[A-Z]+-\d+` (e.g., PROJ-123, ENG-456) in:
1. The **branch name** (head ref) — e.g., `feature/PROJ-123-add-widget` or `PROJ-123/add-widget`
2. The **PR title** — e.g., "PROJ-123: Add widget support"
3. The **PR body/description** — look for Jira keys or Jira URLs containing a key

If a ticket key is found, tell the user which key was detected and from where (branch name, title, or description).

If NO ticket key is found in any of those locations, use AskUserQuestion to ask the user for their Jira ticket key (e.g., PROJ-123). Include an option for "No Jira ticket" in case this PR doesn't have one.

If the user indicates there is no Jira ticket, skip all Jira-related steps (Step 5 / Agent C) and note in the final report that no Jira verification was performed.

## Step 3: Run All Agents in Parallel

Launch **three** Task agents **in parallel** (send a single message with all three Task tool calls). If there is no Jira ticket, only launch Agents A and B.

### Agent A: PR Review Toolkit
Use subagent_type "general-purpose". Prompt:

> You are reviewing PR #[number]. Run `/pr-review-toolkit:review-pr` using the Skill tool to perform a comprehensive review.
> Return a structured list of every issue found, with:
> - file path and line number
> - description of the issue
> - severity (critical / important / suggestion / nitpick)
> - which sub-reviewer found it (code-reviewer, silent-failure-hunter, pr-test-analyzer, etc.)

### Agent B: Code Review
Use subagent_type "general-purpose". Prompt:

> You are reviewing PR #[number]. Run `/code-review:code-review` using the Skill tool to perform a code review.
> IMPORTANT: Do NOT post a comment on the PR. Instead, return the full results to me.
> Return a structured list of every issue found, with:
> - file path and line number
> - description of the issue
> - confidence score (0-100)
> - source (CLAUDE.md compliance, bug scan, git history, prior PR comments, code comments)

### Agent C: Jira Requirements Verification
Use subagent_type "general-purpose". Prompt:

> You are verifying that PR #[number] fulfills the requirements of Jira ticket [TICKET-KEY].
>
> First, use the Atlassian MCP tools to fetch the Jira ticket [TICKET-KEY]. Extract the title, description, acceptance criteria, and priority. If the MCP call fails, return an error saying "Could not fetch Jira ticket [TICKET-KEY] — MCP may need authentication setup."
>
> Then, run `gh pr diff [number]` to get the full PR diff, and `git diff --name-only [base]...HEAD` to see changed files. Read any relevant changed files to understand the implementation.
>
> For each acceptance criterion or requirement from the ticket:
> 1. **Requirements Fulfillment**: Is it MET, PARTIALLY MET, NOT MET, or UNCLEAR? Cite specific files and lines for MET items. Describe what's missing for PARTIALLY MET or NOT MET.
> 2. **Test Coverage**: Are there new or modified tests that verify this requirement? Note the test type (unit, integration, E2E). Flag any requirement with NO test coverage.
>
> Also check for **Scope Creep**: Flag any significant code changes that don't map to any Jira requirement.
>
> Return your results in this structured format:
> - List of requirements with status (MET/PARTIAL/NOT MET/UNCLEAR), test coverage (yes/no + file), and notes
> - List of untested requirements
> - List of potential scope creep items

## Step 4: Cross-Reference, Filter, and Decide

After all agents return, YOU (the coordinating instance) must critically evaluate every issue. Read the actual code yourself for any issue you are uncertain about. The goal is to output ONLY issues that genuinely need to be fixed — not a laundry list of everything the reviewers mentioned.

For each issue that survives filtering, you MUST read the relevant code and formulate a concrete suggested fix. The final report must include what specifically should be changed, not just what is wrong.

### 4a. Identify Agreement — ALWAYS FIX
Find issues that **both** Agent A and Agent B flagged — same file, same area, same concern. Two independent reviewers finding the same problem is definitive.

**Any issue flagged by both reviewers is automatically marked as needing a fix. No further evaluation is needed for these — they bypass all filtering below. Do not second-guess or downgrade them regardless of severity labels or confidence scores.**

### 4b. Adversarial Verification

For any issue you are uncertain about (whether from one reviewer or both), resume the agent that reported it using the Task tool's `resume` parameter. Challenge the finding directly — be skeptical but polite. Do NOT treat the reviewer as an authority. The reviewer must convince you with specific evidence.

Your challenge should:
- State what you observed when you read the code yourself
- Ask the reviewer to explain exactly how this issue manifests in practice (not in theory)
- Ask for a concrete scenario where this causes a real failure, not just "could potentially" language
- If the reviewer cited a line number, tell them what you see at that line and ask them to reconcile any discrepancy

Example challenge prompt:
> "I read the code at [file:line] and I see [what you observed]. You flagged this as [issue]. Can you walk me through a concrete scenario where this actually causes a failure? I'm not seeing how [specific doubt]. Convince me this is a real problem, not a theoretical one."

If the reviewer cannot provide a convincing concrete scenario, downgrade or drop the issue. If the reviewer makes a strong case with specific evidence, keep it. You are the final decision-maker — the reviewers are advisors, not authorities.

You may challenge multiple agents in parallel. Only challenge issues you are genuinely uncertain about — do not challenge issues that are obviously correct (e.g., a file path that clearly doesn't exist, a type error that's self-evident from the code).

### 4c. Apply Strict Filtering (Single-Reviewer Issues Only)

For issues flagged by **only one** reviewer, ask yourself: **"Would a senior engineer on this team insist this be fixed before merging?"**

**INCLUDE** a single-reviewer issue only if it meets ANY of these criteria:
- It is an actual bug: logic error, crash, data loss, security vulnerability, race condition
- It is a clear regression: breaks existing behavior
- It will cause significant maintainability problems if left unaddressed
- It will cause performance issues or unnecessary resource consumption
- It will cause cost issues (e.g., redundant API calls, inefficient patterns at scale)
- Confidence >= 80 AND severity is "critical" or "important"
- It violates an explicit rule in CLAUDE.md or project conventions

**EXCLUDE** (do NOT output) single-reviewer issues that are:
- A nitpick or style preference
- Confidence < 70
- Severity "suggestion" or "nitpick"
- Pre-existing issues not introduced by this PR
- Something a linter, typechecker, or compiler would catch
- Suggestions to add comments, docs, or type annotations to unchanged code
- Vague advice like "consider adding more tests" without a specific testable gap
- Anything you read the code for and determined is not actually a problem

### 4d. Final Verdict

After filtering, determine if there are any issues that actually need fixing.

- If **zero** issues survive filtering: the PR passes the deep review.
- If issues remain: list only the ones that need action.

## Step 5: Final Report

### If the PR passes (no actionable issues):

```
# Deep Review: PR #[number] — [PR title]

## PASSED

No actionable issues found. Both reviewers ran and [N] total findings were evaluated — none met the threshold for requiring a fix.

[If Jira ticket was verified:]
Jira [TICKET-KEY]: All requirements met with test coverage.
```

### If there are issues to fix:

```
# Deep Review: PR #[number] — [PR title]

## ACTION REQUIRED — [X] issue(s) to fix

[For each issue, in priority order:]

### [N]. [short description]
- **File:** [absolute file path]
- **Line(s):** [line number or range]
- **Problem:** [precise description of the bug or issue — what is wrong and why]
- **Suggested fix:** [concrete description of what the fix should do, e.g. "Remove the `module` field from package.json or add a build step that generates ESM output"]
- **Context:** [any surrounding code behavior or dependencies the fixer needs to understand]
- **Flagged by:** [which reviewer(s)]

[If Jira ticket was verified:]
If all Jira requirements are MET with test coverage, output only: `Jira [TICKET-KEY]: All requirements met with test coverage.` Do NOT output the full table.
Otherwise, if any requirement is PARTIALLY MET, NOT MET, or UNCLEAR, or there are untested requirements or scope creep items, include the full Jira section:

---

## Jira: [TICKET-KEY] — [ticket title]

| # | Requirement | Status | Test Coverage | Notes |
|---|-------------|--------|---------------|-------|
| 1 | [criterion] | MET | [test file] | |
| 2 | [criterion] | NOT MET | — | [what's missing] |

### Untested Requirements
[List if any]

### Potential Scope Creep
[List if any]
```

Do NOT include a "worth considering" or "suggestions" section. Every item in the output should be something that needs to be fixed. If it doesn't need fixing, leave it out.
