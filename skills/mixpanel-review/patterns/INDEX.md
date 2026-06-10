# Pattern Index

One line per pattern. Subagents load individual files; the orchestrator only reads this list.

## Test coverage patterns (owned by `test-coverage-expert`)

- `test-assertion-depth.md` — tests assert existence/IDs/types but not field values.
- `test-coverage-symmetry.md` — error/edge cases tested for one tool but not its siblings.
- `test-corpus-translation.md` — parametrized tests verify round-trip but not semantic correctness.

## Design patterns (owned by `design-reviewer`)

- `graceful-degradation.md` — transform/validation failures raise instead of returning a sentinel.
- `api-efficiency.md` — fetch-all-then-filter where the upstream API could accept a query.
- `lifecycle-assumptions.md` — code assumes a field is populated immediately after a create/write call.
- `asymmetric-variants.md` — one branch of a discriminated union gets special treatment without justification.
- `naming-as-interface.md` — internal/legacy jargon leaks into typed schemas, public APIs, or LLM-facing names.

## Hygiene patterns (owned by `hygiene-reviewer`)

- `pr-focus.md` — unrelated formatting/style churn mixed into a feature PR.
- `stray-references.md` — comments or strings that mention bots, abandoned specs, or scrapped concepts.
