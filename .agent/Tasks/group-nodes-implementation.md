# Group Nodes Implementation Plan (TDD-First)

## Overview
Add ability to group selected nodes together, with collapse/expand functionality. Groups are regular nodes with special type, leveraging existing `hidden` pattern for collapse behavior.

**Implementation Philosophy**: Test-Driven Development with backward compatibility as priority.

## Data Model Changes

### Node Schema Updates
Add three new fields to nodes:
- `type`: `'regular' | 'group'` (defaults to `'regular'`, enforced by CHECK constraint)
- `parentGroupId`: `string | null` (which group this node belongs to, defaults to `NULL`)
- `isExpanded`: `boolean | undefined` (only for `type='group'` nodes, defaults to `true`)

### Example Structure
```javascript
// Regular node in a group
{ id: '1', label: 'Login', parentGroupId: 'group-a', type: 'regular' }

// Group node (collapsed)
{ id: 'group-a', label: 'Auth Flow', type: 'group', isExpanded: false }

// Nested group
{ id: 'group-b', label: 'Outer', type: 'group', parentGroupId: 'group-c', isExpanded: true }
```

### Backward Compatibility
- Existing flows without `type` field default to `'regular'`
- Existing flows without `parentGroupId` default to `null` (not grouped)
- Migration must not break existing flows

## UX Flow

### Creating Groups
1. User `Cmd+Click` to select multiple nodes (≥2)
2. Show tooltip: "⌘G to group • ⌘⇧G to ungroup"
3. User presses `Cmd+G`
4. Prompt for group label
5. Create group node with `type: 'group'`, `isExpanded: true`
6. Set `parentGroupId` on selected nodes
7. Re-layout with dagre

### Collapsing/Expanding
1. User double-clicks group node
2. Toggle `isExpanded` state
3. If collapsing: mark all nodes with `parentGroupId === groupId` as `hidden: true`
4. Mark edges connected to hidden nodes as `hidden: true`
5. Re-layout with dagre (uses existing pattern from Alt+Click collapse)

### Ungrouping
1. Select group node
2. User presses `Cmd+Shift+G`
3. Remove `parentGroupId` from all member nodes
4. Delete group node
5. Re-layout with dagre

## Implementation Order (TDD-First)

### Phase 1: Foundation - Validation & Helper Functions
**Goal**: Build robust helpers that handle edge cases before touching UI/DB.

#### 1.1 Descendant Traversal (Test-First)
**Test file**: `tests/groupHelpers.test.js`

1. **Write failing tests**:
   ```javascript
   // Test: finds direct children by parentGroupId
   // Test: finds nested descendants recursively
   // Test: handles circular references gracefully
   // Test: returns empty array for non-existent nodeId
   // Test: handles nodes with no children
   ```

2. **Implement**: Add to `src/hooks/useFlowLayout.js` (alongside existing `getAllDescendants`)
   ```javascript
   // New function - traverses by parentGroupId instead of edges
   export function getAllDescendantsByGroup(nodeId, nodes) {
     // Traverse by parentGroupId instead of edges
     // Handle nested groups recursively
     // Return Set of descendant IDs
   }

   // NOTE: Existing getAllDescendants() uses edges (for Alt+Click collapse)
   // This new one uses parentGroupId (for group membership collapse)
   ```

#### 1.2 Validation Functions (Test-First)
**Test file**: `tests/groupHelpers.test.js`

1. **Write failing tests**:
   ```javascript
   // Test: detects circular references (A contains B, B contains A)
   // Test: detects indirect circular refs (A->B->C->A)
   // Test: prevents grouping node with its own descendant
   // Test: allows valid parent-child relationships
   ```

2. **Implement**:
   ```javascript
   export function detectCircularReference(nodeId, potentialParentId, nodes)
   export function validateGroupMembership(selectedIds, nodes)
   ```

#### 1.3 Group State Helpers (Test-First)
**Test file**: `tests/groupHelpers.test.js`

1. **Write failing tests**:
   ```javascript
   // Test: finds all nodes affected by collapse (including nested)
   // Test: finds all edges connected to hidden nodes
   // Test: handles expand correctly (marks nodes visible)
   ```

2. **Implement**:
   ```javascript
   export function getAffectedNodesForCollapse(groupId, nodes)
   export function getAffectedEdgesForCollapse(hiddenNodeIds, edges)
   ```

