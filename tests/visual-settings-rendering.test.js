// ABOUTME: Tests visual settings rendering logic from App.jsx
// ABOUTME: Validates that settings correctly transform into node/edge styles

import { describe, it, expect } from '@jest/globals';
import { DEFAULT_VISUAL_SETTINGS, mergeWithDefaultVisualSettings } from '../shared/visualSettings.js';

describe('Visual Settings - Merge Logic', () => {
  it('should return defaults when no overrides provided', () => {
    const result = mergeWithDefaultVisualSettings();
    expect(result).toEqual(DEFAULT_VISUAL_SETTINGS);
  });

  it('should merge background color override', () => {
    const overrides = {
      colors: {
        background: '#ff0000',
      }
    };

    const result = mergeWithDefaultVisualSettings(overrides);
    expect(result.colors.background).toBe('#ff0000');
    expect(result.colors.allNodes).toEqual(DEFAULT_VISUAL_SETTINGS.colors.allNodes);
  });

  it('should merge all nodes colors without affecting defaults', () => {
    const overrides = {
      colors: {
        allNodes: {
          background: '#00ff00',
          text: 'yellow',
        }
      }
    };

    const result = mergeWithDefaultVisualSettings(overrides);
    expect(result.colors.allNodes.background).toBe('#00ff00');
    expect(result.colors.allNodes.text).toBe('yellow');
    expect(result.colors.allNodes.border).toBe(DEFAULT_VISUAL_SETTINGS.colors.allNodes.border);
  });

  it('should merge per-node color overrides', () => {
    const overrides = {
      colors: {
        perNode: {
          'node-1': {
            background: 'red',
            text: 'white',
          },
          'node-2': {
            border: 'blue',
          }
        }
      }
    };

    const result = mergeWithDefaultVisualSettings(overrides);
    expect(result.colors.perNode['node-1'].background).toBe('red');
    expect(result.colors.perNode['node-1'].text).toBe('white');
    expect(result.colors.perNode['node-2'].border).toBe('blue');
  });

  it('should merge dimension defaults', () => {
    const overrides = {
      dimensions: {
        node: {
          default: {
            width: 200,
            height: 50,
          }
        }
      }
    };

    const result = mergeWithDefaultVisualSettings(overrides);
    expect(result.dimensions.node.default.width).toBe(200);
    expect(result.dimensions.node.default.height).toBe(50);
    expect(result.dimensions.node.default.borderRadius).toBe(DEFAULT_VISUAL_SETTINGS.dimensions.node.default.borderRadius);
  });

  it('should merge per-node dimension overrides', () => {
    const overrides = {
      dimensions: {
        node: {
          overrides: {
            'big-node': {
              width: 300,
              height: 100,
            }
          }
        }
      }
    };

    const result = mergeWithDefaultVisualSettings(overrides);
    expect(result.dimensions.node.overrides['big-node'].width).toBe(300);
    expect(result.dimensions.node.overrides['big-node'].height).toBe(100);
  });


  it('should merge dagre spacing', () => {
    const overrides = {
      dimensions: {
        dagre: {
          horizontal: 100,
          vertical: 75,
        }
      }
    };

    const result = mergeWithDefaultVisualSettings(overrides);
    expect(result.dimensions.dagre.horizontal).toBe(100);
    expect(result.dimensions.dagre.vertical).toBe(75);
  });

  it('should deep merge nested structures', () => {
    const overrides = {
      colors: {
        background: '#111111',
        allNodes: {
          text: 'cyan',
        },
        perNode: {
          'custom': {
            background: 'purple',
          }
        }
      },
      dimensions: {
        node: {
          default: {
            width: 150,
          }
        }
      }
    };

    const result = mergeWithDefaultVisualSettings(overrides);

    // Colors
    expect(result.colors.background).toBe('#111111');
    expect(result.colors.allNodes.text).toBe('cyan');
    expect(result.colors.allNodes.background).toBe(DEFAULT_VISUAL_SETTINGS.colors.allNodes.background);
    expect(result.colors.perNode['custom'].background).toBe('purple');

    // Dimensions
    expect(result.dimensions.node.default.width).toBe(150);
    expect(result.dimensions.node.default.height).toBe(DEFAULT_VISUAL_SETTINGS.dimensions.node.default.height);
  });

  it('should not mutate the default settings', () => {
    const originalDefaults = JSON.parse(JSON.stringify(DEFAULT_VISUAL_SETTINGS));

    const overrides = {
      colors: {
        background: '#999999',
      }
    };

    mergeWithDefaultVisualSettings(overrides);

    expect(DEFAULT_VISUAL_SETTINGS).toEqual(originalDefaults);
  });

  it('should not mutate the override object', () => {
    const overrides = {
      colors: {
        background: '#888888',
      }
    };

    const originalOverrides = JSON.parse(JSON.stringify(overrides));
    mergeWithDefaultVisualSettings(overrides);

    expect(overrides).toEqual(originalOverrides);
  });
});

