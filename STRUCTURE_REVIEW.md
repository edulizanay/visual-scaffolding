# Visual Scaffolding – Structure Review

This document captures a structural audit of the repository with recommendations for reorganizing files, renaming modules/functions, and clarifying responsibilities. No code changes were made; these are planning notes for a future refactor pass.

## High-Level Observations
- The `src/` directory is flat, mixing top-level components, hooks, utilities, and API helpers. Several files exceed 300–600 LOC (e.g., `groupUtils.js`, `App.jsx`, `NotesPanel.jsx`), which makes navigation and reuse difficult.
- Backend logic in `server/` is also concentrated in a handful of large modules (`server.js`, `tools/executor.js`, `llm/llmService.js`, `db.js`) without an explicit routing/service/data-access separation.
- Tests live under `tests/` but largely mirror the flat frontend layout. As features grow, keeping unit/integration tests co-located with their feature code will be easier.
- Naming consistency can improve. UI components such as `KeyboardUI` or `Node` are very generic, while API helpers are grouped under a monolithic `api.js`.

## Duplication Hotspots
- **Inline editing behavior**: `src/Node.jsx:13-95` and `src/Edge.jsx:13-79` both maintain nearly identical state and event handlers for double-click-to-edit, change, blur, and `Enter`-to-commit logic. Extracting a shared `useInlineEdit` hook or `InlineEditableText` component would reduce maintenance overhead.
- **Manual debouncing**: `src/App.jsx:100-118` (auto-saving flow) and `src/NotesPanel.jsx:157-176` (notes persistence) each implement their own `setTimeout`/`clearTimeout` debounce wrappers. A shared `useDebouncedEffect`/`useDebouncedCallback` helper would remove duplication and ensure consistent behavior.
- **Fetch boilerplate**: Most functions in `src/api.js` (`loadFlow`, `saveFlow`, `createNode`, `updateNode`, etc.) repeat the same `fetch`/status-check/error-handling pattern. Centralizing this into a `request` helper (with configurable method/body) would shrink the file and keep error handling consistent across endpoints.
- **Hotkey metadata reuse in tests**: `src/hooks/useHotkeys.jsx` enumerates all hotkeys, and `tests/unit/frontend/KeyboardUI.test.jsx` reasserts the same labels/keys inline. Providing exported fixtures (e.g., `HOTKEYS` reused directly in tests) would avoid keeping parallel literal lists in sync.

## Frontend Restructuring Suggestions
1. **Adopt a feature-first directory layout**
   - Suggested top-level structure:
     ```
     src/
       features/
         flow-canvas/
           components/ (Node, Edge, GroupHaloOverlay, GroupHaloOverlayTooltip, etc.)
           hooks/ (useFlowLayout, useGroupSelection, useCanvasHotkeys)
           utils/ (group visibility helpers, layout math)
         chat/
           components/ (ChatInterface, KeyboardShortcutsPanel, MessageHistoryList)
           hooks/ (useChatHistory, useProcessingState)
           services/ (chatApi client)
         notes/
           components/ (NotesPanel, NotesToolbar, BulletList)
           hooks/ (useNotes, useEntityMarkers)
       services/ (REST clients shared across features)
       theme/ (tokens, helpers)
       app/ (AppShell, entry providers, routing, context)
       index.tsx / main.jsx
     ```
   - Keep shared primitives (buttons, inputs) under `src/components/` or `src/ui/` if a design system emerges.

