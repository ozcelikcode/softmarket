# Native canvas: what-digital spike — 2026-11-08

## Decision: REJECTED (FAILS)

> Result: the plugin was removed from the worktree; V3b was built with a custom bridge (`canvas.md`).

1.0.1 does not satisfy the two-way `origin` **and** `source` check security gate. In the installed package's `SiteBridge` test, a different origin was rejected, but a `hello` message from a non-parent window on the same origin was accepted (`connected = true`). On its own, this is not proof of unauthorized writes or data access: the admin side also verifies the iframe source and session ID. Even so, the plan's explicit gate is not met. Move to the custom V3b Argon bridge; this spike does not implement the bridge.

Sources: [site bridge](https://github.com/what-digital/payload-inline-visual-editor/blob/85e055e51d8c8e4128aa4c3ef2808dee9c2bd850/packages/core/src/bridge.ts), [admin bridge](https://github.com/what-digital/payload-inline-visual-editor/blob/85e055e51d8c8e4128aa4c3ef2808dee9c2bd850/packages/plugin/src/utils/adminBridge.ts). The README's claim of two-way source checking does not match the site code.

The admin plugin is registered only for `products`; the frontend SDK and markup were not wired up. Therefore, this worktree is not a working canvas demo. Editor round-trip, Lexical, multilingual flow, and full integration bundle results were not verified. Chromium failed to launch with a sandbox permission error; the security flaw is already a mandatory disqualifier.

## Package and maintenance

- [MIT license](https://github.com/what-digital/payload-inline-visual-editor/blob/85e055e51d8c8e4128aa4c3ef2808dee9c2bd850/LICENSE): forking is possible, copyright and license notice must be preserved. Inspected and exact-pinned packages from npm are `payload-inline-visual-editor@1.0.1` and `@payload-inline-visual-editor/react@1.0.1`; core 1.0.1. npm `latest` 1.0.1 (2026-07-20 13:12:26 UTC); [first public release 2026-07-20](https://github.com/what-digital/payload-inline-visual-editor/blob/85e055e51d8c8e4128aa4c3ef2808dee9c2bd850/CHANGELOG.md); 1.0.0 yanked. Inspected upstream HEAD `85e055e51d8c8e4128aa4c3ef2808dee9c2bd850`.
- Peer ranges Payload/UI `^3.85.0`, Next `^15.2.9 || ^16.0.0`, React/React-DOM `^19.0.0`: installed 3.93.0 / 15.4.11 / 19.2.6 are within range; build and typecheck passed, runtime compatibility not fully proven.
- Upstream `packages/{plugin,core,react}/src`: 35 files, ~4,603 TS/TSX lines. Code is modular and readable; Payload UI exports such as the form API, drawer, `RenderFields`, and Live Preview are gathered into a single `payload-internals.ts` barrel. Avoids deep UI imports but depends tightly on admin form/state and component contracts; Payload upgrades require regression/fork maintenance. Since this is the first public release, maturity evidence is limited.
- The site SDK's `configurePayloadEditable` function uses a module-global variable; per-request draft configuration in the README risks sharing state across concurrent SSR requests. The race was not tested dynamically; integration should use an explicit request-local flag. Compliance of the SDK client module with the public JS ban must also be resolved.

## Gates and evidence

| Gate | Result |
|---|---|
| Editor round-trip / Lexical | **Could not verify.** Chromium launch hit SIGTRAP with `MachPortRendezvous ... Permission denied`; SDK/DOM markup not wired. In the copy DB, TR and EN `layout` of an empty-content composition product were read via Local API and saved published unchanged, and deep comparison passed. This is not an editor test; home page, Lexical node JSON, and non-writing of empty EN fallback were not tested. |
| Operations and TR/EN | **Partial.** Installed `planBlockOp` produced expected indices for add/duplicate/remove/move. Via Local API on an isolated product draft, `spacer` was added, duplicated, removed, and `productEditions` was moved; changing the EN title did not change the TR title. Not performed through the plugin form; locale switching and draft-to-publish UI flow were not verified. Duplicating singleton `productNav` returned 400. |
| V2 | **Server boundary passed.** Removing `productEditions` in the copy DB returned 400 on normal, draft, and autosave writes; a hero moved to the end was normalized to first on the server. `product-composition` and `live-preview` unit tests passed 60/60. The plugin planner plans the editions delete request; server rejection holds. |
| Security | **FAILS.** Site bridge accepts a wrong source; admin bridge checks origin/source/session and target origin is explicit. `/api/preview?redirect=/tr` returned anonymous HTTP 401 and `private, no-store, max-age=0`. `/admin/visual-editor/products/1` returned anonymous HTTP 200; absence of unauthorized editor content and customer/draft no-store end-to-end were not separately verified. The existing preview implementation was not modified. |
| Public bundle | **Could not verify / measured raw total above threshold.** Build succeeded with admin plugin registered and SDK unwired. Gzipping and summing each of the 13 scripts in `/tr` HTML gave 161,565 bytes (~157.8 KiB); `payload-inline-visual-editor`, `payload-visual-editor`, and `data-pve-` markers are absent from these scripts. This method is not directly comparable to the earlier Lighthouse transfer metric and measures an integration without the SDK; the ≤130 KB gate is treated as not passed, and Lighthouse plus all frontend chunks must be measured separately on full integration. |
| MCP/import | **Could not verify.** Since no save occurred from the editor, subsequent MCP find and import dry-run were not run. |

`NEXT_DIST_DIR=.next-pilot-canvas PORT=3520 pnpm build` and `pnpm typecheck` succeeded. On 3520, `/tr`, `/en`, `/admin` returned 200 and anonymous preview returned 401. The server was shut down upon completion. The copy DB was created with `sqlite3 .backup` and `integrity_check = ok`. Migrations were not run, uploads were not needed, and no HTTP requests were made to the main repo server. Test products exist only in the copy.

## Payload 3.93.0 admin form API

Directly inspected `node_modules/@payloadcms/ui/dist/forms/Form/{context,types}.d.ts`, `forms/useField/{index,types}.d.ts`, and `dist/exports/client/index.d.ts`. These are `@payloadcms/ui` client exports:

```ts
useForm(): Context
useDocumentForm(): Context // from nested form to document form
useAllFormFields(): [FormState, React.Dispatch<FieldAction>]
useFormFields<T = unknown>(selector: (context: [FormState, React.Dispatch<FieldAction>]) => T): T
// Context:
addFieldRow(args: { path: string; schemaPath: string; blockType?: string; rowIndex?: number; subFieldState?: FormState }): void
moveFieldRow(args: { path: string; moveFromIndex: number; moveToIndex: number }): void
removeFieldRow(args: { path: string; rowIndex: number }): void
dispatchFields: React.Dispatch<FieldAction>
setModified(modified: boolean): void
// FieldAction options:
{ type: 'DUPLICATE_ROW'; path: string; rowIndex: number }
{ type: 'UPDATE'; path: string } & Partial<FormField> // including value
useField<T>(options?: Options): FieldType<T> // setValue(val: unknown, disableModifyingForm?: boolean): void
```

`useForm().fields` can be stale; the type file recommends `useFormFields`. It is necessary to resolve row IDs from current state and validate indices, manage `schemaPath` and modified/validation state, and preserve the server access/validation chain after form dispatch. These signatures are source verification, not a runtime test of the custom bridge.
