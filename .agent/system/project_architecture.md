# Visual Scaffolding - Project Architecture

## Project Overview

Visual Scaffolding is an AI-powered visual flow builder that combines React Flow with LLM capabilities. Users can create, edit, and manipulate node-based flow diagrams either manually through an interactive canvas or through natural language commands via an AI chat interface.

## Tech Stack

### Frontend
- **React 18** - UI library
- **@xyflow/react (React Flow) 12.0** - Flow diagram canvas
- **Vite** - Build tool and dev server
- **TailwindCSS 4** - Styling

### Backend
- **Express.js** - REST API server
- **Supabase (PostgreSQL 15+)** - Cloud-hosted database with async operations
- **@supabase/supabase-js** - Supabase client SDK
- **Groq SDK** - Primary LLM provider (gpt-oss-120b)
- **Cerebras SDK** - Fallback LLM provider
- **CORS** - Cross-origin support

### Testing
- **Vitest 3.2.4** - Test framework with native ESM support (542 tests passing)
- **React Testing Library** - Frontend component testing
- **@testing-library/jest-dom** - DOM assertion matchers (via `/vitest` entry point)
- **@testing-library/user-event** - User interaction simulation
- **happy-dom 20.0.0** - Lightweight browser environment (faster than jsdom)
- **Supertest** - Backend API integration testing
- **Supabase Test Database** - Isolated test environment with `setupTestDb()/cleanupTestDb()` helpers
- **@vitest/coverage-v8** - Code coverage reporting (86.38% overall)

## Project Structure

```
visual-scaffolding/
├── src/                          # Frontend React application
│   ├── App.jsx                   # Main canvas with React Flow
│   ├── ChatInterface.jsx         # AI chat UI component
│   ├── Node.jsx                  # Custom node component
│   ├── Edge.jsx                  # Custom edge component
│   ├── HotkeysPanel.jsx          # Keyboard shortcuts panel UI
│   ├── api.js                    # Frontend API client
│   ├── constants/
│   │   └── theme.js              # Design tokens and semantic theme (replaces visual_settings)
│   ├── hooks/
│   │   ├── useFlowLayout.js      # Auto-layout with dagre
│   │   └── useHotkeys.jsx        # Centralized hotkeys registry and hook
│   ├── utils/
│   │   └── groupUtils.js         # Group node management and visibility
│   └── main.jsx                  # React entry point
│
├── server/                       # Backend Express server
│   ├── server.js                 # Main server & API routes
│   ├── app.js                    # Express app configuration
│   ├── db.js                     # Compatibility layer (re-exports from repositories)
│   ├── supabase-client.js        # Supabase PostgreSQL client configuration
│   ├── repositories/             # Domain-specific data access layer
│   │   ├── flowRepository.js     # Flow CRUD operations
│   │   ├── undoRepository.js     # Undo/redo history management
│   │   ├── conversationRepository.js  # Conversation history operations
│   │   └── notesRepository.js    # Notes CRUD operations
│   ├── services/                 # Business logic layer
│   │   └── flowService.js        # Flow read/write with snapshot integration
│   ├── conversationService.js    # Conversation history management
│   ├── historyService.js         # Undo/redo state management (timestamp-based)
│   ├── routes/
│   │   ├── index.js              # Central route registration
│   │   ├── flowRoutes.js         # Flow domain endpoints
│   │   ├── conversationRoutes.js # Conversation endpoints
│   │   └── notesRoutes.js        # Notes panel endpoints
│   ├── llm/
│   │   ├── llmService.js         # LLM context building & parsing
│   │   ├── llmUtils.js           # Shared LLM utilities
│   │   └── tools.js              # Tool definitions for AI
│   └── tools/
│       └── executor.js           # Tool execution logic
│
├── tests/                        # Comprehensive test suite (542 tests)
│   ├── test-db-setup.js         # Supabase test helpers (setupTestDb/cleanupTestDb)
│   ├── db.test.js               # Database layer tests (timestamp-based)
│   ├── conversationService.test.js  # Conversation service tests
│   ├── historyService.test.js   # Undo/redo tests (timestamp navigation)
│   ├── toolExecution.test.js    # Tool execution with group tests
│   ├── api-*.test.js            # API contract tests (Supabase cleanup)
│   ├── groupHelpers.test.js     # Group utility functions
│   ├── llm/                     # LLM service tests
│   ├── integration/             # Integration tests (Supabase-aware)
│   ├── e2e/                     # End-to-end tests
│   ├── unit/
│   │   ├── frontend/            # Frontend unit tests
│   │   └── backend/             # Backend unit tests (test-db-setup, hotkeys)
│   ├── security/                # Security tests (XSS prevention)
│   ├── setup-frontend.js        # Vitest setup for React component tests
│   └── mocks/                   # Test mocks (styleMock.js)
│
├── .agent/                      # Project documentation
├── package.json
├── vite.config.js
├── vitest.config.js             # Vitest test configuration
└── .env                         # API keys (gitignored)
```

