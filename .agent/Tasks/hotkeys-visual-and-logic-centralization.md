# Hotkeys Visual and Logic Centralization

## Objective
- Replace scattered keyboard shortcut handling and tooltip rendering with a single source of truth that can be consumed by the React UI, documentation, and (eventually) LLM guidance.
- Ensure every shortcut has a predictable UI treatment and consistent labeling so future changes are made once and propagate everywhere.
- Preserve existing behaviours during the initial refactor, while laying groundwork for richer HUDs or command palettes later.

## Current Interaction Inventory
| Command / Gesture | Trigger | Current Handler | UI Surface | Notes |
| --- | --- | --- | --- | --- |
| Undo | `metaKey|ctrlKey` + `z` | `src/App.jsx:490` (`handleKeyDown`) | Toast with `⌘ Z` badge (`src/App.jsx:598`) | Toast auto-hides after 2.5s; only appears post-action. |
| Redo | `metaKey|ctrlKey` + `y` | `src/App.jsx:493` | Toast with `⌘ Y` badge (`src/App.jsx:598`) | Shares toast component with undo. |
| Group Nodes | `metaKey|ctrlKey` + `g` | `src/App.jsx:500` with `selectedNodeIds` guard | Bottom-right tooltip (`src/App.jsx:560`) | Tooltip only when ≥2 nodes selected; logic/visual tied together. |
| Ungroup Nodes | `metaKey|ctrlKey` + `shiftKey` + `G` | `src/App.jsx:496` | Bottom-right tooltip (`src/App.jsx:577`) | Requires single group selection; tooltip duplicates styling. |
| Toggle Multi-select | Pointer + `metaKey|ctrlKey` click | `src/App.jsx:334` (`onNodeClick`) | No visual guidance | Shortcut undocumented in UI. |
| Collapse/Expand Subtree | Pointer + `altKey` click | `src/App.jsx:322` (`onNodeClick`) | No guidance | Behaviour differs from double-click collapse. |
| Toggle Group Expansion | Pointer double-click on group node | `src/App.jsx:298` (`onNodeDoubleClick`) | No guidance | Shares handler with Cmd+Double-click creation. |
| Create Child Node | Pointer double-click + `metaKey|ctrlKey` on node | `src/App.jsx:304` → `createNode()` | No guidance | Adds backend child node via API. |
| Collapse Group Halo | Pointer double-click on halo | `src/utils/groupUtils.js:475-505` (`GroupHaloOverlay`) | No guidance | Prevents collapse when modifier held. |
| Submit Chat | `metaKey|ctrlKey` + `Enter` | `src/ChatInterface.jsx:119` (`handleKeyDown`) | Inline hint overlay (`src/ChatInterface.jsx:245`) | Hint fades when input empty. |
| Focus Chat Input | Any printable key while canvas is focused | `src/ChatInterface.jsx:162` (`handleGlobalKeyDown`) | No guidance | Prevents typing loss but invisible. |
| Commit Node Label | `Enter` inside inline editor | `src/Node.jsx:38-66` | No guidance | Currently relies on familiarity. |
| Commit Node Description | `Enter` inside description editor | `src/Node.jsx:67-106` | No guidance | Same pattern as label. |
| Commit Edge Label | `Enter` inside edge editor | `src/Edge.jsx:45-78` | No guidance | Same pattern. |

## Current Tooltip / Hint Surfaces
- **Bottom-right floating cards** (`src/App.jsx:560-595`): show group/ungroup prompts; duplicated markup/styles.
- **Top-right toast** (`src/App.jsx:598-612`): shows undo/redo hints post-action.
- **Inline chat overlay** (`src/ChatInterface.jsx:245-260`): static `⌘ + ⏎` prompt once user types.
- **No surfaces** for the remaining keyboard gestures despite being implemented.

## Pain Points Identified
- Hotkey logic is hard-coded in multiple components, with state checks embedded in listeners; changing a combo means touching several files.
- Visual hints are bespoke and inconsistent in placement, timing, and style. Duplicated inline CSS makes UX drift likely.
- No audit trail of which commands exist versus which have UI exposure; testing or doc automation cannot rely on a single definition.
- `document.addEventListener` listeners live directly in `App.jsx` and `ChatInterface.jsx` rather than a shared hook, complicating reuse or cleanup.

## Target Architecture (Lean MVP)
- **Single registry module (`src/hotkeys.js`)**: exports an array of definitions (`id`, `keys`, `label`, `description`, optional `isActive(state)`).
- **Inline listener hook** (`useHotkeys`) living in `src/hotkeys.js` (or directly in `App.jsx` initially) to register keyboard handlers against the registry.
- **Display mode metadata**: each definition declares `displayMode: 'contextual' | 'always' | 'both'` so the dock knows whether to rotate it continuously or only surface it when active; mouse gestures can be marked `always`.
- **Existing UI surfaces** (tooltips, toasts, inline chat hint) stay in place, but pull their labels/keys from the registry via lightweight helpers such as `getHotkeyLabel(id)`.
- **Context data** gathered inside `App.jsx` and passed as props (no new provider yet). `ChatInterface` receives needed flags through existing props.
- **Naming/labels** standardized via the registry so edits cascade instantly.

## Implementation Plan (Lean)
1. **Discovery & Schema**
   - Confirm the command list (table above) and agree on IDs and display labels.
   - Decide Mac/Windows key rendering rules for the registry (`['Meta', 'Shift', 'G']` etc.).
   - Define registry shape using JSDoc/TypeScript typedef to document `displayMode`, `keys`, `isActive(state)`, and optional `type: 'keyboard' | 'mouse'`.

