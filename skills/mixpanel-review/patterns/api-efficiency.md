# Pattern: Fetch-All-Then-Filter

## Trigger

A function fetches a list from an upstream API and then filters / searches / picks one item from it in Python/TS.

```python
all_cohorts = client.list_cohorts(project_id)
match = [c for c in all_cohorts if c.name == requested_name]
```

## Look for

- `list_*` / `get_all_*` calls followed by local filtering.
- Pagination loops that exist solely to find one record.
- Comments like "fetch all and filter" or "TODO: server-side filter."

## Why it matters

Mixpanel projects often have thousands of cohorts / dashboards / reports. Full-scan-then-filter is O(N) over the entire account on every call and will eventually time out or spike load on the upstream service. Worse, the design layer (the API contract) may already support filters — the author just didn't reach for them.

## Suggest

"Check the upstream API: does it support a query/filter/name parameter? If so, push the filter to the server. If not, consider whether the API should be extended — pulling all records to find one is a design smell, not a transient performance issue."

When commenting, name the specific upstream call and ask whether it supports a `query=` / `name=` / `filter=` parameter rather than just flagging the perf concern abstractly.