---

### Phase 2: Database Schema (Safe Migration)
**Goal**: Add columns with proper defaults and constraints, ensuring backward compatibility.

#### 2.1 Migration Testing (Test-First)
**Test file**: `tests/schema-migration.test.js`

1. **Write failing tests**:
   ```javascript
   // Test: old flows load with default type='regular'
   // Test: old flows load with default parentGroupId=null
   // Test: can save flows with new fields
   // Test: CHECK constraint rejects invalid types
   // Test: can create group nodes with type='group'
   ```

2. **Create migration**: `server/migrations/002_add_group_fields.sql`
   ```sql
   -- Add columns with explicit defaults
   ALTER TABLE flows ADD COLUMN type TEXT DEFAULT 'regular'
     CHECK(type IN ('regular', 'group'));
   ALTER TABLE flows ADD COLUMN parentGroupId TEXT DEFAULT NULL;
   ALTER TABLE flows ADD COLUMN isExpanded INTEGER DEFAULT 1;

   -- Update existing rows to have explicit type
   UPDATE flows SET type = 'regular' WHERE type IS NULL;
   ```

3. **Update migration runner**: Ensure `db.js` applies 002 migration

#### 2.2 Schema Validation (Test-First)
**Test file**: `tests/db.test.js` (add to existing)

1. **Write failing tests**:
   ```javascript
   // Test: saveFlow accepts nodes with type field
   // Test: saveFlow accepts nodes with parentGroupId
   // Test: getFlow returns nodes with all new fields
   // Test: nodes without type/parentGroupId still work
   ```

2. **Update Zod schemas** (if they exist in codebase)

---

### Phase 3: Backend API (Test-First)
**Goal**: Ensure API correctly handles new fields.

#### 3.1 API Contract Tests
**Test file**: `tests/api-contracts.test.js` (add to existing)

1. **Write failing tests**:
   ```javascript
   // Test: POST /api/flow accepts group nodes
   // Test: POST /api/flow accepts parentGroupId
   // Test: GET /api/flow returns new fields
   // Test: POST /api/flow validates type enum
   ```

2. **Update backend**: Ensure `saveFlow`/`getFlow` handle new fields

---

### Phase 4: Selection System (Test-First)
**Goal**: Multi-select UI with keyboard shortcuts.

#### 4.1 Selection State Tests
**Test file**: `tests/selection.test.js` (new)

1. **Write failing tests**:
   ```javascript
   // Test: Cmd+Click adds node to selection
   // Test: Cmd+Click on selected node deselects it
   // Test: Regular click clears selection
   // Test: selectedNodeIds state updates correctly
   // Test: selected nodes have 40% more prominent stroke
   ```

2. **Implement in App.jsx**:
   - Add `selectedNodeIds` state
   - Add `onNodeClick` handler with Cmd key detection
   - Add `onPaneClick` to clear selection

#### 4.2 Visual Feedback Tests
**Test file**: Manual testing (visual UI)

1. **Implement**:
   - Add `className` to selected nodes for highlight (40% more prominent stroke)
   - Add CSS for selection highlight
   - Show tooltip in **bottom-right corner** (new tooltip section): "⌘G to group" when ≥2 nodes selected

---

### Phase 5: Basic Grouping (Test-First)
**Goal**: Create group nodes, set parentGroupId, prevent invalid operations.

#### 5.1 Group Creation Tests
**Test file**: `tests/grouping.test.js` (new)

1. **Write failing tests**:
   ```javascript
   // Test: createGroup() generates node with type='group'
   // Test: createGroup() sets parentGroupId on selected nodes
   // Test: createGroup() prevents circular references
   // Test: createGroup() prevents grouping node with descendant
   // Test: createGroup() clears selection after creation
   // Test: createGroup() triggers layout
   ```

2. **Implement in App.jsx**:
   ```javascript
   const createGroup = () => {
     // Prompt for label
     // Validate using groupHelpers
     // Create group node
     // Update selected nodes
     // Clear selection
     // Save & layout
   }
   ```

#### 5.2 Keyboard Shortcut Tests
**Test file**: `tests/keyboard-shortcuts.test.js` (add to existing if present)

1. **Write failing tests**:
   ```javascript
   // Test: Cmd+G calls createGroup when ≥2 nodes selected
   // Test: Cmd+G does nothing when <2 nodes selected
   ```

