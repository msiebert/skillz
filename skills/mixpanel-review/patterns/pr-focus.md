# Pattern: Unrelated Style / Formatting Churn in a Feature PR

## Trigger

A file in the diff has changes that:

- Reorder imports, reflow long lines, or change quote styles.
- Rename local variables for clarity with no behavior change.
- Reformat structures (dict → multi-line dict, etc.) with no semantic edit.

And the file's _functional_ changes are zero or trivial.

## Look for

- Files where the diff is dominated by whitespace, reordering, or rewrites that produce the same AST.
- Generated files (lockfiles, codegen output) whose changes don't match a corresponding source edit.
- Config / dashboard files with stylistic churn (Jsonnet, libsonnet, YAML) that doesn't add a panel/alert/metric.

## Why it matters

Style-only changes mixed into a feature PR inflate the diff, hide real changes behind noise, and complicate `git blame`. They should ride in their own PR (or be left for a formatter pass).

## Suggest

"This file looks like it's just style/formatting changes. Please revert anything that doesn't add new functionality, or split it into a separate cleanup PR."
