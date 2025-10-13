// ABOUTME: Tests for database layer (db.js) operations
// ABOUTME: Ensures SQLite CRUD operations work correctly

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getDb,
  closeDb,
  getFlow,
  saveFlow,
  addConversationMessage,
  getConversationHistory,
  clearConversationHistory,
  pushUndoSnapshot,
  undo,
  redo,
  getUndoStatus,
  clearUndoHistory,
  initializeUndoHistory
} from '../server/db.js';

beforeEach(() => {
  // Use in-memory database for tests
  process.env.DB_PATH = ':memory:';
});

afterEach(() => {
  closeDb();
});

describe('Database Connection', () => {
  it('should create database and run migrations', () => {
    const db = getDb();
    expect(db).toBeDefined();

    // Check tables exist
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all();

    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('flows');
    expect(tableNames).toContain('conversation_history');
    expect(tableNames).toContain('undo_history');
    expect(tableNames).toContain('undo_state');
  });

  it('should initialize undo_state table', () => {
    const db = getDb();
    const state = db.prepare('SELECT * FROM undo_state WHERE id = 1').get();

    expect(state).toBeDefined();
    expect(state.current_index).toBe(-1);
  });
});

describe('Flow Operations', () => {
  it('should return empty flow when none exists', () => {
    const flow = getFlow();

    expect(flow).toEqual({ nodes: [], edges: [] });
  });

  it('should save and retrieve flow', () => {
    const testFlow = {
      nodes: [
        { id: '1', position: { x: 0, y: 0 }, data: { label: 'Test Node' } }
      ],
      edges: []
    };

    saveFlow(testFlow);
    const retrieved = getFlow();

    expect(retrieved.nodes).toHaveLength(1);
    expect(retrieved.nodes[0].data.label).toBe('Test Node');
  });

  it('should update existing flow on save', () => {
    const flow1 = {
      nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'First' } }],
      edges: []
    };
    const flow2 = {
      nodes: [{ id: '2', position: { x: 0, y: 0 }, data: { label: 'Second' } }],
      edges: []
    };

    saveFlow(flow1);
    saveFlow(flow2);

    const retrieved = getFlow();
    expect(retrieved.nodes).toHaveLength(1);
    expect(retrieved.nodes[0].data.label).toBe('Second');
  });

  it('should support multiple flows per user', () => {
    const flow1 = { nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Main' } }], edges: [] };
    const flow2 = { nodes: [{ id: '2', position: { x: 0, y: 0 }, data: { label: 'Family' } }], edges: [] };

    saveFlow(flow1, 'default', 'main');
    saveFlow(flow2, 'default', 'family');

    const retrievedMain = getFlow('default', 'main');
    const retrievedFamily = getFlow('default', 'family');

    expect(retrievedMain.nodes[0].data.label).toBe('Main');
    expect(retrievedFamily.nodes[0].data.label).toBe('Family');
  });

  it('should preserve JSON structure exactly', () => {
    const complexFlow = {
      nodes: [
        {
          id: 'complex_1',
          position: { x: 150.5, y: 250.75 },
          data: {
            label: 'Complex Node',
            description: 'With\nNewlines'
          },
          type: 'custom',
          sourcePosition: 'right'
        }
      ],
      edges: [
        {
          id: 'e1',
          source: 'complex_1',
          target: 'complex_1',
          data: { label: 'Self Loop' }
        }
      ]
    };

    saveFlow(complexFlow);
    const retrieved = getFlow();

    expect(retrieved).toEqual(complexFlow);
  });

  it('should save and retrieve nodes with type field', () => {
    const flowWithTypes = {
      nodes: [
        { id: 'node-1', type: 'regular', position: { x: 0, y: 0 }, data: { label: 'Regular Node' } },
        { id: 'group-1', type: 'group', position: { x: 100, y: 0 }, data: { label: 'Group Node' } },
      ],
      edges: [],
    };

    saveFlow(flowWithTypes);
    const retrieved = getFlow();

    expect(retrieved.nodes[0].type).toBe('regular');
    expect(retrieved.nodes[1].type).toBe('group');
  });

  it('should save and retrieve nodes with parentGroupId field', () => {
    const flowWithGroups = {
      nodes: [
        { id: 'group-1', type: 'group', position: { x: 0, y: 0 }, data: { label: 'Parent Group' } },
        { id: 'node-1', type: 'regular', parentGroupId: 'group-1', position: { x: 50, y: 50 }, data: { label: 'Child Node' } },
        { id: 'node-2', type: 'regular', parentGroupId: 'group-1', position: { x: 50, y: 100 }, data: { label: 'Another Child' } },
      ],
      edges: [],
    };

    saveFlow(flowWithGroups);
    const retrieved = getFlow();

    expect(retrieved.nodes[1].parentGroupId).toBe('group-1');
    expect(retrieved.nodes[2].parentGroupId).toBe('group-1');
  });

  it('should save and retrieve nodes with isExpanded field', () => {
    const flowWithCollapsedGroup = {
      nodes: [
        { id: 'group-1', type: 'group', isExpanded: false, position: { x: 0, y: 0 }, data: { label: 'Collapsed Group' } },
        { id: 'node-1', parentGroupId: 'group-1', hidden: true, position: { x: 50, y: 50 }, data: { label: 'Hidden Child' } },
      ],
      edges: [],
    };

    saveFlow(flowWithCollapsedGroup);
    const retrieved = getFlow();

    expect(retrieved.nodes[0].isExpanded).toBe(false);
    expect(retrieved.nodes[1].hidden).toBe(true);
  });

  it('should handle nested groups correctly', () => {
    const flowWithNestedGroups = {
      nodes: [
        { id: 'group-outer', type: 'group', isExpanded: true, position: { x: 0, y: 0 }, data: { label: 'Outer' } },
        { id: 'group-inner', type: 'group', isExpanded: true, parentGroupId: 'group-outer', position: { x: 50, y: 50 }, data: { label: 'Inner' } },
        { id: 'node-1', parentGroupId: 'group-inner', position: { x: 100, y: 100 }, data: { label: 'Deeply Nested' } },
      ],
      edges: [],
    };

    saveFlow(flowWithNestedGroups);
    const retrieved = getFlow();

    expect(retrieved.nodes[1].parentGroupId).toBe('group-outer');
    expect(retrieved.nodes[2].parentGroupId).toBe('group-inner');
  });
});

