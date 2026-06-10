# Pattern: Corpus / Round-Trip Tests Verify Survival, Not Semantics

## Trigger

A parametrized test iterates over a corpus of fixtures and verifies that some operation (translate → translate-back, serialize → deserialize, encode → decode) is a round-trip identity.

```python
@pytest.mark.parametrize("fixture", load_corpus())
def test_round_trip(fixture):
    assert ai_to_wire(wire_to_ai(fixture)) == fixture
```

## Look for

Whether any test in the parametrized set verifies that the **intermediate representation** has the right values — not just that the round-trip preserves the input.

A round-trip can pass while the translator silently maps two distinct wire shapes to the same AI form, or while a field is preserved by accident through a no-op code path.

## Why it matters

Round-trip equality is necessary but not sufficient. It catches "lossy translation" but not "wrong translation that happens to be reversible." For a translator/grammar, you also need explicit assertions on the AI-form values for known wire inputs.

## Suggest

"Add at least one parametrized test per corpus entry (or per equivalence class) that asserts specific AI-form fields equal known expected values — not just that the round-trip succeeds. Use the corpus as a source of inputs whose expected outputs are computable."
