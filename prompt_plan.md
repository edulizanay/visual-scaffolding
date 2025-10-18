# Notes Panel - Implementation Plan

Based on PRD: `.agent/tasks/notes-panel.md`

## Agent Coordination Strategy

This feature will be implemented using **parallel tracks** with clear handoffs to maximize efficiency.

### Work Distribution

```
TRACK 1 (Backend - Independent)
└── Agent: general-purpose
    └── Responsible for: Backend LLM service, storage, API endpoints
    └── Tests: T1.1-T1.13 (13 unit tests)
    └── Inputs: None (reads PRD, existing llmService.js pattern)
    └── Outputs:
        - server/llm/notesLLMService.js (working)
        - server/notesService.js (working)
        - server/server.js (3 new endpoints)
        - notes-debug.json (created on first use)
        - All T1.x tests passing
    └── Deliverable: Backend can be tested with curl/Postman

TRACK 2 (ChatInterface - Blocking)
└── Agent: general-purpose
    └── Responsible for: ChatInterface routing modification, API functions
    └── Tests: T2.1-T2.6 (6 unit tests)
    └── Inputs: None (reads PRD, existing ChatInterface.jsx)
    └── Outputs:
        - src/ChatInterface.jsx (modified with isNotesPanelOpen prop)
        - src/api.js (3 new functions added)
        - All T2.x tests passing
    └── Deliverable: ChatInterface routes to correct endpoint based on prop
    └── BLOCKS Track 3

TRACK 3 (NotesPanel - Sequential after Track 2)
└── Agent: general-purpose
    └── Responsible for: NotesPanel component, App.jsx integration
    └── Tests: T3.1-T3.5 (5 unit tests)
    └── Inputs: Track 2 complete (ChatInterface routing working)
    └── Outputs:
        - src/NotesPanel.jsx (new component)
        - src/App.jsx (toggle button + panel integration)
        - src/constants/theme.js (Z_INDEX_NOTES_PANEL added if needed)
        - All T3.x tests passing
    └── Deliverable: Full UI working (panel + routing)
    └── REQUIRES: Track 2 complete

TRACK 4 (Integration & E2E - Sequential after all)
└── Agent: general-purpose
    └── Responsible for: Integration tests, E2E tests, manual QA
    └── Tests: I1-I6, E2E1-E2E4 (10 integration/e2e tests)
    └── Inputs: Tracks 1, 2, 3 complete (full feature working)
    └── Outputs:
        - All integration tests passing (I1-I6)
        - All E2E tests passing (E2E1-E2E4)
        - Manual testing checklist completed
        - Bug fixes for any issues found
    └── Deliverable: Feature ready to commit
    └── REQUIRES: Tracks 1, 2, 3 complete
```

### Execution Timeline

**Parallel Phase (Start simultaneously)**:
- Spawn Track 1 agent (Backend)
- Spawn Track 2 agent (ChatInterface)

**Handoff 1** → When Track 2 completes:
- Spawn Track 3 agent (NotesPanel)

**Handoff 2** → When all Tracks 1, 2, 3 complete:
- Spawn Track 4 agent (Integration & E2E)

**Estimated Total Time**: 6-7 hours (vs 9-10 if sequential)

### Test Assignment Summary

- **Track 1**: Tests T1.1-T1.13 (Backend unit tests)
- **Track 2**: Tests T2.1-T2.6 (ChatInterface unit tests)
- **Track 3**: Tests T3.1-T3.5 (NotesPanel unit tests)
- **Track 4**: Tests I1-I6, E2E1-E2E4 (Integration & E2E tests)

See PRD Testing Requirements section for full test specifications.

---

## Implementation Steps

**🚀 SPAWN AGENTS**: Start Phase 1 and Phase 2.1 in parallel

---

### Phase 1: Backend Infrastructure (TRACK 1)

**Agent Assignment**: Spawn `general-purpose` agent for entire Phase 1
**Tests Required**: T1.1 through T1.13 (write tests first, then implement)
**Deliverable**: Backend endpoints working and testable with curl/Postman

