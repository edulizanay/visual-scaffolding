# Notes Panel - Experimental Thinking Assistant

## Overview

An experimental feature to test whether capturing free-form thoughts and AI-structuring them is valuable before committing to full node automation. A sliding panel where users can talk through what they want to build, and the AI organizes their thoughts into editable bullet summaries.

**Purpose**: Validate the "thinking assistant" approach - does structuring stream-of-consciousness into bullets help users clarify ideas before building?

**Status**: Experimental / Debug Mode
**Priority**: Medium (product discovery)
**Estimated Effort**: 6-8 hours

---

## User Experience

### Core Flow

1. User clicks toggle button (top-left of canvas)
2. Panel slides in from left, overlaying the canvas
3. User types thoughts into ChatInterface (reused from existing component)
4. User sends message (Cmd/Ctrl+Enter)
5. AI receives: (a) current notes bullets, (b) user's message, (c) current graph state
6. AI responds by adding new bullets to the summary
7. User can edit any bullet inline
8. Notes persist across sessions
9. User closes panel when done

### Key Behaviors

- **Panel overlay**: Does NOT push canvas content, overlays from left side
- **Canvas interaction**: Canvas remains visible and interactive while panel is open (no backdrop - panel is companion workspace, not modal)
- **Editable bullets**: All text is editable - user can add, delete, modify any bullet
- **Session persistence**: Notes survive browser refresh and app restarts
- **ChatInterface routing**:
  - Panel OPEN → messages go to `/api/notes` (notes LLM, no node creation)
  - Panel CLOSED → messages go to `/api/conversation/message` (normal node creation)
- **Append-only AI**: AI only adds new bullets, does not edit existing ones

---

## Functional Requirements

### Panel UI/UX

**MUST have:**
- Toggle button in top-left corner of canvas
- Panel slides in/out from left edge
- Panel width: 320px on desktop
- No backdrop - canvas stays interactive (companion workspace, not modal)
- Slide animation duration: Use `TRANSITION_NORMAL` from theme.js (250ms)
- Slide animation easing: Use `EASING_DECELERATE` for open, `EASING_ACCELERATE` for close (from theme.js)
- Panel background: `COLOR_DEEP_PURPLE` with 98% opacity
- Right border: 1px solid indigo with subtle glow (visual connection to group/structure theme)
- Close button (X) in top-right of panel interior

**Panel structure:**
1. Header section ("Notes & Ideas" or similar)
2. Bullets display area (scrollable, full height)
   - All text is editable (user can add, delete, modify bullets)
   - No chat interface inside the panel

### Chat Interface Behavior

**Use existing ChatInterface** (bottom-center of screen, unchanged position):
- When notes panel is **OPEN**:
  - ChatInterface sends messages to `/api/notes` (notes LLM)
  - Node creation endpoint is disabled
  - Bullets are updated in NotesPanel
- When notes panel is **CLOSED**:
  - ChatInterface sends messages to `/api/conversation/message` (normal behavior)
  - Node creation works as usual

**Required modifications to ChatInterface.jsx**:
- Accept `isNotesPanelOpen` prop (passed from App.jsx)
- If `isNotesPanelOpen === true` → call `/api/notes`
- If `isNotesPanelOpen === false` → call `/api/conversation/message`
- No positioning changes, no duplication

### Bullets Display

**Editable bullets in NotesPanel**:
- All text is editable (user can add, delete, modify)
- Bullet marker: "•" in indigo color (`COLOR_INDIGO_LIGHT`)
- Each bullet is a text area (transparent background, no visible border by default)
- On hover: subtle left border appears (editability hint - clean by default, discoverable on interaction)
- On focus: border becomes visible, slight background tint
- Auto-save on edit (call `PUT /api/notes` to persist changes)
- Clean list presentation

### AI Context

When user sends a message, the LLM receives:

1. **Current notes** (all accumulated bullets)
2. **User's latest message** (the one they just sent)
3. **Current graph state**:
   - All nodes (id, label, position)
   - All group nodes (id, label, isCollapsed, members)
   - All edges (source, target)

