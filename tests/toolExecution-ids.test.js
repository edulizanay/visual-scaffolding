// ABOUTME: Tests for ID collision detection and sanitization in addNode
// ABOUTME: Validates custom ID conflicts, sanitized label collisions, and special character handling

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { executeToolCalls } from '../server/tools/executor.js';
import { readFlow } from '../server/server.js';
import { closeDb } from '../server/db.js';

async function executeTool(toolName, params) {
  const results = await executeToolCalls([{ name: toolName, params }]);
  return results[0];
}

beforeEach(() => {
  process.env.DB_PATH = ':memory:';
});

afterEach(() => {
  closeDb();
});

describe('ID Collision Detection', () => {
  it('should detect duplicate custom IDs', async () => {
    const result1 = await executeTool('addNode', { id: 'test1', label: 'First Node' });
    expect(result1.success).toBe(true);
    expect(result1.nodeId).toBe('test1');

    const result2 = await executeTool('addNode', { id: 'test1', label: 'Second Node' });
    expect(result2.success).toBe(false);
    expect(result2.error).toContain('test1');
    expect(result2.error).toContain('already exists');

    const flow = await readFlow();
    expect(flow.nodes).toHaveLength(1);
    expect(flow.nodes[0].data.label).toBe('First Node');
  });

  it('should detect sanitized label collision', async () => {
    const result1 = await executeTool('addNode', { label: 'Test Node' });
    expect(result1.success).toBe(true);
    expect(result1.nodeId).toBe('test_node');

    const result2 = await executeTool('addNode', { label: 'Test@Node' });
    expect(result2.success).toBe(false);
    expect(result2.error).toContain('test_node');
    expect(result2.error).toContain('already exists');

    const flow = await readFlow();
    expect(flow.nodes).toHaveLength(1);
    expect(flow.nodes[0].data.label).toBe('Test Node');
  });

  it('should sanitize special characters correctly', async () => {
    const result = await executeTool('addNode', { label: 'My@Node#123!' });
    expect(result.success).toBe(true);
    expect(result.nodeId).toBe('my_node_123');
    expect(result.nodeId).toMatch(/^[a-z0-9_]+$/);

    const flow = await readFlow();
    expect(flow.nodes).toHaveLength(1);
    expect(flow.nodes[0].id).toBe('my_node_123');
    expect(flow.nodes[0].data.label).toBe('My@Node#123!');
  });
});
