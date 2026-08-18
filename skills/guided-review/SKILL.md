---
name: guided-review
description: Walk the reviewer through a PR at the systems-design level, one step at a time — intent, component map with an explicit skip list, contract changes, design decisions with real alternatives, a testing interview, model-flagged smells, and comment/pattern hygiene — accumulating the reviewer's own reactions into inline PR review comments. Use when the user wants to review a PR's architecture or design rather than its line-level correctness, says they're getting lost in a large diff, asks to be walked through a PR, or asks for a guided/design/systems review.
---

# Guided Review

A stepwise walkthrough that gets the reviewer holding the *system* in their head instead of drowning in the diff. Line-level correctness is already covered by other tooling (`self-review`, `mixpanel-review`, bots) — this skill deliberately does not hunt bugs. It compresses, routes, and surfaces design decisions, then captures the reviewer's judgment.

**The output is the reviewer's opinion, not the model's.** Steps end with a checkpoint; the reviewer's reactions accumulate into a flag list, and the final step posts that flag list as inline comments on the PR. The model's own opinions are quarantined in the smells and hygiene steps and only promoted if the reviewer says so.

Repo-agnostic: architectural roles and boundaries are derived from file paths, imports, and the diff — never from hardcoded knowledge of a specific codebase.

## The load-bearing rule

**The orchestrator never reads the full diff.** It sees `--stat`, path names, `git log`, and the subagent reports. Nothing else. Reading the whole diff into the orchestrator's context reproduces the exact problem this skill exists to solve — buried in code, unable to see the system.

The one exception: targeted `Read`s of specific hunks when verifying the skip list (Step 2) or when the reviewer asks to pull a file back in.

---

## Phase 0 — Classify (always runs, cheap)

```
gh pr view --json number,title,body,url,baseRefName,headRefName,headRefOid,author
gh pr diff --name-only
gh pr diff --stat
git log --oneline <base>...HEAD
```

If no PR exists, fall back to `git diff --stat <base>...HEAD` (default base `master`) and tell the user you're walking the branch diff, not a PR.

From paths and line counts alone — **no file contents yet** — bucket every changed file into an architectural role:

| Role | Typical path/name signals |
| --- | --- |
| **External contract** | `*.proto`, `*.graphql`, `openapi*`, `schema*`, `migrations/`, `routes`, `urls`, `api/`, `__init__` re-exports, published SDK entry points |
| **Entry point** | handlers, views, controllers, endpoints, CLI commands, consumers, cron/task definitions |
| **Domain logic** | services, managers, domain/core modules, business rules |
| **Persistence** | models, repositories, DAOs, query builders, cache layers |
| **Infra / config** | CI workflows, Dockerfiles, terraform, settings, feature flags, dependency manifests |
| **Tests** | test/spec files, fixtures, factories |
| **Mechanical** | generated code, lockfiles, vendored, formatting-only, pure renames |

Then tag each non-test file **new** / **extended** / **reshaped**:

- **new** — file added.
- **extended** — additions only, existing behavior untouched.
- **reshaped** — existing lines deleted or moved; signatures, control flow, or responsibilities changed.

**`reshaped` is where the design lives.** Everything downstream prioritizes it.

### Size ladder

Pick the strategy from the classification before dispatching anything:

| Size | Strategy |
| --- | --- |
| < ~10 non-mechanical files **and** < ~400 changed lines | **No fan-out.** Do all lenses inline. Latency matters more than parallelism at this size. |
| ~10–60 files | **Full fan-out.** |
| > ~60 files or > ~3k changed lines | Fan out, but say up front that the map will be lossy, and offer to scope to one subsystem instead of pretending to cover everything. Let the user choose before proceeding. |

Mechanical files never count toward the ladder and never enter the walkthrough — they go straight to the skip list.

---

## Phase 1 — Fan out (dispatch all together, before Step 1)

Send all subagents in a single message so they run concurrently. **Do not dispatch lazily per step** — stepwise pacing is for the reviewer's reading, not the model's execution.

- `agents/contract-boundary.md` — contracts changed and their compatibility verdict. The only lens that must search outside the PR.
- `agents/core-logic.md` — the `reshaped` files; extracts decisions with *real* alternatives, not descriptions.
- `agents/test-inventory.md` — test files only; semantic assertions per component.
- `agents/comment-hygiene.md` — scans changed files for stale/historical comments and repo-pattern deviations.

