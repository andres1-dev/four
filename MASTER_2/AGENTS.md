# AGENTS.md — Engineering Manifesto & Agentic Standards
## Procesador CSV · IDE Platform
> **Version:** 3.0.0 · **Epoch:** 2026 · **Authority:** Full-Stack Architecture & AI Agent Systems
> **Status:** `CANONICAL` — All agents and contributors MUST treat this document as the immutable single source of truth.

---

## ⚡ Agentic Operating Principles

These rules govern every decision made by AI agents and human contributors. No exceptions.

### 1 · Context Grounding Before Action
- **MANDATORY MAP CONSULTATION:** Agents MUST ALWAYS read `AI_CODE_MAP.md` before initiating any structural search, logic update or DOM manipulation. This is the main GPS of the project.
- **NEVER hallucinate.** Do not invent DOM IDs, CSS class names, variable names, or function signatures. Every identifier MUST be verified against the codebase before use.
- **Read before writing.** Agents MUST load and parse `js/config/constants.js` to understand the global state, maps, and variables before modifying logic.
- **Fail loudly.** If the required context cannot be located, STOP and report the gap. Silent assumptions are a critical failure mode.

### 2 · Zero-Regression Contract
- No change may break an existing data flow, user-facing feature, or integration endpoint.
- Before any modification: identify all downstream consumers of the affected module.
- After any modification: verify all call sites are consistent and no interface contracts are violated.

### 2.5 · Mandatory Backup Protocol (NON-NEGOTIABLE)

**BEFORE modifying ANY file, the agent MUST:**

1. Create a timestamped backup directory: `backup/[YYYYMMDD_HHMMSS]/` using Colombia timezone (UTC-5)
2. Copy ALL files that will be modified into the backup directory, preserving folder structure.
3. Announce backup location to user BEFORE applying any changes.
4. If backup creation fails, STOP immediately and report the error.

**Format:** `backup/20260322_143022/` (Year-Month-Day_Hour-Minute-Second)

**NO EXCEPTIONS.** This rule applies to:
- Single-line changes
- Multi-file refactors
- Configuration updates
- CSS modifications
- Documentation edits
- ANY file write operation

**Rationale:** Backups enable instant rollback. Without them, destructive changes are irreversible. The cost of creating a backup (< 1 second) is negligible compared to the cost of data loss.

### 3 · Safe-Zone Execution Protocol
All work follows this mandatory sequence:

```
[BACKUP] → [ANALYZE] → [PLAN] → [SAFE-ZONE EDIT] → [VALIDATE] → [APPLY TO MAIN]
```

| Step | Requirement |
|---|---|
| **Backup** | **MANDATORY FIRST STEP.** Before ANY file modification, create the timestamped backup block as described above. |
| **Analyze** | Read all relevant source files before writing a single line. |
| **Plan** | Declare the approach in a comment block or agent scratchpad before coding. |
| **Safe-Zone** | Apply all edits in an isolated sandbox, temp branch, or working directory if applicable. |
| **Validate** | Confirm 0 console errors and 0 regressions. |

### 4 · Auto-Documenting Architecture
- If a coding action results in a change to the fundamental structure of the code (e.g., adding a new module layer, changing the global state pattern, adding base conventions), the agent MUST update `AGENTS.md` to cleanly document and reflect this new architectural reality.
- **AI_CODE_MAP Integrity:** If a change modifies how variables interact, alters an important workflow, or adds complex logic that would cause another AI to waste time finding it later, YOU MUST actively update the explicit behavior inside `AI_CODE_MAP.md`.

---

## 🏛️ Architecture Principles (Pragmatic Vanilla JS)

### Controlled Global Architecture
This is a Vanilla JS Monolithic application. It utilizes a **Controlled Global Scope**.  
Files are organized by logical domain, but execute globally.

