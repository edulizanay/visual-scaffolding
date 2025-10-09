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
| **[project_architecture.md](./system/project_architecture.md)** | Tech stack, project structure, core features, integration points, design patterns, development workflow, recent changes |
| **[database_schema.md](./system/database_schema.md)** | Complete schema (4 tables), data structures, API functions, data flows, migrations, performance notes |
| **[llm_integration.md](./system/llm_integration.md)** | LLM providers (Groq/Cerebras), system prompts, tool definitions, response parsing, error recovery, conversation management |

## 📋 Tasks Documentation

Feature-specific PRDs and implementation plans:

| Task | Status | Description |
|------|--------|-------------|
| *(Empty - to be added as features are planned)* | | |

## 🛠️ Standard Operating Procedures (SOPs)

Step-by-step guides for common development tasks:

| SOP | Description |
|-----|-------------|
| *(To be added)* | How to add a database migration |
| *(To be added)* | How to add a new LLM tool |
| *(To be added)* | How to add an API endpoint |
| *(To be added)* | How to write tests |

## 🧭 Quick Navigation

**Looking for...** | **Check...**
---|---
Project overview, tech stack | [project_architecture.md](./system/project_architecture.md)
Database tables, schema, data flow | [database_schema.md](./system/database_schema.md)
How AI/LLM works, tool definitions | [llm_integration.md](./system/llm_integration.md)
Development commands, setup | [project_architecture.md](./system/project_architecture.md) → Development Workflow
API endpoints | [project_architecture.md](./system/project_architecture.md) → Integration Points
Feature requirements | `tasks/` folder
How to do X (migrations, tests, etc.) | `sop/` folder

## 📝 Documentation Conventions

### When to Update Docs

- **After implementing a feature** → Update `system/` docs to reflect new state
- **Before starting a feature** → Check if that tasks is created in `tasks/`, if not, create one
- **When establishing a pattern** → Document it in `sop/`. 
- **When changing architecture** → Update `project_architecture.md`. Changes in architecture should have explicit permission from the user.
- **When modifying database** → Update `database_schema.md`
- **When adding/changing LLM tools** → Update `llm_integration.md`

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
4. Explore `../tests/` directory - See how features are tested

**For Development:**
1. Check `tasks/` for existing feature docs
2. Review relevant `system/` docs
3. Follow `sop/` guides for standard tasks
4. Keep docs updated as you work

---

**Last Updated**: October 2024
