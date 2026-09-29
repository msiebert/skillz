---
name: read-aloud
description: Turn an artifact, page, doc, or spec into a listenable version with a built-in text-to-speech player. Use when the user asks to read an artifact aloud, make an audio or "read it to me" version, or convert a document for listening.
---

# Read Aloud

Convert a source document into a new "listen" artifact: a script rewritten for listening comprehension plus a browser text-to-speech player (Web Speech API). Never modify the source.

## 1. Get the source

- Claude.ai artifact URL: call the Artifact tool with `action: "read"`.
- Local HTML or Markdown file: Read it.
- Otherwise: use the content already in the conversation.

Read the whole source before rewriting. Note its title and URL (if any).

## 2. Write the listening script

Listeners can't skim or re-read. Rewrite, don't transcribe.

**Structure**
- Open with a spoken roadmap: what this is, roughly how long it runs, and the 2 to 4 main points.
- Say counts before lists: "There are three risks. First... Second... Third..."
- Add explicit transitions between sections: "That's the background. Next, the plan."
- End each long section with a one-sentence recap. Close with an overall recap.

**Sentences**
- Short, one idea each. Point first, active voice, concrete wording.
- Fold parentheticals and footnotes into the text, or cut them.

**Non-prose content**
- Tables: narrate the takeaway and at most the few rows that matter. Never read cells one by one.
- Code blocks: say what the code does and why it matters. Never read syntax. Say identifiers naturally (`list_prefix` becomes "list prefix"). Shorten file paths to the meaningful name.
- Charts and diagrams: state the one insight they show.
- URLs and links: drop them, or say "linked on the page".

**Speakable text**
- Round numbers when precision doesn't matter, and write them as spoken: "about forty percent", "one point two seconds".
- Expand abbreviations and symbols: "e.g." to "for example", "vs." to "versus", "&" to "and", "->" to "leads to", "~" to "about".
- Expand acronyms on first use.
- Write ticket IDs speakably: "ticket A-I-E ten thirty-five".
- Strip markdown and emoji.

**Fidelity**
- Keep the substance: decisions, caveats, numbers that matter, action items. Cut only visual scaffolding.
- Target about 150 spoken words per minute. Put the estimated duration in the roadmap and in `minutes`.

**Output shape**: a list of sections, each with a `title` and an array of `sentences`, one spoken sentence per element. The player speaks one sentence per utterance, so keep each element a single sentence.

## 3. Build the page

1. Copy `player-template.html` from this skill's directory (`~/.claude/skills/read-aloud/`) into the scratchpad directory.
2. Replace the exact token `/*SCRIPT_DATA*/SAMPLE_DATA` (one occurrence, in the line `const DATA = /*SCRIPT_DATA*/SAMPLE_DATA;`) with a JSON object. The result must read `const DATA = {...};`. Do not leave `SAMPLE_DATA` behind; it is part of the token.

   ```json
   {"title": "...", "source": "<original title>", "sourceUrl": "<url or empty string>", "minutes": N, "sections": [{"title": "...", "sentences": ["..."]}]}
   ```

   Emit the JSON on one line and escape `</` as `<\/` so the inline script can't close early.
3. Replace `__TITLE__` in the `<title>` tag with the listen title.

Do this with a small script or Edit, not by hand-rewriting the player.

## 4. Publish

1. Load the `artifact-design` skill first, as the Artifact tool requires.
2. Publish as a new artifact (never pass the source's `url`). Title: "<Source title>, Listen" (2 to 4 words if possible). `icon: "audio"`. Add a one-sentence `description`.
3. Give the user the link and the estimated listening time. Mention:
   - It needs one click on play to start (browser autoplay rules).
   - macOS premium or enhanced voices sound much better: System Settings, Accessibility, Spoken Content.
