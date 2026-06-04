// ---------- Mermaid (dark theme) ----------
mermaid.initialize({
  startOnLoad: true,
  theme: "dark",
  themeVariables: {
    primaryColor: "#1c232c",
    primaryTextColor: "#e6edf3",
    primaryBorderColor: "#2a3440",
    lineColor: "#79c0ff",
    secondaryColor: "#161b22",
    tertiaryColor: "#0e1116",
    fontSize: "14px",
    fontFamily: "ui-monospace, SF Mono, Menlo, Consolas, monospace",
  },
  sequence: { actorMargin: 60, boxMargin: 8, noteMargin: 10 },
  flowchart: { curve: "basis", padding: 12 },
});

// ---------- Tab switching ----------
const tabButtons = document.querySelectorAll(".tabbar [data-tab]");
const tabPanes   = document.querySelectorAll("[data-tab-pane]");
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
    tabPanes.forEach((p) => p.classList.toggle("active", p.dataset.tabPane === target));
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

// ---------- In-page TOC smooth-scroll ----------
document.querySelectorAll(".toc a").forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (id && id.startsWith("#")) {
      const el = document.querySelector(id);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });
});

// ---------- Notes panel ----------
const noteArea  = document.getElementById("pr-notes");
const notesPanel = document.getElementById("notes-panel");
const notesToggle = document.getElementById("notes-toggle");
const notesClose = document.getElementById("notes-close");
const notesClear = document.getElementById("notes-clear");
const notesCopy  = document.getElementById("notes-copy");
const notesSaved = document.getElementById("notes-saved");
const notesCount = document.getElementById("notes-count");

const prKey = document.body.dataset.prKey || "default";
const STORAGE_KEY = `pr-notes:${prKey}`;

function updateCount() {
  notesCount.textContent = `${noteArea.value.length} chars`;
}

function flashSaved() {
  notesSaved.classList.add("visible");
  clearTimeout(flashSaved._t);
  flashSaved._t = setTimeout(() => notesSaved.classList.remove("visible"), 900);
}

// Load existing notes
if (noteArea) {
  noteArea.value = localStorage.getItem(STORAGE_KEY) || "";
  updateCount();

  let debounceT;
  noteArea.addEventListener("input", () => {
    updateCount();
    clearTimeout(debounceT);
    debounceT = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, noteArea.value);
      flashSaved();
    }, 250);
  });
}

function openNotes() {
  notesPanel.classList.add("open");
  notesPanel.setAttribute("aria-hidden", "false");
  setTimeout(() => noteArea?.focus(), 200);
}
function closeNotes() {
  notesPanel.classList.remove("open");
  notesPanel.setAttribute("aria-hidden", "true");
}

notesToggle?.addEventListener("click", () => {
  notesPanel.classList.contains("open") ? closeNotes() : openNotes();
});
notesClose?.addEventListener("click", closeNotes);
notesCopy?.addEventListener("click", async () => {
  const text = noteArea.value;
  if (!text) return;
  const flash = (label) => {
    const original = notesCopy.textContent;
    notesCopy.textContent = label;
    notesCopy.classList.add("copied");
    setTimeout(() => {
      notesCopy.textContent = original;
      notesCopy.classList.remove("copied");
    }, 1200);
  };
  try {
    await navigator.clipboard.writeText(text);
    flash("Copied!");
  } catch {
    // Fallback for non-secure contexts (http://) where Clipboard API is blocked.
    noteArea.select();
    const ok = document.execCommand("copy");
    noteArea.setSelectionRange(noteArea.value.length, noteArea.value.length);
    flash(ok ? "Copied!" : "Copy failed");
  }
});
notesClear?.addEventListener("click", () => {
  if (confirm("Clear all notes for this PR?")) {
    noteArea.value = "";
    localStorage.removeItem(STORAGE_KEY);
    updateCount();
    flashSaved();
  }
});

// Keyboard shortcuts:
//   n    — toggle notes (suppressed when focus is in a text input/textarea/contenteditable)
//   Esc  — close the notes panel (also blurs the textarea as a side effect of closing)
function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}
document.addEventListener("keydown", (e) => {
  if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target)) {
    e.preventDefault();
    notesPanel.classList.contains("open") ? closeNotes() : openNotes();
    return;
  }
  if (e.key === "Escape" && notesPanel.classList.contains("open")) {
    noteArea?.blur();
    closeNotes();
  }
});

// ---------- AI Review findings → "Add to notes" buttons ----------
// Injected at runtime so existing pages get this feature with only an app.js refresh.
function findingToMarkdown(li) {
  const header = li.querySelector(":scope > header");
  const sevEl = header?.querySelector(".sev");
  const sev = sevEl?.textContent?.trim().toUpperCase() || "NOTE";
  const title = header
    ? Array.from(header.childNodes)
        .filter((n) => n !== sevEl)
        .map((n) => n.textContent || "")
        .join("")
        .trim()
    : "(untitled finding)";
  const pathEl = li.querySelector(":scope > a.path");
  const pathText = pathEl?.textContent?.trim() || "";
  const pathHref = pathEl?.getAttribute("href") || "";
  const bodies = Array.from(li.querySelectorAll(":scope > p"))
    .map((p) => p.textContent.trim())
    .filter(Boolean);

  const lines = [`### [${sev}] ${title}`];
  if (pathText) lines.push(pathHref ? `${pathText} — ${pathHref}` : pathText);
  if (bodies.length) lines.push("", ...bodies);
  return lines.join("\n");
}

function appendToNotes(text) {
  if (!noteArea) return;
  const existing = noteArea.value;
  const sep = existing && !existing.endsWith("\n\n") ? (existing.endsWith("\n") ? "\n" : "\n\n") : "";
  noteArea.value = existing + sep + text + "\n";
  localStorage.setItem(STORAGE_KEY, noteArea.value);
  updateCount();
  flashSaved();
}

document.querySelectorAll(".findings > li").forEach((li) => {
  if (li.querySelector(":scope > .finding-actions")) return;
  const footer = document.createElement("footer");
  footer.className = "finding-actions";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "add-to-notes";
  btn.textContent = "＋ Add to notes";
  footer.appendChild(btn);
  li.appendChild(footer);

  btn.addEventListener("click", () => {
    appendToNotes(findingToMarkdown(li));
    openNotes();
    const original = btn.textContent;
    btn.textContent = "✓ Added";
    btn.classList.add("added");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("added");
    }, 1200);
  });
});
