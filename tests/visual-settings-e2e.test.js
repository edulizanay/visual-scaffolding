// ABOUTME: End-to-end tests for visual settings changes via LLM
// ABOUTME: Tests LLM parsing, tool execution, and rendering of visual changes

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { executeToolCalls } from '../server/tools/executor.js';
import { closeDb, getVisualSettings } from '../server/db.js';
import { DEFAULT_VISUAL_SETTINGS } from '../shared/visualSettings.js';

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

describe('Visual Settings - Background Colors', () => {
  it('should change background to hex color', async () => {
    const result = await executeTool('changeVisuals', {
      target: 'background',
      color: '#ff0000',
    });

    expect(result.success).toBe(true);
    const settings = getVisualSettings();
    expect(settings.colors.background).toBe('#ff0000');
  });

  it('should change background to gradient', async () => {
    const gradient = 'linear-gradient(180deg, #000000 0%, #ffffff 100%)';
    const result = await executeTool('changeVisuals', {
      target: 'background',
      color: gradient,
    });

    expect(result.success).toBe(true);
    const settings = getVisualSettings();
    expect(settings.colors.background).toBe(gradient);
  });

  it('should change background to named color', async () => {
    const result = await executeTool('changeVisuals', {
      target: 'background',
      color: 'navy',
    });

    expect(result.success).toBe(true);
    const settings = getVisualSettings();
    expect(settings.colors.background).toBe('navy');
  });

  it('should change background to rgba color', async () => {
    const result = await executeTool('changeVisuals', {
      target: 'background',
      color: 'rgba(255, 0, 0, 0.5)',
    });

    expect(result.success).toBe(true);
    const settings = getVisualSettings();
    expect(settings.colors.background).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('should reject invalid color value', async () => {
    const result = await executeTool('changeVisuals', {
      target: 'background',
      color: 'not-a-color',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid color');
  });
});

describe('Visual Settings - All Nodes Colors', () => {
  it('should change all nodes background color', async () => {
    const result = await executeTool('changeVisuals', {
      target: 'all_nodes',
      color: '#00ff00',
      property: 'background',
    });

    expect(result.success).toBe(true);
    const settings = getVisualSettings();
    expect(settings.colors.allNodes.background).toBe('#00ff00');
  });

  it('should change all nodes border color', async () => {
    const result = await executeTool('changeVisuals', {
      target: 'all_nodes',
      color: '#0000ff',
      property: 'border',
    });

    expect(result.success).toBe(true);
    const settings = getVisualSettings();
    expect(settings.colors.allNodes.border).toBe('#0000ff');
  });

  it('should change all nodes text color', async () => {
    const result = await executeTool('changeVisuals', {
      target: 'all_nodes',
      color: 'yellow',
      property: 'text',
    });

    expect(result.success).toBe(true);
    const settings = getVisualSettings();
    expect(settings.colors.allNodes.text).toBe('yellow');
  });

  it('should default to background property when omitted', async () => {
    const result = await executeTool('changeVisuals', {
      target: 'all_nodes',
      color: '#ff00ff',
    });

    expect(result.success).toBe(true);
    const settings = getVisualSettings();
    expect(settings.colors.allNodes.background).toBe('#ff00ff');
  });

  it('should preserve other color properties when changing one', async () => {
    // Set initial colors
    await executeTool('changeVisuals', {
      target: 'all_nodes',
      color: '#111111',
      property: 'background',
    });
    await executeTool('changeVisuals', {
      target: 'all_nodes',
      color: '#222222',
      property: 'border',
    });

    // Change text color
    await executeTool('changeVisuals', {
      target: 'all_nodes',
      color: '#333333',
      property: 'text',
    });

    const settings = getVisualSettings();
    expect(settings.colors.allNodes.background).toBe('#111111');
    expect(settings.colors.allNodes.border).toBe('#222222');
    expect(settings.colors.allNodes.text).toBe('#333333');
  });
});

describe('Visual Settings - Individual Node Colors', () => {
  it('should change specific node background color', async () => {
    const { nodeId } = await executeTool('addNode', { label: 'Test Node' });

    const result = await executeTool('changeVisuals', {
      target: 'node',
      nodeId,
      color: '#ff5500',
      property: 'background',
    });

    expect(result.success).toBe(true);
    const settings = getVisualSettings();
    expect(settings.colors.perNode[nodeId].background).toBe('#ff5500');
  });

  it('should change specific node text color', async () => {
    const { nodeId } = await executeTool('addNode', { label: 'Test Node' });

    const result = await executeTool('changeVisuals', {
      target: 'node',
      nodeId,
      color: 'cyan',
      property: 'text',
    });

    expect(result.success).toBe(true);
    const settings = getVisualSettings();
    expect(settings.colors.perNode[nodeId].text).toBe('cyan');
  });

  it('should change specific node border color', async () => {
    const { nodeId } = await executeTool('addNode', { label: 'Test Node' });

    const result = await executeTool('changeVisuals', {
      target: 'node',
      nodeId,
      color: 'rgba(100, 100, 100, 0.8)',
      property: 'border',
    });

    expect(result.success).toBe(true);
    const settings = getVisualSettings();
    expect(settings.colors.perNode[nodeId].border).toBe('rgba(100, 100, 100, 0.8)');
  });

  it('should fail when node does not exist', async () => {
    const result = await executeTool('changeVisuals', {
      target: 'node',
      nodeId: 'nonexistent',
      color: '#ff0000',
      property: 'background',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should require nodeId when target is node', async () => {
    const result = await executeTool('changeVisuals', {
      target: 'node',
      color: '#ff0000',
      property: 'background',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('nodeId is required');
  });

  it('should allow multiple nodes to have different colors', async () => {
    const { nodeId: node1 } = await executeTool('addNode', { label: 'Node 1' });
    const { nodeId: node2 } = await executeTool('addNode', { label: 'Node 2' });
    const { nodeId: node3 } = await executeTool('addNode', { label: 'Node 3' });

    await executeTool('changeVisuals', {
      target: 'node',
      nodeId: node1,
      color: '#ff0000',
      property: 'background',
    });

    await executeTool('changeVisuals', {
      target: 'node',
      nodeId: node2,
      color: '#00ff00',
      property: 'background',
    });

    await executeTool('changeVisuals', {
      target: 'node',
      nodeId: node3,
      color: '#0000ff',
      property: 'background',
    });

    const settings = getVisualSettings();
    expect(settings.colors.perNode[node1].background).toBe('#ff0000');
    expect(settings.colors.perNode[node2].background).toBe('#00ff00');
    expect(settings.colors.perNode[node3].background).toBe('#0000ff');
  });
});

describe('Visual Settings - Node Dimensions', () => {
  it('should increase all nodes width', async () => {
    const initial = getVisualSettings();
    const initialWidth = initial.dimensions.node.default.width;

    const result = await executeTool('changeDimensions', {
      target: 'all_nodes',
      direction: 'increase',
      axis: 'horizontal',
    });

    expect(result.success).toBe(true);
    const updated = getVisualSettings();
    const expectedWidth = Math.round(initialWidth * 1.1 * 100) / 100;
    expect(updated.dimensions.node.default.width).toBe(expectedWidth);
  });

  it('should decrease all nodes height', async () => {
    const initial = getVisualSettings();
    const initialHeight = initial.dimensions.node.default.height;

    const result = await executeTool('changeDimensions', {
      target: 'all_nodes',
      direction: 'decrease',
      axis: 'vertical',
    });

    expect(result.success).toBe(true);
    const updated = getVisualSettings();
    const expectedHeight = Math.round(initialHeight * 0.9 * 100) / 100;
    expect(updated.dimensions.node.default.height).toBe(expectedHeight);
  });

  it('should change both width and height when axis is both', async () => {
    const initial = getVisualSettings();
    const initialWidth = initial.dimensions.node.default.width;
    const initialHeight = initial.dimensions.node.default.height;

    const result = await executeTool('changeDimensions', {
      target: 'all_nodes',
      direction: 'increase',
      axis: 'both',
    });

    expect(result.success).toBe(true);
    const updated = getVisualSettings();
    expect(updated.dimensions.node.default.width).toBe(Math.round(initialWidth * 1.1 * 100) / 100);
    expect(updated.dimensions.node.default.height).toBe(Math.round(initialHeight * 1.1 * 100) / 100);
  });

  it('should change specific node dimensions', async () => {
    const { nodeId } = await executeTool('addNode', { label: 'Big Node' });
    const initial = getVisualSettings();
    const baseWidth = initial.dimensions.node.default.width;

    const result = await executeTool('changeDimensions', {
      target: 'node',
      nodeId,
      direction: 'increase',
      axis: 'horizontal',
    });

    expect(result.success).toBe(true);
    const updated = getVisualSettings();
    const expectedWidth = Math.round(baseWidth * 1.1 * 100) / 100;
    expect(updated.dimensions.node.overrides[nodeId].width).toBe(expectedWidth);
  });

  it('should respect min and max width constraints', async () => {
    // Decrease many times
    for (let i = 0; i < 50; i++) {
      await executeTool('changeDimensions', {
        target: 'all_nodes',
        direction: 'decrease',
        axis: 'horizontal',
      });
    }

    let settings = getVisualSettings();
    expect(settings.dimensions.node.default.width).toBeGreaterThanOrEqual(60);

    // Increase many times
    for (let i = 0; i < 50; i++) {
      await executeTool('changeDimensions', {
        target: 'all_nodes',
        direction: 'increase',
        axis: 'horizontal',
      });
    }

    settings = getVisualSettings();
    expect(settings.dimensions.node.default.width).toBeLessThanOrEqual(600);
  });

  it('should respect min and max height constraints', async () => {
    // Decrease many times
    for (let i = 0; i < 50; i++) {
      await executeTool('changeDimensions', {
        target: 'all_nodes',
        direction: 'decrease',
        axis: 'vertical',
      });
    }

    let settings = getVisualSettings();
    expect(settings.dimensions.node.default.height).toBeGreaterThanOrEqual(24);

    // Increase many times
    for (let i = 0; i < 50; i++) {
      await executeTool('changeDimensions', {
        target: 'all_nodes',
        direction: 'increase',
        axis: 'vertical',
      });
    }

    settings = getVisualSettings();
    expect(settings.dimensions.node.default.height).toBeLessThanOrEqual(320);
  });
});


describe('Visual Settings - Layout Spacing', () => {
  it('should increase horizontal layout spacing', async () => {
    const initial = getVisualSettings();
    const initialSpacing = initial.dimensions.dagre.horizontal;

    const result = await executeTool('changeDimensions', {
      target: 'layout_spacing',
      direction: 'increase',
      axis: 'horizontal',
    });

    expect(result.success).toBe(true);
    const updated = getVisualSettings();
    const expectedSpacing = Math.round(initialSpacing * 1.1 * 100) / 100;
    expect(updated.dimensions.dagre.horizontal).toBe(expectedSpacing);
  });

  it('should decrease vertical layout spacing', async () => {
    const initial = getVisualSettings();
    const initialSpacing = initial.dimensions.dagre.vertical;

    const result = await executeTool('changeDimensions', {
      target: 'layout_spacing',
      direction: 'decrease',
      axis: 'vertical',
    });

    expect(result.success).toBe(true);
    const updated = getVisualSettings();
    const expectedSpacing = Math.round(initialSpacing * 0.9 * 100) / 100;
    expect(updated.dimensions.dagre.vertical).toBe(expectedSpacing);
  });

  it('should change both horizontal and vertical spacing', async () => {
    const initial = getVisualSettings();
    const initialH = initial.dimensions.dagre.horizontal;
    const initialV = initial.dimensions.dagre.vertical;

    const result = await executeTool('changeDimensions', {
      target: 'layout_spacing',
      direction: 'increase',
      axis: 'both',
    });

    expect(result.success).toBe(true);
    const updated = getVisualSettings();
    expect(updated.dimensions.dagre.horizontal).toBe(Math.round(initialH * 1.1 * 100) / 100);
    expect(updated.dimensions.dagre.vertical).toBe(Math.round(initialV * 1.1 * 100) / 100);
  });

  it('should respect spacing constraints', async () => {
    // Decrease many times
    for (let i = 0; i < 30; i++) {
      await executeTool('changeDimensions', {
        target: 'layout_spacing',
        direction: 'decrease',
        axis: 'both',
      });
    }

    let settings = getVisualSettings();
    expect(settings.dimensions.dagre.horizontal).toBeGreaterThanOrEqual(10);
    expect(settings.dimensions.dagre.vertical).toBeGreaterThanOrEqual(10);

    // Increase many times
    for (let i = 0; i < 50; i++) {
      await executeTool('changeDimensions', {
        target: 'layout_spacing',
        direction: 'increase',
        axis: 'both',
      });
    }

    settings = getVisualSettings();
    expect(settings.dimensions.dagre.horizontal).toBeLessThanOrEqual(400);
    expect(settings.dimensions.dagre.vertical).toBeLessThanOrEqual(400);
  });
});

describe('Visual Settings - Batch Operations', () => {
  it('should apply multiple visual changes in sequence', async () => {
    const { nodeId: node1 } = await executeTool('addNode', { label: 'Node 1' });
    const { nodeId: node2 } = await executeTool('addNode', { label: 'Node 2' });

    const toolCalls = [
      {
        name: 'changeVisuals',
        params: { target: 'background', color: '#000000' }
      },
      {
        name: 'changeVisuals',
        params: { target: 'all_nodes', color: '#ffffff', property: 'text' }
      },
      {
        name: 'changeVisuals',
        params: { target: 'node', nodeId: node1, color: 'red', property: 'background' }
      },
      {
        name: 'changeVisuals',
        params: { target: 'node', nodeId: node2, color: 'blue', property: 'background' }
      },
    ];

    const results = await executeToolCalls(toolCalls);

    expect(results).toHaveLength(4);
    expect(results.every(r => r.success)).toBe(true);

    const settings = getVisualSettings();
    expect(settings.colors.background).toBe('#000000');
    expect(settings.colors.allNodes.text).toBe('#ffffff');
    expect(settings.colors.perNode[node1].background).toBe('red');
    expect(settings.colors.perNode[node2].background).toBe('blue');
  });

  it('should handle mixed success and failure in batch', async () => {
    const { nodeId } = await executeTool('addNode', { label: 'Valid Node' });

    const toolCalls = [
      {
        name: 'changeVisuals',
        params: { target: 'background', color: '#ffffff' }
      },
      {
        name: 'changeVisuals',
        params: { target: 'node', nodeId: 'invalid', color: 'red', property: 'background' }
      },
      {
        name: 'changeVisuals',
        params: { target: 'node', nodeId, color: 'green', property: 'background' }
      },
    ];

    const results = await executeToolCalls(toolCalls);

    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[2].success).toBe(true);

    const settings = getVisualSettings();
    expect(settings.colors.background).toBe('#ffffff');
    expect(settings.colors.perNode[nodeId].background).toBe('green');
  });
});

describe('Visual Settings - Persistence', () => {
  it('should persist visual settings across operations', async () => {
    await executeTool('changeVisuals', {
      target: 'background',
      color: '#123456',
    });

    await executeTool('addNode', { label: 'Test Node' });

    const settings = getVisualSettings();
    expect(settings.colors.background).toBe('#123456');
  });

  it('should preserve node color overrides when modifying global colors', async () => {
    const { nodeId } = await executeTool('addNode', { label: 'Special Node' });

    await executeTool('changeVisuals', {
      target: 'node',
      nodeId,
      color: '#ff0000',
      property: 'background',
    });

    await executeTool('changeVisuals', {
      target: 'all_nodes',
      color: '#00ff00',
      property: 'background',
    });

    const settings = getVisualSettings();
    expect(settings.colors.allNodes.background).toBe('#00ff00');
    expect(settings.colors.perNode[nodeId].background).toBe('#ff0000');
  });

  it('should preserve dimension overrides when modifying defaults', async () => {
    const { nodeId } = await executeTool('addNode', { label: 'Custom Size' });

    await executeTool('changeDimensions', {
      target: 'node',
      nodeId,
      direction: 'increase',
      axis: 'horizontal',
    });

    const beforeGlobal = getVisualSettings();
    const customWidth = beforeGlobal.dimensions.node.overrides[nodeId].width;

    await executeTool('changeDimensions', {
      target: 'all_nodes',
      direction: 'decrease',
      axis: 'horizontal',
    });

    const afterGlobal = getVisualSettings();
    expect(afterGlobal.dimensions.node.overrides[nodeId].width).toBe(customWidth);
  });
});
