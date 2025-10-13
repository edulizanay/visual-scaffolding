# Visual Scaffolding Documentation Index

This directory contains all project documentation. Use this index to quickly find what you need.

## 📁 Documentation Structure

```
.agent/
├── README.md          # This file - documentation index
├── system/            # Current state of the system
├── tasks/             # Feature PRDs & implementation plans
└── sop/               # Standard operating procedures
```

## 📚 System Documentation

Current state of the codebase - architecture, schema, and core systems:

| Document | What's Inside |
|----------|---------------|
| **[project_architecture.md](./system/project_architecture.md)** | Tech stack, project structure, core features (groups, hotkeys panel), integration points, design patterns (centralized hotkeys, hardcoded theme, unified flow commands), development workflow |
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
| *(To be added)* | How to add a database migration |
| *(To be added)* | How to add a new LLM tool |
| *(To be added)* | How to write tests |

## 🧭 Quick Navigation

**Looking for...** | **Check...**
---|---
Project overview, tech stack | [project_architecture.md](./system/project_architecture.md)
Database tables, schema, data flow | [database_schema.md](./system/database_schema.md)
How AI/LLM works, tool definitions | [llm_integration.md](./system/llm_integration.md)
Group nodes feature deep-dive | [group_nodes_system.md](./system/group_nodes_system.md)
Dual collapse systems explained | [group_nodes_system.md](./system/group_nodes_system.md) → Dual Collapse Systems
Synthetic edges algorithm | [group_nodes_system.md](./system/group_nodes_system.md) → Synthetic Edge Generation
Keyboard shortcuts registry | [project_architecture.md](./system/project_architecture.md) → Centralized Hotkeys Registry
Hardcoded theme system | [project_architecture.md](./system/project_architecture.md) → Hardcoded Theme System
Development commands, setup | [project_architecture.md](./system/project_architecture.md) → Development Workflow
API endpoints | [project_architecture.md](./system/project_architecture.md) → Integration Points
Feature requirements | `Tasks/` folder
How to add flow commands | [unified-flow-commands.md](./SOP/unified-flow-commands.md)
How to add/modify keyboard shortcuts | [hotkeys-management.md](./SOP/hotkeys-management.md)
How to do X (migrations, tests, etc.) | `SOP/` folder

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

**Last Updated**: October 12, 2025
**Major Updates**:
- Implemented centralized keyboard shortcuts registry (src/hooks/useHotkeys.jsx)
- Added HotkeysPanel component with slide-in UI (? button)
- Completed visual customization removal (migration 002, hardcoded theme in src/constants/theme.jsx)
- Test suite: 317 tests across 13 test suites (15 failing in frontend tests - act() warnings)
- Test coverage includes comprehensive frontend, backend, and integration tests
- Database now has 4 tables (removed visual_settings)
- Created SOP for hotkeys management
- Updated all system documentation to reflect current state