## Frontend Architecture

### Component Hierarchy
- **App.jsx** - Root component managing React Flow instance, nodes/edges state, undo/redo, and visual settings
- **ChatInterface.jsx** - AI chat UI, sends messages to backend, handles flow updates
- **Node.jsx** - Custom node component with inline label/description editing
- **Edge.jsx** - Custom edge component with inline label editing

### State Management
- React Flow hooks (`useNodesState`, `useEdgesState`) for canvas state
- Local state for UI (loading, toast notifications, backend processing flag)
- No global state management (Redux/Zustand) - props and callbacks

### Key Hooks
- **useFlowLayout** - Auto-layout with dagre, collapse/expand subtrees, animated transitions
- React Flow built-ins - `onNodesChange`, `onEdgesChange`, `onConnect`

### Data Flow
1. Load flow from backend on mount → Initialize React Flow with design token theme
2. User edits (drag, edit labels, delete) → Direct backend API calls with error handling
3. AI chat message → Backend processes → Frontend receives updated flow → Auto-layout
4. Undo/Redo → Fetch snapshot from backend → Update React Flow state

**Persistence Architecture:**
- All persistence through explicit backend API calls (no frontend autosave)
- Each action creates a snapshot with origin tag (`ui.node.update`, `ui.node.delete`, `ui.edge.delete`, `ui.subtree`, `llm.tool`)
- Failed operations revert UI state and alert user
- Backend is single source of truth for flow state

## Core Features

### 1. Visual Flow Editor
- Interactive node-based canvas using React Flow
- Manual node creation via double-click (⌘/Ctrl + Double-click)
- Drag-and-drop positioning with backend persistence
- **Group nodes** - combine multiple nodes into collapsible groups (⌘/Ctrl + G)
- **Dual collapse systems**:
  - Group collapse: Uses `isCollapsed` on group nodes, managed via backend API
  - Subtree collapse: Uses `data.collapsed` on any node, managed via backend API (Alt + Click)
- **Auto-layout using pure Dagre algorithm** - no custom compression logic
- Smooth animations for layout transitions
- **Backend-only persistence** - all actions saved via explicit API calls
- **Keyboard shortcuts panel** - slide-in panel showing all hotkeys (? button)

### 2. AI-Powered Flow Generation
- Natural language interface for flow creation
- LLM integration with tool calling
- Automatic retry mechanism for failed tool executions (max 3 iterations)
- Context-aware responses using conversation history
- Support for batch operations (create multiple nodes in one request)
- Group management via natural language (create, ungroup, expand/collapse)

### 3. Persistence & History
- **Supabase (PostgreSQL)** for cloud-hosted data persistence
- **Timestamp-based undo/redo** (⌘Z / ⌘Y) - navigates via `created_at` timestamps instead of sequential IDs
- Conversation history tracking (last 6 interactions sent to LLM)
- Auto-snapshot on every change (50 snapshot limit)
- Deduplication for identical states
- Backwards compatibility: `getUndoStatus()` returns both `currentTimestamp` and computed `currentIndex`

## Backend Architecture

### Repository Layer

The backend uses a layered architecture with domain-specific repositories for data access:

**Domain Repositories:**
- **flowRepository.js** - Flow CRUD operations
  - `getFlow(userId, name)` - Retrieve flow by user and name
  - `saveFlow(flowData, userId, name)` - Save/update flow data
  - `sanitizeFlowData(flowData)` - Validate and clean flow structure
  - `getFlowId(userId, name)` - Get flow ID for joins