2. **Implement**:
   - Add Cmd+G listener in App.jsx `useEffect`

---

### Phase 6: Collapse/Expand (Test-First)
**Goal**: Toggle visibility of group members, handle nested groups.

#### 6.1 Collapse Logic Tests
**Test file**: `tests/collapse-expand.test.js` (new)

1. **Write failing tests**:
   ```javascript
   // Test: double-click group toggles isExpanded
   // Test: collapse marks direct children as hidden
   // Test: collapse marks nested descendants as hidden
   // Test: collapse marks connected edges as hidden
   // Test: expand unhides all descendants
   // Test: expand unhides connected edges
   // Test: nested groups: collapsing parent hides all nested children
   ```

2. **Implement in App.jsx**:
   ```javascript
   const toggleGroupCollapse = (groupId) => {
     const group = nodes.find(n => n.id === groupId);
     const newExpandedState = !group.isExpanded;

     if (!newExpandedState) {
       // Collapse: hide descendants
       const descendantIds = getAllDescendantsByGroup(groupId, nodes);
       // Mark nodes as hidden
       // Mark edges as hidden
     } else {
       // Expand: unhide descendants
     }
     // Save & layout
   }
   ```

#### 6.2 Double-Click Handler
**Test file**: Manual testing

1. **Implement**:
   - Add `onNodeDoubleClick` handler
   - Check if `node.type === 'group'`
   - Call `toggleGroupCollapse()`

---

### Phase 7: Visual Representation (Test-First where possible)
**Goal**: Distinct styling for group nodes.

#### 7.1 Group Node Styling
**Test file**: Manual testing (visual)

1. **Implement in Node.jsx or App.jsx**:
   - Different background color for `type='group'`
   - Larger dimensions for group nodes (50% bigger than regular)
   - Show "Group Node X" as temporary label format
   - Show "(N nodes)" count when collapsed

#### 7.2 Visual Settings Integration
**Test file**: `tests/visualSettings.test.js` (if needed)

1. **Update `shared/visualSettings.js`**:
   - Add default dimensions for group nodes (50% larger than regular)
   - Add comment: "HARDCODED: Group dimensions defined here temporarily"
   - Allow per-group styling overrides

---

### Phase 8: Ungrouping (Test-First)
**Goal**: Remove parentGroupId, delete group node.

#### 8.1 Ungroup Logic Tests
**Test file**: `tests/grouping.test.js`

1. **Write failing tests**:
   ```javascript
   // Test: ungroup() removes parentGroupId from members
   // Test: ungroup() deletes group node
   // Test: ungroup() allows nested groups to become top-level (remove their parentGroupId)
   // Test: ungroup() triggers layout
   ```

   **Note on nested groups**: When ungrouping a parent that contains nested groups,
   the nested groups simply become top-level (their parentGroupId is cleared).
   Simple and clean - no need to prevent ungrouping.

2. **Implement in App.jsx**:
   ```javascript
   const ungroupNodes = (groupId) => {
     // Find all members
     // Remove parentGroupId
     // Delete group node
     // Save & layout
   }
   ```

#### 8.2 Keyboard Shortcut
**Test file**: `tests/keyboard-shortcuts.test.js`

1. **Write failing tests**:
   ```javascript
   // Test: Cmd+Shift+G calls ungroup when group node selected
   ```

2. **Implement**:
   - Add Cmd+Shift+G listener

---

### Phase 9: Integration & Edge Cases (Test-First)
**Goal**: Ensure system handles complex scenarios.

#### 9.1 Integration Tests
**Test file**: `tests/integration/grouping-workflow.test.js`

1. **Write tests**:
   ```javascript
   // Test: full workflow (select, group, collapse, expand, ungroup)
   // Test: nested groups (create group inside group)
   // Test: multiple groups (create 2+ independent groups)
   // Test: undo/redo works with grouping operations
   // Test: autosave persists group state
   // Test: load flow with groups from DB
   ```

#### 9.2 Edge Case Tests
**Test file**: `tests/grouping-edgecases.test.js`

1. **Write tests**:
   ```javascript
   // Test: cannot group a node with itself
   // Test: cannot create empty group
   // Test: deleting a node from group - group survives if ≥2 members remain
   // Test: deleting a node from group with only 2 members - auto-ungroups (group deleted, last member freed)
   // Test: deleting group node directly - should ungroup first (remove parentGroupId from all members)
   // Test: edges between collapsed groups behave correctly
   // Test: Alt+Click collapse still works independently of group collapse
   ```

