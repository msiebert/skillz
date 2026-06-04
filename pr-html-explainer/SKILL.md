---
name: pr-html-explainer
description: Generate a self-contained HTML explainer page for a pull request, designed for a reader with zero prior context. Dispatches parallel subagents to analyze slices of the diff, then synthesizes a multi-tab page with architecture diagrams (Mermaid), before/after code snippets, GitHub-deep-linked file references, a slide-out persistent notes panel, and a live CI status tab. Activate when the user asks for a PR walkthrough, explainer, review page, or "help me understand this PR."
---

# PR HTML Explainer

Build a single-page HTML artifact that explains a pull request end-to-end to someone who has never seen the codebase. Output lands in `~/pr-review/<pr-number>/` and is served on port 8080 via the included script.

## What makes a good explainer page (and why this skill exists)

A reviewer landing cold on a 30-file PR needs three things fast: **what changed**, **why it changed that way**, and **where to be suspicious**. Bullet lists alone don't deliver — you need diagrams for flow, before/after diffs for the substance, and surfaced concerns with concrete file:line links. This skill exists because doing all that manually is tedious; with parallel subagents it takes a few minutes.

---

## Workflow

### Step 1: Establish PR context

Run these in parallel with Bash:

```bash
gh pr view --json number,title,body,url,baseRefName,headRefName,headRefOid,author
gh pr diff --name-only
git log --oneline $(gh pr view --json baseRefName --jq .baseRefName)...HEAD
gh repo view --json owner,name
```

Hold onto:

- **PR number** — used in the output path and as the localStorage key for notes
- **Head SHA** (`headRefOid`) — used in every GitHub deep-link
- **Owner/repo** — likewise

If the branch has a merge commit from main/master in its history, mention it to the user and confirm scope: do they want the merge included in the explainer, or just the PR-author commits? Default: just PR-author commits.

### Step 2: Plan the slices

Group the diff into 4–6 thematic slices a single subagent can hold in context. Typical groupings:

- **New package / module skeleton** — public API, registry, core types
- **Tooling / CI plumbing** — lint plugins, codegen checks, workflow files
- **Migrations / refactors** — before-vs-after across N call sites
- **Cross-cutting end-to-end change** — proto + handler + service chain
- **Adversarial / suspicion sweep** — read by a separate agent with no other context, asked to find what's broken

The adversarial slice is non-negotiable — always include it. It catches the things the explainer agents are too charitable to flag.

### Step 3: Dispatch subagents in parallel

Use `Agent(subagent_type="Explore", ...)` for each slice. Send all of them in a single message so they run concurrently. Each prompt must:

1. **Restate the PR context** (subagents have no session memory).
2. **Name its slice and list the files** to deep-read in full vs. skim.
3. **Hand over specific commits** by SHA when behavior changed across the PR — the agent should `git show <sha>` to learn the evolution.
4. **Require file:line citations** in the report.
5. **Demand a suspicion list**, even for "happy" slices — flag things at 40% confidence or higher.
6. **Cap word count** (700–1000 words per slice keeps the synthesis tractable).

For the adversarial agent: list the suspicious commit SHAs ("Fix X", "Restore Y", "Address PR feedback") explicitly — late-cycle commits are where bugs already happened in review.

### Step 4: Synthesize into the HTML

Copy the assets and build the page:

```bash
PR=$(gh pr view --json number --jq .number)
DEST="$HOME/pr-review/$PR"
mkdir -p "$DEST"
cp ~/.claude/skills/pr-html-explainer/assets/styles.css "$DEST/"
cp ~/.claude/skills/pr-html-explainer/assets/app.js    "$DEST/"
```

Then write `$DEST/index.html` based on the template at `~/.claude/skills/pr-html-explainer/assets/template.html`. The template has placeholder comments (`<!-- INSERT: ... -->`) for every section that varies per PR.

The page has two primary tabs the reader cares about, in this order:

- **Tab 1 — 📖 Explainer**: the architecture and what the PR is accomplishing.
- **Tab 2 — 🤖 AI Review**: the suspicions/findings surfaced by the adversarial pass.

Required sections to fill (in order):

