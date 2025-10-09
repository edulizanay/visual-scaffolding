// ABOUTME: Edge case tests for parseToolCalls function
// ABOUTME: Tests multiple thinking tags, JSON comments, trailing commas, and large arrays
import { parseToolCalls } from '../../server/llm/llmService.js';

describe('parseToolCalls - Edge Cases', () => {
  describe('multiple thinking tags', () => {
    test('should use the first thinking tag when multiple exist', () => {
      const llmResponse = `
<thinking>
First thinking block - this should be used
</thinking>
<thinking>
Second thinking block - this should be ignored
</thinking>
<response>
[{"type": "tool_use", "id": "toolu_01", "name": "addNode", "input": {"label": "Test"}}]
</response>
      `;

      const result = parseToolCalls(llmResponse);

      expect(result.thinking).toContain('First thinking block');
      expect(result.thinking).not.toContain('Second thinking block');
      expect(result.toolCalls).toHaveLength(1);
      expect(result.parseError).toBeNull();
    });

    test('should handle thinking tag with response tag inside another thinking tag', () => {
      const llmResponse = `
<thinking>
Primary thought process here
</thinking>
<response>
[{"type": "tool_use", "id": "toolu_01", "name": "addNode", "input": {"label": "Node1"}}]
</response>
<thinking>
Additional thoughts after response
</thinking>
      `;

      const result = parseToolCalls(llmResponse);

      expect(result.thinking).toContain('Primary thought process');
      expect(result.toolCalls).toHaveLength(1);
      expect(result.parseError).toBeNull();
    });
  });

  describe('JSON with comments', () => {
    test('should strip single-line // comments from JSON', () => {
      const llmResponse = `
<thinking>
Adding node with comment
</thinking>
<response>
[
  // This is a comment that should be stripped
  {"type": "tool_use", "id": "toolu_01", "name": "addNode", "input": {"label": "Login"}}
]
</response>
      `;

      const result = parseToolCalls(llmResponse);

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('addNode');
      expect(result.toolCalls[0].params.label).toBe('Login');
      expect(result.parseError).toBeNull();
    });

    test('should strip inline // comments after JSON properties', () => {
      const llmResponse = `
<thinking>Test</thinking>
<response>
[
  {
    "type": "tool_use", // tool type
    "id": "toolu_01", // unique id
    "name": "addNode", // tool name
    "input": {"label": "Dashboard"} // parameters
  }
]
</response>
      `;

      const result = parseToolCalls(llmResponse);

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('addNode');
      expect(result.toolCalls[0].params.label).toBe('Dashboard');
      expect(result.parseError).toBeNull();
    });

    test('should handle multiple comments across different lines', () => {
      const llmResponse = `
<thinking>Multiple nodes with comments</thinking>
<response>
[
  // First node
  {"type": "tool_use", "id": "toolu_01", "name": "addNode", "input": {"label": "Start"}},
  // Second node
  {"type": "tool_use", "id": "toolu_02", "name": "addNode", "input": {"label": "End"}}
  // End of array
]
</response>
      `;

      const result = parseToolCalls(llmResponse);

      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls[0].params.label).toBe('Start');
      expect(result.toolCalls[1].params.label).toBe('End');
      expect(result.parseError).toBeNull();
    });
  });

  describe('trailing commas', () => {
    test('should handle trailing comma in array', () => {
      const llmResponse = `
<thinking>Node with trailing comma</thinking>
<response>
[
  {"type": "tool_use", "id": "toolu_01", "name": "addNode", "input": {"label": "Test"}},
]
</response>
      `;

      const result = parseToolCalls(llmResponse);

      // Note: Standard JSON.parse will fail on trailing commas
      // This test documents current behavior
      expect(result.parseError).toBeDefined();
      expect(result.parseError).toContain('Failed to parse');
      expect(result.toolCalls).toHaveLength(0);
    });

    test('should handle trailing comma in object properties', () => {
      const llmResponse = `
<thinking>Object with trailing comma</thinking>
<response>
[
  {
    "type": "tool_use",
    "id": "toolu_01",
    "name": "addNode",
    "input": {
      "label": "Login",
      "description": "Auth page",
    }
  }
]
</response>
      `;

      const result = parseToolCalls(llmResponse);

      // Standard JSON.parse will fail on trailing commas
      expect(result.parseError).toBeDefined();
      expect(result.parseError).toContain('Failed to parse');
      expect(result.toolCalls).toHaveLength(0);
    });

    test('should handle valid JSON without trailing commas', () => {
      const llmResponse = `
<thinking>Valid JSON</thinking>
<response>
[
  {
    "type": "tool_use",
    "id": "toolu_01",
    "name": "addNode",
    "input": {
      "label": "Dashboard",
      "description": "Main page"
    }
  }
]
</response>
      `;

      const result = parseToolCalls(llmResponse);

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].params.label).toBe('Dashboard');
      expect(result.parseError).toBeNull();
    });
  });

  describe('large arrays', () => {
    test('should handle 50+ tool calls without performance issues', () => {
      // Generate 50 tool calls
      const toolCalls = Array.from({ length: 50 }, (_, i) => ({
        type: 'tool_use',
        id: `toolu_${String(i).padStart(3, '0')}`,
        name: 'addNode',
        input: {
          label: `Node ${i}`,
          description: `Description for node ${i}`,
          parentNodeId: i > 0 ? String(i - 1) : undefined
        }
      }));

      const llmResponse = `
<thinking>
Creating 50 nodes for a large workflow
</thinking>
<response>
${JSON.stringify(toolCalls, null, 2)}
</response>
      `;

      const startTime = Date.now();
      const result = parseToolCalls(llmResponse);
      const duration = Date.now() - startTime;

      expect(result.toolCalls).toHaveLength(50);
      expect(result.toolCalls[0].params.label).toBe('Node 0');
      expect(result.toolCalls[49].params.label).toBe('Node 49');
      expect(result.parseError).toBeNull();

      // Should parse in under 100ms
      expect(duration).toBeLessThan(100);
    });

    test('should handle 100+ tool calls efficiently', () => {
      // Generate 100 tool calls
      const toolCalls = Array.from({ length: 100 }, (_, i) => ({
        type: 'tool_use',
        id: `toolu_${i}`,
        name: i % 2 === 0 ? 'addNode' : 'addEdge',
        input: i % 2 === 0
          ? { label: `Node ${i}` }
          : { source: String(i - 1), target: String(i + 1) }
      }));

      const llmResponse = `
<thinking>
Large workflow with 100 operations
</thinking>
<response>
${JSON.stringify(toolCalls)}
</response>
      `;

      const startTime = Date.now();
      const result = parseToolCalls(llmResponse);
      const duration = Date.now() - startTime;

      expect(result.toolCalls).toHaveLength(100);
      expect(result.toolCalls[0].name).toBe('addNode');
      expect(result.toolCalls[1].name).toBe('addEdge');
      expect(result.parseError).toBeNull();

      // Should still parse quickly even with 100 items
      expect(duration).toBeLessThan(200);
    });

    test('should handle deeply nested input objects in large arrays', () => {
      const toolCalls = Array.from({ length: 50 }, (_, i) => ({
        type: 'tool_use',
        id: `toolu_${i}`,
        name: 'addNode',
        input: {
          label: `Complex Node ${i}`,
          metadata: {
            author: 'system',
            timestamp: Date.now(),
            config: {
              nested: {
                property: {
                  deep: `value ${i}`
                }
              }
            }
          }
        }
      }));

      const llmResponse = `
<thinking>Complex nested structures</thinking>
<response>
${JSON.stringify(toolCalls)}
</response>
      `;

      const result = parseToolCalls(llmResponse);

      expect(result.toolCalls).toHaveLength(50);
      expect(result.toolCalls[0].params.metadata.config.nested.property.deep).toBe('value 0');
      expect(result.toolCalls[49].params.metadata.config.nested.property.deep).toBe('value 49');
      expect(result.parseError).toBeNull();
    });
  });
});