```
js/config/     → Constants & State variables (Single Source of Truth)
js/services/   → API calls via XMLHttpRequest (Sheets API v4 & GAS POST)
js/ui/         → DOM manipulation and Modals
js/modules/    → Business logic layer (CSV, OP Distribution, Transfers)
js/printing/   → Printing Logic & Templates (Specific domain)
js/core/       → App core (Theme, Listeners, app.js logic)
js/script.js   → Main Loader (Orchestrates JS loading - Single Entry)
js/utils/      → Utility functions (Logging, Formats)
```

**Interaction rule:** Functions are attached to the `window` object and interact globally. Agents SHOULD call existing global functions (e.g., `processCSV()`, `loadOPData()`) instead of over-engineering complex Dependency Injection models. 

### State Management
State is held globally in maps and variables inside `js/config/constants.js`.
Agents MUST use the provided setter functions (e.g., `setProcessedData`) for massive updates, though direct map modification using `.set()` or `.get()` is the standard convention. Do NOT hallucinate abstract State Manager classes.

### Guard Clauses — No Deep Nesting
Cyclomatic complexity must remain flat. Validate inputs early and return.

```js
// ✅ CORRECT
function parseRow(row) {
  if (!row) return null;
  if (row.length === 0) return null;
  return transform(row);
}

// ❌ FORBIDDEN
function parseRow(row) {
  if (row) {
    if (row.length > 0) {
      return transform(row);
    }
  }
}
```

---

## ⚙️ Performance-First Engineering

### Algorithmic Complexity
- Use `Map` and `Set` for all dataset lookups — O(1) access is mandatory, O(n) array searches are **forbidden** on datasets > 100 rows.
- Sort and index data at load time, never at render time.

### Batch Processing & DOM Safety
Massive DOM rendering MUST use one of:

```js
// Option A — DocumentFragment (preferred for static content)
const fragment = document.createDocumentFragment();
rows.forEach(row => fragment.appendChild(buildRow(row)));
container.appendChild(fragment);

// Option B — requestAnimationFrame (preferred for progressive rendering)
function renderBatch(rows, index = 0) {
  const slice = rows.slice(index, index + BATCH_SIZE);
  slice.forEach(row => container.appendChild(buildRow(row)));
  if (index + BATCH_SIZE < rows.length) {
    requestAnimationFrame(() => renderBatch(rows, index + BATCH_SIZE));
  }
}
```

---

## 💾 Data Flow Architecture

### 📥 READ — Google Sheets API v4 (Direct, Maximum Speed)
| Property | Value |
|---|---|
| **Engine** | Google Sheets API v4 |
| **Method** | `GET` |
| **File** | `js/services/google-sheets.js` |

### 📤 WRITE — Google Apps Script (Simple POST)
| Property | Value |
|---|---|
| **Engine** | Google Apps Script (GAS) |
| **Protocol** | `POST` · `application/x-www-form-urlencoded` |
| **File** | `js/services/gas-service.js` |
| **Mechanism**| `XMLHttpRequest` directly to `GAS_URL` |

**Note for Agents:** Do NOT invent `GASQueue` or `fetchWithBackoff` classes. The app uses `XMLHttpRequest` for maximum compatibility without queues.

---

## 🛡️ Security Standards

### XSS Prevention — DOM Sanitization (Non-Negotiable)

External or user-supplied data (CSV content, API responses, URL params) MUST NEVER touch `.innerHTML`.

```js
// ✅ CORRECT — safe programmatic construction
function buildCell(value) {
  const td = document.createElement('td');
  td.textContent = value;  // auto-escapes all HTML entities
  return td;
}

// ❌ FORBIDDEN — XSS attack surface
cell.innerHTML = csvValue;
```

### Fail-Fast Error Handling

Silent `catch` blocks are **forbidden**. Every exception must be:
1. Captured and logged via the HTML log mechanism.
2. Surfaced to the UI via `Notifications.show()`.

