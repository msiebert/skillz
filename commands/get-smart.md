---
description: Extract learnings from PR review comments and code changes to update CLAUDE.md files
allowed-tools: Bash(git:*), Bash(gh:*), Read, Grep, Glob, Write, Task
model: opus
---

# Get Smart: Extract Learnings from PR

Extract non-obvious learnings from a PR's review comments and code changes, then create a separate PR updating CLAUDE.md files.

## Step 1: Input Handling

Determine the PR number to analyze.

- If the user provided a PR number as an argument (e.g., `/get-smart 1234`), use that number: `$ARGUMENTS`
- If no argument was provided (empty `$ARGUMENTS`), detect the current branch's PR by running: `gh pr view --json number --jq .number`
- If no PR is found, stop and tell the user: "No PR found for the current branch. Please provide a PR number: `/get-smart <number>`"

Save the current branch name for later: `git rev-parse --abbrev-ref HEAD`

Extract `{owner}/{repo}` by running: `gh repo view --json nameWithOwner --jq .nameWithOwner`

## Step 2: Gather PR Context

Run the following commands **in parallel** using Bash tool calls to gather all context:

1. **PR metadata**: `gh pr view {number} --json number,title,body,baseRefName,headRefName,url`
2. **Full diff**: `gh pr diff {number}`
3. **Changed files**: `gh pr diff {number} --name-only`
4. **Review comments** (inline, with threads): `gh api repos/{owner}/{repo}/pulls/{number}/comments --paginate`
5. **Issue comments** (general PR discussion): `gh api repos/{owner}/{repo}/issues/{number}/comments --paginate`
6. **Reviews** (approve/request changes bodies): `gh api repos/{owner}/{repo}/pulls/{number}/reviews --paginate`
7. **Existing CLAUDE.md files**: Use Glob to find all `**/CLAUDE.md` files, then Read all found files

## Step 3: Launch Analysis Agents in Parallel

Launch **two** Task agents **in parallel** (send a single message with both Task tool calls).

### Agent A — Comment Thread Analysis

Use `subagent_type: "general-purpose"`. Provide all review comments, issue comments, and review bodies in the prompt.

Prompt:

> You are analyzing PR review comments to extract non-obvious learnings for CLAUDE.md files.
>
> Here are the review comments (inline), issue comments, and review bodies from PR #{number}:
>
> [paste all comment data here]
>
> Here is the existing CLAUDE.md content (if any):
>
> [paste existing CLAUDE.md content here]
>
> Your task:
>
> 1. Reconstruct comment threads using `in_reply_to_id` for inline comments to understand the full conversation context.
>
> 2. Filter for comments that reveal **non-obvious information** — things a developer couldn't easily figure out by reading the code:
>    - Cross-cutting concerns and implicit contracts between modules
>    - Unexpected side effects or gotchas
>    - Historical context or "why" decisions that aren't documented
>    - System behavior that isn't apparent from reading the changed files alone
>    - Product-level constraints that affect technical decisions
>    - Operational workflows: how changes are deployed, tested, or applied (e.g., what CI/CD tools are used, what order things must happen in)
>
> 3. **Preserve specificity**: When reviewers mention specific tool names, commands, or processes (e.g., "run terrateam apply", "use bazel test"), preserve those details verbatim in the learning. These reveal operational knowledge about how the team works. Do not abstract them into generic descriptions. If the operation is a deployment, infrastructure change, or other high-impact action (e.g., `terrateam apply`, `gcloud`, `mix deploy`), explicitly note in the learning that it is a human-only operation that AI agents should not perform.
>
> 4. **Ignore** all of the following:
>    - Style nitpicks and formatting suggestions
>    - Linter-catchable issues (import order, unused variables, etc.)
>    - Bot comments (dependabot, renovate, CI bots, etc.)
>    - Comments that merely describe what the code does (obvious from reading it)
>    - Generic advice without specific insight ("add more tests", "consider error handling")
>    - Documentation or commenting conventions (e.g., "add a comment explaining X", "document imports with this format") — these are stylistic, not architectural
>
> 5. For each learning found, return it in this exact format:
>
> ```
> LEARNING:
> statement: <1-2 sentence concise learning>
> paths: <comma-separated relevant file paths or directories>
> scope: <either "project-wide" or "directory: <path>">
> ```
>
> If no meaningful learnings are found, return: `NO_LEARNINGS_FOUND`

### Agent B — Code Pattern Analysis

Use `subagent_type: "general-purpose"`. Provide the full diff, changed file list, and existing CLAUDE.md content. The agent has access to Read, Grep, and Glob tools.

Prompt:

