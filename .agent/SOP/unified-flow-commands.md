# SOP: Unified Flow Commands

Keep every flow mutation (node CRUD, grouping, layout tweaks, visual changes) in one backend command so the UI, LLM, and tests all execute the same logic.

## Use This When
- A feature can be triggered from more than one place (e.g. keyboard shortcut and LLM tool).
- You need undo/history consistency or schema checks when mutating the flow.

## Required Workflow (Do This Every Time)
1. **Define the command once** in `server/tools/executor.js` (or helper it calls). Validate inputs and return `{ success, updatedFlow, ... }`.
2. **Expose the same command** to all callers: wire it into the LLM tool list and, if the UI needs it, add a REST endpoint in `server/server.js` that simply passes through to the executor and persists with `writeFlow`.
3. **Call it from the frontend** through a helper in `src/api.js`. React components should use the helper instead of mutating state directly. If the UI needs extra flair, pass flags/params or layer the behaviour after the response, but never fork the core logic.
4. **Update state from the response** using `handleFlowUpdate` (or equivalent) so autosave and undo snapshots stay aligned.
5. **Test the command**: add/extend Jest coverage for the executor and Supertest coverage for any new endpoint.

## Helpful Guidelines
- Keep the frontend thin—optimistic updates are fine, but always reconcile with the server snapshot.
- Share validation helpers (e.g. group membership checks) between UI guards and backend enforcement.
- Document new commands or parameters in `.agent/system/project_architecture.md` or feature task docs.

## Reference Examples
- `executeAddNode` + `POST /api/node` + `createNode()` — double-click in the UI and LLM tool creation now share the same backend command.
- `executeCreateGroup` + `POST /api/group` + `createGroup()` — Cmd+G grouping in UI and LLM tool creation share the same backend command.
- `executeUpdateNode` + `PUT /api/node/:id` + `updateNode()` — label editing in UI and LLM tool updates share the same backend command.
- `executeAddEdge` + `POST /api/edge` + `createEdge()` — drag-to-connect in UI and LLM tool creation share the same backend command.
- Group collapse/expand routes through `toggleGroupExpansion` before the result is persisted and broadcast back to React Flow.