- [x] **1.1 Create Notes LLM Service** (`server/llm/notesLLMService.js`)
  - System prompt for notes summarization (NO tools, bullet extraction only)
  - COPY (don't import) Groq/Cerebras client initialization - create SEPARATE instances
  - Context builder: `buildNotesContext(bullets, userMessage, graphState)`
  - Response parser: `parseNotesBullets(llmResponse)` - extract bullet array from `<response>` tags
  - LLM caller: `callNotesLLM()` with Groq/Cerebras failover
  - OMIT: Tool execution, retry logic, tool definitions (simpler than main LLM service)

- [x] **1.2 Create Notes Storage Service** (`server/notesService.js`)
  - Uses fs.readFileSync/writeFileSync (NOT database)
  - `loadNotes()` - reads `notes-debug.json`, handles ENOENT gracefully
  - `saveNotes(bullets, conversationHistory)` - writes to `notes-debug.json`
  - `updateBullets(bullets)` - updates bullets array only
  - Path: `join(__dirname, '..', 'notes-debug.json')`

- [x] **1.3 Add API Endpoints** (`server/server.js`)
  - `GET /api/notes` - Load existing bullets
  - `POST /api/notes` - Process user message, return new bullets
    - Flow: `loadNotes()` → `buildNotesContext()` → `callNotesLLM()` → `parseNotesBullets()` → `saveNotes()`
    - Response: `{ success, bullets, newBullets, thinking?, error? }`
  - `PUT /api/notes` - Update bullets array (for edits)
  - Error handling: Use `logError()` helper, return `{ success: false, error }` format

---

### Phase 2.1: ChatInterface Routing (TRACK 2)

**Agent Assignment**: Spawn `general-purpose` agent for Phase 2.1 (can run parallel with Phase 1)
**Tests Required**: T2.1 through T2.6 (write tests first, then implement)
**Deliverable**: ChatInterface routes correctly based on prop + API functions in src/api.js

- [x] **2.1a Add API Functions** (`src/api.js`)
  - `loadNotes()` - GET /api/notes
  - `sendNotesMessage(message)` - POST /api/notes
  - `updateNotes(bullets)` - PUT /api/notes
  - Write tests T2.4, T2.5, T2.6 first

- [x] **2.1b Modify ChatInterface** (`src/ChatInterface.jsx`)
  - Add `isNotesPanelOpen` prop (boolean, passed from App.jsx)
  - When `isNotesPanelOpen === true` → call `/api/notes` endpoint
  - When `isNotesPanelOpen === false` → call `/api/conversation/message` endpoint
  - NO position changes, stays bottom-center
  - Write tests T2.1, T2.2, T2.3 first

**📋 HANDOFF 1**: Phase 2.1 complete → Spawn Phase 2.2-3.2 agent

---

### Phase 2.2-3.2: NotesPanel UI (TRACK 3)

**Agent Assignment**: Spawn `general-purpose` agent for Phase 2.2 through 3.2
**Tests Required**: T3.1 through T3.5 (write tests first, then implement)
**Dependencies**: REQUIRES Phase 2.1 complete (ChatInterface routing working)
**Deliverable**: Full UI working (panel displays bullets, integrates with App.jsx)

- [x] **2.2 Create NotesPanel Component** (`src/NotesPanel.jsx`)
  - Panel container with slide animation (250ms, EASING_STANDARD from theme)
  - Fixed positioning, 320px width, no backdrop
  - Header section ("Notes & Ideas")
  - Scrollable bullets display area (full height)
  - NO chat interface inside panel
  - Close button (X) in top-right

- [x] **2.3 Implement Bullets Display**
  - Editable bullet list (textarea per bullet)
  - User can add, delete, modify any bullet
  - Indigo bullet markers (`COLOR_INDIGO_LIGHT`)
  - Hover state: subtle left border
  - Focus state: visible border + background tint
  - Auto-save on bullet edit (call `updateNotes()` API)

- [x] **2.4 Wire NotesPanel to ChatInterface**
  - When NotesPanel receives new bullets from `/api/notes` response
  - Update bullets display in NotesPanel
  - ChatInterface handles the API call (no chat UI in panel)

### Phase 3: UI Integration

- [x] **3.1 Add Toggle Button** (`src/App.jsx`)
  - Button in top-left corner (40x40px or similar)
  - Simple icon or emoji (📝)
  - Opens/closes NotesPanel
  - State: `const [isNotesPanelOpen, setIsNotesPanelOpen] = useState(false)`

- [x] **3.2 Add Panel to App**
  - Render NotesPanel conditionally when `isNotesPanelOpen`
  - Pass `isOpen` and `onClose` props to NotesPanel
  - Pass `isNotesPanelOpen` prop to ChatInterface
  - Z-index: Add `Z_INDEX_NOTES_PANEL = 150` to theme.js if needed
  - Ensure canvas remains interactive (proper z-index stacking)

**📋 HANDOFF 2**: All Phases 1, 2.1, 2.2-3.2 complete → Spawn Phase 4-5 agent

---

### Phase 4-5: Integration Testing & QA (TRACK 4)

**Agent Assignment**: Spawn `general-purpose` agent for Phase 4 and 5
**Tests Required**: I1-I6, E2E1-E2E4 (integration and end-to-end tests)
**Dependencies**: REQUIRES all previous phases complete (full feature working)
**Deliverable**: All tests passing, feature ready to commit

### Phase 4: Data Persistence

- [x] **4.1 File-Based Storage**
  - Backend creates `notes-debug.json` in project root on first write
  - Structure: `{ bullets: [], conversationHistory: [] }`
  - Load notes on panel open (call `loadNotes()` API)
  - Save on every bullet edit and AI response

- [x] **4.2 Session Persistence**
  - Notes reload from file on app restart
  - Handle missing/corrupted file gracefully (empty state)
  - Empty state handling (first time use)

### Phase 5: Testing & Polish

- [x] **5.1 Manual Testing**
  - Toggle panel open/close - smooth animation
  - Send message with panel OPEN - bullets appear in panel, no nodes created
  - Send message with panel CLOSED - nodes created normally
  - Edit bullet - changes persist to file
  - Refresh browser - notes reload
  - Canvas interaction while panel open
  - Delete file - app handles gracefully

- [x] **5.2 Edge Cases**
  - Empty notes (first open)
  - Very long bullets (wrapping/scrolling)
  - Rapid toggling (animation queuing)
  - LLM error response (show error in panel)
  - File write failure (graceful error)

- [x] **5.3 Final Polish**
  - No console errors/warnings
  - Smooth animation
  - Theme tokens used correctly (TRANSITION_NORMAL, EASING_STANDARD, etc.)
  - ChatInterface routing works correctly (notes vs nodes)

---

## Current Status

**Active Step**: ✅ COMPLETED - All tracks finished
**Blockers**: None
**Notes**: All 4 tracks completed successfully. Feature ready for production.

### Completion Summary:
- ✅ Track 1: Backend infrastructure (notesLLMService, notesService, API endpoints) - Tests T1.1-T1.13 passing
- ✅ Track 2: ChatInterface routing (API functions, conditional routing) - Tests T2.1-T2.6 passing
- ✅ Track 3: NotesPanel UI (component, App.jsx integration, toggle button) - Tests T3.1-T3.5 passing
- ✅ Track 4: Integration & E2E tests - Tests I1-I6, E2E1-E2E6 passing (12 tests total)
- ✅ All 606 tests passing (579 unit + 6 integration + 6 E2E + 15 backend)

---

## Implementation Notes

**Pattern References**:
- LLM service: `server/llm/llmService.js` (COPY client pattern, SIMPLIFY for notes)
- Storage service: `server/conversationService.js` (adapt for file-based storage)
- Panel UI: `src/KeyboardUI.jsx` (slide animation pattern)
- Theme tokens: `src/constants/theme.js`

**Key Constraints**:
- ONE ChatInterface (bottom-center, unchanged position)
- ChatInterface routes to different endpoints based on `isNotesPanelOpen` prop
- NotesPanel is ONLY bullets display (no chat inside)
- MUST NOT modify database schema (file storage only)
- LLM service is SIMPLIFIED (no tools, no retry, separate clients)
- File storage NOT frontend (all I/O via backend API)
- Append-only bullets (AI adds, doesn't edit)
- NO keyboard shortcuts

**Critical Details**:
- ChatInterface gets `isNotesPanelOpen` prop from App.jsx
- Panel open → route to `/api/notes` (notes LLM)
- Panel closed → route to `/api/conversation/message` (node creation LLM)
- Separate LLM client instances (copy pattern, don't import/share)
- Error handling: `logError()` helper, `{ success, error }` format
- Panel state managed in App.jsx (consistent with KeyboardUI)
- Graph state accessed via `getFlow()` in backend