> You are analyzing a PR's code changes to extract non-obvious patterns and conventions for CLAUDE.md files.
>
> Here is the full diff from PR #{number}:
>
> [paste full diff here]
>
> Changed files:
>
> [paste changed file list here]
>
> Here is the existing CLAUDE.md content (if any):
>
> [paste existing CLAUDE.md content here]
>
> Your task:
>
> 1. Identify candidate patterns, conventions, and architectural decisions visible in the diff.
>
> 2. For each candidate pattern, **verify it isn't already easily discoverable**:
>    - Use Grep to search for similar patterns in the codebase — if the pattern is widely used and self-evident, skip it
>    - Check if existing CLAUDE.md content already covers it — if so, skip it
>    - Check if there are existing docs, comments, or READMEs that explain it — if so, skip it
>
> 3. Only keep patterns that meet ALL of these criteria:
>    - Not obvious from browsing the code
>    - Not already documented
>    - Would save a future developer from making a mistake or wrong assumption
>    - Is about architecture, behavior, or workflow — NOT about code comments, documentation formatting, or naming conventions
>
> 4. **Right level of abstraction**: Always generalize learnings to the broadest scope where they still hold true. If a diff shows a pattern with a specific technology but the principle applies more broadly, state the learning in general terms. For example, if a diff replaces `dataset_id = "feature_flags"` with `dataset_id = google_bigquery_dataset.feature_flags.dataset_id`, the learning is NOT "use resource references for BigQuery datasets" — it IS "always use Terraform resource references instead of hardcoded ID strings to ensure proper dependency tracking." Only keep a learning technology-specific if the insight is genuinely unique to that technology.
>
> 5. Focus areas:
>    - Architectural conventions that aren't enforced by tooling
>    - Implicit contracts between modules (e.g., "service A must be initialized before service B")
>    - Product-level behavior patterns that affect how code should be written
>    - Non-obvious dependency relationships
>    - Surprising behavior or gotchas discovered through the changes
>
> 6. For each pattern found, return it in this exact format:
>
> ```
> LEARNING:
> statement: <1-2 sentence concise learning>
> paths: <comma-separated relevant file paths or directories>
> scope: <either "project-wide" or "directory: <path>">
> ```
>
> If no meaningful patterns are found, return: `NO_LEARNINGS_FOUND`

## Step 4: Synthesize CLAUDE.md Updates

After both agents return, YOU (the coordinating instance) handle synthesis. Do NOT delegate this to an agent.

### 4a. Collect and Parse

Parse all `LEARNING:` blocks from both agents. If both agents returned `NO_LEARNINGS_FOUND`, report to the user that no meaningful learnings were found in this PR and stop — do not create a PR.

### 4b. Deduplicate

If both agents surfaced the same or substantially similar insight, merge into a single entry. Keep the more concise wording.

### 4c. Check Against Existing CLAUDE.md Content

For each learning:
- If an existing CLAUDE.md entry already covers it → skip it
- If an existing CLAUDE.md entry is **directly contradicted** by the PR's changes → mark it for removal

### 4d. Determine Placement

- `project-wide` learnings → root `CLAUDE.md`
- `directory: <path>` learnings → `<path>/CLAUDE.md` (create if needed)

### 4e. Write Entries

Each learning should be 1-2 sentences max. Use concise, directive language (e.g., "Always X when Y" or "X requires Y because Z").

**When adding to an existing CLAUDE.md:**
- Read the existing structure and place entries in the most appropriate existing category/section
- If no existing category fits, create a new descriptively-named section for those learnings
- Never use a generic "Learnings" or "PR Learnings" heading

**When creating a new CLAUDE.md:**
```markdown
# CLAUDE.md

## <Category>
- <learning>
```

Categories should be derived from the nature of the learnings (e.g., "Architecture", "Side Effects", "Conventions", "Testing", "Data Flow") rather than using a fixed set.

### 4f. Final Check

If after deduplication and filtering against existing content, **zero** learnings remain and no entries need removal → report to the user that all insights from this PR are already captured and stop. Do not create a PR.

## Step 5: Create PR

1. **Check for existing branch**: Run `git branch -l get-smart-pr-{number}` and `git ls-remote --heads origin get-smart-pr-{number}`. If the branch exists locally or remotely, delete it:
   - `git branch -D get-smart-pr-{number}` (local, if exists)
   - `git push origin --delete get-smart-pr-{number}` (remote, if exists)

2. **Create branch** off the default branch:
   ```
   git checkout -b get-smart-pr-{number} main
   ```

3. **Write** the updated/new CLAUDE.md files using the Write tool.

4. **Commit**:
   ```
   git add -A && git commit -m "Update CLAUDE.md with learnings from PR #{number}"
   ```

5. **Push**:
   ```
   git push -u origin get-smart-pr-{number}
   ```

6. **Create PR** via `gh pr create`:
   ```
   gh pr create \
     --title "CLAUDE.md: learnings from PR #{number}" \
     --assignee msiebert \
     --body "Extracted from #{number} ({pr_url})."
   ```

7. **Switch back** to the original branch:
   ```
   git checkout {original_branch}
   ```

## Step 6: Output

Report to the user:
- How many learnings were added, updated, or removed
- Which CLAUDE.md files were modified or created
- The URL of the created PR
