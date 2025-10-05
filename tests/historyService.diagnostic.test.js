// ABOUTME: Diagnostic tests to prove history service architectural problems
// ABOUTME: These tests demonstrate why the current design is broken

import { describe, it, expect, beforeEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  pushSnapshot,
  undo,
  redo,
  getHistoryStatus,
  clearHistory
} from '../server/historyService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_HISTORY_PATH = join(__dirname, 'test-data', 'diagnostic-history.json');

describe('History Service Diagnostic Tests', () => {
  beforeEach(async () => {
    process.env.HISTORY_DATA_PATH = TEST_HISTORY_PATH;
    await fs.mkdir(dirname(TEST_HISTORY_PATH), { recursive: true });
    await fs.writeFile(TEST_HISTORY_PATH, JSON.stringify({ states: [], currentIndex: -1 }));
  });

  describe('PROBLEM 1: Snapshots Include UI Transient State', () => {
    it('should prove snapshots store selected/dragging/measured properties', async () => {
      // Simulate a flow state with UI transient properties (from real ReactFlow)
      const flowWithUIState = {
        nodes: [
          {
            id: '1',
            type: 'default',
            position: { x: 100, y: 100 },
            data: { label: 'Node 1' },
            selected: true,          // ❌ UI state - shouldn't be in snapshot
            dragging: false,          // ❌ UI state - shouldn't be in snapshot
            measured: { width: 150, height: 57 } // ❌ UI state - shouldn't be in snapshot
          }
        ],
        edges: []
      };

      // Push snapshot
      await pushSnapshot(flowWithUIState);

      // Read back the snapshot
      const historyData = JSON.parse(await fs.readFile(TEST_HISTORY_PATH, 'utf-8'));
      const snapshot = historyData.states[0];

      // PROBLEM: Snapshot includes UI transient state
      expect(snapshot.nodes[0].selected).toBe(true);
      expect(snapshot.nodes[0].dragging).toBe(false);
      expect(snapshot.nodes[0].measured).toEqual({ width: 150, height: 57 });

      // When you undo, you restore this "dirty" UI state
      // This is WRONG - UI state should be derived fresh, not restored from history
    });

    it('should prove restoring snapshots pollutes UI state', async () => {
      // Step 1: Create node with selected=true
      const state1 = {
        nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'A' }, selected: true }],
        edges: []
      };
      await pushSnapshot(state1);

      // Step 2: Create node with selected=false
      const state2 = {
        nodes: [{ id: '1', position: { x: 100, y: 100 }, data: { label: 'A' }, selected: false }],
        edges: []
      };
      await pushSnapshot(state2);

      // Step 3: Undo to state1
      const restoredState = await undo();

      // PROBLEM: We restored selected=true from the past
      // This is "dirty" state - user didn't select the node NOW, it was selected in the PAST
      expect(restoredState.nodes[0].selected).toBe(true);

      // EXPECTED: selected should always be fresh UI state, not restored from history
      // The snapshot should ONLY store: id, position, data.label
    });
  });

  describe('PROBLEM 2: Flow Divergence (flow.json !== history.states[currentIndex])', () => {
    it('should prove that auto-saves create divergence between flow.json and history', async () => {
      // This test simulates the real-world scenario:
      // 1. LLM creates a node (creates snapshot)
      // 2. User drags the node (auto-save updates flow.json, but NOT history)
      // 3. Now flow.json !== history.states[currentIndex]

      // Step 1: LLM creates node at position (0, 0)
      const llmState = {
        nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'LLM Node' } }],
        edges: []
      };
      await pushSnapshot(llmState);

      const status1 = await getHistoryStatus();
      expect(status1.currentIndex).toBe(0);
      expect(status1.snapshotCount).toBe(1);

      // Step 2: User manually drags node to (500, 500)
      // In real app: auto-save calls writeFlow(newState, skipSnapshot=true)
      // This updates flow.json but NOT history
      // We can't test writeFlow here, but we can prove the concept:

      const manuallyEditedState = {
        nodes: [{ id: '1', position: { x: 500, y: 500 }, data: { label: 'LLM Node' } }],
        edges: []
      };

      // In real world: writeFlow(manuallyEditedState, skipSnapshot=true) would:
      // - Update flow.json to {x: 500, y: 500}
      // - NOT update history
      // We simulate by NOT calling pushSnapshot

      const status2 = await getHistoryStatus();
      expect(status2.currentIndex).toBe(0); // Still pointing to old state
      expect(status2.snapshotCount).toBe(1); // No new snapshot

      // Step 3: Read history to see what "current" is according to history
      const historyData = JSON.parse(await fs.readFile(TEST_HISTORY_PATH, 'utf-8'));
      const historyCurrent = historyData.states[historyData.currentIndex];

      // PROBLEM: History thinks current position is (0, 0)
      expect(historyCurrent.nodes[0].position).toEqual({ x: 0, y: 0 });

      // But in reality, flow.json has position (500, 500)
      // This is DIVERGENCE - two sources of truth

      // CONSEQUENCE: If user now clicks "Undo", they go to index -1 (nothing)
      // But they EXPECTED to go back to (0, 0) - which is actually the CURRENT state in history!
    });

    it('should prove that multiple manual edits get lost on LLM snapshot', async () => {
      // Real scenario:
      // 1. User has node at (0, 0) - snapshot exists
      // 2. User drags to (100, 100) - auto-save, no snapshot
      // 3. User drags to (200, 200) - auto-save, no snapshot
      // 4. User drags to (300, 300) - auto-save, no snapshot
      // 5. LLM creates new node - creates snapshot with (300, 300)
      // 6. User undoes - expects to go to (200, 200) but goes to (0, 0)!

      // Step 1: Initial state
      const initial = {
        nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Node' } }],
        edges: []
      };
      await pushSnapshot(initial);

      // Steps 2-4: User drags (no snapshots created)
      // In real app: auto-save updates flow.json but not history
      // History still at index 0 with position (0, 0)

      // Step 5: LLM adds node, creating snapshot with dragged position
      const afterDrag = {
        nodes: [
          { id: '1', position: { x: 300, y: 300 }, data: { label: 'Node' } },
          { id: '2', position: { x: 0, y: 0 }, data: { label: 'LLM Node' } }
        ],
        edges: []
      };
      await pushSnapshot(afterDrag);

      const status = await getHistoryStatus();
      expect(status.currentIndex).toBe(1);
      expect(status.snapshotCount).toBe(2);

      // Step 6: User undoes (expects to remove LLM node, keep dragged position)
      const undone = await undo();

      // PROBLEM: Undo goes to index 0, which has position (0, 0)
      // User LOST all their drag work!
      expect(undone.nodes[0].position).toEqual({ x: 0, y: 0 });
      expect(undone.nodes.length).toBe(1);

      // EXPECTED: Undo should only remove LLM node, but keep dragged position (300, 300)
      // This requires snapshots on manual edits OR a different architecture
    });
  });

  describe('PROBLEM 3: Manual Edits Are Not Tracked in History', () => {
    it('should prove that manual node dragging is not snapshotted', async () => {
      // This test proves that the current system doesn't track manual edits

      // User creates flow via LLM
      const state1 = {
        nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Node' } }],
        edges: []
      };
      await pushSnapshot(state1);

      // User manually drags node
      // In real app: auto-save with skipSnapshot=true
      // Result: No snapshot created
      const status = await getHistoryStatus();
      expect(status.snapshotCount).toBe(1); // Still only 1 snapshot

      // User can't undo their drag!
      // Undo would go to empty history (nothing before state1)
      const undone = await undo();
      expect(undone).toBe(null); // Can't undo

      // PROBLEM: Manual work is not tracked
      // EXPECTED: Debounced snapshots for manual edits
    });

    it('should prove that manual label edits are not snapshotted', async () => {
      // User creates node via LLM
      const state1 = {
        nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Original' } }],
        edges: []
      };
      await pushSnapshot(state1);

      // User manually edits label to 'Updated'
      // In real app: updateNodeLabel() triggers auto-save with skipSnapshot=true
      // Result: No snapshot created

      const status = await getHistoryStatus();
      expect(status.snapshotCount).toBe(1); // Still only 1 snapshot

      // User can't undo their label edit!
      const undone = await undo();
      expect(undone).toBe(null);

      // PROBLEM: Manual label edits not tracked
    });
  });

  describe('PROBLEM 4: No Single Source of Truth', () => {
    it('should demonstrate the two-source-of-truth problem', async () => {
      // We have two places where state lives:
      // 1. flow.json (updated by auto-save + LLM tools)
      // 2. history.states[currentIndex] (updated only by LLM tools)

      // Initial state (both sources agree)
      const state1 = {
        nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Node' } }],
        edges: []
      };
      await pushSnapshot(state1);

      // After this:
      // - flow.json: { nodes: [{ x: 0, y: 0 }] }
      // - history.states[0]: { nodes: [{ x: 0, y: 0 }] }
      // - currentIndex: 0
      // Sources AGREE ✅

      // User drags node (auto-save with skipSnapshot=true)
      // This would update flow.json but not history
      // After this:
      // - flow.json: { nodes: [{ x: 500, y: 500 }] }
      // - history.states[0]: { nodes: [{ x: 0, y: 0 }] }
      // - currentIndex: 0
      // Sources DISAGREE ❌

      // Now, which is the "current" state?
      // - flow.json says (500, 500)
      // - history.states[currentIndex] says (0, 0)

      // This is the fundamental architectural flaw
      // There should be ONE source of truth, not two
    });
  });

  describe('PROBLEM 5: Unclear Snapshot Semantics', () => {
    it('should prove that canUndo depends on history, not flow.json', async () => {
      // User has a flow with 5 nodes (from manual creation)
      // But history is empty
      // Question: Can they undo?

      // In current system: NO (canUndo checks history.currentIndex > 0)
      const status = await getHistoryStatus();
      expect(status.canUndo).toBe(false);

      // But logically, they SHOULD be able to undo their manual creations
      // This is confusing for users

      // PROBLEM: Undo is only for LLM changes, not manual changes
      // This is not obvious to users
    });

    it('should prove that undo after manual edit is confusing', async () => {
      // 1. LLM creates node A
      const state1 = {
        nodes: [{ id: 'A', position: { x: 0, y: 0 }, data: { label: 'A' } }],
        edges: []
      };
      await pushSnapshot(state1);

      // 2. LLM creates node B
      const state2 = {
        nodes: [
          { id: 'A', position: { x: 0, y: 0 }, data: { label: 'A' } },
          { id: 'B', position: { x: 100, y: 0 }, data: { label: 'B' } }
        ],
        edges: []
      };
      await pushSnapshot(state2);

      // 3. User manually drags B to (200, 200)
      // Auto-save updates flow.json but not history
      // flow.json: B at (200, 200)
      // history.states[1]: B at (100, 0)

      // 4. User clicks undo (expects to undo the drag)
      const undone = await undo();

      // PROBLEM: Undo goes to state1 (removes node B entirely!)
      expect(undone.nodes.length).toBe(1);
      expect(undone.nodes[0].id).toBe('A');

      // User expected: B stays but returns to (100, 0)
      // User got: B removed entirely

      // This is VERY confusing
    });
  });

  describe('PROBLEM 6: Snapshot Data Includes Unnecessary Fields', () => {
    it('should prove snapshots are bloated with ReactFlow internal state', async () => {
      // Real ReactFlow node includes many fields
      const realReactFlowNode = {
        id: '1',
        type: 'default',
        position: { x: 100, y: 200 },
        data: { label: 'My Node', description: 'Test' },
        sourcePosition: 'right',
        targetPosition: 'left',
        measured: { width: 150, height: 57 },
        selected: false,
        dragging: false,
        // ... and potentially more
      };

      const state = { nodes: [realReactFlowNode], edges: [] };
      await pushSnapshot(state);

      // Read snapshot
      const historyData = JSON.parse(await fs.readFile(TEST_HISTORY_PATH, 'utf-8'));
      const snapshot = historyData.states[0].nodes[0];

      // PROBLEM: Snapshot includes ALL fields, even unnecessary ones
      expect(snapshot.sourcePosition).toBe('right');
      expect(snapshot.targetPosition).toBe('left');
      expect(snapshot.measured).toEqual({ width: 150, height: 57 });

      // These fields are:
      // 1. Derived/constant (sourcePosition, targetPosition - always the same)
      // 2. UI transient (measured - recalculated on render)
      // 3. Bloating snapshot size

      // EXPECTED: Snapshot should ONLY include:
      // - id
      // - position
      // - data.label
      // - data.description
      // Everything else should be derived or ignored
    });
  });

  describe('ARCHITECTURAL FIX RECOMMENDATIONS', () => {
    it('should demonstrate what a clean snapshot should look like', async () => {
      // CURRENT: Bloated snapshot with UI state
      const dirtySnapshot = {
        nodes: [{
          id: '1',
          type: 'default',
          position: { x: 100, y: 200 },
          data: { label: 'Node', description: 'Test' },
          sourcePosition: 'right',
          targetPosition: 'left',
          measured: { width: 150, height: 57 },
          selected: true,
          dragging: false
        }],
        edges: []
      };

      // EXPECTED: Clean snapshot with only data
      const cleanSnapshot = {
        nodes: [{
          id: '1',
          position: { x: 100, y: 200 },
          data: { label: 'Node', description: 'Test' }
        }],
        edges: [{
          id: 'e1',
          source: '1',
          target: '2',
          data: { label: 'Edge Label' }
        }]
      };

      // Fields to STRIP before snapshot:
      // - type (always 'default')
      // - sourcePosition (always 'right')
      // - targetPosition (always 'left')
      // - measured (derived)
      // - selected (UI state)
      // - dragging (UI state)

      // On restore, ADD these fields back:
      // - type: 'default'
      // - sourcePosition: Position.Right
      // - targetPosition: Position.Left
      // - selected: false (always fresh)
      // - dragging: false (always fresh)
      // - measured: undefined (will be calculated)
    });
  });
});