describe('Visual Settings - Node Style Application', () => {
  // These tests simulate the logic in App.jsx that applies visual settings to nodes

  function applyVisualSettingsToNode(node, visualSettings) {
    const defaultNode = visualSettings.dimensions?.node?.default ?? DEFAULT_VISUAL_SETTINGS.dimensions.node.default;
    const overrides = visualSettings.dimensions?.node?.overrides ?? {};
    const globalColors = visualSettings.colors?.allNodes ?? DEFAULT_VISUAL_SETTINGS.colors.allNodes;
    const perNodeColors = visualSettings.colors?.perNode ?? {};

    const override = overrides[node.id] || {};
    const width = override.width ?? defaultNode.width;
    const height = override.height ?? defaultNode.height;
    const borderRadius = override.borderRadius ?? defaultNode.borderRadius;

    const nodeColorOverrides = perNodeColors[node.id] || {};
    const background = nodeColorOverrides.background ?? globalColors.background;
    const border = nodeColorOverrides.border ?? globalColors.border;
    const text = nodeColorOverrides.text ?? globalColors.text;

    return {
      ...node,
      style: {
        background,
        border: `1px solid ${border}`,
        color: text,
        width,
        minWidth: width,
        height,
        minHeight: height,
        borderRadius: `${borderRadius}px`,
      },
      data: {
        ...node.data,
        textColor: text,
      }
    };
  }

  it('should apply default styles to node without overrides', () => {
    const node = {
      id: 'test-node',
      data: { label: 'Test' },
    };

    const styledNode = applyVisualSettingsToNode(node, DEFAULT_VISUAL_SETTINGS);

    expect(styledNode.style.background).toBe(DEFAULT_VISUAL_SETTINGS.colors.allNodes.background);
    expect(styledNode.style.border).toBe(`1px solid ${DEFAULT_VISUAL_SETTINGS.colors.allNodes.border}`);
    expect(styledNode.style.color).toBe(DEFAULT_VISUAL_SETTINGS.colors.allNodes.text);
    expect(styledNode.style.width).toBe(DEFAULT_VISUAL_SETTINGS.dimensions.node.default.width);
    expect(styledNode.style.height).toBe(DEFAULT_VISUAL_SETTINGS.dimensions.node.default.height);
  });

  it('should apply global color changes to all nodes', () => {
    const node = {
      id: 'test-node',
      data: { label: 'Test' },
    };

    const settings = mergeWithDefaultVisualSettings({
      colors: {
        allNodes: {
          background: '#ff0000',
          border: '#00ff00',
          text: '#0000ff',
        }
      }
    });

    const styledNode = applyVisualSettingsToNode(node, settings);

    expect(styledNode.style.background).toBe('#ff0000');
    expect(styledNode.style.border).toBe('1px solid #00ff00');
    expect(styledNode.style.color).toBe('#0000ff');
    expect(styledNode.data.textColor).toBe('#0000ff');
  });

  it('should apply per-node color overrides', () => {
    const node = {
      id: 'special-node',
      data: { label: 'Special' },
    };

    const settings = mergeWithDefaultVisualSettings({
      colors: {
        allNodes: {
          background: '#ffffff',
          border: '#000000',
          text: '#333333',
        },
        perNode: {
          'special-node': {
            background: 'orange',
            text: 'purple',
          }
        }
      }
    });

    const styledNode = applyVisualSettingsToNode(node, settings);

    expect(styledNode.style.background).toBe('orange');
    expect(styledNode.style.border).toBe('1px solid #000000'); // Uses global border
    expect(styledNode.style.color).toBe('purple');
  });

  it('should apply dimension overrides to specific node', () => {
    const node = {
      id: 'big-node',
      data: { label: 'Big' },
    };

    const settings = mergeWithDefaultVisualSettings({
      dimensions: {
        node: {
          default: {
            width: 172,
            height: 36,
            borderRadius: 3,
          },
          overrides: {
            'big-node': {
              width: 300,
              height: 100,
            }
          }
        }
      }
    });

    const styledNode = applyVisualSettingsToNode(node, settings);

    expect(styledNode.style.width).toBe(300);
    expect(styledNode.style.height).toBe(100);
    expect(styledNode.style.borderRadius).toBe('3px'); // Uses default borderRadius
  });

  it('should handle multiple nodes with different settings', () => {
    const nodes = [
      { id: 'node-1', data: { label: 'First' } },
      { id: 'node-2', data: { label: 'Second' } },
      { id: 'node-3', data: { label: 'Third' } },
    ];

    const settings = mergeWithDefaultVisualSettings({
      colors: {
        allNodes: {
          background: '#111111',
          text: '#ffffff',
        },
        perNode: {
          'node-1': {
            background: 'red',
          },
          'node-3': {
            background: 'blue',
            text: 'yellow',
          }
        }
      },
      dimensions: {
        node: {
          overrides: {
            'node-2': {
              width: 250,
            }
          }
        }
      }
    });

    const styledNodes = nodes.map(node => applyVisualSettingsToNode(node, settings));

    // Node 1: custom background, global text
    expect(styledNodes[0].style.background).toBe('red');
    expect(styledNodes[0].style.color).toBe('#ffffff');
    expect(styledNodes[0].style.width).toBe(DEFAULT_VISUAL_SETTINGS.dimensions.node.default.width);

    // Node 2: global colors, custom width
    expect(styledNodes[1].style.background).toBe('#111111');
    expect(styledNodes[1].style.color).toBe('#ffffff');
    expect(styledNodes[1].style.width).toBe(250);

    // Node 3: custom background and text, default dimensions
    expect(styledNodes[2].style.background).toBe('blue');
    expect(styledNodes[2].style.color).toBe('yellow');
    expect(styledNodes[2].style.width).toBe(DEFAULT_VISUAL_SETTINGS.dimensions.node.default.width);
  });

  it('should preserve node data when applying styles', () => {
    const node = {
      id: 'test-node',
      data: {
        label: 'Test',
        description: 'Test description',
        customProp: 'custom value',
      },
      position: { x: 100, y: 200 },
    };

    const styledNode = applyVisualSettingsToNode(node, DEFAULT_VISUAL_SETTINGS);

    expect(styledNode.id).toBe('test-node');
    expect(styledNode.data.label).toBe('Test');
    expect(styledNode.data.description).toBe('Test description');
    expect(styledNode.data.customProp).toBe('custom value');
    expect(styledNode.position).toEqual({ x: 100, y: 200 });
  });
});