- **undoRepository.js** - Undo/redo history management
  - `pushUndoSnapshot(flowData, origin)` - Create snapshot with deduplication
  - `undo()` - Navigate to previous snapshot by timestamp
  - `redo()` - Navigate to next snapshot by timestamp
  - `getUndoStatus()` - Get current position and availability
  - `clearUndoHistory()` - Remove all snapshots
  - `initializeUndoHistory()` - Ensure singleton row exists

- **conversationRepository.js** - Conversation history operations
  - `addConversationMessage(role, content, toolCalls)` - Add message with limit
  - `getConversationHistory()` - Retrieve last 6 messages
  - `clearConversationHistory()` - Remove all messages

- **notesRepository.js** - Notes CRUD operations (singleton pattern)
  - `getNotes()` - Retrieve notes with graceful empty state fallback
  - `saveNotes(bullets, conversationHistory)` - Upsert notes data
  - `updateBullets(bullets)` - Update bullets while preserving conversation history

**Service Layer:**
- **flowService.js** - Consolidates flow read/write logic
  - `readFlow(userId, name)` - Wrapper around flowRepository.getFlow
  - `writeFlow(flowData, skipSnapshot, origin, userId, name)` - Save flow + create snapshot
  - Used by: app.js, executor.js (eliminates duplicate implementations)

**Compatibility Layer:**
- **db.js** - Re-exports from repositories for backward compatibility
  - Allows gradual migration to direct repository imports
  - See [migration-plan.md](../migration-plan.md) for future removal plan

**Shared Utilities:**
- **llmUtils.js** - Common LLM helpers
  - `checkLLMAvailability()` - Verify API keys configured
  - `logError(operation, error)` - Consistent error logging

### Route Organization

Routes are namespaced and mounted via central registration:

- **Namespaced Routes:** All routes under `/api/<domain>/*`
  - `/api/flow/*` - Flow operations (node, edge, group CRUD)
  - `/api/conversation/*` - Chat and history
  - `/api/notes/*` - Notes panel operations

- **Route Registration:** `routes/index.js` mounts all domain routers
  - Dependency injection pattern for `readFlow`/`writeFlow`
  - Each domain has dedicated route file

## Database Schema

See [database_schema.md](./database_schema.md) for detailed schema documentation.

## Integration Points

### Frontend ↔ Backend API

**Flow Operations:**
- `GET /api/flow` - Load current flow state
- `POST /api/flow/undo` - Undo last change
- `POST /api/flow/redo` - Redo undone change
- `GET /api/flow/history-status` - Get undo/redo availability
- `PUT /api/subtree/:id/collapse` - Toggle subtree collapse (creates snapshot with origin: `ui.subtree`)

**Unified Flow Command Operations:**
- `POST /api/flow/node` - Create node (optionally with parent or group)
- `PUT /api/flow/node/:id` - Update node properties (label, description, position)
- `DELETE /api/flow/node/:id` - Delete node and connected edges
- `POST /api/flow/edge` - Create edge between nodes
- `PUT /api/flow/edge/:id` - Update edge label
- `DELETE /api/flow/edge/:id` - Delete edge
- `POST /api/flow/group` - Create group from selected nodes
- `DELETE /api/flow/group/:id` - Ungroup and restore member nodes
- `PUT /api/flow/group/:id/expand` - Toggle group expansion (collapse/expand)

**Conversation Operations:**
- `POST /api/conversation/message` - Send message to AI
- `GET /api/conversation/debug` - View conversation history
- `DELETE /api/conversation/history` - Clear conversation

### Backend → LLM Providers

**Primary: Groq API**
- Model: `openai/gpt-oss-120b`
- Streaming responses
- Tool calling support

**Fallback: Cerebras API**
- Model: `gpt-oss-120b`
- Automatic failover if Groq fails

### LLM Response Format

XML format with `<thinking>` and `<response>` tags containing JSON tool calls. See [llm_integration.md](./llm_integration.md) for details.

## Available Tools

The AI can execute 11 flow operations: node CRUD (3 tools), edge CRUD (3 tools), group operations (3 tools), and history operations (2 tools). Includes automatic retry mechanism for failed executions (max 3 iterations). See [llm_integration.md](./llm_integration.md) for detailed tool definitions and error recovery.

## Key Design Patterns

