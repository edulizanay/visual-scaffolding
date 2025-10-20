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
   - Split `server/server.js` into:
     - `server/app.js` (Express app definition, middleware, health checks).
     - `server/routes/flowRoutes.js`, `server/routes/conversationRoutes.js`, `server/routes/notesRoutes.js`.
     - `server/index.js` (starts HTTP server, handles env config).
   - Move business logic currently embedded in routes into service modules such as `services/flowService.js`, `services/groupService.js`, `services/notesService.js`. //why is this necessary or good? what could be a middleground that doesnt explode in # of files?

2. **Separate data access from services**
   - Keep `db.js` focused on database initialization; move SQL query helpers into `repositories/` (e.g., `repositories/flowRepository.js`, `repositories/notesRepository.js`) for better encapsulation and testability.
   - Wrap `historyService`/`conversationService` logic into classes or factory functions if they share dependencies (e.g., database, snapshot store).

## Testing Strategy Adjustments
- Mirror the feature layout under `tests/`, e.g., `tests/features/flow-canvas/FlowCanvasContainer.test.jsx`, `tests/features/notes/NotesPanel.test.jsx`.
- Co-locate unit tests with source files once the structure stabilizes (`__tests__` folders or `*.test.tsx` siblings) to reduce path gymnastics and ensure changes stay in sync. //what does this mean? can you elaborate please?
- Introduce integration tests for backend routes alongside the route modules, using supertest or a similar tool. //I believe we do, can you check?

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

## Additional Opportunities
- Consider TypeScript adoption for the frontend to make large modules (layout utils, API clients) safer to refactor. //can you explain why?
- Generate Storybook entries (or a simple component gallery) for core UI components once they are modularized. // can you explain this pls?


These notes should provide a roadmap for restructuring the project without altering current functionality until you are ready to make the changes.
