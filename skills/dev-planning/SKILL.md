---
name: dev-planning
description: Use when the user wants to plan a feature, change, or refactor before writing code — "let's plan X", "help me design this change", "sketch a plan I can hand off" — or when starting any non-trivial dev task that has no written plan yet. First of the dev-* workflow skills.
---

# Dev Planning

Research-first planning that ends in a written plan doc, with the user kept in the
verification loop throughout. Six phases, three user approval gates.

**Time pressure never skips a gate.** "I'm in a hurry" means ask fewer, sharper
questions — it never means answer them yourself (see Red Flags).

## Phases

### 1. Intake

- If the task is ambiguous, clarify goal, constraints, and success criteria — one
  question at a time. Skip if already concrete.
- Ask for a Linear issue if one wasn't mentioned. If provided, pull its
  title/description (Linear integration when connected; otherwise ask the user to paste
  the relevant bits) and stamp the issue ID into the plan doc filename and header. If
  none exists, proceed and note "no tracking issue" — don't nag.

### 2. Pattern research — subagent

- Dispatch **one read-only subagent** (`Explore` type): prompt is
  `agents/pattern-researcher.md` verbatim with the task description appended.
- Do NOT do this research in the main thread, even if you think you know the codebase.
- The report (shape defined in the agent file) covers: reusable assets, conventions,
  similar features to model after, a "do not reinvent" list, open questions.
- Subagent fails or times out → tell the user; offer retry or proceed with a
  "no research" annotation in the plan doc.

### 3. Architecture — Gate 1

Main thread, not a subagent. Propose the overall architecture **explicitly citing the
research**: every component either maps to an existing pattern or justifies why it's
new. Iterate until the user approves.

### 4. Module breakdown — Gate 2

Main thread. Decompose into modules: responsibility, interface, dependencies, which
existing code each touches. Iterate until the user approves.

During phases 3–4 you may dispatch additional targeted research subagents when a design
question needs deeper codebase digging. Delegate the reading, never the deciding.

### 5. Adversarial review — subagent

- Dispatch one subagent: prompt is `agents/adversarial-reviewer.md` verbatim with the
  task summary, research report, approved architecture, and module breakdown appended.
- It returns severity-tagged findings (blocking / should-fix / note). Triage every
  finding **with the user**: accept (revise the design, re-confirm the affected gate)
  or rebut (reason stated). No silent drops — findings and resolutions go in the plan doc.
- Subagent fails → tell the user; offer retry or proceed with a "no adversarial review"
  annotation.

### 6. Test-case interview — Gate 3 (ask first, fill gaps)

Only after phases 1–5. Per module, plus cross-cutting product behavior:

1. Ask the user open-ended questions **first** — expected behaviors, edge cases,
   failure modes, product invariants. One question at a time.
2. Only after the user's cases are collected, propose the gaps you see; the user
   confirms or cuts each one.

Tag every test case with its origin: `user` or `suggested-and-confirmed`. Never write
the test list unilaterally — this interview is the point of the skill; it keeps the
user knowledgeable about what the system should do from a product and architecture
standpoint.

## Deliverable

Write `docs/plans/YYYY-MM-DD-[ISSUE-]<topic>-plan.md` in the **target** repo (honor any
existing plan-location convention the repo has). Contents: task summary + issue link,
research findings, architecture, module breakdown, adversarial findings and
resolutions, test-case list with origin tags, open questions. Footer states that
implementation is out of scope.

Then **stop**. Do not begin implementing.

If the user abandons the interview midway, still write the plan doc and mark the
unexamined modules "interview incomplete".

## Red Flags — you are about to violate this skill

| Rationalization | Reality |
|---|---|
| "User is in a hurry, skip the questions" | Gates still apply. Ask fewer, sharper questions — never zero. |
| "I'll flag open questions with recommended defaults" | Gate approvals and test cases need the user's answers, not your defaults. |
| "I already know this codebase" | Dispatch the researcher anyway. Its report belongs in the plan doc. |
| "The testing section is obvious" | Test cases come FROM the interview. Never write them unilaterally. |
| "The plan's done, might as well start implementing" | The skill ends at the plan doc. Stop. |