2. **Split large components into focused modules**
   - `App.jsx` (≈550 LOC) can be separated into:
     - `AppShell`: orchestrates layout, providers, portals.
     - `FlowCanvasContainer`: owns React Flow state, handlers, and API mutation wiring.
     - `FlowCommandHandlers` (custom hook) that centralizes undo/redo/save/create logic.
   - `NotesPanel.jsx` (≈530 LOC) could become:
     - Presentational components (`NotesPanel`, `NotesList`, `EntityTag`, `PanelHeader`).
     - Hooks (`useNotesPersistence`, `useEntityPrompts`).
     - Pure helpers (`renderStyledText`, `stripEntityMarkers`) moved to `notes/utils`.
   - `groupUtils.js` (≈600 LOC) should be partitioned by responsibility:
     - `group/validation.js` (`validateGroupMembership`, `detectCircularReference`)
     - `group/visibility.js` (`applyGroupVisibility`, `computeNodeVisibility`, halo helpers)
     - `group/layout.js` (`collapseSubtreeByHandles`, descendant traversal)

3. **Clarify API service boundaries**
   - Replace the single `api.js` with domain-specific clients (`flowApi.js`, `conversationApi.js`, `notesApi.js`, `groupApi.js`) exported through `services/api/index.js`.
   - Co-locate feature hooks with the API client they rely on for clearer dependency direction.

4. **Improve naming clarity**
   - Rename `KeyboardUI` → `KeyboardShortcutsPanel`.
   - Rename hook exports to reflect intent: e.g., `useFlowLayout` → `useAutoLayoutAnimation`, `useHotkeys` → `useGlobalHotkeys`.
   - Consolidate constants under `theme/tokens.js` and export typed subsets (`colors`, `spacing`, etc.) to avoid broad `THEME` imports everywhere. **


## Backend Restructuring Suggestions
1. **Create explicit entrypoint, routes, and services layers**
   - First pass (minimal churn): extract `server/app.js` (Express app + middleware) and `server/routes/index.js` (all route registrations). Keep business logic in place while confirming everything still works.
   - Second pass: break `routes/index.js` into feature-specific routers (`routes/flowRoutes.js`, `routes/notesRoutes.js`, `routes/conversationRoutes.js`) and introduce matching services (`services/flowService.js`, etc.) as each file grows beyond ~200 LOC.
   - Long-term structure can expand to `controllers/`, `repositories/`, etc., only when a domain truly needs the extra separation.

2. **Separate data access from services**
   - Keep `db.js` focused on database initialization; move SQL query helpers into `repositories/` (e.g., `repositories/flowRepository.js`, `repositories/notesRepository.js`) for better encapsulation and testability.
   - Wrap `historyService`/`conversationService` logic into classes or factory functions if they share dependencies (e.g., database, snapshot store).

## Testing Strategy Adjustments
- **Unit tests (temporary):** During migration, mirror the feature layout under `tests/features/` (e.g., `tests/features/flow-canvas/Node.test.jsx`) to avoid breaking imports while files move.
- **Unit tests (goal):** Once a feature stabilizes in `src/features/`, co-locate its unit tests next to source files (`Component.test.jsx` or `__tests__/Component.test.jsx`). IDEs let you collapse `__tests__/` folders to reduce noise.
- **Integration & E2E tests:** Keep under `tests/integration/` and `tests/api-*/` as they span multiple modules and need shared test harnesses. Update imports to reference new route/service locations as backend refactors.

## Incremental Refactor Plan
1. **Lay groundwork**
   - Introduce `src/features/` folder and gradually move one feature at a time (start with flow canvas).
   - Add re-export barrels (e.g., `src/features/flow-canvas/index.js`) to avoid breaking imports while files move.
2. **Component breakup**
   - Extract pure helper modules before moving files; add unit tests for each extracted helper to preserve behavior.
   - Replace large switch/if blocks with smaller dedicated handler functions (especially in `App.jsx` for mutation handlers).
3. **Backend layering**
   - Refactor Express server into `app.js` + routers without altering business logic, then progressively move logic into services/repositories.
4. **Cleanup and naming**
   - Once files live under their target folders, perform the renames (`KeyboardUI` → `KeyboardShortcutsPanel`, etc.) and update imports.
   - Adjust documentation/readme to match the new structure.

## Parallel Migration Plan

