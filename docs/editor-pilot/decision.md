# Visual editor decision (V4) — 2026-11-08

**Decision:** Payload-native canvas (custom bridge). The Puck pilot (`pilot/puck`) was dropped; archive tag `archive/pilot-puck`.

## Rationale

- **User evaluation:** Among the 3 admin experiences, the option preferred most for visual editing was the native canvas. User feedback: "Keep it in Payload infrastructure."
- **Published parity:** The canvas viewport is 100% pixel-equivalent to the published output.
- **Public bundle:** +0.17 KB (129.42 → 129.59 KB). Puck's footprint on the public side was 0, and the native solution also adds negligible overhead to public pages.
- **Effort:** V5 estimated at 6–8 days (Puck ~12 days).
- **Dependencies:** The native path adds no new runtime dependencies. Puck would bring 0.x and roughly 60 extra packages.
- **Data:** No conversion. Records remain in the Payload `layout` structure.

## Puck pilot status

- All gates passed: 0 round-trip diff, 0 bundle footprint.
- However, canvas parity was 79%. The MCP/import gate was open at that time; it was later resolved with decision b (commit `f8c7f34`).
- The rationale still favors the native direction: the dependency and effort difference outweighed the gates Puck won.

## Additional user decisions

- The visual editor will be the default view when opening products and pages.
- The form will remain as a narrow side panel. The form is not removed: media, rich text, relationships, and all writes go through form → server validation.
- The `what-digital` plugin was rejected: no postMessage source check.

## Reports

- Puck: `docs/editor-pilot/puck.md`, `docs/editor-pilot/puck-metrics.json`
- Canvas: `docs/editor-pilot/canvas.md`, `docs/editor-pilot/canvas-metrics.json`, `docs/editor-pilot/canvas-spike.md`

## Next step

V5 (`feat/visual-editor` branch): full implementation of the native canvas, 8-task acceptance tests, and `Görsel düzenle` ("Visual edit") visible only to staff in admin.
