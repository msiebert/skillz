---
name: guided-review
description: Walk the reviewer through a PR at the systems-design level, one step at a time — intent, component map with an explicit skip list, blast radius, design decisions with alternatives, and a semantic test inventory by component — accumulating the reviewer's own reactions into a pasteable set of author questions. Use when the user wants to review a PR's architecture or design rather than its line-level correctness, says they're getting lost in a large diff, asks to be walked through a PR, or asks for a guided/design/systems review.
---

# Guided Review

A stepwise walkthrough that gets the reviewer holding the _system_ in their head instead of drowning in the diff. Line-level correctness is already covered by other tooling (`self-review`, `mixpanel-review`, bots) — this skill deliberately does not hunt bugs. It compresses, routes, and surfaces design decisions, then captures the reviewer's judgment.

**The output is the reviewer's opinion, not the model's.** Steps 3–5 each end with a question; the answers accumulate into a flag list, and Step 7 assembles the pasteable author-questions block from those flags. The model's own opinions are quarantined in Step 6 and only promoted if the reviewer says so.

Repo-agnostic: architectural roles and boundaries are derived from file paths, imports, and the diff — never from hardcoded knowledge of a specific codebase.

## The load-bearing rule

**The orchestrator never reads the full diff.** It sees `--stat`, path names, `git log`, and the subagent reports. Nothing else. Reading the whole diff into the orchestrator's context reproduces the exact problem this skill exists to solve — buried in code, unable to see the system.

The one exception: targeted `Read`s of specific hunks when verifying the skip list (Step 2) or when the reviewer asks to pull a file back in.

---

## Phase 0 — Classify (always runs, cheap)

```bash
gh pr view --json number,title,body,url,baseRefName,headRefName,headRefOid,author
gh pr diff --name-only
gh pr diff --stat
git log --oneline <base>...HEAD
```

If no PR exists, fall back to `git diff --stat <base>...HEAD` (default base `master`) and tell the user you're walking the branch diff, not a PR.

From paths and line counts alone — **no file contents yet** — bucket every changed file into an architectural role:

| Role                  | Typical path/name signals                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **External contract** | `*.proto`, `*.graphql`, `openapi*`, `schema*`, `migrations/`, `routes`, `urls`, `api/`, `__init__` re-exports, published SDK entry points |
| **Entry point**       | handlers, views, controllers, endpoints, CLI commands, consumers, cron/task definitions                                                   |
| **Domain logic**      | services, managers, domain/core modules, business rules                                                                                   |
| **Persistence**       | models, repositories, DAOs, query builders, cache layers                                                                                  |
| **Infra / config**    | CI workflows, Dockerfiles, terraform, settings, feature flags, dependency manifests                                                       |
| **Tests**             | test/spec files, fixtures, factories                                                                                                      |
| **Mechanical**        | generated code, lockfiles, vendored, formatting-only, pure renames                                                                        |

Then tag each non-test file **new** / **extended** / **reshaped**:

- **new** — file added.
- **extended** — additions only, existing behavior untouched.
- **reshaped** — existing lines deleted or moved; signatures, control flow, or responsibilities changed.

**`reshaped` is where the design lives.** Everything downstream prioritizes it.

### Size ladder

Pick the strategy from the classification before dispatching anything:

| Size                                                    | Strategy                                                                                                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| < ~10 non-mechanical files **and** < ~400 changed lines | **No fan-out.** Do all three lenses inline. Latency matters more than parallelism at this size.                                                                             |
| ~10–60 files                                            | **Full three-lens fan-out.**                                                                                                                                                |
| > ~60 files or > ~3k changed lines                      | Fan out, but say up front that the map will be lossy, and offer to scope to one subsystem instead of pretending to cover everything. Let the user choose before proceeding. |

Mechanical files never count toward the ladder and never enter the walkthrough — they go straight to the skip list.

---

## Phase 1 — Fan out (dispatch all three together, before Step 1)

Send all three in a single message so they run concurrently. **Do not dispatch lazily per step** — stepwise pacing is for the reviewer's reading, not the model's execution. Waiting 90 seconds at each checkpoint kills the momentum the skill exists to create.

