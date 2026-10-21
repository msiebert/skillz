---
name: guided-review
description: Walk the reviewer through a PR at the systems-design level, one step at a time — intent, component map with a reading route, design decisions with real alternatives, contract changes, the critical missing tests, and design smells — accumulating the reviewer's own reactions into inline PR review comments. Use when the user wants to review a PR's architecture or design rather than its line-level correctness, says they're getting lost in a large diff, asks to be walked through a PR, or asks for a guided/design/systems review.
---

# Guided Review

A stepwise walkthrough that gets the reviewer holding the _system_ in their head instead of drowning in the diff. Line-level correctness is out of scope here — pair this with whatever review tooling and bots you already use; this skill deliberately does not hunt bugs. It compresses, routes, and surfaces design decisions, then captures the reviewer's judgment.

**Prerequisites:** this skill assumes the GitHub `gh` CLI is installed and authenticated, and that the PR lives on GitHub (Step 7 posts inline review comments via `gh`).

Steps end with a checkpoint; the reviewer's reactions accumulate into a flag list, and the final step posts that flag list as inline comments on the PR. Smells and critical tests only become flags if the reviewer says so.

Repo-agnostic: architectural roles and boundaries are derived from file paths, imports, and the diff — never from hardcoded knowledge of a specific codebase.

## The load-bearing rule

**The orchestrator never reads the full diff.** It sees `--stat`, path names, `git log`, and the subagent reports. Nothing else. Reading the whole diff into the orchestrator's context reproduces the exact problem this skill exists to solve — buried in code, unable to see the system.

The one exception: targeted `Read`s of specific hunks when the reviewer asks to pull a file back in.

---

## Phase 0 — Classify (always runs, cheap)

```
gh pr view --json number,title,body,url,baseRefName,headRefName,headRefOid,author
gh pr diff --name-only
gh pr diff --stat
git log --oneline <base>...HEAD
```

If no PR exists, fall back to `git diff --stat <base>...HEAD` and tell the user you're walking the branch diff, not a PR. Detect `<base>` from the repo's default branch (`git symbolic-ref refs/remotes/origin/HEAD`, or `gh repo view --json defaultBranchRef`); if detection fails, try `main` then `master`.

From paths and line counts alone — **no file contents yet** — bucket every changed file into an architectural role:

| Role                  | Typical path/name signals                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **External contract** | `*.proto`, `*.graphql`, `openapi*`, `schema*`, `migrations/`, `routes`, `urls`, `api/`, `__init__` re-exports, published SDK entry points |
| **Entry point**       | handlers, views, controllers, endpoints, CLI commands, consumers, cron/task definitions                                                   |
| **Domain logic**      | services, managers, domain/core modules, business rules                                                                                   |
| **Persistence**       | models, repositories, DAOs, query builders, cache layers                                                                                  |
| **Infra / config**    | CI workflows, Dockerfiles, terraform, settings, feature flags, dependency manifests                                                       |
| **Tests**             | test/spec files, fixtures, factories                                                                                                      |

Silently set aside generated code, lockfiles, vendored files, formatting-only changes, and pure renames: leave them out of the agents' file lists, the size ladder, and the walkthrough, and never present them as a category.

Then tag each remaining non-test file **new** / **extended** / **reshaped**:

- **new** — file added.
- **extended** — additions only, existing behavior untouched.
- **reshaped** — existing lines deleted or moved; signatures, control flow, or responsibilities changed.

**`reshaped` is where the design lives.** Everything downstream prioritizes it.

### Size ladder

Pick the strategy from the classification before dispatching anything:

| Size                                                    | Strategy                                                                                                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| < ~10 files **and** < ~400 changed lines              | **No fan-out.** Do all lenses inline. Latency matters more than parallelism at this size.                                                                                   |
| ~10–60 files                                            | **Full fan-out.**                                                                                                                                                           |
| > ~60 files or > ~3k changed lines                      | Fan out, but say up front that the map will be lossy, and offer to scope to one subsystem instead of pretending to cover everything. Let the user choose before proceeding. |

### File links

Whenever you show the reviewer a file or `path:line` (component map, reading route, decisions, contracts, critical tests, smells), render it as a markdown link into the PR's "Files changed" view instead of a bare path:

