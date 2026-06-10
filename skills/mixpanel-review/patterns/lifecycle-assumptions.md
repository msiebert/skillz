# Pattern: Lifecycle / State Assumptions After Writes

## Trigger

Code reads a field from the response of a create/update/write call and uses it as if it's fully populated.

```python
result = create_cohort(definition)
return result.user_count   # is this populated immediately?
```

```ts
const cohort = await api.createCohort(payload);
return cohort.lastEvaluatedAt;
```

## Look for

- Fields on a write-response that represent _computed_ state (counts, evaluations, derived metadata).
- Code that returns or asserts on these fields without checking whether the upstream service computes them synchronously on create.
- Tests that mock a "fully populated" response and never exercise the "field present but null because not yet computed" case.

## Why it matters

Many create/update APIs return a record before async pipelines have populated derived fields. Treating these fields as authoritative leads to confusing nulls, off-by-one counts, or stale data shown to users. The bug is hard to reproduce locally because mocks always return the populated shape.

## Suggest

"Does <field> actually get populated by the time this call returns? If it's computed asynchronously (e.g., by a background evaluator), the read here may be null or stale. Either fetch with a follow-up `Get-*` after a settle delay, or document that this field is best-effort and may be null on freshly-created records."
