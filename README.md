<!-- ABOUTME: README for visual-scaffolding, an LLM-powered visual thinking tool. -->
<!-- ABOUTME: Talk to an AI and it builds structured node graphs with auto-layout and persistence. -->

# Visual Scaffolding

**LLM-powered visual thinking tool -- talk to an AI, it builds structured node graphs with auto-layout, persistence, and predictive suggestions.**

---

## What It Does

Visual Scaffolding is an AI-powered flow builder that lets you create and manipulate node-based diagrams through natural language. Type what you're thinking in the chat, and the AI creates, connects, groups, and rearranges nodes on a visual canvas.

You can also work directly on the canvas -- drag nodes, edit labels inline, group items, collapse subtrees -- and everything syncs to a Supabase database with full undo/redo history.

---

## How It Works

```
+-----------------+       +-----------------+       +------------------+
|  React Canvas   | <---> |  Express API    | <---> |  Supabase        |
|  (React Flow)   |       |  + LLM Service  |       |  (PostgreSQL)    |
|                 |       |                 |       |                  |
|  - Node editor  |       |  - Tool calling |       |  - Flow state    |
|  - Chat UI      |       |  - Groq/Cerebras|       |  - Undo history  |
|  - Auto-layout  |       |  - 11 flow ops  |       |  - Conversations |
+-----------------+       +-----------------+       +------------------+
```

1. User sends a message ("Break this into 3 sub-tasks")
2. Backend builds context: system prompt + last 6 messages + current flow state + available tools
3. LLM responds with tool calls (create_node, create_edge, create_group, etc.)
4. Tools execute sequentially, batched into a single DB write
5. Frontend receives updated flow, applies Dagre auto-layout with smooth animation

The AI has access to 11 flow operations: node CRUD (3), edge CRUD (3), group operations (3), and history operations (2). Failed tool calls retry automatically up to 3 times.

---

## Key Features

- **Natural language flow creation** -- describe what you want, the AI builds it
- **Interactive canvas** -- React Flow with drag, inline editing, keyboard shortcuts
- **Group nodes** -- combine nodes into collapsible groups (Cmd+G)
- **Subtree collapse** -- collapse any branch to focus on what matters (Alt+Click)
- **Full undo/redo** -- timestamp-based snapshots with 50-state history (Cmd+Z / Cmd+Y)
- **Cloud persistence** -- Supabase (PostgreSQL) with automatic snapshots on every change
- **Notes panel** -- side panel for capturing thoughts alongside the visual flow
- **542 tests passing** -- unit, integration, e2e, and security (XSS prevention), 86% coverage

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Flow 12, TailwindCSS 4, Vite |
| Backend | Express.js, Node.js |
| Database | Supabase (PostgreSQL 15+) |
| LLM | Groq (primary), Cerebras (fallback) -- tool calling with XML structured output |
| Layout | Dagre (automatic directed graph layout) |
| Testing | Vitest, React Testing Library, Supertest, happy-dom |

---

## Running Locally

```bash
npm install
cp .env.example .env        # Add Supabase + Groq API keys
npm run dev:all              # Starts Vite frontend + Express backend
npm test                     # 542 tests
```
