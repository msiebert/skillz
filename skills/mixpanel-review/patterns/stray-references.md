# Pattern: Stray References in Code

## Trigger

Code, comments, docstrings, or test data contain references to:

- Review bots (`greptile`, `codiumai`, `coderabbit`, etc.).
- Specs, design docs, or tickets that aren't actually present in the repo.
- Internal phase/iteration names from the development process (`phase 1`, `v0`, `before refactor`).
- The PR author's own scratch notes ("TODO: ask Sam", "fix this later").

## Look for

- String literals, comments, or docstrings mentioning bot names.
- Comments referencing a spec file path that doesn't exist (`# see spec.md section 4`).
- "Phase", "stage", "iteration" used as if they were a stable concept when they're really process artifacts.
- Test fixture names or values that encode review history (`test_after_greptile_fix`).

## Why it matters

These references are session/process artifacts. They were meaningful during development but mean nothing to a reader six months later. They rot fast and degrade signal-to-noise in the codebase.

## Suggest

"Remove the reference to `<bot/spec/phase>` — it's a development-process artifact, not something a future reader can act on. If the underlying concern is worth preserving, restate it in terms of the code itself (what invariant it's protecting, what bug class it's avoiding)."
