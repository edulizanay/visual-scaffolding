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
  },
  parentGroupId: "parent_group"  // Optional: nested groups can have parent groups
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

### Nested Groups

Groups can contain other groups, creating hierarchies:
- **Sub-grouping**: Selecting multiple nodes within a group and grouping them creates a sub-group
- **Group nesting**: Grouping multiple group nodes creates a parent group containing child groups
- Sub-groups inherit the `parentGroupId` of their members
- When a parent group is collapsed, all descendant groups and nodes are hidden
- When ungrouping a nested group, its members are reassigned to the parent group (hierarchy preserved)

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
- `ungroup(flow, groupId)` - Removes group and reassigns members to parent group (preserves hierarchy)
- `toggleGroupExpansion(flow, groupId, collapseState)` - Toggles collapse state
- `applyGroupVisibility(nodes, edges)` - Computes visibility and synthetic edges
- `getGroupDescendants(nodeId, nodes)` - Recursively finds all descendants
- `validateGroupMembership(nodeIds, nodes)` - Validates group creation
- `detectCircularReference(nodeId, parentId, nodes)` - Prevents circular hierarchies
- `getExpandedGroupHalos(nodes, getNodeDimensions, paddingConfig)` - Computes halo bounds with depth-based padding
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
- `executeCreateGroup(params, flow)` - Creates group node, validates parent group compatibility, assigns members
- `executeUngroup(params, flow)` - Removes group node and reassigns members to parent group (preserves hierarchy)
- `executeToggleGroupExpansion(params, flow)` - Toggles `isCollapsed` state and member `hidden` properties

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

## Depth-Based Incremental Padding

Visual Scaffolding uses a sophisticated padding system for group halos that increases spacing based on nesting depth, creating visual hierarchy for nested groups.

### Configuration

Located in `src/constants/theme.jsx` under `THEME.groupNode.halo.padding`:

```javascript
padding: {
  x: {
    base: 18,  // Horizontal padding (constant for all nesting levels)
  },
  y: {
    base: 18,        // Base vertical padding for innermost groups
    increment: 12,   // Initial padding increment for each nesting level
    decay: 0.7,      // Multiplier applied to increment at each level
    minStep: 1,      // Minimum padding increment per level
  },
}
```

### Algorithm

Located in `src/utils/groupUtils.js` (`getExpandedGroupHalos()`):

1. **Depth Calculation**: For each expanded group, compute nested group depth
   - Depth = maximum number of nested group layers it contains
   - Uses recursive traversal with cycle detection
   - Example: Group with no child groups has depth 0

2. **Padding Computation**: Calculate vertical padding based on depth
   ```
   padding = base + Σ(max(minStep, round(increment × decay^i))) for i=0 to depth-1
   ```
   - First level: `base + max(minStep, round(increment))`
   - Second level: `base + max(minStep, round(increment)) + max(minStep, round(increment × decay))`
   - Continues with decaying increments until depth reached

3. **Halo Bounds**: Apply computed padding to group bounds
   - Horizontal padding (x-axis): constant `base` value for all levels
   - Vertical padding (y-axis): increases with nesting depth

### Example

With default config (base=18, increment=12, decay=0.7, minStep=1):

- **Innermost group** (depth 0): 18px vertical padding
- **Parent of innermost** (depth 1): 18 + 12 = 30px vertical padding
- **Grandparent** (depth 2): 18 + 12 + 8 = 38px vertical padding (12 × 0.7 ≈ 8)
- **Great-grandparent** (depth 3): 18 + 12 + 8 + 6 = 44px vertical padding (8 × 0.7 ≈ 6)

### Visual Effect

This creates progressively larger halos for ancestor groups, making the nesting hierarchy immediately visible:
- Inner groups have tighter halos
- Outer groups have more spacious halos
- Decay prevents excessive padding at deep nesting levels
- Horizontal padding remains constant for alignment consistency

### Configuration Flexibility

The padding system supports multiple configuration formats:
- **Simple number**: `padding: 16` (applies to all axes as base)
- **Axis-specific**: `padding: { x: 20, y: 25 }` (different base per axis)
- **Full config**: `padding: { x: { base: 18 }, y: { base: 18, increment: 12, decay: 0.7, minStep: 1 } }`
- Falls back to theme defaults if not specified

## Validation Rules

### Group Creation

Enforced in `executeCreateGroup()` in [server/tools/executor.js](../../server/tools/executor.js:284):
- Minimum 2 nodes required
- No duplicate node IDs
- All nodes must exist in flow
- Cannot mix nodes from different parent groups (prevents invalid hierarchies)

### Parent Group Validation

All nodes being grouped must either have no parent group OR the same parent group:
- **Allowed**: Grouping ungrouped nodes together
- **Allowed**: Sub-grouping nodes within the same parent group
- **Allowed**: Grouping group nodes that share the same parent (or have no parent)
- **Blocked**: Mixing "node from Group A" with "node from Group B"

This enables nested group hierarchies while preventing invalid cross-group structures.

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

- **Expanded groups**: Purple halo border around members (padding increases with nesting depth)
- **Collapsed groups**: Single node with group label
- **Nested groups**: Progressively larger halos for ancestor groups create visual hierarchy

## AI Integration

The LLM can manage groups through three tools: `createGroup`, `toggleGroupExpansion`, and `ungroup`. It receives all nodes with their `type`, `parentGroupId`, and collapse states.

## Performance Considerations

`applyGroupVisibility()` uses memoized ancestor traversal and single-pass computation. Synthetic edges are generated dynamically with O(n) complexity and Map-based deduplication.

## Testing

Test coverage: `tests/groupHelpers.test.js`, `tests/api-group-operations.test.js`, `tests/toolExecution.test.js`

## Known Limitations

- Group colors/styling not customizable per-group
- Synthetic edges cannot have custom labels
- Group positioning is calculated automatically (to the left of members)

## Key Files

- `src/utils/groupUtils.js` - Core utilities and halo overlay
- `src/App.jsx` - UI integration and keyboard shortcuts
- `server/tools/executor.js` - Backend executors
- `server/llm/tools.js` - LLM tool definitions