Each prompt is the agent file's content plus: PR title/body, the role-classified file list with new/extended/reshaped tags, the base ref, and the head SHA. Use `subagent_type="Explore"` — all are read-only.

While they run, draft the Step 1 and Step 2 content from Phase 0 output.

---

## The walkthrough

Present **one step at a time**. Stop after each and wait. Never pre-emptively dump the next step, and never collapse two steps into one message because they seem short.

Every step header carries its number and the total, so the reviewer knows where they are: `**Step 3 of 7 — Contracts**`.

### Step 0 — Orient *(no checkpoint; fold into the Step 1 message)*

One or two lines: PR number and title, N components touched, N files (N mechanical/skipped), N contract changes, size verdict.

### Step 1 — Orient & explore

- **The problem** — what this change is for, from the PR body, linked ticket, and commit messages.
- **What it claims to do** — the author's stated scope.
- **The architecture in one sentence** — the shape of the change.

→ **Opening move (first arrival only):** name **two or three specific threads** worth digging into, drawn from reshaped files, contract-boundary findings, or anything that looks like a live design choice. Present them as an invitation — e.g. *"Worth digging into: the retry logic in the consumer, the new cache-invalidation path, or the schema migration. Where do you want to start?"* Let the reviewer explore conversationally. When a thread winds down, offer another two or three from what's left, if any remain.

**After a few exchanges**, shift from suggesting new threads to checking readiness: *"Feel oriented enough to move on, or is there more here?"*

This step is a genuine back-and-forth, not a single presentation-and-checkpoint — spend as many turns here as the reviewer wants.

### Step 2 — Map & route

**Component map** — the goal is that the reviewer can hold the *system* in their head: what each moving part **is**, and **how the parts talk to each other**. Interaction is the point, not enumeration. Two ingredients, in this order:

1. **Lead with the interaction.** Trace one representative path through the change end to end. Show it as a diagram (ASCII flow or mermaid graph) whenever more than ~three components interact. The reviewer should be able to reconstruct the flow of control from the diagram alone.

2. **Then name and explain each component.** Use a **grounded, real name** for each — its class, module, or role name, drawn from the code itself. **Never use invented behavior-based nicknames** (no "the Gate," no "the Counter"). For each: two or three sentences, dense and direct — the register a fellow engineer would use describing it at a whiteboard, not padded prose. Cover its single responsibility, its failure posture, and what it hands off to its neighbors. Close the map with one sentence on the system's overall shape.

**Do not attach a per-component file list.** The files are recoverable from the reading route and the skip list. If a component's location genuinely isn't findable from the route, mention its path inline in that component's prose, not as a standing subordinate line.

**Reading route** — an ordered list of 3–6 places to actually read, starting at the seam where the change meets the existing system. Each route stop: `path:line-range` — one sentence on what to look for.

**Skip list** — every file the reviewer can ignore, grouped with a shared reason. Give counts, not individual lines.

**Verify the skip list before presenting it.** For every skipped non-mechanical file, cross-check it against the contract-boundary agent's findings, and `Read` its hunks if it touches something the contract agent flagged, changes a signature or public export, adds a conditional or error path, or changes a default/constant. Anything that survives that check moves off the skip list and into the route.

→ **Checkpoint:** *Anything on the skip list you want pulled back in?*

### Step 3 — Contracts

From the contract-boundary agent, kept **conceptual** — not file- or line-level:

- **Contracts changed** — each with a compatibility verdict (backward-compatible / breaking / breaking-but-versioned) and, in a sentence, who's affected.

That's it. Callers outside the diff, fine-grained coupling, and dependency-direction detail are **dropped** — they either overlap the Step 2 map or drop to a granularity the reviewer doesn't want here.

→ **Checkpoint:** *Does this match your model of what's changing at the boundary?*

Record anything the reviewer objects to, doubts, or wants raised as a **flag**.

### Step 4 — Decisions

From the core-logic agent. Only surface a card when there's **genuine live tension** — a real alternative the author could plausibly have taken, not a strawman the reviewer would obviously reject.

```
**<short name>**
- Chose: <what the PR does>
- Alternative: <what else was genuinely available, concretely>
- Cost: <what this choice makes harder later>
- Question: <what to ask the author>
```

**Zero or one card is a fine, expected outcome.** Do not pad to reach three. If the agent's candidates are all descriptions dressed as decisions, or alternatives no one would seriously consider, drop them.

