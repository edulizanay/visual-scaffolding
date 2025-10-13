// ABOUTME: Tests XSS prevention in tool execution for malicious input
// ABOUTME: Verifies data is stored safely without sanitization - frontend MUST escape on render

// NOTE: These tests verify data is stored safely. Frontend MUST escape on render.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { executeToolCalls } from '../../server/tools/executor.js';
import { readFlow } from '../../server/server.js';
import { closeDb } from '../../server/db.js';

async function executeTool(toolName, params) {
  const results = await executeToolCalls([{ name: toolName, params }]);
  return results[0];
}

async function loadFlow() {
  return readFlow();
}

beforeEach(() => {
  process.env.DB_PATH = ':memory:';
});

afterEach(() => {
  closeDb();
});

describe('XSS Prevention - Node Labels', () => {
  it('should store node label with script tag as-is', async () => {
    const maliciousLabel = '<script>alert(\'xss\')</script>';

    const result = await executeTool('addNode', { label: maliciousLabel });

    expect(result.success).toBe(true);
    expect(result.nodeId).toBeDefined();

    const flow = await loadFlow();
    expect(flow.nodes).toHaveLength(1);
    expect(flow.nodes[0].data.label).toBe(maliciousLabel);
  });
});

describe('XSS Prevention - Edge Labels', () => {
  it('should store edge label with onclick attribute safely', async () => {
    const maliciousEdgeLabel = 'onclick="alert(\'xss\')"';

    // Create two nodes first
    const source = await executeTool('addNode', { label: 'Source' });
    const target = await executeTool('addNode', { label: 'Target' });

    // Create edge with malicious label
    const result = await executeTool('addEdge', {
      sourceNodeId: source.nodeId,
      targetNodeId: target.nodeId,
      label: maliciousEdgeLabel
    });

    expect(result.success).toBe(true);
    expect(result.edgeId).toBeDefined();

    const flow = await loadFlow();
    expect(flow.edges).toHaveLength(1);
    expect(flow.edges[0].data.label).toBe(maliciousEdgeLabel);
  });
});

describe('XSS Prevention - Node Descriptions', () => {
  it('should store node description with HTML containing img tag', async () => {
    const maliciousDescription = '<img src=x onerror=alert(1)>';

    const result = await executeTool('addNode', {
      label: 'Test Node',
      description: maliciousDescription
    });

    expect(result.success).toBe(true);
    expect(result.nodeId).toBeDefined();

    const flow = await loadFlow();
    expect(flow.nodes).toHaveLength(1);
    expect(flow.nodes[0].data.description).toBe(maliciousDescription);
  });
});