- `agents/contract-boundary.md` — contracts changed, callers outside the diff, new coupling, dependency-direction violations. The expensive lens, and the only one that must search outside the PR.
- `agents/core-logic.md` — the `reshaped` files; extracts decisions-with-alternatives, not descriptions.
- `agents/test-inventory.md` — test files only; semantic assertions per component.

Each prompt is the agent file's content plus: PR title/body, the role-classified file list with new/extended/reshaped tags, the base ref, and the head SHA. Use `subagent_type="Explore"` — all three are read-only.

While they run, draft the Step 1 and Step 2 content from Phase 0 output.

---

## The walkthrough

Present **one step at a time**. Stop after each and wait. Never pre-emptively dump the next step, and never collapse two steps into one message because they seem short.

Every step header carries its number and the total, so the reviewer knows where they are: `**Step 3 of 7 — Blast radius**`.

### Step 0 — Orient _(no checkpoint; fold into the Step 1 message)_

One or two lines: PR number and title, N components touched, N files (N mechanical/skipped), N contract changes, size verdict.

### Step 1 — Intent & shape

- **The problem** — what this change is for, from the PR body, linked ticket, and commit messages.
- **What it claims to do** — the author's stated scope.
- **The architecture in one sentence** — the shape of the change, e.g. "adds a write-through cache in front of the existing subscription read path" or "splits the monolithic exporter into a queue producer and three consumers."

→ **Checkpoint:** _Does that match what you expected this ticket to require?_

Scope creep, a misread ticket, and an "oh, they solved a different problem" all surface here for the price of three sentences.

### Step 2 — Map & route

**Component map** — describe the _conceptual moving parts of the system_, not the files. A component is a named responsibility ("the Planner", "the Writer", "the Merge Engine"), stated as one line of what it does, plus one line of how it connects to its neighbors (what calls it, what it calls). Lead with a boxes-and-arrows read of the change: the reviewer should be able to hold the system in their head from this list alone, without a single path. Infer each component's name and job from behavior — from what the code _does_ — never from the directory it lives in. Two files in the same directory can be different components; one component can span four directories and three languages. Only after the component is named and explained do you attach its files (with new/extended/reshaped tags) as a subordinate "lives in:" line, so the reviewer can find it — the files are the address, not the thing. If a section reads like a grouped `git --stat`, it has failed; rewrite it as responsibilities. Use the same component names for the rest of the walkthrough.

**Reading route** — an ordered list of 3–6 places to actually read, starting at the seam where the change meets the existing system (usually a `reshaped` entry point or contract), not at the biggest file. Each route stop: `path:line-range` — one sentence on what to look for.

**Skip list** — every file the reviewer can ignore, grouped with a shared reason ("generated", "test fixtures for the above", "pure rename", "additive config"). Give counts, not 40 individual lines.

**Verify the skip list before presenting it.** This is the only thing in the skill that gets fact-checked, because it's the one failure mode the reviewer cannot detect themselves — they skipped the file. For every skipped non-mechanical file, cross-check it against the contract-boundary agent's findings, and `Read` its hunks if it: touches a file the contract agent flagged, changes a signature or public export, adds a conditional or error path, or changes a default/constant. Anything that survives that check moves off the skip list and into the route.

→ **Checkpoint:** _Anything on the skip list you want pulled back in?_

### Step 3 — Blast radius

From the contract-boundary agent:

- **Contracts changed** — each with a compatibility verdict (backward-compatible / breaking / breaking-but-versioned) and who consumes it.
- **Callers outside the diff** — call sites the PR didn't touch that hit changed signatures or behavior. This is the highest-value section; be concrete with `file:line`.
- **New coupling** — component pairs that now depend on each other and didn't before, with the direction.
- **Dependency-direction violations** — inner layers reaching outward, domain logic importing infrastructure, circular imports.

→ **Checkpoint:** _Does this coupling match your model of how these components relate — and is any of it a boundary you'd defend?_

Record anything the reviewer objects to, doubts, or wants raised as a **flag** (see Flag list below).

### Step 4 — Decisions