**AI behavior:**
- Summarizes user's thoughts concisely
- Identifies key concepts or entities
- **Adds new bullets only** (does not edit or reorganize existing bullets for now)

### Data Persistence

**Storage format:**
- Local file in project directory (for easy inspection during development)
- Suggested filename: `notes-debug.json` in project root
- Must persist across app restarts

**Required data structure:**
```json
{
  "bullets": [
    "First bullet point summary",
    "Second bullet point summary"
  ],
  "conversationHistory": [
    {
      "role": "user",
      "content": "raw user message",
      "timestamp": "ISO timestamp"
    },
    {
      "role": "assistant",
      "content": "AI response with bullets",
      "timestamp": "ISO timestamp"
    }
  ]
}
```

**Note:** Graph snapshots are NOT required for this phase.

**Backend access to graph state:**
- Backend fetches current flow via `getFlow()` (same pattern as `llmService.js`)
- NotesPanel doesn't need direct access to nodes/edges props

### API Endpoints

**GET /api/notes**
- Loads existing notes from file
- Returns: `{ bullets: string[], conversationHistory: object[] }`
- On file missing: Returns empty state `{ bullets: [], conversationHistory: [] }` (not error)

**POST /api/notes**
- Sends message to notes LLM for summarization
- Request: `{ message: string }`
- Response: `{ success: boolean, bullets: string[], newBullets: string[], thinking?: string, error?: string }`
- LLM context: current bullets + user message + current flow state (via `getFlow()`)

**PUT /api/notes**
- Updates entire bullets array (when user edits)
- Request: `{ bullets: string[] }`
- Response: `{ success: boolean, bullets: string[] }`
- Persists immediately to file

### Theme Integration

**Must use existing theme.js tokens:**

From `src/constants/theme.js`:
- Colors: `COLOR_DEEP_PURPLE`, `COLOR_INDIGO_LIGHT`, `COLOR_NEUTRAL_*` scale
- Spacing: `SPACING_*` scale (4px base unit)
- Typography: `FONT_SIZE_SM/BASE/LG`, `FONT_WEIGHT_*`, `LINE_HEIGHT_*`
- Borders: `BORDER_RADIUS_SM/MD`, `BORDER_WIDTH_THIN`
- Transitions: `TRANSITION_NORMAL` (250ms for slide animations)
- Easing: `EASING_STANDARD` (use for slide animation consistency)

**Panel z-index:**
- Must be above canvas (0) but below modals (300)
- Add to theme.js if missing: `Z_INDEX_NOTES_PANEL = 150`
- Panel: 150, Backdrop: 149 (if backdrop is used)

---

## Out of Scope (Phase 2)

The following are explicitly NOT part of this initial implementation:

- Entity highlighting in bullets (detecting potential nodes)
- Creating nodes from notes via UI actions
- Voice input
- Real-time AI summarization (auto-summarize while typing)
- AI editing or reorganizing existing bullets (append-only for now)
- Special visual treatment for different bullet types
- Exporting notes to other formats
- Search/filter within notes
- Sharing notes between users

---

## Technical Constraints

### File Structure

**You MAY create new files in these locations:**

**Frontend (src/):**
- `src/NotesPanel.jsx` - Main panel component (bullets display only)
- `src/api.js` - Add API functions: `loadNotes()`, `sendNotesMessage()`, `updateNotes()`
- `src/ChatInterface.jsx` - Modify to check `isNotesPanelOpen` prop and route to correct endpoint

