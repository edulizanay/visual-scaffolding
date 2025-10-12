# Group Nodes - Outstanding Tasks

## ✅ Implementation Complete

The group nodes feature has been **fully implemented** and is working in production. All core functionality is complete:
- Group creation via Cmd+G
- Collapse/expand via double-click
- Ungrouping via Cmd+Shift+G
- Nested groups support
- Visual halos for expanded groups
- Synthetic edges for collapsed groups
- Comprehensive test coverage (250+ tests passing)

**Implementation Approach Used**: Document store pattern (JSON blob in `flows.data`) instead of normalized schema. This was the right call - it's simpler, more flexible, and works perfectly with React Flow's state model.

## ❌ Outstanding Tasks

### 1. Documentation Updates

The group feature is not documented in the system docs:

**Files to Update:**
- `.agent/system/project_architecture.md` - Add group functionality to "Core Features" section
- `.agent/system/database_schema.md` - Document group node properties in the JSON structure

**What to Document:**
- Group node properties: `type: 'group'`, `parentGroupId`, `isExpanded`
- Keyboard shortcuts: Cmd+G (group), Cmd+Shift+G (ungroup), double-click (collapse/expand)
- Visual features: halos, synthetic edges
- Implementation location: `src/utils/groupUtils.js`

### 2. POST /api/node Endpoint (Unrelated to Groups)

There are 4 failing tests in `tests/api-node-creation.test.js` for a manual node creation endpoint that was never implemented.

**Options:**
1. **Implement the endpoint** - Add `POST /api/node` to `server/server.js` for manual node creation with parent/group inheritance
2. **Remove the tests** - If this feature isn't needed, delete the test file

**Note**: This is separate from the group feature. The tests are for creating nodes via HTTP API instead of through LLM tools.

---

## 📚 Implementation Reference (For Context)

The following shows what was actually built. This is kept for reference only.

### Data Model

Group properties are stored as node attributes in the JSON blob (`flows.data`):

```json
{
  "nodes": [
    {
      "id": "group-1",
      "type": "group",              // Marks node as a group
      "isExpanded": true,            // Collapse state
      "data": {"label": "Auth Flow"},
      "position": {"x": 0, "y": 0}
    },
    {
      "id": "login",
      "parentGroupId": "group-1",    // Group membership
      "data": {"label": "Login"},
      "position": {"x": 100, "y": 100}
    }
  ],
  "edges": [...]
}
```

### Implementation Files

- **`src/utils/groupUtils.js`** - All group logic (creation, collapse, validation, halos)
- **`src/App.jsx`** - Keyboard shortcuts and UI integration
- **`tests/groupHelpers.test.js`** - Comprehensive test coverage

### Key Functions

From `groupUtils.js`:
- `getGroupDescendants(nodeId, nodes)` - Find all descendants by parentGroupId
- `validateGroupMembership(selectedIds, nodes)` - Prevent circular references
- `createGroup(flow, config)` - Create group and update members
- `toggleGroupExpansion(flow, groupId)` - Collapse/expand with synthetic edges
- `ungroup(flow, groupId)` - Remove group and clear parentGroupId
- `getExpandedGroupHalos(nodes, edges)` - Calculate visual halos for expanded groups

### UX Features

- **Cmd+G** - Group selected nodes (≥2 required)
- **Cmd+Shift+G** - Ungroup selected group
- **Double-click** - Collapse/expand group
- **Visual halos** - Show boundaries of expanded groups
- **Synthetic edges** - Show connections when group is collapsed
