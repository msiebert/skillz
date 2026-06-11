# dev-planning Skill — Design

**Date:** 2026-06-11
**Status:** Approved
**Location:** `skills/dev-planning/`

## Purpose

A developer planning workflow skill: research-first feature planning that finds existing
codebase patterns before designing anything new, and keeps the developer in the
verification loop by interviewing them about test cases once the architecture and module
breakdown are settled.

First entry in a planned collection of dev-workflow skills. The collection is a naming
convention, not a directory: prefixed siblings (`dev-planning`, later `dev-implement`,
`dev-ship`, …), because skill discovery only finds `skills/<name>/SKILL.md` one level
deep (`~/.claude/skills` is a symlink to this repo's `skills/`).

## File structure

```
skills/dev-planning/
├── SKILL.md                    # orchestrator: phases, gates, plan-doc format
└── agents/
    └── pattern-researcher.md   # subagent prompt, dispatched verbatim + task appended
```

House style follows `skills/mixpanel-review/`: the orchestrator stays lean and
dispatches subagent prompt files; it never inlines their content.

## Flow

Five phases, three approval gates.

### 1. Intake

- Clarify the task if ambiguous: goal, constraints, success criteria. One question at a
  time. Skip if the request is already concrete.
- **Ask for a Linear issue if one wasn't mentioned.** If provided, pull its
  title/description (Linear integration when connected; otherwise the user pastes the
  relevant bits), use it as planning context, and stamp the issue ID into the plan doc
  header and filename. If there is genuinely no issue, proceed and note "no tracking
  issue" — do not nag.

### 2. Pattern research (subagent)

- Dispatch **one read-only subagent** (`Explore`-type) with the
  `agents/pattern-researcher.md` prompt plus the task description.
- Mandate: find prior art **in the target codebase** — similar features already
  implemented, reusable utilities/helpers, established conventions (error handling,
  module layout, test style), and code that should be extended rather than rebuilt.
- Returns a structured report:
  - **Reusable assets** (with `file:line`)
  - **Conventions to follow**
  - **Similar features to model after**
  - **"Do not reinvent" list**
  - **Open questions**
- If nothing is found, the report says so plainly. No invented prior art.

### 3. Architecture — Gate 1

- Main conversation, not a subagent (interactive; revisions are cheap in-thread).
- Propose the overall architecture, **explicitly citing the research**: every component
  either maps to an existing pattern or justifies why it is new.
- Iterate with the user until approved.

### 4. Module breakdown — Gate 2

- Main conversation.
- Decompose into modules: responsibility, interface, dependencies, which existing code
  each touches.
- Iterate until approved.
- During phases 3–4 the orchestrator **may dispatch additional targeted research
  subagents** when a design question needs deeper codebase digging. Delegate the
  reading, never the deciding.

### 5. Test-case interview — Gate 3 (ask first, fill gaps)

- Runs only after architecture and modules are settled.
- Per module, plus cross-cutting product behavior:
  1. Ask the user **open-ended questions first** — expected behaviors, edge cases,
     failure modes, product invariants. One question at a time.
  2. After the user's cases are collected, propose only the **gaps** Claude sees; the
     user confirms or cuts each.
- Every test case in the final plan is tagged with its origin: `user` or
  `suggested-and-confirmed`.

## Deliverable

A plan document written to `docs/plans/YYYY-MM-DD-<topic>-plan.md` in the **target**
repo (include the Linear issue ID in the filename when present, e.g.
`docs/plans/2026-06-11-ABC-123-retry-layer-plan.md`). Honor any existing plan-location
convention the target repo already has.

Contents: task summary (+ Linear issue link), research findings, architecture, module
breakdown, test-case list (with origin tags), open questions.

Then the skill **stops**. Implementation is explicitly out of scope, stated in the
doc's footer.

## Error handling

- **Research subagent fails or times out** → say so; offer to retry or proceed with a
  "no research" annotation in the plan doc.
- **User abandons mid-interview** → the plan doc is still written, with an "interview
  incomplete" marker on the unexamined modules.
- **No Linear issue exists** → proceed; plan doc notes "no tracking issue."

## Out of scope

- Implementation of the planned feature (separate, later decision).
- Any other dev-workflow skills in the collection (future siblings).