describe('Conversation Operations', () => {
  it('should add and retrieve conversation messages', () => {
    addConversationMessage('user', 'Hello');
    addConversationMessage('assistant', 'Hi there', []);

    const history = getConversationHistory();

    expect(history).toHaveLength(2);
    expect(history[0].role).toBe('user');
    expect(history[0].content).toBe('Hello');
    expect(history[1].role).toBe('assistant');
    expect(history[1].content).toBe('Hi there');
  });

  it('should store tool calls as JSON', () => {
    const toolCalls = [
      { name: 'addNode', params: { label: 'Test' } }
    ];

    addConversationMessage('assistant', 'Creating node', toolCalls);

    const history = getConversationHistory();
    expect(history[0].toolCalls).toHaveLength(1);
    expect(history[0].toolCalls[0].name).toBe('addNode');
  });

  it('should limit conversation history', () => {
    // Add 10 messages (5 interactions)
    for (let i = 0; i < 5; i++) {
      addConversationMessage('user', `Message ${i}`);
      addConversationMessage('assistant', `Response ${i}`);
    }

    // Get last 2 interactions (4 messages)
    const limited = getConversationHistory(2);

    expect(limited).toHaveLength(4);
    expect(limited[0].content).toBe('Message 3');
    expect(limited[3].content).toBe('Response 4');
  });

  it('should clear conversation history', () => {
    addConversationMessage('user', 'Test');
    clearConversationHistory();

    const history = getConversationHistory();
    expect(history).toHaveLength(0);
  });
});

