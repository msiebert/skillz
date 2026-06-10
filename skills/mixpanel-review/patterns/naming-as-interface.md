# Pattern: Naming as Interface — Internal Jargon Leaks

## Trigger

A typed schema, public API field, LLM-facing tool argument, or external enum value uses an internal codename or legacy term whose meaning isn't obvious to someone outside the team.

Common offenders in Mixpanel:

- `"engine"` vs `"builder"` for cohort formats.
- `"phase"` / `"phases"` for internal pipeline stages.
- Project codenames in user-facing field values.
- Acronyms (SRFE, AIE, GOVENG) in field names or doc strings.

## Look for

- New `Literal["..."]` types, `Enum` values, or Pydantic field names that use internal terms.
- LLM tool argument names that don't read naturally to a non-Mixpanel engineer.
- Docstrings that explain the term inline because it's not self-evident.

## Why it matters

Schemas and tool arguments are an interface. Once shipped, renaming them is a breaking change. Internal jargon leaks force every future caller — human or LLM — to learn Mixpanel-internal vocabulary to use the API. Worse, LLMs trained on public docs will pick wrong values because the names don't match their semantics.

## Suggest

"Where do these names come from? Are they Mixpanel-internal, or do they appear in customer-facing docs? For an LLM-facing schema, prefer names that describe _what the variant is_ (e.g., `behavioral_cohort` vs `static_list_cohort`) over internal codenames (`engine` vs `builder`)."

Also check: does the name encode an implementation detail that may change? If so, propose a stable user-facing alternative.
