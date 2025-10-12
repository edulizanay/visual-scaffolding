# Group Nodes System

This document provides a comprehensive overview of the group nodes feature in Visual Scaffolding, including architecture, implementation details, and the dual collapse systems.

## Overview

Group nodes allow users to organize related nodes into collapsible containers. This feature supports:
- Manual grouping via keyboard shortcut (⌘/Ctrl + G)
- AI-driven grouping through natural language
- Nested group hierarchies
- Visual halos around expanded groups
- Synthetic edge generation for collapsed groups

## Core Concepts

### Group Node Structure

Group nodes are stored as regular nodes with special properties:

```javascript
{
  id: "auth_group",
  type: "group",              // Special type identifier
  isCollapsed: true,          // Collapse state (true = collapsed)
  position: { x: 100, y: 100 },
  data: {
    label: "Authentication",
    description: "Auth-related nodes"
  }
}
```

### Group Membership

Member nodes reference their parent group via `parentGroupId`:

```javascript
{
  id: "login",
  type: "default",
  parentGroupId: "auth_group",  // References parent group
  position: { x: 150, y: 150 },
  data: { label: "Login" }
}
```

### Visibility States

Nodes track two visibility flags computed dynamically:
- **`hidden`**: Node should not render (any reason)
- **`groupHidden`**: Node is hidden because ancestor group is collapsed

These are NOT persisted - they're computed on every render via `applyGroupVisibility()`.

## Dual Collapse Systems

**IMPORTANT**: Visual Scaffolding has TWO independent collapse systems that can coexist:

### System 1: Group Collapse (Backend-Managed)

**Location**: `src/utils/groupUtils.js`

**Purpose**: Collapse groups to hide members and show group as single node

**Properties**:
- Uses `isCollapsed: true/false` on group nodes
- Managed via backend API (`toggleGroupExpansion`)
- Affects nodes based on `parentGroupId` hierarchy
- Creates synthetic edges connecting external nodes to/from collapsed groups
- Visibility computed via `applyGroupVisibility()`

**Behavior**:
- Collapsed group: Group node visible, members hidden, synthetic edges shown
- Expanded group: Group node hidden (only halo visible), members visible, real edges shown

**Triggers**:
- Double-click on collapsed group node
- Double-click on group halo border
- AI command: `toggleGroupExpansion`
- API: `PUT /api/group/:id/expand`

### System 2: Subtree Collapse (Frontend-Only)

**Location**: `src/App.jsx` (Alt+Click handler)

**Purpose**: Temporarily hide descendants of any node for canvas clarity

**Properties**:
- Uses `data.collapsed: true/false` on ANY node
- Frontend-only (no backend persistence or API)
- Affects nodes based on edge-based hierarchy (follows edges, not groups)
- Uses `collapseSubtreeByHandles()` function
- No synthetic edges generated

**Behavior**:
- Collapsed node: Shows collapse indicator, descendants hidden via edge traversal
- Expanded node: Normal display, descendants visible

**Triggers**:
- Alt + Click on any node
- No AI command (frontend-only feature)

### Why Two Systems?

These systems serve different purposes:
- **Group collapse**: Semantic organization, persisted state, AI-accessible
- **Subtree collapse**: Quick canvas decluttering, temporary, manual-only

They can operate on the same nodes simultaneously without conflicts.

## Architecture

### Frontend Components

**`src/utils/groupUtils.js`** - Core group management utilities:
- `createGroup(flow, options)` - Creates group node and assigns members
- `ungroup(flow, groupId)` - Removes group and restores members
- `toggleGroupExpansion(flow, groupId, collapseState)` - Toggles collapse state
- `applyGroupVisibility(nodes, edges)` - Computes visibility and synthetic edges
- `getGroupDescendants(nodeId, nodes)` - Recursively finds all descendants
- `validateGroupMembership(nodeIds, nodes)` - Validates group creation
- `detectCircularReference(nodeId, parentId, nodes)` - Prevents circular hierarchies
- `getExpandedGroupHalos(nodes, getNodeDimensions, padding)` - Computes halo bounds
- `GroupHaloOverlay` - React component rendering group halos

**`src/App.jsx`** - UI integration:
- Group keyboard shortcuts (⌘G, ⌘⇧G)
- Double-click handlers for expansion
- Calls `applyGroupVisibility()` on flow load
- Multi-select state management
- Toast notifications for group operations

**`src/api.js`** - API client helpers:
- `createGroup(nodeIds, groupId, label, description)`
- `ungroup(groupId)`
- `toggleGroupExpansion(groupId, collapse)`

### Backend Components

**`server/tools/executor.js`** - Group tool executors:
- `executeCreateGroup(params, flow)` - Creates group via `createGroup()` from groupUtils
- `executeUngroup(params, flow)` - Removes group via `ungroup()` from groupUtils
- `executeToggleGroupExpansion(params, flow)` - Toggles via `toggleGroupExpansion()` from groupUtils

**`server/llm/tools.js`** - LLM tool definitions:
- `createGroup` - Tool definition for AI group creation
- `ungroup` - Tool definition for AI ungrouping
- `toggleGroupExpansion` - Tool definition for AI collapse/expand