```js
// ✅ CORRECT
try {
  await processData(payload);
} catch (err) {
  Logger.error('processData', err.message);
  if (typeof Notifications !== 'undefined') {
    Notifications.show('error', err.message);
  }
  throw err; // re-throw — no silent swallow
}
```

---

## 🎨 Design System — VS Code IDE Aesthetic

The UI must feel like a native professional IDE. Generic, "webby", or consumer-app aesthetics are **strictly forbidden**.

### Color Tokens

```css
:root {
  /* Actions & Focus */
  --primary:   #0078d4;   /* Main CTA, active tabs, focus rings */
  --info:      #3794ff;   /* Secondary status, informational */

  /* Feedback States */
  --success:   #0dbc79;   /* Confirmations, saved, done */
  --warning:   #ff8c00;   /* Partial data, degraded state, JSON markers */
  --error:     #f44747;   /* Critical failures, validation errors */

  /* Surfaces */
  --bg-dark:   #1e1e1e;   /* Primary background (dark theme) */
  --bg-light:  #ffffff;   /* Primary background (light theme) */
  --surface:   #252526;   /* Card / panel surface (dark) */
  --border:    #3c3c3c;   /* Dividers, panel borders */
  --text:      #d4d4d4;   /* Primary text (dark theme) */
  --text-muted:#858585;   /* Secondary, disabled text */
}
```

### Typography

| Property | Value |
|---|---|
| **Font stack** | `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif` |
| **Base size** | `13px` |
| **Line height** | `1.5` |
| **Code / monospace** | `'Cascadia Code', 'Fira Code', 'Consolas', monospace` |

### Iconography

- Codicons (`codicon-*`) must be the primary and default library for all UI elements to maintain the IDE aesthetic.
- FontAwesome is **permitted** as a secondary alternative when necessary or optimal to complement Codicons.

---

## 🏷️ Naming Conventions & Code Quality

### Identifiers

| Type | Convention | Example |
|---|---|---|
| Functions / Instances | `camelCase` | `parseRow()`, `activeSheet` |
| Constants / Config | `UPPER_SNAKE_CASE` | `BATCH_SIZE`, `GAS_URL` |
| CSS Variables | `--kebab-case` | `--primary`, `--bg-dark` |

### Logging Policy

`console.log()` is **permanently forbidden** in all source files.
All runtime logging MUST route through the dedicated `Logger`:

```js
// js/utils/logger.js — only permitted logging interface
Logger.info('module', 'message', payload?);
Logger.warn('module', 'message', payload?);
Logger.error('module', 'message', error);
```

---

## 🌐 Accessibility & Semantic HTML

- Use semantic HTML5 elements: `<header>`, `<main>`, `<nav>`, `<section>`, `<article>`, `<aside>`, `<footer>`.
- Every interactable element MUST have a unique `id` and appropriate `aria-*` attributes.

---

## ✅ Agent Pre-Flight Checklist

Before submitting any coding action, the agent MUST confirm all items:

```
[ ] BACKUP CREATED  — Timestamped backup folder created in backup/[YYYYMMDD_HHMMSS]/ BEFORE file modification
[ ] BACKUP ANNOUNCED — Backup location reported to user BEFORE applying changes
[ ] Context read    — js/config/constants.js loaded to understand current real state
[ ] Valid APIs      — Global architecture respected, using existing XMLHttpRequest for Server calls
[ ] XSS-safe        — No .innerHTML with external data anywhere
[ ] Batch processing — CSV/DOM operations use DocumentFragment/requestAnimationFrame
[ ] No console.log  — All logging routes through Logger utility
[ ] 0 console errors — Browser devtools expected to be clean
[ ] AI_CODE_MAP updated — If new intricate workflows were introduced, AI_CODE_MAP reflects them.
```

---

*Document authority: Full-Stack Architecture Expert & AI Agent Systems Engineer*
*Status: Adapted for Vanilla JS monolithic speed & safety.*