From the core-logic agent. Each decision as a compact card:

```
**<short name>**
- Chose: <what the PR does>
- Alternative: <what else was available, concretely>
- Cost: <what this choice makes harder later>
- Question: <what to ask the author>
```

Three to six cards. A "decision" is a choice with a real alternative — not a description of the code. If the agent returned descriptions dressed as decisions, drop them rather than padding the section.

→ **Checkpoint:** _Which of these do you want to push on?_

Every one the reviewer names becomes a flag, using the card's `Question` as the seed.

### Step 5 — Tests

From the test-inventory agent. Organized **by component**, semantic only — what behavior is asserted, never how the test is written. One line per case.

Then the three derived signals, which are the actual value here:

- **Zero-coverage components** — components with changed behavior and no test touching them.
- **Wiring vs. behavior** — cases that only assert something got called/constructed/didn't throw, versus cases that assert an outcome.
- **Undefended decisions** — decisions from Step 4 with no test that would fail if the choice were reverted.

→ **Checkpoint:** _Which gaps read as blocking to you?_

Each one named becomes a flag.

### Step 6 — Smells

The model's own read, two or three items maximum, explicitly fenced and labeled as such:

> _Model's read, not yours — promote any of these to the question list if you agree._

Design-level only: a misplaced responsibility, an abstraction that will leak, a pattern deviation without visible justification. No line-level bugs, no style, no naming nits. If nothing rises to that bar, say "nothing at the design level" and move on — an empty Step 6 is a good outcome, not a failure to be padded.

→ **Checkpoint:** _Promote any of these?_

### Step 7 — Author questions

Assemble from **the flag list only**. Not from the agents' findings, not from Step 6 unless promoted.

Rules for the assembled block:

- Phrase each as a question **to the author**, not a verdict. "What happens to in-flight jobs when the consumer redeploys mid-batch?" — not "this doesn't handle in-flight jobs."
- Order: contracts/coupling first, then decisions, then test gaps.
- Group under short headings when there are more than four.
- Plain markdown in a fenced block, ready to paste into a GitHub review comment. **No persona voice, no flavor text, no severity theater** — this is going in front of the author.
- If the reviewer intends to post it via the model rather than pasting it, the user's global posting-on-behalf-of rule applies: prefix `Response by The Claudefather:` and get explicit confirmation before posting anything.

If the flag list is empty, say so plainly and offer the alternative: assemble a block from the strongest unflagged items instead, clearly marked as the model's suggestions.

---

## Flag list (running state)

Maintain across the whole walkthrough. One entry per flag:

```
- source: <step-3-coupling | step-4-decision | step-5-tests | step-6-promoted>
  subject: <the contract / decision / gap>
  reviewer said: <their actual words, paraphrased minimally>
  seed question: <draft question to the author>
```

Keep the reviewer's own framing wherever possible — their phrasing carries system context the model doesn't have, and it's what makes the final block read like a human wrote it.

## Navigation

Accept at any checkpoint:

- `next` — advance.
- `back` — previous step, re-presented.
- `jump <n>` / a section name (`tests`, `map`, `decisions`, `blast radius`) — go there directly.
- `done` — jump straight to Step 7 and assemble from whatever's flagged so far.

Everything is precomputed after Phase 1, so all navigation is free — never re-dispatch an agent to answer a jump. `done` must work after any step, including Step 1; bailing early with two good questions is a success case.

## Anti-instructions

- **Don't hunt bugs.** Line-level correctness is out of scope; other skills own it. If something egregious surfaces incidentally, mention it in one line in Step 6 and move on.
- **Don't assert design verdicts.** Present the system; the reviewer forms the judgment. The model's opinions live in Step 6 and nowhere else.
- **Don't skip the checkpoint questions** to save a turn. They are the mechanism by which the reviewer's knowledge enters the output; without them this is just another report.
- **Don't pad.** An empty Step 6, a three-card Step 4, or a short skip list are all fine. Inventing a fourth decision to round out the section is worse than having three.
- **Don't describe files.** Describe components, boundaries, and choices. If a section reads like a tour of the diff, it has failed.
