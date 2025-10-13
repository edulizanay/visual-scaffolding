import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  pushSnapshot,
  undo,
  redo,
  canUndo,
  canRedo,
  getHistoryStatus,
  clearHistory,
  initializeHistory
} from '../server/historyService.js';
import { closeDb } from '../server/db.js';

describe('historyService', () => {
  beforeEach(() => {
    process.env.DB_PATH = ':memory:';
  });

  afterEach(() => {
    closeDb();
  });

  describe('pushSnapshot', () => {
    it('should add first snapshot', async () => {
      const state1 = { nodes: [{ id: '1' }], edges: [] };
      await pushSnapshot(state1);

      const status = await getHistoryStatus();
      expect(status.snapshotCount).toBe(1);
      expect(status.currentIndex).toBe(1); // DB uses 1-based IDs
      expect(status.canUndo).toBe(false);
      expect(status.canRedo).toBe(false);
    });

    it('should add multiple snapshots', async () => {
      const state1 = { nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'A' } }], edges: [] };
      const state2 = { nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'B' } }], edges: [] };

      await pushSnapshot(state1);
      await pushSnapshot(state2);

      const status = await getHistoryStatus();
      expect(status.snapshotCount).toBe(2);
      expect(status.currentIndex).toBe(2); // Second snapshot has ID 2
      expect(status.canUndo).toBe(true);
      expect(status.canRedo).toBe(false);
    });

    it('should truncate future states when pushing after undo', async () => {
      const state1 = { nodes: [{ id: '1' }], edges: [] };
      const state2 = { nodes: [{ id: '1' }, { id: '2' }], edges: [] };
      const state3 = { nodes: [{ id: '1' }, { id: '3' }], edges: [] };

      await pushSnapshot(state1);
      await pushSnapshot(state2);
      await undo(); // Back to state1 (index 1)
      await pushSnapshot(state3); // Should remove state2, add state3

      const status = await getHistoryStatus();
      expect(status.snapshotCount).toBe(2); // state1 and state3
      expect(status.currentIndex).toBe(3); // state3 gets new ID 3 (auto-increment continues)
    });

    it('should limit snapshots to 50', async () => {
      // Push 60 snapshots
      for (let i = 0; i < 60; i++) {
        await pushSnapshot({ nodes: [{ id: `${i}` }], edges: [] });
      }

      const status = await getHistoryStatus();
      expect(status.snapshotCount).toBe(50);
      expect(status.currentIndex).toBe(60); // Last snapshot ID is 60
    });
  });

  describe('undo', () => {
    it('should return null when no history', async () => {
      const result = await undo();
      expect(result).toBe(null);
    });

    it('should return null when only one state', async () => {
      const state1 = { nodes: [{ id: '1' }], edges: [] };
      await pushSnapshot(state1);

      const result = await undo();
      expect(result).toBe(null);
    });

    it('should undo to previous state', async () => {
      const state1 = { nodes: [{ id: '1' }], edges: [] };
      const state2 = { nodes: [{ id: '1' }, { id: '2' }], edges: [] };

      await pushSnapshot(state1);
      await pushSnapshot(state2);

      const result = await undo();
      expect(result).toEqual(state1);

      const status = await getHistoryStatus();
      expect(status.currentIndex).toBe(1); // Back to first snapshot (ID 1)
      expect(status.canUndo).toBe(false);
      expect(status.canRedo).toBe(true);
    });

    it('should undo multiple times', async () => {
      const state1 = { nodes: [{ id: '1' }], edges: [] };
      const state2 = { nodes: [{ id: '1' }, { id: '2' }], edges: [] };
      const state3 = { nodes: [{ id: '1' }, { id: '2' }, { id: '3' }], edges: [] };

      await pushSnapshot(state1);
      await pushSnapshot(state2);
      await pushSnapshot(state3);

      const result1 = await undo();
      expect(result1).toEqual(state2);

      const result2 = await undo();
      expect(result2).toEqual(state1);

      const result3 = await undo();
      expect(result3).toBe(null);
    });
  });

  describe('redo', () => {
    it('should return null when no future states', async () => {
      const state1 = { nodes: [{ id: '1' }], edges: [] };
      await pushSnapshot(state1);

      const result = await redo();
      expect(result).toBe(null);
    });

    it('should redo after undo', async () => {
      const state1 = { nodes: [{ id: '1' }], edges: [] };
      const state2 = { nodes: [{ id: '1' }, { id: '2' }], edges: [] };

      await pushSnapshot(state1);
      await pushSnapshot(state2);
      await undo();

      const result = await redo();
      expect(result).toEqual(state2);

      const status = await getHistoryStatus();
      expect(status.currentIndex).toBe(2); // Back to second snapshot (ID 2)
      expect(status.canUndo).toBe(true);
      expect(status.canRedo).toBe(false);
    });

    it('should redo multiple times', async () => {
      const state1 = { nodes: [{ id: '1' }], edges: [] };
      const state2 = { nodes: [{ id: '1' }, { id: '2' }], edges: [] };
      const state3 = { nodes: [{ id: '1' }, { id: '2' }, { id: '3' }], edges: [] };

      await pushSnapshot(state1);
      await pushSnapshot(state2);
      await pushSnapshot(state3);

      await undo();
      await undo();

      const result1 = await redo();
      expect(result1).toEqual(state2);

      const result2 = await redo();
      expect(result2).toEqual(state3);

      const result3 = await redo();
      expect(result3).toBe(null);
    });
  });

  describe('canUndo/canRedo', () => {
    it('should return false when empty', async () => {
      expect(await canUndo()).toBe(false);
      expect(await canRedo()).toBe(false);
    });

    it('should return correct values after operations', async () => {
      const state1 = { nodes: [{ id: '1' }], edges: [] };
      const state2 = { nodes: [{ id: '1' }, { id: '2' }], edges: [] };

      await pushSnapshot(state1);
      expect(await canUndo()).toBe(false);
      expect(await canRedo()).toBe(false);

      await pushSnapshot(state2);
      expect(await canUndo()).toBe(true);
      expect(await canRedo()).toBe(false);

      await undo();
      expect(await canUndo()).toBe(false);
      expect(await canRedo()).toBe(true);

      await redo();
      expect(await canUndo()).toBe(true);
      expect(await canRedo()).toBe(false);
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', async () => {
      const state1 = { nodes: [{ id: '1' }], edges: [] };
      const state2 = { nodes: [{ id: '1' }, { id: '2' }], edges: [] };

      await pushSnapshot(state1);
      await pushSnapshot(state2);

      await clearHistory();

      const status = await getHistoryStatus();
      expect(status.snapshotCount).toBe(0);
      expect(status.currentIndex).toBe(-1); // Cleared state
      expect(status.canUndo).toBe(false);
      expect(status.canRedo).toBe(false);
    });
  });

  describe('initializeHistory', () => {
    it('should clear history and create initial snapshot', async () => {
      const initialFlow = { nodes: [{ id: 'initial' }], edges: [] };

      await initializeHistory(initialFlow);

      const status = await getHistoryStatus();
      expect(status.snapshotCount).toBe(1);
      expect(status.currentIndex).toBe(1); // First snapshot gets ID 1
      expect(status.canUndo).toBe(false);
      expect(status.canRedo).toBe(false);
    });

    it('should clear old history before initializing', async () => {
      const oldState = { nodes: [{ id: 'old' }], edges: [] };
      const newState = { nodes: [{ id: 'new' }], edges: [] };

      await pushSnapshot(oldState);
      await initializeHistory(newState);

      const status = await getHistoryStatus();
      expect(status.snapshotCount).toBe(1);
      expect(status.currentIndex).toBe(2); // New snapshot gets next ID
    });
  });
});
