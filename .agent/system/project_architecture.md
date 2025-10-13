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
- **Better-SQLite3** - Database (SQLite with sync operations)
- **Groq SDK** - Primary LLM provider (gpt-oss-120b)
- **Cerebras SDK** - Fallback LLM provider
- **CORS** - Cross-origin support

### Testing
- **Jest** - Test framework (with ES modules via `NODE_OPTIONS=--experimental-vm-modules`)
- **React Testing Library** - Frontend component testing (with jsdom environment)
- **@testing-library/jest-dom** - Custom Jest matchers for DOM assertions
- **@testing-library/user-event** - User interaction simulation
- **Supertest** - Backend API integration testing
- **In-memory SQLite** - Isolated database testing (`:memory:`)

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
│   │   └── theme.jsx             # Hardcoded theme constants (replaces visual_settings)
│   ├── hooks/
│   │   ├── useFlowLayout.js      # Auto-layout with dagre
│   │   └── useHotkeys.jsx        # Centralized hotkeys registry and hook
│   ├── utils/
│   │   └── groupUtils.js         # Group node management and visibility
│   └── main.jsx                  # React entry point
│
├── server/                       # Backend Express server
│   ├── server.js                 # Main server & API routes
│   ├── db.js                     # SQLite database layer with migration runner
│   ├── conversationService.js    # Conversation history management
│   ├── historyService.js         # Undo/redo state management
│   ├── llm/
│   │   ├── llmService.js         # LLM context building & parsing
│   │   └── tools.js              # Tool definitions for AI
│   ├── tools/
│   │   └── executor.js           # Tool execution logic
│   ├── migrations/
│   │   ├── 001_initial.sql       # Initial database schema
│   │   └── 002_remove_visual_settings.sql  # Remove visual customization
│   └── data/
│       └── flow.db               # SQLite database file
│
├── tests/                        # Comprehensive test suite (317 tests)
│   ├── db.test.js               # Database layer tests
│   ├── conversationService.test.js
│   ├── historyService.test.js
│   ├── toolExecution.test.js    # Tool execution with group tests
│   ├── api-contracts.test.js
│   ├── groupHelpers.test.js     # Group utility functions
│   ├── llm/                     # LLM service tests
│   ├── integration/             # Integration tests (message retry, conversation)
│   ├── unit/
│   │   ├── frontend/            # Frontend unit tests
│   │   └── backend/             # Backend unit tests (hotkeys registry)
│   └── security/                # Security tests (XSS prevention)
│
├── .agent/                      # Project documentation
├── package.json
├── vite.config.js
├── jest.config.js
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
1. Load flow from backend on mount → Initialize React Flow with hardcoded theme
2. User edits (drag, edit labels) → Debounced autosave (500ms)
3. AI chat message → Backend processes → Frontend receives updated flow → Auto-layout
4. Undo/Redo → Fetch snapshot from backend → Update React Flow state

## Core Features

### 1. Visual Flow Editor
- Interactive node-based canvas using React Flow
- Manual node creation via double-click (⌘/Ctrl + Double-click)
- Drag-and-drop positioning
- **Group nodes** - combine multiple nodes into collapsible groups (⌘/Ctrl + G)
- **Dual collapse systems**:
  - Group collapse: Uses `isCollapsed` on group nodes, managed via backend API
  - Subtree collapse: Uses `data.collapsed` on any node, frontend-only (Alt + Click)
- Auto-layout using dagre algorithm
- Smooth animations for layout transitions
- Real-time autosave (500ms debounce)
- **Keyboard shortcuts panel** - slide-in panel showing all hotkeys (? button)

### 2. AI-Powered Flow Generation
- Natural language interface for flow creation
- LLM integration with tool calling
- Automatic retry mechanism for failed tool executions (max 3 iterations)
- Context-aware responses using conversation history
- Support for batch operations (create multiple nodes in one request)
- Group management via natural language (create, ungroup, expand/collapse)

### 3. Persistence & History
- SQLite database for all data
- Undo/redo functionality (⌘Z / ⌘Y)
- Conversation history tracking (last 6 interactions sent to LLM)
- Auto-snapshot on every change (50 snapshot limit)
- Deduplication for identical states

## Database Schema

See [database_schema.md](./database_schema.md) for detailed schema documentation.

## Integration Points

### Frontend ↔ Backend API

**Flow Operations:**
- `GET /api/flow` - Load current flow state
- `POST /api/flow` - Save flow state
- `POST /api/flow/undo` - Undo last change
- `POST /api/flow/redo` - Redo undone change
- `GET /api/flow/history-status` - Get undo/redo availability

**Unified Flow Command Operations:**
- `POST /api/node` - Create node (optionally with parent or group)
- `PUT /api/node/:id` - Update node properties (label, description, position)
- `DELETE /api/node/:id` - Delete node and connected edges
- `POST /api/edge` - Create edge between nodes
- `PUT /api/edge/:id` - Update edge label
- `DELETE /api/edge/:id` - Delete edge
- `POST /api/group` - Create group from selected nodes
- `DELETE /api/group/:id` - Ungroup and restore member nodes
- `PUT /api/group/:id/expand` - Toggle group expansion (collapse/expand)

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

The AI can execute the following operations on flows (11 tools total):

1. **addNode** - Create node (optionally with parent connection or group membership)
2. **updateNode** - Modify node properties (label, description, position)
3. **deleteNode** - Remove node and connected edges
4. **addEdge** - Create connection between nodes
5. **updateEdge** - Modify edge label
6. **deleteEdge** - Remove connection
7. **createGroup** - Create group from multiple nodes (starts collapsed by default)
8. **ungroup** - Remove group and restore member nodes to root level
9. **toggleGroupExpansion** - Toggle group between collapsed and expanded states
10. **undo** - Revert last change
11. **redo** - Reapply undone change

## Error Recovery System

Automatic retry mechanism for failed tool executions (max 3 iterations). Failed operations trigger detailed retry messages with current flow state. See [llm_integration.md](./llm_integration.md) for details.

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

### 2. Hardcoded Theme System
Visual styling is centralized in a single theme constant:
- **Theme file**: [src/constants/theme.jsx](../../src/constants/theme.jsx:1-72)
- **Replaced**: Previous `visual_settings` table (removed in migration 002)
- **Structure**: Nested object with canvas, node, groupNode, tooltip, and dagre settings
- **Single source of truth**: All components import from theme constant
- **No runtime customization**: Visual styling is hardcoded for consistency

### 3. Unified Flow Commands
All flow mutations (node CRUD, grouping, visual changes) follow a unified pattern:
- Backend command defined in `server/tools/executor.js`
- Exposed to both LLM tools and REST API endpoints
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
Snapshots stored in `undo_history` table with deduplication. Current position tracked in `undo_state` table. 50 snapshot limit with automatic truncation.

### 7. Autosave with Debouncing
Frontend debounces saves by 500ms to avoid excessive writes during canvas manipulation.

### 8. LLM Context Building
Each request includes: system prompt, last 6 conversation turns, current flow state, available tools, and user message. See [llm_integration.md](./llm_integration.md).

## Test Strategy

- **Unit tests**: Database operations, services, tool execution
- **Integration tests**: Message retry logic, API contracts
- **Security tests**: XSS prevention
- **All tests use in-memory SQLite** (`DB_PATH=:memory:`)

## Known Limitations

- Single user only (user_id always 'default')
- Single flow per user (name always 'main')
- No authentication/authorization
- No real-time collaboration
- Max 3 retry iterations for failed tool calls
- Undo history limited to 50 snapshots
