# Pattern: Graceful Degradation at LLM / MCP / API Boundaries

## Trigger

A function at an external-facing boundary (MCP tool, API endpoint, RPC handler) calls a transform / validator / translator and lets exceptions propagate. The caller is an LLM, an external client, or a UI.

```python
def get_cohort(...):
    raw = fetch_cohort(...)
    translated = wire_to_ai(raw)   # raises on unmodeled / malformed inputs
    return translated
```

## Look for

- Try/except blocks that catch a narrow set of exceptions (`ValidationError`, `ValueError`) but not the broader siblings (`TypeError`, `AttributeError`, `KeyError`).
- Boundary functions that have no try/except at all and rely on upstream guarantees that may not hold.
- A "sentinel" / "unmodeled" / "fallback" result type that exists in the codebase but is not actually returned by every failure path.

## Why it matters

At MCP/API boundaries, raising an exception means the LLM or client gets nothing useful — sometimes nothing at all. A sentinel result ("we couldn't translate this, here's the raw form / a flagged stub") preserves the call, lets the caller decide what to do, and emits metrics.

## Suggest

"When translation fails, return the unmodeled/raw form wrapped in a sentinel type instead of raising. The MCP/API should always return _something_ useful to the caller. Catch the full family of exceptions that can escape from the transform (`ValidationError, ValueError, KeyError, TypeError, AttributeError`), or `Exception` if the transform surface is wide."

Cross-check: does the codebase already have an `UnmodeledResult` / `RawFallback` / similar type? If yes, this function should use it.