```
https://github.com/<owner>/<repo>/pull/<n>/files#diff-<sha256 of the file path>
```

For a specific line append `R<line>` (right side of the diff), e.g. `...#diff-<hash>R42`; for a range, `R42-R57`. The link text is the `path:line` as written.

- `<owner>/<repo>` and `<n>` come from the `url` field of `gh pr view` (`https://github.com/<owner>/<repo>/pull/<n>`).
- The hash is the SHA-256 of the file's repo-relative path, as `gh pr diff --name-only` prints it: `printf '%s' "<path>" | shasum -a 256`. Compute it once in Phase 0 for every changed file and keep a path-to-URL map; build line links by appending `R<line>` to the mapped URL.
- Line anchors only resolve for lines inside the diff. For code outside the diff (e.g. callers elsewhere in the repo), or a file not in the changed list, use a plain `path:line`.
- With no PR (local branch diff), there is no Files changed view: use plain `path:line` everywhere.

Agents return plain `path:line`; the orchestrator builds the links.

---

## Phase 1 — Fan out (dispatch all together, before Step 1)

Send all subagents in a single message so they run concurrently. **Do not dispatch lazily per step** — stepwise pacing is for the reviewer's reading, not the model's execution.

- `agents/contract-boundary.md` — contracts changed and their compatibility verdict. The only lens that must search outside the PR.
- `agents/core-logic.md` — the `reshaped` files; extracts decisions with _real_ alternatives, not descriptions.
- `agents/critical-tests.md` — the few missing tests whose absence is a real risk, each with why it's critical.

Each prompt is the agent file's content plus: PR title/body, the role-classified file list with new/extended/reshaped tags, the base ref, and the head SHA. Remind each agent to cite every file as `path:line` (repo-relative) so the orchestrator can link it. Use `subagent_type="Explore"` — all are read-only.

While they run, draft the Step 0, Step 1, and Step 2 content from Phase 0 output — but do not present any of it yet. **Wait for all subagents to complete before starting the walkthrough.** Presenting Step 0 or Step 1 while the agents are still running interleaves the walkthrough with the dispatch; the reviewer's first step should arrive on a clean turn once the reports are back.

---

## The walkthrough

**The walkthrough begins only after Phase 1's subagents have all returned.** Step 0 and Step 1 are the reviewer's entry point — hold them until every report is in, so the orient/explore content starts cleanly and doesn't get mixed up with agent dispatch.

Present **one step at a time**. Stop after each and wait. Never pre-emptively dump the next step, and never collapse two steps into one message because they seem short.

Every step header carries its number and the total, so the reviewer knows where they are: `**Step 3 of 7 — Decisions**`.

**Prefer pseudocode to prose whenever it conveys meaning better.** Engineers grok a few lines of pseudocode faster than a paragraph. Any time you judge that a short pseudocode sketch would land an idea more clearly than sentences — control flow, an algorithm, a condition, a before/after in behavior, or anything else, in any step — use it. Keep it plain-text and terminal-renderable, same constraint as the diagrams. Prose still carries intent, tradeoffs, and anything pseudocode would only bloat.

### Step 0 — Orient _(no checkpoint; fold into the Step 1 message)_

One or two lines: PR number and title, N components touched, N files, N contract changes, size verdict.

### Step 1 — Orient & explore

- **The problem** — what this change is for, from the PR body, linked ticket, and commit messages.
- **What it claims to do** — the author's stated scope.
- **The architecture in one sentence** — the shape of the change.

→ **Opening move (first arrival only):** name **two or three specific threads** worth digging into, drawn from reshaped files, contract-boundary findings, or anything that looks like a live design choice. Present them as an invitation — e.g. _"Worth digging into: the retry logic in the consumer, the new cache-invalidation path, or the schema migration. Where do you want to start?"_ Let the reviewer explore conversationally. When a thread winds down, offer another two or three from what's left, if any remain.

**After a few exchanges**, shift from suggesting new threads to checking readiness: _"Feel oriented enough to move on, or is there more here?"_

This step is a genuine back-and-forth, not a single presentation-and-checkpoint — spend as many turns here as the reviewer wants.

