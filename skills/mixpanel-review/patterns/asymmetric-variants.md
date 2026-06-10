# Pattern: Asymmetric Variant Handling in Discriminated Unions

## Trigger

A discriminated union / sum type has multiple variants, and one variant gets special treatment — extra translation, validation, error handling, or a side effect — that the others do not.

```python
if cohort.format == "engine":
    cohort = translate_engine_to_ai(cohort)
return cohort   # what about "builder" / "list" variants?
```

## Look for

- `if format == "X"` / `if isinstance(x, X)` branches with no symmetric branch for the other variants.
- Variant-specific functions called on one path and not others.
- Tests that exercise the special case but not the bypass case (or vice versa).

## Why it matters

Either the asymmetry is correct (the other variants don't need it, and that's worth documenting) or it's a bug (the other variants also need it, and silently skipping them produces wrong output). Reviewers can't tell from the diff alone — the author has to justify it explicitly.

## Suggest

"Why does only the `<X>` variant get this treatment? Are the other variants definitionally safe to skip, or is this a gap? If the asymmetry is intentional, a one-line comment explaining why prevents the next reader from 'fixing' it."