**Backend (server/):**
- `server/llm/notesLLMService.js` - Notes LLM service (SIMPLIFIED version of `llmService.js`)
  - System prompt for notes summarization (NO tools)
  - Context builder (bullets + user message + graph state)
  - Response parser for bullet array extraction (simpler than tool parsing)
  - LLM caller with Groq/Cerebras clients (SEPARATE instances, copy pattern don't import)
  - OMIT: Tool execution, retry logic, tool definitions
- `server/notesService.js` - File-based storage service (NOT database)
  - Uses fs.readFileSync/writeFileSync for `notes-debug.json`
  - Functions: `loadNotes()`, `saveNotes()`, `updateBullets()`
  - Handles ENOENT errors gracefully (return empty state)

**Data:**
- `notes-debug.json` - In project root for easy inspection

**You MAY modify these existing files:**
- `src/App.jsx` - To add toggle button and render NotesPanel (state managed here)
- `src/api.js` - Add notes-related API functions
- `src/ChatInterface.jsx` - Add optional `endpoint` prop
- `src/constants/theme.js` - Add `Z_INDEX_NOTES_PANEL` constant if needed
- `server/server.js` - Add API endpoints: GET/POST/PUT /api/notes

### Must NOT Modify

**You MUST NOT change:**
- `server/db.js` - Database schema (notes use file storage, not database)
- `src/App.jsx` - Canvas/flow rendering logic (only add panel toggle button and state)
- `src/GroupHaloOverlay.jsx` - Group nodes system
- `src/utils/groupUtils.js` - Group utilities
- Any existing LLM system prompts (create separate notes prompt in `notesLLMService.js`)

### Implementation Guidance

**Backend/API:**
- File-based storage (no database changes)
- **Simplified LLM service pattern** (from `server/llm/llmService.js`):
  - Create `server/llm/notesLLMService.js` with notes-specific system prompt
  - COPY (don't import) Groq/Cerebras client initialization pattern - create SEPARATE instances
  - Build context: bullets + user message + graph state (via `getFlow()`)
  - Response parser: Extract bullet array from `<response>` tags (simpler than tool parsing)
  - OMIT: Tool execution, retry logic, tool definitions
- **File storage service** (pattern from `server/conversationService.js`):
  - Create `server/notesService.js` using fs.readFileSync/writeFileSync
  - Handle ENOENT gracefully (return empty state, not error)
  - Path construction: `join(__dirname, '..', 'notes-debug.json')`
- **API endpoints** in `server/server.js`:
  - GET /api/notes - Load bullets
  - POST /api/notes - Process message, return new bullets
  - PUT /api/notes - Update bullets array
- **Error handling**:
  - Use `logError()` helper (consistent with server.js pattern)
  - Response format: `{ success: boolean, error?: string, ... }`
  - File errors: Return empty state (not 500 error)

**Frontend:**
- Modify ChatInterface to accept `isNotesPanelOpen` prop from App.jsx
  - When true → route to `/api/notes`
  - When false → route to `/api/conversation/message`
- NotesPanel is simple bullets display (no chat inside)
- Panel state managed in App.jsx (consistent with KeyboardUI pattern)
- Add API functions to `src/api.js`: `loadNotes()`, `sendNotesMessage()`, `updateNotes()`
- Must not interfere with canvas interactions (use proper z-index)
- ChatInterface position unchanged (stays bottom-center)

**Reference implementations:**
- `src/ChatInterface.jsx` - For chat UI patterns
- `server/llm/llmService.js` - For LLM service pattern (context builder, response parser, LLM caller)
- `server/conversationService.js` - For service layer pattern (file/storage operations)
- `src/constants/theme.js` - For design tokens
- `server/server.js` - For API endpoint patterns


---

## Success Criteria

**Functionality:**
1. ✅ User can toggle panel open/closed
2. ✅ User can type thoughts and send via Cmd/Ctrl+Enter
3. ✅ AI receives graph context and produces bullet summaries
4. ✅ Bullets are displayed and directly editable
5. ✅ Notes persist across app restarts (file-based)
6. ✅ Canvas remains interactive while panel is open

**UX Quality:**
1. ✅ Smooth slide animation (250ms from theme, proper easing)
2. ✅ Panel doesn't block canvas interaction (no backdrop)
3. ✅ Clear visual hierarchy (bullets above, input at bottom)
4. ✅ Edit affordance is discoverable (hover shows left border)

**Technical Quality:**
1. ✅ No console errors or React warnings
2. ✅ File I/O works reliably (reads/writes notes file)
3. ✅ Animation is smooth (no jank)
4. ✅ Works on desktop (mobile can be future enhancement)

---

## Testing Requirements

### Unit Tests (TDD - Write Before Implementation)

**Backend (`server/llm/notesLLMService.js`)** - Track 1 tests:
- **T1.1** `parseNotesBullets()` extracts bullet array from `<response>` tags
- **T1.2** `parseNotesBullets()` handles malformed JSON (comments, extra whitespace)
- **T1.3** `parseNotesBullets()` returns empty array when no bullets found
- **T1.4** `buildNotesContext()` combines bullets + user message + graph state correctly
- **T1.5** `callNotesLLM()` fails over from Groq to Cerebras on error

**Backend (`server/notesService.js`)** - Track 1 tests:
- **T1.6** `loadNotes()` returns empty state when file doesn't exist (ENOENT)
- **T1.7** `loadNotes()` parses existing JSON file correctly
- **T1.8** `saveNotes()` writes correct JSON structure to file
- **T1.9** `updateBullets()` updates only bullets array, preserves conversationHistory

**Backend (`server/server.js` endpoints)** - Track 1 tests:
- **T1.10** `GET /api/notes` returns bullets array
- **T1.11** `POST /api/notes` processes message and returns new bullets
- **T1.12** `PUT /api/notes` updates bullets and persists to file
- **T1.13** Error responses return `{ success: false, error: string }`

**Frontend (`src/ChatInterface.jsx`)** - Track 2 tests:
- **T2.1** When `isNotesPanelOpen=true` → calls `/api/notes`
- **T2.2** When `isNotesPanelOpen=false` → calls `/api/conversation/message`
- **T2.3** Prop is optional (defaults to false for backward compatibility)

**Frontend (`src/api.js`)** - Track 2 tests:
- **T2.4** `loadNotes()` fetches from GET /api/notes
- **T2.5** `sendNotesMessage(message)` posts to /api/notes with message
- **T2.6** `updateNotes(bullets)` puts to /api/notes with bullets array

**Frontend (`src/NotesPanel.jsx`)** - Track 3 tests:
- **T3.1** Panel renders when `isOpen=true`, hidden when false
- **T3.2** Slide animation uses TRANSITION_NORMAL and EASING_STANDARD
- **T3.3** Bullets are editable (textarea per bullet)
- **T3.4** Edit triggers `updateNotes()` API call
- **T3.5** Close button calls `onClose()` prop

### Integration Tests - Track 4 tests

**Backend Integration**:
- **I1** Full flow: POST /api/notes → LLM call → parse → save → return bullets
- **I2** File persistence: Save → restart → load returns same data
- **I3** Error handling: LLM failure returns error without crashing

**Frontend Integration**:
- **I4** App.jsx → ChatInterface → NotesPanel data flow
- **I5** Panel state toggle updates ChatInterface routing
- **I6** Bullets update in panel when ChatInterface receives response

### End-to-End Tests - Track 4 tests

**Critical User Flows**:
- **E2E1** Open panel → send message → bullets appear in panel, no nodes created
- **E2E2** Close panel → send message → nodes created normally, no bullets
- **E2E3** Edit bullet → refresh browser → changes persist
- **E2E4** Delete notes file → open panel → app shows empty state (no crash)

### Manual Testing

**UX Quality**:
- Toggle panel open/close multiple times - smooth animation, no flicker
- Edit bullet inline - auto-saves, no lag
- Canvas interaction while panel open - both work independently
- Very long bullets wrap/scroll appropriately

**Edge Cases**:
- Empty notes (first time opening panel)
- Rapid open/close toggling (animations queue properly)
- LLM error response (shows error state, doesn't crash)
- File write failure (handles gracefully with error message)

---

**Created**: 2025-10-18
**Last Updated**: 2025-10-18
**Owner**: Edu