---

### Phase 10: Documentation & Cleanup
1. Update `.agent/system/project_architecture.md` with grouping feature
2. Update `.agent/system/database_schema.md` with new columns
3. Add SOP for group operations if needed
4. Remove any TODO comments from code

## Technical Notes

### Leverage Existing Patterns
- **Collapse behavior**: Reuse Alt+Click collapse pattern (`hidden` property + dagre re-layout)
- **Descendant finding**: `getAllDescendants()` exists in useFlowLayout.js, may need modification for `parentGroupId` 
- **Layout animation**: `applyLayoutWithAnimation()` already handles smooth transitions

### Dagre Integration
- Filter out `hidden` nodes before passing to dagre (already done in `getLayoutedElements`)
- Dagre automatically ignores edges with missing nodes
- No edge rewriting needed

### State Management
- All state in React (no MobX/Zustand needed)
- Use existing `setNodes`/`setEdges` patterns
- Selection state can be local to App.jsx

## Critical Safety Checks

### Edge Cases to Handle
1. **Circular References**: Prevent A→B, B→A or A→B→C→A
2. **Self-Grouping**: Cannot group a node with itself
3. **Ancestor Grouping**: Cannot make node X a member of its own descendant group Y
4. **Empty Groups**: Decide policy (allow or prevent)
5. **Edge Visibility**: Edges crossing group boundaries when collapsed
6. **Interaction with Alt+Click**: Ensure both collapse mechanisms work independently

### Data Integrity
- All `parentGroupId` values must reference existing group nodes
- No orphaned `parentGroupId` references after deletions
- `type='group'` nodes should have `isExpanded` defined
- Migration must preserve all existing flow data

### Performance Considerations
- Descendant traversal is O(n) per group - acceptable for typical flows
- Circular reference check is O(n²) worst case - validate once at creation
- Layout recalculation triggered on every collapse/expand

## Open Questions / Design Decisions

### Resolved Decisions
- **Edge behavior on collapse**: Hide edges (don't reroute to group node)
- **Nested group support**: Yes, from Phase 1
- **Backward compatibility**: Required, use defaults
- **Group node dimensions**: Fixed 50% larger than regular nodes (hardcoded in visualSettings)
- **Visual style for expanded groups**: No special visual (just larger node with distinct color)
- **Group label format**: Just add how many nodes it includes for now
- **Selection visual**: 40% more prominent stroke on selected nodes
- **Tooltip location**: Bottom-right corner (new tooltip section)
- **Ungroup with nested groups**: Allow - nested groups become top-level
- **Delete node from group**: Group survives if ≥2 members remain; auto-ungroup if only 1 left
- **Direct group deletion**: Should ungroup first (clear parentGroupId from all members)
- **Helper function location**: Add to `useFlowLayout.js` (not separate file)

### Final Decisions (All Resolved ✅)
1. **Empty groups**: Prevent - require ≥2 members to create group
2. **Auto-layout on group creation**: No repositioning - keep existing positions
3. **Group label editing**: Yes - same inline edit UX as regular nodes

## Files to Create/Modify

### New Files
- `server/migrations/002_add_group_fields.sql` - Schema migration
- `tests/groupHelpers.test.js` - Tests for group helper functions (in useFlowLayout.js)
- `tests/schema-migration.test.js` - Migration backward compatibility tests
- `tests/selection.test.js` - Selection state tests
- `tests/grouping.test.js` - Group creation/deletion tests
- `tests/collapse-expand.test.js` - Collapse/expand logic tests
- `tests/integration/grouping-workflow.test.js` - End-to-end workflow tests
- `tests/grouping-edgecases.test.js` - Edge case tests

### Modified Files
- `server/db.js` - Apply 002 migration
- `server/server.js` - Ensure API handles new fields (likely no changes needed)
- `src/App.jsx` - Selection state, keyboard handlers, group/ungroup/collapse logic
- `src/Node.jsx` - Group node styling (conditional rendering)
- `src/hooks/useFlowLayout.js` - May need updates for group-aware layout
- `shared/visualSettings.js` - Add group node dimension defaults
- `tests/db.test.js` - Add tests for new schema fields
- `tests/api-contracts.test.js` - Add tests for group field handling