### Step 2 — Map & route

**Component map** — the goal is that the reviewer can hold the _system_ in their head: what each moving part **is**, and **how the parts talk to each other**. Interaction is the point, not enumeration. Two ingredients, in this order:

1. **Lead with the interaction.** Trace one representative path through the change end to end. Show it as a plain ASCII/text diagram whenever more than ~three components interact — never mermaid or any other diagram format that isn't renderable as plain text in a terminal (the review runs in a terminal that renders GitHub-flavored markdown but not mermaid). The reviewer should be able to reconstruct the flow of control from the diagram alone.

2. **Then name and explain each component.** Use a **grounded, real name** for each — its class, module, or role name, drawn from the code itself. **Never use invented behavior-based nicknames** (no "the Gate," no "the Counter"). For each: two or three sentences, dense and direct — the register a fellow engineer would use describing it at a whiteboard, not padded prose. Cover its single responsibility, its failure posture, and what it hands off to its neighbors. Close the map with one sentence on the system's overall shape.

**Do not attach a per-component file list.** The files are recoverable from the reading route. If a component's location genuinely isn't findable from the route, mention its path inline in that component's prose, not as a standing subordinate line.

**Reading route** — an ordered list of 3–6 places to actually read, starting at the seam where the change meets the existing system. Each route stop: `path:line-range` — one sentence on what to look for.

### Step 3 — Decisions

From the core-logic agent. Only surface a card when there's **genuine live tension** — a real alternative the author could plausibly have taken, not a strawman the reviewer would obviously reject.

```
**<short name>**
- Chose: <what the PR does>
- Alternative: <what else was genuinely available, concretely>
- Cost: <what this choice makes harder later>
- Question: <what to ask the author>
```

The `Chose` and `Alternative` lines are prime pseudocode candidates — a two-line sketch of each path usually beats describing it in words.

**Zero or one card is a fine, expected outcome.** Do not pad to reach three. If the agent's candidates are all descriptions dressed as decisions, or alternatives no one would seriously consider, drop them.

→ **Checkpoint:** _Any of these worth pushing on?_

Every one the reviewer names becomes a flag, using the card's `Question` as the seed.

### Step 4 — Contracts

From the contract-boundary agent, kept **conceptual** — not file- or line-level:

- **Contracts changed** — each with a compatibility verdict (backward-compatible / breaking / breaking-but-versioned) and, in a sentence, who's affected.

That's it. Callers outside the diff, fine-grained coupling, and dependency-direction detail are **dropped** — they either overlap the Step 2 map or drop to a granularity the reviewer doesn't want here.

→ **Checkpoint:** _Does this match your model of what's changing at the boundary?_

Record anything the reviewer objects to, doubts, or wants raised as a **flag**.

### Step 5 — Critical tests

From the critical-tests agent: only the tests that are missing and genuinely critical — their absence is a real risk, not a nice-to-have. Present a short numbered list (five at most), each with the behavior that needs a test and a one-line reason it's critical.

If the agent found nothing that meets the bar, say "no critical test gaps" and move on. Do not add items to fill the list.

→ **Checkpoint:** _Flag any of these? yes/no per item._

Each "yes" becomes a flag, using the item's behavior and reason as the seed. "No" items are dropped.

### Step 6 — Smells

Two or three items maximum. Design-level only: a misplaced responsibility, an abstraction that will leak, a pattern deviation without visible justification. No line-level bugs, no style, no naming nits. If nothing rises to that bar, say "nothing at the design level" and move on.

State each smell as **trigger → outcome**: the plausible input, state, or future edit that sets it off, and what goes observably wrong after it (wrong result, error, extra call). A smell that only describes structure ("X subclasses Y") isn't ready to show; work out what it breaks first, so a promoted smell is already a concrete flag.

→ **Checkpoint:** _Promote any of these?_

### Step 7 — Post review

Post the approved `draft comment` of each flag in **the flag list only** — not the agents' raw findings, not Steps 5/6 items the reviewer didn't confirm. Drafts are written and approved when the flag is recorded; this step only posts them.