1. **Hero metadata** — PR number, title, branch, file/line counts, GitHub link
2. **TL;DR** (Explainer tab) — 5 bullets, the elevator pitch
3. **Architecture** (Explainer tab) — at least one Mermaid diagram per major flow. Use `flowchart` for static structure, `sequenceDiagram` for runtime interactions. Aim for 2–3 diagrams.

   **Mermaid syntax — the conservative-quoting rules.** Mermaid 11's flowchart parser is fussy about special characters even inside double-quoted labels, and a single broken diagram blanks the whole `<div class="mermaid">` block at runtime with no obvious error in the page. Follow these rules from the start; don't write "natural" labels and fix them after the user complains:

   - **Quote every node label and every edge label.** `A["foo"] -->|"bar"| B["baz"]`. Unquoted labels work for trivial strings and break the moment a special character sneaks in.
   - **Never put a literal `|` inside an edge label** — even when the label is double-quoted, the parser still treats `|` as the label terminator. Use the word "or" instead.
   - **Avoid these characters inside labels, even when quoted:** parentheses `()`, curly braces `{}`, colons `:`, slashes `/`, em-dashes `—`, backticks. They parse correctly _sometimes_, but the failure modes are silent. Substitute: drop the parens (`@scopes_required(COHORTS)` → `@scopes_required COHORTS`), use `--` for em-dashes, replace `:id` path params with `ID`, replace `/` separators with spaces or commas, drop curly braces around metric labels.
   - **`<br/>` for line breaks inside labels is fine** and the preferred way to wrap long node text.
   - **The cylinder shape `[(...)]`, the diamond `{...}`, and the rounded shape `(...)` use unquoted-syntax delimiters** that conflict with content characters. Keep their inner text plain alphanumerics + spaces + `<br/>` only.
   - **Sequence diagrams are stricter than flowcharts.** Participant names cannot contain spaces or special chars — alias them: `participant T as translator.wire_to_ai`.

   Before declaring the page done, mentally re-parse each diagram against the rules above. If you see a parens, slash, colon, or pipe inside any label, fix it before writing the file. Re-fixing after the user reports a broken render costs a turn and breaks immersion.

4. **Deep flows** (Explainer tab) — for each major code path, write **3–5 sentences of prose** explaining the flow step-by-step, not just bullets. Treat the reader like they've never seen Django / gRPC / whatever framework is in play. Reference the diagrams explicitly.
5. **Before vs. After** (Explainer tab) — side-by-side code blocks for every meaningful refactor. Pull real snippets via `git show master:<path>` and the current file.
6. **Reviewer's checklist** (Explainer tab) — 5–8 actionable items.
7. **AI Review — Suspicions** (AI Review tab) — numbered findings with severity badges (`high` / `med` / `low`), file path link, what could go wrong, and "what I'd ask the author." This is the entire content of the second tab; everything the adversarial agent surfaces lands here.

### Step 5: GitHub deep-links — non-negotiable

Every file reference in the page must be a real clickable link to the line in GitHub at the PR's head SHA. Use this anchor format directly in the HTML — don't try to script it:

```html
<a
  class="path"
  href="https://github.com/{owner}/{repo}/blob/{headSha}/webapp/permissions/enforce.py#L23"
  target="_blank"
  rel="noopener"
  >webapp/permissions/enforce.py:23</a
>
```

For line ranges, use `#L23-L31`. For a whole file, omit the fragment. Substitute `{owner}`, `{repo}`, and `{headSha}` from Step 1. If you cite a file but don't link it, you've failed this step.

### Step 6: Fill the helper tabs

One side tab beyond the main Explainer and AI Review:

- **CI status** — pulled live at generation time:

  ```bash
  gh pr checks --json name,state,bucket,link
  ```

  Render as a table with a green/yellow/red dot per check. Note in the section heading that the snapshot is from page-generation time, not live.

The template's tab markup is already wired up — just fill the `<section data-tab-pane="ci">` body. **Do not add a File tree or Related tab** — they were removed because they duplicated information already on GitHub and didn't earn their tab slot. Surface anything genuinely cross-referenced (parent ticket, design doc, follow-ups) in the Explainer tab's TL;DR or a small inline section instead.

### Step 7: Notes panel — already wired

The slide-out notes panel on the right edge is part of the template. It auto-saves to `localStorage` under the key `pr-notes:{prNumber}`. Set the PR number on `<body data-pr-key="{prNumber}">` and the JS handles the rest. Don't touch the notes section unless the user asks for behavior changes.