### 1. Centralized Hotkeys Registry
All keyboard shortcuts and mouse interactions are defined in a single registry:
- **Registry**: [src/hooks/useHotkeys.jsx](../../src/hooks/useHotkeys.jsx:1-273)
- **Structure**: Each hotkey has `id`, `category`, `keys`, `label`, `description`, `type` (keyboard/mouse)
- **State guards**: Optional `isActive(state)` function for conditional hotkeys
- **Hook**: `useHotkeys(hotkeys, state)` registers event listeners with cleanup
- **Display helpers**: `formatKeys()`, `getCategories()`, `getHotkeyById()`
- **UI integration**: HotkeysPanel component consumes registry for documentation
- **See**: [hotkeys-visual-and-logic-centralization Task](../Tasks/hotkeys-visual-and-logic-centralization.md)

### 2. Structured Design Token System
Visual styling uses a two-tier token system separating primitives from semantic application:
- **Theme file**: [src/constants/theme.js](../../src/constants/theme.js:1-262)
- **Replaced**: Previous `visual_settings` table (removed in migration 002)
- **Architecture**:
  - **Design Tokens (Primitives)**: Raw values (colors, spacing, typography, shadows, etc.)
  - **Semantic Theme**: Component-specific application of tokens (canvas, node, groupNode, tooltip, dagre)
- **Token categories**: Color palette, typography, spacing scale (4px base), borders, shadows, animations, z-index, opacity
- **Single source of truth**: All components import from `THEME` export
- **No runtime customization**: Visual styling is hardcoded for consistency
- **Maintainability**: Clear separation enables design system updates without touching component logic

### 3. Unified Flow Commands
All flow mutations (node CRUD, grouping, visual changes) follow a unified pattern:
- Backend command defined in `server/tools/executor.js`
- Exposed to both LLM tools and REST API endpoints via `toolEndpoint()` factory
- `toolEndpoint()` accepts configuration object with toolName, validation, param extraction
- Consistent error handling and response formatting across all endpoints
- Frontend calls via helpers in `src/api.js`
- See [unified-flow-commands SOP](../SOP/unified-flow-commands.md)

### 4. Group Node Architecture
Two independent collapse systems coexist:
- **Group collapse**: `isCollapsed` property on group nodes, backend-managed, generates synthetic edges
- **Subtree collapse**: `data.collapsed` on any node, frontend-only, hides descendants via edges
- Visibility computed via `applyGroupVisibility()` in `src/utils/groupUtils.js`
- Synthetic edges dynamically generated for collapsed groups on every state change
- See [groupUtils.js](../../src/utils/groupUtils.js:1-22) for detailed documentation

### 5. Tool Execution Chain
Tools executed sequentially with state passed between them. All changes batched in single DB write.

### 6. Undo/Redo State Management
Snapshots stored in `undo_history` table with deduplication. Current position tracked in `undo_state` table. 50 snapshot limit with automatic truncation. Unified implementation via `executeHistoryOperation()` helper.

### 7. LLM Context Building
Each request includes: system prompt, last 6 conversation turns, current flow state, available tools, and user message. See [llm_integration.md](./llm_integration.md).

### 8. Pure Dagre Layout Algorithm
Layout calculation uses Dagre algorithm without custom post-processing:
- **Pure Dagre output** - removed custom compression logic that caused diagonal positioning bugs
- **TDD approach** - regression tests ensure horizontal parent-child alignment
- **Simplified maintenance** - easier to reason about layout behavior
- **Trade-off** - siblings may have larger vertical gaps (Dagre's natural spacing)
- **See**: [useFlowLayout.js](../../src/hooks/useFlowLayout.js:24-93) for implementation

## Test Strategy

- **Test Framework**: Vitest with multi-project configuration (4 isolated environments)
- **Unit tests**: Database operations, services, tool execution
- **Integration tests**: Message retry logic, API contracts, workflow state sync
- **Security tests**: XSS prevention
- **Frontend tests**: React component tests with happy-dom
- **All tests use isolated Supabase test environment** (`setupTestDb()/cleanupTestDb()` from `tests/test-db-setup.js`)
- **Test Execution**: 542 tests passing
- **Coverage**: 86.38% overall (v8 provider)
- **See**: [test_suite.md](./test_suite.md) for detailed test documentation

## Known Limitations

- Single user only (user_id always 'default')
- Single flow per user (name always 'main')
- No authentication/authorization
- No real-time collaboration
- Max 3 retry iterations for failed tool calls
- Undo history limited to 50 snapshots
