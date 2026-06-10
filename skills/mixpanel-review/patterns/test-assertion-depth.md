# Pattern: Test Assertion Depth

## Trigger

A test asserts that:

- A return value exists / is non-empty / has the right length.
- An object has the right `id`, `type`, or single field.
- A list contains N items but doesn't inspect the items.
- A dict has the expected keys but not the expected values.

## Look for

In the test body, count how many fields of the result are actually asserted against expected values. If the answer is "one" (and it's `id` or `type`), flag it.

Especially suspicious:

- `assert result.id == "abc"` with no follow-up.
- `assert len(items) == 3` with no inspection of items.
- `assert "key" in response` instead of `assert response["key"] == expected`.

## Why it matters

A test that only checks shape passes when the code returns the wrong content but the right type. That's the bug class these tests are meant to catch. Shape assertions are theater.

## Suggest

"Assert the full value of each field that the code under test is responsible for populating. If the result is a record, check every field that came from the input or transformation. If the result is a list of records, check the contents of at least the first and last items."

If the test sets up a known input, the expected output is computable — write it out explicitly and compare.