2. **Registry Creation**
   - Add `src/hotkeys.js` exporting:
     ```js
     export const HOTKEYS = [
       {
         id: 'flow.group',
         keys: ['Meta', 'G'],
         label: 'Group Nodes',
         description: 'Combine selected nodes into a group.',
         displayMode: 'contextual',
         isActive: state => state.selectionCount >= 2,
       },
       // …all other commands
     ];
     export function findHotkey(id) { … }
     export function formatHotkeyKeys(keys, platform) { … }
     ```
   - Include optional helpers for matching keyboard events (`matchHotkey(event, hotkey)`).

3. **Listener Consolidation**
   - Implement `useHotkeys` inside `src/hotkeys.js`:
     - Accepts a map `{ [id]: handler }` and optional `state`.
     - Registers a single `keydown` listener on mount; unregisters on cleanup.
     - Normalizes modifiers and invokes the matching handler when the command’s `isActive(state)` evaluates true.
      - Includes a tiny debounce/guard to prevent repeated firing when state toggles rapidly (bounce handling).
   - Replace the `document.addEventListener('keydown', …)` block in `App.jsx` with `useHotkeys({ 'flow.undo': handleUndo, … }, state)`.
   - Reuse the same hook inside `ChatInterface.jsx` (import from `src/hotkeys.js`) for submit/history navigation commands.

4. **Tooltip / Toast Integration**
   - Create small inline helpers in `App.jsx`:
     ```js
     const ShortcutHint = ({ id }) => {
       const hotkey = findHotkey(id);
       if (!hotkey) return null;
       return <Kbd>{formatHotkeyKeys(hotkey.keys)}</Kbd>;
     };
     ```
   - Replace hard-coded tooltip labels (`⌘ G`, `⌘ ⇧ G`) with `<ShortcutHint id="flow.group" />` etc.
   - Update undo/redo toast to read label/keys from registry.
   - Update chat hint overlay to use the same helper for `chat.submit`.

5. **State Plumb-Through**
   - Build a minimal `hotkeyState` object in `App.jsx` containing `selectionCount`, `isGroupSelected`, `isProcessing`, etc.
   - Pass this object into `useHotkeys` and tooltip components so `isActive` conditions work.
   - Continue drilling props into `ChatInterface` and other consumers; no context provider yet.
   - Add throttled update (e.g., `setTimeout` or `requestAnimationFrame`) when swapping contextual hints so the dock does not flicker during rapid selection changes.

6. **Documentation & Validation**
   - Update this task doc plus `.agent/system/project_architecture.md` (Front-end UX primitives section) to mention `src/hotkeys.js`.
   - Manually test all commands to confirm behaviour unchanged.
   - Flag future enhancements (e.g., provider, HUD, tests) as follow-up tasks once the registry proves valuable.

## Test Plan (TDD)
> Develop the registry and hook via TDD—write failing tests first, implement minimal code to pass, then refactor.

1. **Registry Schema Tests**
   - `HOTKEYS` entries conform to required keys (id/label/keys/displayMode).
   - `findHotkey` returns the correct object and null for unknown IDs.
   - `formatHotkeyKeys` correctly renders Mac labels (e.g., `⌘ ⇧ G`) and falls back to raw letters when unknown.

2. **`matchHotkey` / Event Handling**
   - Given a synthetic `KeyboardEvent`, `matchHotkey` identifies the command only when modifiers and key match.
   - Ensure `isActive(state)` gates are respected; inactive state prevents handler invocation.
   - Listener cleanup removes event listeners exactly once.

3. **Bounce/Throttle Behaviour**
   - Simulate rapid state changes; ensure the contextual hint selection defers updates (e.g., test that last state wins after debounce interval).

4. **UI Integration (React Testing Library)**
   - Bottom-right dock renders contextual hint when `state.selectionCount >= 2`.
   - Dock falls back to rotating “always” tips when no contextual commands are active.
   - Collapsing the dock hides hints but preserves a reopen affordance.
   - Clicking the dock opens the full overlay panel listing every entry.

5. **Regression Smoke Tests**
   - Simulate `⌘G` press with appropriate state and confirm grouping handler called.
   - Simulate `⌘⇧G` with group selected.
   - Simulate `⌘Z`/`⌘Y` to verify undo/redo toasts use registry labels.
   - Simulate chat submit key combo.

6. **Mouse Gesture Entries**
   - Ensure `displayMode: 'always'` entries (e.g., Alt+Click) appear in rotating carousel even without contextual activation.

## Deliverables Checklist
- `src/hotkeys.js` exporting the registry, helper utilities, and `useHotkeys`.
- `App.jsx` refactored to consume the registry for tooltips/toasts and to register handlers via `useHotkeys`.
- `ChatInterface.jsx` refactored to use the shared registry for submit hints and keyboard handling.
- Documentation updates referencing the centralized hotkey registry.

## Deliverables Checklist
### Full Architecture Track
- `src/hotkeys/registry.js` with exhaustive command definitions.
- `useHotkeyManager`, `HotkeyStateProvider`, `ContextHints`, `ActionToasts`, `InlineShortcut`.
- Refactored `App.jsx`, `ChatInterface.jsx`, `GroupHaloOverlay` consumption of the new APIs without behavioural regressions.
- Updated documentation (architecture + new task SOP if needed).
- Automated tests covering registry-driven conditions and listeners.

### Lean MVP Track
- `src/hotkeys.js` exporting registry + helper utilities.
- Updated `App.jsx` / `ChatInterface.jsx` to consume registry and share inline `useHotkeys` + `ShortcutHint`.
- Documentation updates noting the new registry.

## Other Considerations
- Target Mac-only shortcuts for now, so the registry can emit `⌘`, `⌥`, etc., without cross-platform branching.
- Tooltip churn: implement debounce/throttle to smooth rapid state changes.
- Mouse gestures: include them in the registry with `type: 'mouse'` and `displayMode: 'always'`.
