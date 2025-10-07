// ABOUTME: End-to-end tests for complete flow operations across server lifecycle
// ABOUTME: Ensures data persists correctly through create/save/restart/load cycles

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { readFlow, writeFlow, executeToolCalls } from '../server/server.js';
import { pushSnapshot, undo, redo, canUndo, canRedo, initializeHistory } from '../server/historyService.js';
import { closeDb } from '../server/db.js';

beforeEach(() => {
  process.env.DB_PATH = ':memory:';
});

afterEach(() => {
  closeDb();
});

describe('E2E Flow Operations', () => {
  it('should persist nodes through save and load cycle', async () => {
    // Create nodes
    const toolCalls = [
      { name: 'addNode', params: { label: 'Node A', description: 'First node' } },
      { name: 'addNode', params: { label: 'Node B', description: 'Second node' } },
      { name: 'addNode', params: { label: 'Node C', description: 'Third node' } }
    ];

    const results = await executeToolCalls(toolCalls);
    expect(results.every(r => r.success)).toBe(true);

    // Verify nodes were created
    let flow = await readFlow();
    expect(flow.nodes).toHaveLength(3);
    expect(flow.nodes[0].data.label).toBe('Node A');
    expect(flow.nodes[1].data.label).toBe('Node B');
    expect(flow.nodes[2].data.label).toBe('Node C');

    // Simulate server restart by reading again
    flow = await readFlow();
    expect(flow.nodes).toHaveLength(3);
    expect(flow.nodes[0].data.description).toBe('First node');
  });

  it('should persist edges with parent-child relationships', async () => {
    // Create parent and children with edges
    const toolCalls = [
      { name: 'addNode', params: { label: 'Parent' } },
      { name: 'addNode', params: { label: 'Child 1', parentNodeId: 'parent' } },
      { name: 'addNode', params: { label: 'Child 2', parentNodeId: 'parent', edgeLabel: 'connection' } }
    ];

    const results = await executeToolCalls(toolCalls);
    expect(results.every(r => r.success)).toBe(true);

    // Verify structure
    const flow = await readFlow();
    expect(flow.nodes).toHaveLength(3);
    expect(flow.edges).toHaveLength(2);

    // Verify edges point to correct nodes
    const parentNode = flow.nodes.find(n => n.data.label === 'Parent');
    const child1 = flow.nodes.find(n => n.data.label === 'Child 1');
    const child2 = flow.nodes.find(n => n.data.label === 'Child 2');

    expect(flow.edges[0].source).toBe(parentNode.id);
    expect(flow.edges[0].target).toBe(child1.id);
    expect(flow.edges[1].source).toBe(parentNode.id);
    expect(flow.edges[1].target).toBe(child2.id);
    expect(flow.edges[1].data.label).toBe('connection');
  });

  it('should handle undo/redo across multiple operations', async () => {
    // Initialize history
    const initialFlow = await readFlow();
    await initializeHistory(initialFlow);

    // Create state A
    await executeToolCalls([{ name: 'addNode', params: { label: 'Node A' } }]);
    const flowA = await readFlow();
    expect(flowA.nodes).toHaveLength(1);

    // Create state B
    await executeToolCalls([{ name: 'addNode', params: { label: 'Node B' } }]);
    const flowB = await readFlow();
    expect(flowB.nodes).toHaveLength(2);

    // Create state C
    await executeToolCalls([{ name: 'addNode', params: { label: 'Node C' } }]);
    const flowC = await readFlow();
    expect(flowC.nodes).toHaveLength(3);

    // Undo twice (C -> B -> A)
    expect(await canUndo()).toBe(true);
    const undoResult1 = await undo();
    expect(undoResult1.nodes).toHaveLength(2);

    const undoResult2 = await undo();
    expect(undoResult2.nodes).toHaveLength(1);

    // Redo once (A -> B)
    expect(await canRedo()).toBe(true);
    const redoResult = await redo();
    expect(redoResult.nodes).toHaveLength(2);
    expect(redoResult.nodes[1].data.label).toBe('Node B');

    // Verify redo chain is intact
    expect(await canRedo()).toBe(true);
  });

  it('should handle complex graph with updates and deletes', async () => {
    // Create initial graph
    const createCalls = [
      { name: 'addNode', params: { label: 'Root' } },
      { name: 'addNode', params: { label: 'Branch 1', parentNodeId: 'root' } },
      { name: 'addNode', params: { label: 'Branch 2', parentNodeId: 'root' } },
      { name: 'addNode', params: { label: 'Leaf', parentNodeId: 'branch_1' } }
    ];

    await executeToolCalls(createCalls);

    let flow = await readFlow();
    expect(flow.nodes).toHaveLength(4);
    expect(flow.edges).toHaveLength(3);

    // Update a node
    const branch1 = flow.nodes.find(n => n.data.label === 'Branch 1');
    await executeToolCalls([
      { name: 'updateNode', params: { nodeId: branch1.id, label: 'Updated Branch' } }
    ]);

    flow = await readFlow();
    const updated = flow.nodes.find(n => n.id === branch1.id);
    expect(updated.data.label).toBe('Updated Branch');

    // Delete a node (should remove connected edges)
    const branch2 = flow.nodes.find(n => n.data.label === 'Branch 2');
    await executeToolCalls([
      { name: 'deleteNode', params: { nodeId: branch2.id } }
    ]);

    flow = await readFlow();
    expect(flow.nodes).toHaveLength(3);
    expect(flow.edges).toHaveLength(2); // One edge removed with Branch 2
  });

  it('should handle special characters and unicode in labels', async () => {
    const specialLabels = [
      'Node with "quotes"',
      "Node with 'single quotes'",
      'Node with émojis 🎉🚀',
      'Node with\nnewline',
      'Node with <html> tags',
      'Node with & ampersand'
    ];

    const toolCalls = specialLabels.map(label => ({
      name: 'addNode',
      params: { label, description: `Description for ${label}` }
    }));

    const results = await executeToolCalls(toolCalls);
    expect(results.every(r => r.success)).toBe(true);

    // Verify all labels persisted correctly
    const flow = await readFlow();
    expect(flow.nodes).toHaveLength(6);

    specialLabels.forEach((label, index) => {
      expect(flow.nodes[index].data.label).toBe(label);
    });
  });

  it('should handle empty and null values correctly', async () => {
    // Node with no description
    await executeToolCalls([
      { name: 'addNode', params: { label: 'No Description' } }
    ]);

    // Edge with no label
    const flow1 = await readFlow();
    const node1 = flow1.nodes[0];

    await executeToolCalls([
      { name: 'addNode', params: { label: 'Second Node' } }
    ]);

    const flow2 = await readFlow();
    const node2 = flow2.nodes[1];

    await executeToolCalls([
      { name: 'addEdge', params: { sourceNodeId: node1.id, targetNodeId: node2.id } }
    ]);

    const finalFlow = await readFlow();
    expect(finalFlow.edges).toHaveLength(1);
    expect(finalFlow.edges[0].data).toBeUndefined(); // No label means no data object
  });

  it('should maintain data integrity across 100+ nodes', async () => {
    // Create large flow
    const toolCalls = [];
    for (let i = 0; i < 100; i++) {
      toolCalls.push({
        name: 'addNode',
        params: { label: `Node ${i}`, description: `Description ${i}` }
      });
    }

    const results = await executeToolCalls(toolCalls);
    expect(results.every(r => r.success)).toBe(true);

    // Verify all nodes persisted
    const flow = await readFlow();
    expect(flow.nodes).toHaveLength(100);

    // Spot check some nodes
    expect(flow.nodes[0].data.label).toBe('Node 0');
    expect(flow.nodes[49].data.label).toBe('Node 49');
    expect(flow.nodes[99].data.label).toBe('Node 99');
    expect(flow.nodes[99].data.description).toBe('Description 99');
  });
});