- Each flag is posted as an **inline PR comment**, anchored to its `location`.
- Drafts are phrased as a question **to the author**, not a verdict — _"What happens to in-flight jobs when the consumer redeploys mid-batch?"_, not _"this doesn't handle in-flight jobs."_
- Drafts are written so a reader unfamiliar with the code can follow them on their own, in this order, as concisely as possible:

  1. **Context** — one sentence on what this code does or which invariant/config/caller matters here.
  2. **The concern and why it's real** — the concrete input or state that leads to the wrong behavior, backed by the specific evidence (function names, `file:line`, values, related code elsewhere). Pseudocode beats prose when it's clearer. Name a concrete **trigger** (an input, a state, or a plausible future edit) and the **observable outcome** (wrong result, error message, extra call). For "fine today but fragile" concerns, show the actual code involved, the specific edit that breaks it, what happens after that edit, and why existing tooling (types, tests) won't catch it. A sketch that only restates the structure is not enough.
  3. **The question** (and a suggested fix, if there is one).

  Include only the details the reader needs to understand the issue; no filler, and don't restate the diff. Example:

  ```
  `flush()` drains `pending` and then clears `self.lock`. `on_shutdown()` (worker.py:88) calls
  it from a signal handler while a batch may still be mid-`send()`:

    send(batch[0..k]) -> SIGTERM -> flush() clears pending -> batch[k+1..n] is dropped

  What guarantees `send()` has finished before `flush()` runs? If nothing does, should
  `flush()` wait on the lock?
  ```

- No persona voice, no flavor text, no severity theater.
- Batch every inline comment collected across the whole walkthrough into **one GitHub review**, submitted together when the reviewer is done — not posted one at a time as they're generated.
- No wording checkpoint before posting; the reviewer already approved each draft, and posting _is_ the last step.
- If the reviewer intends to post it via the model rather than doing it themselves, get explicit confirmation before posting anything.

If the flag list is empty, say so plainly and offer the alternative: drafting a review from the strongest unflagged items instead.

---

## Flag list (running state)

Maintain across the whole walkthrough. One entry per flag:

```
- source: <step-1-explore | step-3-decision | step-4-contract | step-5-tests | step-6-promoted>
  subject: <the decision / contract / missing test / smell>
  location: <file:line, for inline anchoring>
  reviewer said: <their actual words, paraphrased minimally>
  draft comment: <full comment text in the Step 7 format, as approved by the reviewer>
```

Keep the reviewer's own framing wherever possible — their phrasing carries system context the model doesn't have.

One concern per flag. Build the flag around the specific point the reviewer reacted to. Leave out related concerns they didn't raise; if one seems worth its own flag, offer it separately.

Pre-answer before recording. Before a flag goes on the list, write the author's most likely answer in one or two lines and show it next to the draft. If that answer would settle the concern, say so and let the reviewer decide whether to keep it.

Show the draft when the flag is recorded. When a flag goes on the list, show the reviewer the full comment text, written in the Step 7 format, not a summary. The reviewer approves the wording at the point it's created, so Step 7 is only posting.

## Navigation

Accept at any checkpoint:

- `next` — advance.
- `back` — previous step, re-presented.
- `jump <n>` / a section name (`map`, `decisions`, `contracts`, `tests`, `smells`) — go there directly.
- `done` — jump straight to Step 7 and post from whatever's flagged so far. First draft and show any flags that don't yet have an approved comment, then post.

Everything is precomputed after Phase 1, so all navigation is free — never re-dispatch an agent to answer a jump. `done` must work after any step, including Step 1; bailing early with two good questions is a success case.

## Anti-instructions

- **Don't hunt bugs.** Line-level correctness is out of scope; other skills own it. If something egregious surfaces incidentally, mention it in one line in Step 6 and move on.
- **Don't assert design verdicts.** Present the system; the reviewer forms the judgment.
- **Don't skip the checkpoint questions** to save a turn. They are the mechanism by which the reviewer's knowledge enters the output.
- **Don't pad.** An empty Step 5 or 6 or a one-card Step 3 are fine outcomes.
- **Don't describe files.** Describe components, boundaries, and choices.
- **Don't manufacture alternatives.** A Step 3 card with a strawman alternative is worse than no card at all.
- **Don't pad the critical tests.** Only missing tests with a real regression risk belong in Step 5.