describe('Visual Settings - Background Application', () => {
  it('should use default background when not overridden', () => {
    const settings = mergeWithDefaultVisualSettings();
    const background = settings.colors?.background ?? DEFAULT_VISUAL_SETTINGS.colors.background;

    expect(background).toBe(DEFAULT_VISUAL_SETTINGS.colors.background);
  });

  it('should use overridden background color', () => {
    const settings = mergeWithDefaultVisualSettings({
      colors: {
        background: '#000000',
      }
    });

    const background = settings.colors?.background ?? DEFAULT_VISUAL_SETTINGS.colors.background;
    expect(background).toBe('#000000');
  });

  it('should support gradient backgrounds', () => {
    const gradient = 'linear-gradient(180deg, #ff0000 0%, #0000ff 100%)';
    const settings = mergeWithDefaultVisualSettings({
      colors: {
        background: gradient,
      }
    });

    const background = settings.colors?.background ?? DEFAULT_VISUAL_SETTINGS.colors.background;
    expect(background).toBe(gradient);
  });

  it('should support radial gradients', () => {
    const gradient = 'radial-gradient(circle, #ffffff 0%, #000000 100%)';
    const settings = mergeWithDefaultVisualSettings({
      colors: {
        background: gradient,
      }
    });

    const background = settings.colors?.background ?? DEFAULT_VISUAL_SETTINGS.colors.background;
    expect(background).toBe(gradient);
  });
});


describe('Visual Settings - Dagre Layout Spacing', () => {
  it('should use default spacing when not overridden', () => {
    const settings = mergeWithDefaultVisualSettings();

    expect(settings.dimensions.dagre.horizontal).toBe(DEFAULT_VISUAL_SETTINGS.dimensions.dagre.horizontal);
    expect(settings.dimensions.dagre.vertical).toBe(DEFAULT_VISUAL_SETTINGS.dimensions.dagre.vertical);
  });

  it('should use overridden horizontal spacing', () => {
    const settings = mergeWithDefaultVisualSettings({
      dimensions: {
        dagre: {
          horizontal: 100,
        }
      }
    });

    expect(settings.dimensions.dagre.horizontal).toBe(100);
    expect(settings.dimensions.dagre.vertical).toBe(DEFAULT_VISUAL_SETTINGS.dimensions.dagre.vertical);
  });

  it('should use overridden vertical spacing', () => {
    const settings = mergeWithDefaultVisualSettings({
      dimensions: {
        dagre: {
          vertical: 75,
        }
      }
    });

    expect(settings.dimensions.dagre.horizontal).toBe(DEFAULT_VISUAL_SETTINGS.dimensions.dagre.horizontal);
    expect(settings.dimensions.dagre.vertical).toBe(75);
  });

  it('should use overridden both spacing values', () => {
    const settings = mergeWithDefaultVisualSettings({
      dimensions: {
        dagre: {
          horizontal: 120,
          vertical: 80,
        }
      }
    });

    expect(settings.dimensions.dagre.horizontal).toBe(120);
    expect(settings.dimensions.dagre.vertical).toBe(80);
  });
});