describe('Undo/Redo Operations', () => {
  it('should push and retrieve snapshots', () => {
    const state1 = { nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'A' } }], edges: [] };

    pushUndoSnapshot(state1);

    const status = getUndoStatus();
    expect(status.snapshotCount).toBe(1);
    expect(status.currentIndex).toBe(1);
  });

  it('should handle undo operation', () => {
    const stateA = { nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'A' } }], edges: [] };
    const stateB = { nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'B' } }], edges: [] };

    pushUndoSnapshot(stateA);
    pushUndoSnapshot(stateB);

    const undoResult = undo();

    expect(undoResult.nodes[0].data.label).toBe('A');

    const status = getUndoStatus();
    expect(status.canUndo).toBe(false); // At first snapshot
    expect(status.canRedo).toBe(true);
  });

  it('should handle redo operation', () => {
    const stateA = { nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'A' } }], edges: [] };
    const stateB = { nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'B' } }], edges: [] };

    pushUndoSnapshot(stateA);
    pushUndoSnapshot(stateB);
    undo();

    const redoResult = redo();

    expect(redoResult.nodes[0].data.label).toBe('B');
  });

  it('should skip duplicate snapshots', () => {
    const state = { nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Same' } }], edges: [] };

    pushUndoSnapshot(state);
    pushUndoSnapshot(state); // Duplicate

    const status = getUndoStatus();
    expect(status.snapshotCount).toBe(1); // Only one saved
  });

  it('should update positions without creating new snapshot', () => {
    const state1 = { nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'A' } }], edges: [] };
    const state2 = { nodes: [{ id: '1', position: { x: 100, y: 100 }, data: { label: 'A' } }], edges: [] };

    pushUndoSnapshot(state1);
    pushUndoSnapshot(state2); // Same data, different position

    const status = getUndoStatus();
    expect(status.snapshotCount).toBe(1); // Position update, not new snapshot

    // Verify the snapshot was updated with new position
    const db = getDb();
    const snapshot = db.prepare('SELECT snapshot FROM undo_history WHERE id = 1').get();
    const parsedSnapshot = JSON.parse(snapshot.snapshot);
    expect(parsedSnapshot.nodes[0].position.x).toBe(100); // Updated position
  });

  it('should truncate redo chain on new snapshot after undo', () => {
    const stateA = { nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'A' } }], edges: [] };
    const stateB = { nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'B' } }], edges: [] };
    const stateC = { nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'C' } }], edges: [] };

    pushUndoSnapshot(stateA);
    pushUndoSnapshot(stateB);
    pushUndoSnapshot(stateC);

    undo(); // Back to B
    undo(); // Back to A

    // Push new state D (should truncate B and C)
    const stateD = { nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'D' } }], edges: [] };
    pushUndoSnapshot(stateD);

    const status = getUndoStatus();
    expect(status.canRedo).toBe(false); // Can't redo to B or C anymore
  });

  it('should limit snapshots to 50', () => {
    // Push 60 snapshots
    for (let i = 0; i < 60; i++) {
      const state = {
        nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: `State ${i}` } }],
        edges: []
      };
      pushUndoSnapshot(state);
    }

    const status = getUndoStatus();
    expect(status.snapshotCount).toBe(50); // Limited to 50
  });

  it('should clear undo history', () => {
    pushUndoSnapshot({ nodes: [], edges: [] });
    clearUndoHistory();

    const status = getUndoStatus();
    expect(status.snapshotCount).toBe(0);
    expect(status.currentIndex).toBe(-1);
  });

  it('should initialize undo history with flow', () => {
    const initialFlow = { nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Init' } }], edges: [] };

    initializeUndoHistory(initialFlow);

    const status = getUndoStatus();
    expect(status.snapshotCount).toBe(1);
    expect(status.currentIndex).toBe(1);
  });

  it('should return null when nothing to undo', () => {
    pushUndoSnapshot({ nodes: [], edges: [] });

    const result = undo();
    expect(result).toBeNull(); // Can't undo first snapshot
  });

  it('should return null when nothing to redo', () => {
    pushUndoSnapshot({ nodes: [], edges: [] });

    const result = redo();
    expect(result).toBeNull(); // Nothing to redo
  });
});