**Keyboard shortcuts** (already wired in `app.js`): `n` toggles the notes panel (suppressed when focus is in a text input/textarea/contenteditable, so it doesn't fire while typing). `Esc` closes the panel (and blurs the textarea as a side effect of closing — single press, no double-tap). The Notes button in the tabbar shows a `<kbd class="kbd-hint">n</kbd>` chip so the shortcut is discoverable. If you replace the template's tabbar markup, preserve the `<kbd class="kbd-hint">n</kbd>` chip and the `title="Toggle notes (n)"` attribute on the button.

**"Add to notes" on AI Review findings** (already wired in `app.js`): on page load, the script scans `.findings > li` and appends a `<footer class="finding-actions">` containing an `＋ Add to notes` button to each one. Clicking the button extracts the finding's severity, title, file:line link, body, and the "Ask" paragraph, formats them as a markdown block, appends it to the notes textarea (persisted via `localStorage`), and opens the panel with a brief "✓ Added" confirmation. **Don't add the footer in your generated markup** — the JS injects it and is idempotent. Just keep the existing `<li>` shape: `<header><span class="sev …">…</span> Title</header>`, then `<a class="path" href="…">…</a>`, then one or more `<p>` paragraphs. If you change the markup shape, update `findingToMarkdown()` in `app.js` to match.

### Step 8: Serve the page

After writing files, start the server (or note that one is already running):

```bash
~/.claude/skills/pr-html-explainer/scripts/serve.sh
```

This serves `~/pr-review/` on port 8080 in the background. The user reaches their PR page at `http://localhost:8080/<pr-number>/` (after setting up an SSH tunnel from their laptop — see the script's banner for the exact tunnel command).

If port 8080 is already taken, the script reports the existing PID and exits — the running server is already serving the new files (filesystem is read live).

### Step 9: Report back to the user

Give them:

1. The exact local URL: `http://localhost:8080/<pr-number>/`
2. The SSH tunnel command they'll need from their laptop
3. A one-paragraph summary of what's in the page and the top 2–3 suspicions surfaced

---

## Subagent prompt pattern (copy-adapt)

```
You are analyzing one slice of PR #<N> ("<title>") in <repo-path>.
The PR's head SHA is <sha>; cite file paths with line numbers so I can
deep-link them.

Your slice: <one-sentence>. Deep-read these files in full:
- <path1>
- <path2>

For context (skim only):
- <path3>

To understand evolution within the PR, run:
- git show <sha-of-fix-commit>

Report back, structured as:
1. What the slice does in plain English
2. Key design choices and why
3. How a caller / reader interacts with it
4. Test coverage and gaps
5. 🐛 Suspicion list — flag things at 40%+ confidence with file:line

Target ~800 words. Quote short snippets directly. Don't summarize files
you didn't read.
```

For the adversarial agent, replace the structure with: "Output a numbered list of 6–12 concrete suspicions, each with **Title**, **Severity** (low/med/high/spec), **Where** (file:line), **What could go wrong**, **What I'd ask the author**."

---

## Server details (Step 8 deep-dive)

The `serve.sh` script is a single-process `python3 -m http.server 8080 --bind 0.0.0.0` running in the background, serving `~/pr-review/`. The directory layout looks like:

```
~/pr-review/
├── 95130/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── 95211/
│   └── ...
```

From the devbox, `curl http://localhost:8080/95130/` works directly. From the user's laptop, they need an IAP-tunneled SSH session:

```
gcloud compute ssh <devbox-name> --project=<gcp-project> --tunnel-through-iap -- -L 8080:localhost:8080
```

Then browse to `http://localhost:8080/<pr-number>/` (use `127.0.0.1` instead of `localhost` if HSTS upgrades to HTTPS and the server doesn't speak TLS).

To check whether the server is already running:

```bash
pgrep -fa "http.server 8080"
```

If it is, do nothing — the filesystem is read live, so new PR pages appear automatically.

---

## Output checklist

Before reporting done, verify:

- [ ] `~/pr-review/<pr-number>/index.html` exists and is &gt; 10 KB
- [ ] `styles.css` and `app.js` were copied alongside it
- [ ] Mermaid diagrams render (search the HTML for `class="mermaid"` and verify each has valid syntax)
- [ ] Every file:line reference in the page is wrapped in an `<a href="https://github.com/...">` — grep for `class="path"` and confirm each is a link, not a bare span
- [ ] The hero has the right PR number, title, and link
- [ ] `<body data-pr-key="...">` is set so notes scope correctly
- [ ] The server is running (or you told the user it already was)