### Safety Practices
- Keep PRs focused on a single domain/feature so two engineers rarely touch the same files.
- Require unit + integration test runs (CI + local) for every refactor PR.
- Hold a weekly sync to rebalance assignments if conflicts emerge.
- Because each step is production-ready, rollback is as simple as reverting the last merged PR if an issue slips through.

### Phase 0 – Prep (1–2 days, single engineer)
- Finalize this document, confirm naming/layout guidelines, and share the branch workflow.
- Optionally add CI reminders (e.g., lint rule for missing unit tests) so new code follows the structure automatically.

### Phase 1 – Backend Foundations (routes/services)  
_Engineers can own individual route families._
1. **Shared scaffolding**
   - Create `server/app.js`: build the Express app instance, apply middleware (JSON body parsing, CORS, static assets), and export it.
   - Create `server/routes/index.js`: import existing route handlers and register them with the app (`app.use('/api/flow', flowRoutes)`).
   - Update `server/server.js`: import the app from `app.js`, move the `listen` logic here, and remove route/middleware definitions.
   - Run the full test suite, merge.
2. **Domain route extraction**
   - Assign owners for `flow`, `notes`, and `conversation`.
   - Each owner moves their endpoints into `routes/<domain>Routes.js`, leaving logic in place.
   - Where logic exceeds ~100 LOC or crosses concerns, create `services/<domain>Service.js`.
   - Ensure Supertest suites still pass before merging.
3. **Repository extraction (as needed)**
   - When a service has multiple SQL calls or repeated queries, introduce `repositories/<domain>Repository.js`.
   - Update the corresponding service to depend on the repository; extend tests to cover the new boundary.

**Phase 1 Exit Criteria**
- All API endpoints live under `server/routes/<domain>Routes.js`.
- `server/server.js` only wires up `app.listen` and related startup concerns (ideally <100 LOC).
- Integration tests (`tests/api-*.test.js`, `tests/integration/`) pass without modification.
- No business logic remains inside `server/server.js`.

### Phase 2 – Frontend Feature Modules  
_Workstreams can proceed concurrently with Phase 1._
0. **Shared helper extraction**
   - Before relocating features, extract shared hooks (`useInlineEdit`, `useDebouncedCallback`, etc.) to `src/shared/hooks/`.
   - Update existing modules to import from `src/shared/hooks/` so each feature references the canonical helper during its move.
1. **Flow canvas relocation**
   - Move flow-specific components/hooks/utils into `src/features/flow-canvas/` with a temporary barrel export to keep imports stable.
   - Adjust unit tests to match new paths.
2. **Chat and notes relocation**
   - Engineers handle `src/features/chat/` and `src/features/notes/` simultaneously, mirroring the flow pattern.
   - `api.js` functions split into `services/<domain>Api.js`, with a short-lived `apiLegacy.js` that re-exports both to prevent breakage mid-migration.

**Phase 2 Exit Criteria**
- Flow, chat, and notes code reside under `src/features/<domain>/`.
- Legacy `src/api.js` is replaced by domain-specific API modules (legacy re-export removed).
- Unit tests referencing moved modules run against the new locations without warnings.
- Shared helpers (inline edit, debounce, etc.) are sourced from `src/shared/hooks/` with no duplicated logic.

### Phase 3 – Quality Layer (tests & documentation)
1. **Test relocation**
   - As files move, place unit tests next to their modules (`Component.test.jsx` or `__tests__/Component.test.jsx`).  
   - Encourage teammates to collapse the test folder in their IDE to reduce noise.
2. **Integration alignment**
   - Update supertest suites to import from the new route/service locations.
   - Capture lightweight documentation (screenshots, short notes) for complex UI states so QA can verify them quickly.

**Phase 3 Exit Criteria**
- Unit tests are co-located with their source modules (or mirrored by feature folders) with no stale references.
- Integration tests import the relocated routes/services and pass.
- QA/reference notes for key UI states are documented and accessible.
- Legacy test paths or imports pointing to old locations have been removed.


These notes should provide a roadmap for restructuring the project without altering current functionality until you are ready to make the changes.
