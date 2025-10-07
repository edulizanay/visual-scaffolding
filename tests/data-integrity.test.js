// ABOUTME: Tests data integrity and roundtrip correctness for flow persistence
// ABOUTME: Ensures no data loss or corruption during save/load cycles

import { describe, it, expect, beforeEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFlow, writeFlow } from '../server/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_FLOW_PATH = join(__dirname, 'test-data', 'test-data-integrity-flow.json');
const TEST_HISTORY_PATH = join(__dirname, 'test-data', 'test-data-integrity-history.json');

beforeEach(async () => {
  process.env.FLOW_DATA_PATH = TEST_FLOW_PATH;
  process.env.HISTORY_DATA_PATH = TEST_HISTORY_PATH;
  await fs.mkdir(dirname(TEST_FLOW_PATH), { recursive: true });
  await fs.writeFile(TEST_FLOW_PATH, JSON.stringify({ nodes: [], edges: [] }, null, 2));
  await fs.writeFile(TEST_HISTORY_PATH, JSON.stringify({ states: [], currentIndex: -1 }, null, 2));
});

describe('Data Integrity', () => {
  it('should preserve exact flow structure in roundtrip', async () => {
    const originalFlow = {
      nodes: [
        {
          id: 'node_1',
          position: { x: 100, y: 200 },
          data: { label: 'Test Node', description: 'Test Description' },
          type: 'default',
          sourcePosition: 'right',
          targetPosition: 'left'
        },
        {
          id: 'node_2',
          position: { x: 300, y: 200 },
          data: { label: 'Second Node' }
        }
      ],
      edges: [
        {
          id: 'edge_1',
          source: 'node_1',
          target: 'node_2',
          data: { label: 'connects' }
        }
      ]
    };

    // Save and load
    await writeFlow(originalFlow, true); // skipSnapshot = true
    const loadedFlow = await readFlow();

    // Verify exact match
    expect(loadedFlow.nodes).toHaveLength(originalFlow.nodes.length);
    expect(loadedFlow.edges).toHaveLength(originalFlow.edges.length);

    // Deep equality check on first node
    expect(loadedFlow.nodes[0].id).toBe(originalFlow.nodes[0].id);
    expect(loadedFlow.nodes[0].position).toEqual(originalFlow.nodes[0].position);
    expect(loadedFlow.nodes[0].data).toEqual(originalFlow.nodes[0].data);

    // Edge data preserved
    expect(loadedFlow.edges[0].data.label).toBe('connects');
  });

  it('should handle unicode and emoji characters correctly', async () => {
    const flowWithUnicode = {
      nodes: [
        {
          id: '1',
          position: { x: 0, y: 0 },
          data: {
            label: '🎉 Celebration Node 🚀',
            description: 'Unicode: café, naïve, 日本語, 한국어, العربية'
          }
        },
        {
          id: '2',
          position: { x: 100, y: 100 },
          data: {
            label: 'Math symbols: ∑∫∂∆∇',
            description: 'Arrows: ←↑→↓↔↕'
          }
        }
      ],
      edges: [
        {
          id: 'e1',
          source: '1',
          target: '2',
          data: { label: '→ Flow →' }
        }
      ]
    };

    await writeFlow(flowWithUnicode, true);
    const loaded = await readFlow();

    // Verify all unicode preserved
    expect(loaded.nodes[0].data.label).toBe('🎉 Celebration Node 🚀');
    expect(loaded.nodes[0].data.description).toContain('日本語');
    expect(loaded.nodes[1].data.label).toContain('∑∫∂');
    expect(loaded.edges[0].data.label).toBe('→ Flow →');
  });

  it('should handle special JSON characters correctly', async () => {
    const flowWithSpecialChars = {
      nodes: [
        {
          id: 'test_1',
          position: { x: 0, y: 0 },
          data: {
            label: 'Quotes: "double" and \'single\'',
            description: 'Backslash: \\ and forward: /'
          }
        },
        {
          id: 'test_2',
          position: { x: 0, y: 0 },
          data: {
            label: 'Newline:\nTab:\tCarriage:\r',
            description: 'Null char test'
          }
        }
      ],
      edges: []
    };

    await writeFlow(flowWithSpecialChars, true);
    const loaded = await readFlow();

    expect(loaded.nodes[0].data.label).toBe('Quotes: "double" and \'single\'');
    expect(loaded.nodes[0].data.description).toBe('Backslash: \\ and forward: /');
    expect(loaded.nodes[1].data.label).toContain('\n');
    expect(loaded.nodes[1].data.label).toContain('\t');
  });

  it('should preserve null vs undefined vs empty string', async () => {
    const flowWithNulls = {
      nodes: [
        {
          id: '1',
          position: { x: 0, y: 0 },
          data: {
            label: 'Has Label',
            description: '' // Empty string
          }
        },
        {
          id: '2',
          position: { x: 0, y: 0 },
          data: {
            label: 'No Description'
            // description is undefined (not present)
          }
        }
      ],
      edges: [
        {
          id: 'e1',
          source: '1',
          target: '2'
          // No data property (undefined)
        },
        {
          id: 'e2',
          source: '2',
          target: '1',
          data: { label: '' } // Empty string label
        }
      ]
    };

    await writeFlow(flowWithNulls, true);
    const loaded = await readFlow();

    // Empty string should be preserved
    expect(loaded.nodes[0].data.description).toBe('');

    // Undefined description should remain undefined
    expect(loaded.nodes[1].data.description).toBeUndefined();

    // Edge without data should have no data property
    expect(loaded.edges[0].data).toBeUndefined();

    // Edge with empty label should preserve it
    expect(loaded.edges[1].data.label).toBe('');
  });

  it('should handle deeply nested React Flow properties', async () => {
    const complexFlow = {
      nodes: [
        {
          id: 'complex_1',
          position: { x: 150.5, y: 250.75 }, // Float positions
          data: {
            label: 'Complex Node',
            description: 'Multi-line\ndescription\nwith breaks'
          },
          type: 'custom',
          sourcePosition: 'right',
          targetPosition: 'left',
          measured: { width: 150, height: 57 },
          selected: false,
          dragging: false
        }
      ],
      edges: [
        {
          id: 'complex_edge',
          source: 'complex_1',
          target: 'complex_1', // Self-loop
          type: 'smoothstep',
          animated: true,
          data: { label: 'Self Reference' }
        }
      ]
    };

    await writeFlow(complexFlow, true);
    const loaded = await readFlow();

    // Float precision preserved
    expect(loaded.nodes[0].position.x).toBe(150.5);
    expect(loaded.nodes[0].position.y).toBe(250.75);

    // All properties preserved
    expect(loaded.nodes[0].type).toBe('custom');
    expect(loaded.nodes[0].measured).toEqual({ width: 150, height: 57 });

    // Self-loop preserved
    expect(loaded.edges[0].source).toBe(loaded.edges[0].target);
  });

  it('should handle concurrent writes without corruption', async () => {
    // Simulate concurrent writes
    const flow1 = { nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Flow 1' } }], edges: [] };
    const flow2 = { nodes: [{ id: '2', position: { x: 0, y: 0 }, data: { label: 'Flow 2' } }], edges: [] };
    const flow3 = { nodes: [{ id: '3', position: { x: 0, y: 0 }, data: { label: 'Flow 3' } }], edges: [] };

    // Write concurrently
    await Promise.all([
      writeFlow(flow1, true),
      writeFlow(flow2, true),
      writeFlow(flow3, true)
    ]);

    // Final state should be one of the three (last write wins)
    const loaded = await readFlow();
    expect(loaded.nodes).toHaveLength(1);
    expect(['Flow 1', 'Flow 2', 'Flow 3']).toContain(loaded.nodes[0].data.label);

    // Verify file is valid JSON (not corrupted)
    const fileContent = await fs.readFile(TEST_FLOW_PATH, 'utf-8');
    expect(() => JSON.parse(fileContent)).not.toThrow();
  });

  it('should handle empty flow correctly', async () => {
    const emptyFlow = { nodes: [], edges: [] };

    await writeFlow(emptyFlow, true);
    const loaded = await readFlow();

    expect(loaded.nodes).toEqual([]);
    expect(loaded.edges).toEqual([]);
    expect(Array.isArray(loaded.nodes)).toBe(true);
    expect(Array.isArray(loaded.edges)).toBe(true);
  });

  it('should handle very long labels and descriptions', async () => {
    const longText = 'A'.repeat(10000); // 10k characters
    const veryLongFlow = {
      nodes: [
        {
          id: 'long_1',
          position: { x: 0, y: 0 },
          data: {
            label: longText,
            description: longText + ' description'
          }
        }
      ],
      edges: []
    };

    await writeFlow(veryLongFlow, true);
    const loaded = await readFlow();

    expect(loaded.nodes[0].data.label).toHaveLength(10000);
    expect(loaded.nodes[0].data.description).toHaveLength(10012); // 10000 + " description"
  });

  it('should preserve numeric IDs as strings', async () => {
    const flowWithNumericIds = {
      nodes: [
        { id: '123', position: { x: 0, y: 0 }, data: { label: 'Numeric ID' } },
        { id: '456', position: { x: 0, y: 0 }, data: { label: 'Another' } }
      ],
      edges: [
        { id: '789', source: '123', target: '456' }
      ]
    };

    await writeFlow(flowWithNumericIds, true);
    const loaded = await readFlow();

    // IDs should remain strings, not convert to numbers
    expect(typeof loaded.nodes[0].id).toBe('string');
    expect(loaded.nodes[0].id).toBe('123');
    expect(typeof loaded.edges[0].id).toBe('string');
    expect(loaded.edges[0].id).toBe('789');
  });
});
