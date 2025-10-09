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
- **Jest** - Test framework
- **Supertest** - API testing
- **NODE_OPTIONS=--experimental-vm-modules** - ES modules support in tests

## Project Structure

```
visual-scaffolding/
├── src/                          # Frontend React application
│   ├── App.jsx                   # Main canvas with React Flow
│   ├── ChatInterface.jsx         # AI chat UI component
│   ├── Node.jsx                  # Custom node component
│   ├── Edge.jsx                  # Custom edge component
│   ├── api.js                    # Frontend API client
│   ├── hooks/
│   │   └── useFlowLayout.js      # Auto-layout with dagre
│   └── main.jsx                  # React entry point
│
├── server/                       # Backend Express server
│   ├── server.js                 # Main server & API routes
│   ├── db.js                     # SQLite database layer
│   ├── conversationService.js    # Conversation history management
│   ├── historyService.js         # Undo/redo state management
│   ├── llm/
│   │   ├── llmService.js         # LLM context building & parsing
│   │   └── tools.js              # Tool definitions for AI
│   ├── tools/
│   │   └── executor.js           # Tool execution logic
│   ├── migrations/
│   │   └── 001_initial.sql       # Database schema
│   └── data/
│       └── flow.db               # SQLite database file
│
├── tests/                        # Comprehensive test suite
│   ├── db.test.js               # Database layer tests
│   ├── conversationService.test.js
│   ├── historyService.test.js
│   ├── toolExecution.test.js
│   ├── api-contracts.test.js
│   ├── llm/                     # LLM service tests
│   ├── integration/             # Integration tests
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
- **App.jsx** - Root component managing React Flow instance, nodes/edges state, undo/redo
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
1. Load flow from backend on mount → Initialize React Flow
2. User edits (drag, edit labels) → Debounced autosave (500ms)
3. AI chat message → Backend processes → Frontend receives updated flow → Auto-layout
4. Undo/Redo → Fetch snapshot from backend → Update React Flow state

## Core Features

### 1. Visual Flow Editor
- Interactive node-based canvas using React Flow
- Manual node creation via double-click (⌘/Ctrl + Double-click)
- Drag-and-drop positioning
- Collapsible subtrees (Alt + Click)
- Auto-layout using dagre algorithm
- Smooth animations for layout transitions
- Real-time autosave (500ms debounce)

### 2. AI-Powered Flow Generation
- Natural language interface for flow creation
- LLM integration with tool calling
- Automatic retry mechanism for failed tool executions (max 3 iterations)
- Context-aware responses using conversation history
- Support for batch operations (create multiple nodes in one request)

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

The AI can execute the following operations on flows:

1. **addNode** - Create node (optionally with parent connection)
2. **updateNode** - Modify node properties
3. **deleteNode** - Remove node and connected edges
4. **addEdge** - Create connection between nodes
5. **updateEdge** - Modify edge label
6. **deleteEdge** - Remove connection
7. **undo** - Revert last change
8. **redo** - Reapply undone change

## Error Recovery System

Automatic retry mechanism for failed tool executions (max 3 iterations). Failed operations trigger detailed retry messages with current flow state. See [llm_integration.md](./llm_integration.md) for details.

## Key Design Patterns

### 1. Tool Execution Chain
Tools executed sequentially with state passed between them. All changes batched in single DB write.

### 2. Undo/Redo State Management
Snapshots stored in `undo_history` table with deduplication. Current position tracked in `undo_state` table. 50 snapshot limit with automatic truncation.

### 3. Autosave with Debouncing
Frontend debounces saves by 500ms to avoid excessive writes during canvas manipulation.

### 4. LLM Context Building
Each request includes: system prompt, last 6 conversation turns, current flow state, available tools, and user message. See [llm_integration.md](./llm_integration.md).

## Development Workflow

### Running the Application

```bash
# Install dependencies
npm install

# Development (frontend + backend)
npm run dev:all

# Frontend only
npm run dev

# Backend only
npm run server:dev

# Run tests
npm test

# Run specific test
NODE_OPTIONS=--experimental-vm-modules npx jest tests/db.test.js
```

### Environment Variables

Create `.env` file with:
```
GROQ_API_KEY=your_groq_key
CEREBRAS_API_KEY=your_cerebras_key
```

### Test Strategy

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
