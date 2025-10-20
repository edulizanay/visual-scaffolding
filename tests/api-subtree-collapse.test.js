// ABOUTME: Tests for toggleSubtreeCollapse executor and API endpoint
// ABOUTME: Covers backend subtree collapse functionality added in Phase 2
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { closeDb, getDb } from '../server/db.js';
import app from '../server/app.js';
import { executeTool } from '../server/tools/executor.js';

describe('toggleSubtreeCollapse executor', () => {
  beforeEach(() => {
    process.env.DB_PATH = ':memory:';
  });

  afterEach(() => {
    closeDb();
  });

  it('should return error when nodeId is missing', async () => {
    const flow = { nodes: [], edges: [] };
    const result = await executeTool('toggleSubtreeCollapse', { collapsed: true }, flow);

    expect(result.success).toBe(false);
    expect(result.error).toContain('nodeId is required');
  });

  it('should return error when collapsed is not boolean', async () => {
    const flow = { nodes: [{ id: 'a' }], edges: [] };
    const result = await executeTool('toggleSubtreeCollapse', { nodeId: 'a' }, flow);

    expect(result.success).toBe(false);
    expect(result.error).toContain('collapsed must be a boolean');
  });

  it('should return error when node not found', async () => {
    const flow = { nodes: [{ id: 'a' }], edges: [] };
    const result = await executeTool('toggleSubtreeCollapse', { nodeId: 'nonexistent', collapsed: true }, flow);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should collapse subtree successfully', async () => {
    const flow = {
      nodes: [
        { id: 'a', data: {}, position: { x: 0, y: 0 } },
        { id: 'b', data: {}, position: { x: 100, y: 0 } },
        { id: 'c', data: {}, position: { x: 200, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
      ],
    };

    const result = await executeTool('toggleSubtreeCollapse', { nodeId: 'a', collapsed: true }, flow);

    expect(result.success).toBe(true);
    expect(result.updatedFlow).toBeDefined();

    const parentNode = result.updatedFlow.nodes.find(n => n.id === 'a');
    const childB = result.updatedFlow.nodes.find(n => n.id === 'b');
    const childC = result.updatedFlow.nodes.find(n => n.id === 'c');

    expect(parentNode.data.collapsed).toBe(true);
    expect(childB.hidden).toBe(true);
    expect(childB.subtreeHidden).toBe(true);
    expect(childC.hidden).toBe(true);
    expect(childC.subtreeHidden).toBe(true);

    const edge1 = result.updatedFlow.edges.find(e => e.id === 'e1');
    const edge2 = result.updatedFlow.edges.find(e => e.id === 'e2');
    expect(edge1.hidden).toBe(true);
    expect(edge2.hidden).toBe(true);
  });

  it('should expand collapsed subtree successfully', async () => {
    const flow = {
      nodes: [
        { id: 'a', data: { collapsed: true }, position: { x: 0, y: 0 } },
        { id: 'b', data: {}, hidden: true, subtreeHidden: true, position: { x: 100, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b', hidden: true },
      ],
    };

    const result = await executeTool('toggleSubtreeCollapse', { nodeId: 'a', collapsed: false }, flow);

    expect(result.success).toBe(true);

    const parentNode = result.updatedFlow.nodes.find(n => n.id === 'a');
    const childB = result.updatedFlow.nodes.find(n => n.id === 'b');

    expect(parentNode.data.collapsed).toBe(false);
    expect(childB.hidden).toBe(false);
    expect(childB.subtreeHidden).toBeUndefined();

    const edge1 = result.updatedFlow.edges.find(e => e.id === 'e1');
    expect(edge1.hidden).toBe(false);
  });

  it('should handle branching hierarchies', async () => {
    const flow = {
      nodes: [
        { id: 'root', data: {}, position: { x: 0, y: 0 } },
        { id: 'child1', data: {}, position: { x: 100, y: 0 } },
        { id: 'child2', data: {}, position: { x: 100, y: 100 } },
        { id: 'grandchild1', data: {}, position: { x: 200, y: 0 } },
      ],
      edges: [
        { source: 'root', target: 'child1' },
        { source: 'root', target: 'child2' },
        { source: 'child1', target: 'grandchild1' },
      ],
    };

    const result = await executeTool('toggleSubtreeCollapse', { nodeId: 'root', collapsed: true }, flow);

    expect(result.success).toBe(true);

    const child1 = result.updatedFlow.nodes.find(n => n.id === 'child1');
    const child2 = result.updatedFlow.nodes.find(n => n.id === 'child2');
    const grandchild1 = result.updatedFlow.nodes.find(n => n.id === 'grandchild1');

    expect(child1.hidden).toBe(true);
    expect(child2.hidden).toBe(true);
    expect(grandchild1.hidden).toBe(true);
  });
});

describe('PUT /api/flow/subtree/:id/collapse endpoint', () => {
  beforeEach(() => {
    process.env.DB_PATH = ':memory:';

    // Initialize with test flow
    const db = getDb();
    const initialFlow = {
      nodes: [
        { id: 'a', data: {}, position: { x: 0, y: 0 } },
        { id: 'b', data: {}, position: { x: 100, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
      ],
    };
    db.prepare('INSERT OR REPLACE INTO flows (user_id, name, data) VALUES (?, ?, ?)').run(
      'default',
      'main',
      JSON.stringify(initialFlow)
    );
  });

  afterEach(() => {
    closeDb();
  });

  it('should collapse subtree via API', async () => {
    const response = await request(app)
      .put('/api/flow/subtree/a/collapse')
      .send({ collapsed: true })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.flow).toBeDefined();

    const parentNode = response.body.flow.nodes.find(n => n.id === 'a');
    const childNode = response.body.flow.nodes.find(n => n.id === 'b');

    expect(parentNode.data.collapsed).toBe(true);
    expect(childNode.hidden).toBe(true);
  });

  it('should expand subtree via API', async () => {
    // First collapse
    await request(app)
      .put('/api/flow/subtree/a/collapse')
      .send({ collapsed: true });

    // Then expand
    const response = await request(app)
      .put('/api/flow/subtree/a/collapse')
      .send({ collapsed: false })
      .expect(200);

    expect(response.body.success).toBe(true);

    const parentNode = response.body.flow.nodes.find(n => n.id === 'a');
    const childNode = response.body.flow.nodes.find(n => n.id === 'b');

    expect(parentNode.data.collapsed).toBe(false);
    expect(childNode.hidden).toBe(false);
  });

  it('should return 400 when collapsed is not boolean', async () => {
    const response = await request(app)
      .put('/api/flow/subtree/a/collapse')
      .send({ collapsed: 'true' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('must be a boolean');
  });

  it('should return 400 when node not found', async () => {
    const response = await request(app)
      .put('/api/flow/subtree/nonexistent/collapse')
      .send({ collapsed: true })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('not found');
  });

  it('should create snapshot with operation', async () => {
    const db = getDb();

    // Get initial snapshot count
    const beforeCount = db.prepare('SELECT COUNT(*) as count FROM undo_history').get().count;

    // Collapse subtree
    await request(app)
      .put('/api/flow/subtree/a/collapse')
      .send({ collapsed: true })
      .expect(200);

    // Check snapshot was created
    const afterCount = db.prepare('SELECT COUNT(*) as count FROM undo_history').get().count;
    expect(afterCount).toBe(beforeCount + 1);
  });
});