**`server/server.js`** - REST API endpoints:
- `POST /api/group` - Create group
- `DELETE /api/group/:id` - Ungroup
- `PUT /api/group/:id/expand` - Toggle expansion

## Synthetic Edge Generation

When a group is collapsed, the system automatically generates synthetic edges to maintain visual flow continuity.

### Algorithm

Located in `src/utils/groupUtils.js` (`computeSyntheticEdges()`):

1. Find all collapsed groups
2. For each collapsed group:
   - Get all member node IDs (recursively including nested groups)
   - Scan all edges in the flow
   - For edges crossing the group boundary:
     - **Outbound**: `member → external` becomes `group → external`
     - **Inbound**: `external → member` becomes `external → group`
   - Deduplicate synthetic edges (multiple members to same external node = one synthetic edge)

### Synthetic Edge Structure

```javascript
{
  id: "group-edge-auth_group->home",
  source: "auth_group",
  target: "home",
  type: "smoothstep",
  data: { isSyntheticGroupEdge: true }
}
```

### Lifecycle

- **NOT persisted** in database
- Computed dynamically on every state change via `applyGroupVisibility()`
- Filtered out before new computation to prevent duplication
- Automatically cleaned up when group is ungrouped or expanded

## Validation Rules

### Group Creation

Enforced in `validateGroupMembership()`:
- Minimum 2 nodes required
- No duplicate node IDs
- All nodes must exist in flow
- Cannot group a node with its descendant (prevents circular references)

### Circular Reference Prevention

Enforced in `detectCircularReference()`:
- Before adding node to group, check if target group is a descendant of the node
- Prevents creating impossible hierarchies

## User Interactions

### Keyboard Shortcuts

- **⌘/Ctrl + G**: Group selected nodes
- **⌘/Ctrl + ⇧ + G**: Ungroup selected group
- **Alt + Click**: Collapse/expand subtree (different system, see above)

### Mouse Interactions

- **Double-click group node**: Toggle expansion
- **Double-click group halo**: Collapse group
- **⌘/Ctrl + Double-click on node**: Create child node (inherits parent's group)

### Visual Feedback

- **Expanded groups**: Purple halo border around members, hover effect
- **Collapsed groups**: Single node with group label
- **Group tooltips**: Show when ≥2 nodes selected (grouping) or 1 group selected (ungrouping)

## AI Integration

### Natural Language Examples

```
User: "group the login and signup nodes"
→ AI calls createGroup(nodeIds: ["login", "signup"])

User: "collapse the auth group"
→ AI calls toggleGroupExpansion(groupId: "auth_group", collapse: true)

User: "ungroup authentication"
→ AI calls ungroup(groupId: "auth_group")
```

### Context Awareness

The LLM receives:
- All nodes with their `type` and `parentGroupId`
- Current group collapse states (`isCollapsed`)
- Can reference groups by label or ID

## Performance Considerations

### Visibility Computation

`applyGroupVisibility()` is called frequently:
- On flow load
- After every group operation
- During autosave
- On undo/redo

**Optimizations**:
- Memoized ancestor traversal
- Single pass for visibility computation
- Efficient Set operations for member lookups

### Synthetic Edge Generation

- Runs on every visibility computation
- Filters old synthetic edges first
- Uses Map for deduplication
- O(n) complexity where n = number of edges

## Testing

Comprehensive test coverage in:
- `tests/groupHelpers.test.js` - Core utility functions
- `tests/api-group-operations.test.js` - REST API endpoints
- `tests/toolExecution.test.js` - LLM tool execution
- Integration tests for end-to-end group workflows

## Known Limitations

- Groups cannot be nested within groups (flat hierarchy only)
- Maximum nesting depth not enforced (theoretically unlimited)
- Group colors/styling not customizable per-group
- No group-level descriptions in UI (only in data model)
- Synthetic edges cannot have custom labels
- No group templates or presets

## Future Enhancements

Potential improvements documented in task backlog:
- Nested group support (groups within groups)
- Per-group color customization
- Group templates (e.g., "Authentication Flow", "Payment Flow")
- Group-level statistics (member count, edge count)
- Drag-and-drop to add/remove members
- Group search and filtering
- Export/import groups as reusable components

## Related Documentation

- [Project Architecture](./project_architecture.md) - Overall system architecture
- [Database Schema](./database_schema.md) - Data persistence
- [LLM Integration](./llm_integration.md) - AI tool definitions
- [Unified Flow Commands SOP](../SOP/unified-flow-commands.md) - Implementation pattern

## Code References

Key files and line numbers:
- [src/utils/groupUtils.js:1-476](../../src/utils/groupUtils.js) - Complete group utilities
- [src/App.jsx:334-362](../../src/App.jsx) - Multi-select and grouping handlers
- [server/tools/executor.js:525-613](../../server/tools/executor.js) - Backend executors
- [server/llm/tools.js](../../server/llm/tools.js) - Tool definitions

---

**Last Updated**: October 2025
**Status**: Production - Stable
**Maintainer**: See project README
