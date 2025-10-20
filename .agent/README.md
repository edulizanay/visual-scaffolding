# Visual Scaffolding Documentation Index

This directory contains all project documentation. Use this index to quickly find what you need.

## 📁 Documentation Structure

```
.agent/ (2444 lines)
├── README.md          # This file - documentation index (126 lines)
├── system/            # Current state of the system (1237 lines)
├── tasks/             # Feature PRDs & implementation plans (138 lines)
└── SOP/               # Standard operating procedures (802 lines)
```

**Documentation Guidelines**: Try to keep total documentation below 2,300 lines. Focus on clarity and conciseness over exhaustive detail. The lines count is updated automatically.

## 📚 System Documentation

Current state of the codebase - architecture, schema, and core systems:

| Document | What's Inside |
|----------|---------------|
| **[project_architecture.md](./system/project_architecture.md)** | Tech stack, project structure, core features (groups, hotkeys panel), integration points, design patterns (centralized hotkeys, structured design token system, unified flow commands), development workflow |
| **[database_schema.md](./system/database_schema.md)** | Complete schema (4 tables), data structures with group node examples, API functions, data flows, migrations, performance notes |
| **[llm_integration.md](./system/llm_integration.md)** | LLM providers (Groq/Cerebras), system prompts, 13 tool definitions (including group operations), response parsing, error recovery |
| **[group_nodes_system.md](./system/group_nodes_system.md)** | Complete group nodes feature documentation: dual collapse systems, synthetic edges, visibility computation, validation rules, UI interactions |

## 📋 Tasks Documentation

Feature-specific PRDs and implementation plans:

| Task | Status | Description |
|------|--------|-------------|
| **[hotkeys-visual-and-logic-centralization.md](./Tasks/hotkeys-visual-and-logic-centralization.md)** | Planning | Centralize keyboard shortcuts in single registry, improve UX hints |

## 🛠️ Standard Operating Procedures (SOPs)

Step-by-step guides for common development tasks:

| SOP | Description |
|-----|-------------|
| **[unified-flow-commands.md](./SOP/unified-flow-commands.md)** | How to add flow mutations (nodes, groups, edges) - unified backend pattern |
| **[hotkeys-management.md](./SOP/hotkeys-management.md)** | How to add or modify keyboard shortcuts in the centralized registry |
| **[theme-and-design-tokens.md](./SOP/theme-and-design-tokens.md)** | How to work with design tokens and semantic theme system |
| **[writing-tests.md](./SOP/writing-tests.md)** | How to write tests with Vitest - unit, integration, frontend, API tests, layout algorithm testing |
| *(To be added)* | How to add a database migration |
| *(To be added)* | How to add a new LLM tool |

## 🧭 Quick Navigation

**Looking for...** | **Check...**
---|---
Project overview, tech stack | [project_architecture.md](./system/project_architecture.md)
Database tables, schema, data flow | [database_schema.md](./system/database_schema.md)
How AI/LLM works, tool definitions | [llm_integration.md](./system/llm_integration.md)
Group nodes feature deep-dive | [group_nodes_system.md](./system/group_nodes_system.md)
Dual collapse systems explained | [group_nodes_system.md](./system/group_nodes_system.md) → Dual Collapse Systems
Synthetic edges algorithm | [group_nodes_system.md](./system/group_nodes_system.md) → Synthetic Edge Generation
Depth-based halo padding system | [group_nodes_system.md](./system/group_nodes_system.md) → Depth-Based Incremental Padding
Nested groups and hierarchy | [group_nodes_system.md](./system/group_nodes_system.md) → Nested Groups
Keyboard shortcuts registry | [project_architecture.md](./system/project_architecture.md) → Centralized Hotkeys Registry
Design token system | [project_architecture.md](./system/project_architecture.md) → Structured Design Token System
Development commands, setup | [project_architecture.md](./system/project_architecture.md) → Development Workflow
API endpoints | [project_architecture.md](./system/project_architecture.md) → Integration Points
Feature requirements | `Tasks/` folder
How to add flow commands | [unified-flow-commands.md](./SOP/unified-flow-commands.md)
How to add/modify keyboard shortcuts | [hotkeys-management.md](./SOP/hotkeys-management.md)
How to work with design tokens/theme | [theme-and-design-tokens.md](./SOP/theme-and-design-tokens.md)
How to write tests | [writing-tests.md](./SOP/writing-tests.md)
How to test layout algorithms (TDD) | [writing-tests.md](./SOP/writing-tests.md) → Testing Layout Algorithms
How to do X (migrations, LLM tools, etc.) | `SOP/` folder

## 📝 Documentation Conventions

### When to Update Docs

- **After implementing a feature** → Update `system/` docs to reflect new state
- **Before starting a feature** → Check if task exists in `Tasks/`, if not, create one
- **When establishing a pattern** → Document it in `SOP/`
- **When changing architecture** → Update `project_architecture.md`. Changes in architecture require explicit user permission
- **When modifying database** → Update `database_schema.md`
- **When adding/changing LLM tools** → Update `llm_integration.md`
- **When adding complex features** → Consider dedicated system doc (e.g., `group_nodes_system.md`)

### Doc Update Workflow

1. Implement your feature
2. Update relevant `system/` documentation
3. Update this README if you added new doc files
4. Commit docs with your code changes

### Keep Docs Evergreen

- Docs describe **current state**, not history
- Remove outdated information
- Update examples to match current code
- No "old way" vs "new way" comparisons

## 🎯 For New Engineers

**Getting Started:**
1. Read [project_architecture.md](./system/project_architecture.md) - Get the big picture
2. Read [database_schema.md](./system/database_schema.md) - Understand persistence layer
3. Read [llm_integration.md](./system/llm_integration.md) - Learn how AI works
4. Read [group_nodes_system.md](./system/group_nodes_system.md) - Understand group feature
5. Explore `../tests/` directory - See how features are tested

**For Development:**
1. Check `Tasks/` for existing feature docs
2. Review relevant `system/` docs
3. Follow `SOP/` guides for standard tasks (especially [unified-flow-commands.md](./SOP/unified-flow-commands.md))
4. Keep docs updated as you work

---

**Last Updated**: October 14, 2025

**Recent Major Changes**:
- **Server.js refactoring** - Extracted helper functions, organized into sections, reduced conversation endpoint from 90→13 lines
- **Layout algorithm** - Simplified to pure Dagre (removed compression causing diagonal bugs), TDD approach, 542 tests passing
- **Frontend refactoring** - Extracted node visibility helpers, JSDoc documentation, 2-line ABOUTME headers
- **Vitest migration** - 2.95x faster, 170+ hidden tests fixed, native ESM, 86.38% coverage
- **Design tokens** - Two-tier system (primitives + semantic theme) in single theme.js file
- **Group nodes** - Nested groups, depth-based halo padding, dual collapse systems
- **Hotkeys** - Centralized registry with HotkeysPanel UI
