# V5 P1 independent security and quality audit — 2026-11-10

Scope: `6509ec6..HEAD`, `feat/visual-editor`, Next 15.4.11 / Payload 3.93.0. Schema/migrations, the main repo, the live DB, and the port 3100 process were not modified. All DB writes ran against temporary SQLite/uploads directories created by the tests themselves.

## Findings and fixes

No P0 findings were found. The following P1/P2 findings were fixed and targeted regressions were added:

- **P1 — Queue was released early.** Payload deletes the session record before physical commit/rollback finishes; a second completion call for the same ID could return immediately and start the next writer. `db-serial-transactions.ts` shares the completion promise for the same ID; it does not open the queue until failed commit cleanup completes. Tested for commit/rollback races, errors, 25 timeouts, null BEGIN, and re-advancing.
- **P1 — Timestamp alone was not a conditional write identity.** Content changing within the same millisecond can receive the same `updatedAt` as the previous version. `concurrency.ts` uses the SHA-256 digest of the raw all-locale snapshot; it catches content differences even if the clock is rolled back. The virtual field is computed first, before locale flatten/populate. The write response returns the snapshot token re-read from the DB within the same transaction. Stale timestamp clients receive 409.
- **P1 — Merge could lose remote content.** `layout` was treated as a single field, overwriting the remote array with the entire local array. `admin/merge.ts` merges objects by field and blocks/arrays by stable row ID, preserving additions, deletions, and ordering. On same-value, Lexical, delete/edit, and incompatible-order conflicts, the form is not reset or saved. A successful merge clears stale undo history.
- **P1 — Merge base remained stale after flush.** While the token advanced, `savedData` stayed stale; previously saved local changes could overwrite remote changes again. `host.tsx` stores the values sent by a successful flush as the new base.
- **P2 — Version restore erroneously received 409.** Payload produces the virtual field from a historical snapshot; that value is not a client precondition. Explicit restore is on the unversioned write contract. Leaking the restore flag onto a subsequent normal update on a reused Local API `req` was also prevented.
- **P2 — 409 notification was lost in a hidden tab.** Flush called the polling check that only ran in a visible tab. Now 409 is reported directly; a late response does not overwrite another locale/document's token or warning. A tokenless flush is not sent, and a versionless success response is not accepted.
- **P2 — Empty/null token silently disabled the condition.** Only a truly omitted field is unconditional; empty/null receives 400. Payload populating a missing virtual field from the old document is tracked separately; unversioned MCP/import behavior is preserved.
- **P3 (resolved) — `editorVersion` was visible on anonymous reads.** Field read access was restricted to staff. Copy/merge only takes writable content roots defined in the collection schema; metadata, virtual/readOnly/join, and unknown fields are excluded. Populated relationships are normalized to IDs.

## Verification and scope limits

- Targeted: `visual-editor-db`, `db-serial-transactions`, `visual-editor-merge`, `visual-editor-sync`: **4 files, 36/36**.
- Temporary SQLite: TR/EN token equality, depth/fallback independence, absence of anonymous token, no DB column, timestamp collision/clock rollback, stale version rejection, restore/duplicate/bulk, mounted REST handler draft/publish, V2 editions requirement, and hero-first normalization were verified. Import/CLI transaction tests are included in the full suite.
- Load: **30 parallel writes + 30 anonymous reads, 0 errors, 1579 ms total, slowest read 190 ms** (latest full-suite run). Local API writes inside an open outer transaction worked with `req`; outer anonymous reads stayed under the 2 s limit. At the end, adapter session count was 0. This small local test is not a production capacity guarantee.
- `pnpm typecheck`, `pnpm lint`, `git diff --check`: clean.
- Latest `pnpm test --maxWorkers=1`: **73 files; 1184 passed / 2 failed / 1186 total**, 493.16 s. All relevant editor/queue regressions passed. Failures: `content-import › rejects media outside` excluded by the user (in this environment `content/seed/media` ENOENT first) and `blocks-appearance-migration › reads legacy rows` 60 s timeout. The same assertions in the second file passed **3/3** within a 120 s limit using only a temporary Vite test transform, 85.84 s total; the single test took 65.22 s. The repo's test timeout/fixture was not modified. This duration budget is reported as **P3**.
- Separate client/merge/queue run on latest source: **3 files / 20 tests passed**. Targeted run including DB 36/36; full-suite DB 16/16.
- **Merge to main branch: NO.** No open P0–P2 findings remain; real admin browser/merge E2E and build verification are missing, and the standard full-suite gate is red for the two reasons above.
- **No commit was created:** attempting `git add` with the explicit file list failed with `/Users/ozcelik/dev/softmarket/.git/worktrees/softmarket-visual-editor/index.lock: Operation not permitted`. Files were left unstaged in the working tree. `.env`, DB/uploads, and temporary test outputs are not in the list.
- The path `/private/tmp/claude-501/-Users-ozcelik-dev-softmarket/86cb568c-5f6b-4b21-b0fe-e6a5de07c79f/scratchpad/softmarket-v5.db` specified by the user was not found. An alternative copy path was requested. **3531 build/browser E2E was not run; no server was started.** Stale timestamp expectations in E2E were updated to the new token contract.

## Remaining P3 / operational contracts

- Conditional writes are not an authorization boundary: privileged API/Local API/MCP/import omitting the token completely, bulk edit, and explicit restore are intentionally unconditional writes. Document form autosave/publish/flush paths carry the token; the server does not require a token on every staff write.
- The queue is adapter/process-local. Across multiple Node processes there is no shared mutex; SQLite locking can reject a second writer with `SQLITE_BUSY`. The single-VPS single-process assumption must be preserved. Cross-process load testing was not performed.
- Nested Local API calls share the same transaction via the existing `req`. If `req` is forgotten, the inner BEGIN is rejected after 5 s. A manual BEGIN owner completely forgetting commit/rollback is not automatically recovered; writes will time out. Rolling back an active transaction with a blind timer was not added because it would break long imports. Built-in operations were tested for rollback and subsequent writes after error/409/validation; actual process crash/disk full was not simulated.
- Snapshot tokens require the full document; tokens from projected API reads must not be used as an editor precondition. Polling now reads a full depth-0 draft with locale/fallback enabled; additional network/CPU cost on large documents was not separately measured. Anonymous reads do not compute the hash; normal public find/findByID does not open a queue BEGIN.
- Real admin DOM, GraphQL HTTP transport, and browser merge/reset interactions were not verified in this run. The snapshot field-hook ordering should be re-tested on Payload upgrades.

## Changed files

`AGENTS.md`, `docs/editor-guide.md`, `docs/qa/v5-concurrency-audit.md`, `memory-bank/activeContext.md`, `memory-bank/progress.md`, `src/editor/canvas/{concurrency.ts,plugin.ts}`, `src/editor/canvas/admin/{host.tsx,sync.ts,merge.ts}`, `src/lib/{db-serial-transactions.ts,visual-editor-labels.ts}`, `src/payload-types.ts`, `tests/e2e/isolated/visual-editor.spec.ts`, `tests/unit/{db-serial-transactions,visual-editor-db,visual-editor-merge,visual-editor-sync}.test.ts`.
