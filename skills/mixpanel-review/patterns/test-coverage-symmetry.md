# Pattern: Test Coverage Symmetry

## Trigger

The PR adds a family of related entry points (CRUD verbs, sibling tools, related endpoints) and the test file covers error states / edge cases for **one** of them but not the others.

## Look for

- A `test_<tool>_error_*` or `test_<tool>_invalid_*` exists for `create` but not for `update`, `delete`, `get`, or `list` (or vice versa).
- A negative-path fixture is exercised for one sibling and not the others.
- Permission, validation, or not-found cases are tested asymmetrically.

Make a small matrix in your head: rows = sibling tools/endpoints, columns = error classes. Flag empty cells.

## Why it matters

Sibling endpoints usually share validation, permission, and error-handling code paths in production. They should share the same coverage in tests. Asymmetric coverage means an entire endpoint can regress silently because no test ever exercises its failure modes.

## Suggest

"This tool has error-state coverage but its siblings don't. Add equivalent error tests for `<missing tools>` — invalid input, missing permissions, not-found, and any tool-specific failure mode."
