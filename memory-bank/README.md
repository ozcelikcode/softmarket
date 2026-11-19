# Memory Bank

## What it is
The Memory Bank is the persistent summary of the project, so the AI agent does not lose context between sessions. The agent's memory is reset in every session; project knowledge comes only from these files and the codebase.

## File hierarchy

```
projectbrief.md          (foundation: scope, decisions, goals; single source of truth)
   ├── productContext.md  (why it exists, UX, design, palette)
   ├── systemPatterns.md  (architecture, patterns, critical flows)
   └── techContext.md     (versions, setup, constraints, tools)
            │
            ▼
      activeContext.md    (now: focus, recent changes, next steps)
            │
            ▼
       progress.md        (what works, what remains, known issues, decision evolution)
```

- Files at the top are more stable; files at the bottom change more often.
- If there is a conflict, the file higher in the hierarchy is authoritative. `activeContext.md` and `progress.md` show the current status.

## Mandatory reading
**At the start of every task, read ALL files under `memory-bank/`.** Order: `projectbrief.md` → `productContext.md` → `systemPatterns.md` → `techContext.md` → `activeContext.md` → `progress.md`. Reading this README is also mandatory.

Do not change code, make plans, or suggest commits without reading.

## Update triggers
- **New pattern** or architecture decision → `systemPatterns.md` (and `techContext.md` if needed).
- **Significant change** after a phase (phase completed, QA passed, file/route added, command changed) → `activeContext.md` and `progress.md`.
- **Scope or decision changes** → `projectbrief.md` (with user approval).
- **When the user says "update memory bank"** → ALL files are reviewed and updated.
- **When context is uncertain** (suspected stale information, conflicts between files) → check the code and sources, then fix the relevant file.

## Writing rules
- Short, factual, scannable. No guesses or fabrication; if unsure, write "not verified".
- Paths, commands, versions, and technical terms are written exactly as they are.
- Each piece of information is written in one place; no repetition.
- A typical file is 40-120 lines.