→ **Checkpoint:** *Any of these worth pushing on?*

Every one the reviewer names becomes a flag, using the card's `Question` as the seed.

### Step 5 — Tests (interview)

This step is an interview, not a report. **Do not show the test inventory up front.**

Component by component: ask the reviewer what they'd expect to be tested for that component, *before* revealing anything. Silently compare their answer against the actual test-inventory agent output.

**Only surface the gaps the reviewer didn't mention** — behavior with no test that would catch a regression, which the reviewer didn't think to ask about. Do not show confirmation of things they did name; the value here is the blind spot, not the checklist.

→ Each surfaced gap becomes a flag automatically.

### Step 6 — Smells

The model's own read, two or three items maximum, explicitly fenced and labeled as such:
> *Model's read, not yours — promote any of these to the question list if you agree.*

Design-level only: a misplaced responsibility, an abstraction that will leak, a pattern deviation without visible justification. No line-level bugs, no style, no naming nits. If nothing rises to that bar, say "nothing at the design level" and move on.

→ **Checkpoint:** *Promote any of these?*

### Step 7 — Comment & pattern hygiene

The model's own read, same list-and-flag shape as Step 6, from the comment-hygiene agent. Flag candidates in two categories only:

- **Stale/historical comments** — comments that narrate the change itself rather than describing current state. This means phrasing like "now does X instead of Y" or "previously this handled it differently" — **not** comments that are merely out of sync with the code (that's a correctness bug, out of scope here).
- **Verbosity** — comments substantially wordier than what they convey.

Present as a numbered list. The reviewer marks each yes/no — real issue or not.

→ Each confirmed item becomes a flag.

### Step 8 — Post review

Assemble from **the flag list only** — not from the agents' raw findings, not from Steps 6/7 unless the reviewer confirmed them.

- Each flag becomes an **inline PR comment**, anchored to its relevant line/file.
- Phrase each as a question **to the author**, not a verdict — *"What happens to in-flight jobs when the consumer redeploys mid-batch?"*, not *"this doesn't handle in-flight jobs."*
- No persona voice, no flavor text, no severity theater.
- Batch every inline comment collected across the whole walkthrough into **one GitHub review**, submitted together when the reviewer is done — not posted one at a time as they're generated.
- No confirmation checkpoint before posting; posting *is* the last step.
- If the reviewer intends to post it via the model rather than doing it themselves, the user's global posting-on-behalf-of rule applies: prefix `Response by The Claudefather:` and get explicit confirmation before posting anything.

If the flag list is empty, say so plainly and offer the alternative: assemble a review from the strongest unflagged items instead, clearly marked as the model's suggestions.

---

## Flag list (running state)

Maintain across the whole walkthrough. One entry per flag:

```
- source: <step-3-contract | step-4-decision | step-5-tests | step-6-promoted | step-7-promoted>
  subject: <the contract / decision / gap / comment/pattern>
  location: <file:line, for inline anchoring>
  reviewer said: <their actual words, paraphrased minimally>
  seed question: <draft question to the author>
```

Keep the reviewer's own framing wherever possible — their phrasing carries system context the model doesn't have.

## Navigation

Accept at any checkpoint:

- `next` — advance.
- `back` — previous step, re-presented.
- `jump <n>` / a section name (`tests`, `map`, `decisions`, `contracts`, `hygiene`) — go there directly.
- `done` — jump straight to Step 8 and post from whatever's flagged so far.

Everything is precomputed after Phase 1, so all navigation is free — never re-dispatch an agent to answer a jump. `done` must work after any step, including Step 1; bailing early with two good questions is a success case.

## Anti-instructions

- **Don't hunt bugs.** Line-level correctness is out of scope; other skills own it. If something egregious surfaces incidentally, mention it in one line in Step 6 and move on.
- **Don't assert design verdicts.** Present the system; the reviewer forms the judgment.
- **Don't skip the checkpoint questions** to save a turn. They are the mechanism by which the reviewer's knowledge enters the output.
- **Don't pad.** An empty Step 6 or 7, a one-card Step 4, or a short skip list are all fine outcomes.
- **Don't describe files.** Describe components, boundaries, and choices.
- **Don't manufacture alternatives.** A Step 4 card with a strawman alternative is worse than no card at all.
- **Don't show the test inventory before asking.** Step 5's value depends on the reviewer answering cold.
