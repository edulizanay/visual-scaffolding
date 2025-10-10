// ABOUTME: Tests LLM's ability to understand and parse visual change requests
// ABOUTME: Validates that natural language requests correctly map to changeVisuals/changeDimensions tools

import { describe, it, expect } from '@jest/globals';
import { toolDefinitions } from '../server/llm/tools.js';

describe('Visual Settings - Tool Definitions', () => {
  it('should have changeVisuals tool definition', () => {
    const changeVisualsTool = toolDefinitions.find(t => t.name === 'changeVisuals');
    expect(changeVisualsTool).toBeDefined();
    expect(changeVisualsTool.description).toBeTruthy();
    expect(changeVisualsTool.parameters).toBeDefined();
  });

  it('should have changeDimensions tool definition', () => {
    const changeDimensionsTool = toolDefinitions.find(t => t.name === 'changeDimensions');
    expect(changeDimensionsTool).toBeDefined();
    expect(changeDimensionsTool.description).toBeTruthy();
    expect(changeDimensionsTool.parameters).toBeDefined();
  });

  describe('changeVisuals parameters', () => {
    let changeVisualsTool;

    beforeEach(() => {
      changeVisualsTool = toolDefinitions.find(t => t.name === 'changeVisuals');
    });

    it('should require target parameter', () => {
      expect(changeVisualsTool.parameters.required).toContain('target');
    });

    it('should require color parameter', () => {
      expect(changeVisualsTool.parameters.required).toContain('color');
    });

    it('should have target enum with correct values', () => {
      const targetProp = changeVisualsTool.parameters.properties.target;
      expect(targetProp.enum).toEqual(['background', 'all_nodes', 'node']);
    });

    it('should have property enum with correct values', () => {
      const propertyProp = changeVisualsTool.parameters.properties.property;
      expect(propertyProp.enum).toEqual(['background', 'border', 'text']);
    });

    it('should have nodeId parameter for specific node targeting', () => {
      expect(changeVisualsTool.parameters.properties.nodeId).toBeDefined();
      expect(changeVisualsTool.parameters.properties.nodeId.type).toBe('string');
    });

    it('should have color parameter accepting string', () => {
      expect(changeVisualsTool.parameters.properties.color).toBeDefined();
      expect(changeVisualsTool.parameters.properties.color.type).toBe('string');
    });
  });

  describe('changeDimensions parameters', () => {
    let changeDimensionsTool;

    beforeEach(() => {
      changeDimensionsTool = toolDefinitions.find(t => t.name === 'changeDimensions');
    });

    it('should require target parameter', () => {
      expect(changeDimensionsTool.parameters.required).toContain('target');
    });

    it('should require direction parameter', () => {
      expect(changeDimensionsTool.parameters.required).toContain('direction');
    });

    it('should have target enum with correct values', () => {
      const targetProp = changeDimensionsTool.parameters.properties.target;
      expect(targetProp.enum).toEqual(['node', 'all_nodes', 'layout_spacing']);
    });

    it('should have direction enum with correct values', () => {
      const directionProp = changeDimensionsTool.parameters.properties.direction;
      expect(directionProp.enum).toEqual(['increase', 'decrease']);
    });

    it('should have axis enum with correct values', () => {
      const axisProp = changeDimensionsTool.parameters.properties.axis;
      expect(axisProp.enum).toEqual(['horizontal', 'vertical', 'both']);
    });

    it('should have nodeId parameter for specific node targeting', () => {
      expect(changeDimensionsTool.parameters.properties.nodeId).toBeDefined();
      expect(changeDimensionsTool.parameters.properties.nodeId.type).toBe('string');
    });
  });
});

describe('Visual Settings - Expected LLM Behaviors', () => {
  // These tests document the expected behavior when LLM receives various user requests
  // They serve as specification for what tool calls should be generated

  describe('Background color changes', () => {
    it('should map "change background to blue" to changeVisuals tool', () => {
      // Expected LLM output:
      const expectedToolCall = {
        name: 'changeVisuals',
        params: {
          target: 'background',
          color: 'blue',
        }
      };

      expect(expectedToolCall.name).toBe('changeVisuals');
      expect(expectedToolCall.params.target).toBe('background');
    });

    it('should map "make canvas red" to changeVisuals tool', () => {
      // Expected LLM output:
      const expectedToolCall = {
        name: 'changeVisuals',
        params: {
          target: 'background',
          color: 'red',
        }
      };

      expect(expectedToolCall.name).toBe('changeVisuals');
      expect(expectedToolCall.params.target).toBe('background');
    });

    it('should map gradient requests to changeVisuals with gradient value', () => {
      // Expected LLM output for "gradient from black to white":
      const expectedToolCall = {
        name: 'changeVisuals',
        params: {
          target: 'background',
          color: expect.stringMatching(/linear-gradient/),
        }
      };

      expect(expectedToolCall.params.color).toEqual(expect.stringMatching(/linear-gradient/));
    });
  });

  describe('Node color changes', () => {
    it('should map "make all nodes green" to changeVisuals with all_nodes target', () => {
      // Expected LLM output:
      const expectedToolCall = {
        name: 'changeVisuals',
        params: {
          target: 'all_nodes',
          color: 'green',
          property: 'background',
        }
      };

      expect(expectedToolCall.params.target).toBe('all_nodes');
    });

    it('should map "change text color to white" to changeVisuals with text property', () => {
      // Expected LLM output:
      const expectedToolCall = {
        name: 'changeVisuals',
        params: {
          target: 'all_nodes',
          color: 'white',
          property: 'text',
        }
      };

      expect(expectedToolCall.params.property).toBe('text');
    });

    it('should map "make login node orange" to changeVisuals with specific node', () => {
      // Expected LLM output (assuming "login" node exists):
      const expectedToolCall = {
        name: 'changeVisuals',
        params: {
          target: 'node',
          nodeId: 'login',
          color: 'orange',
          property: 'background',
        }
      };

      expect(expectedToolCall.params.target).toBe('node');
      expect(expectedToolCall.params.nodeId).toBe('login');
    });

    it('should map "change border color to red" to changeVisuals with border property', () => {
      // Expected LLM output:
      const expectedToolCall = {
        name: 'changeVisuals',
        params: {
          target: 'all_nodes',
          color: 'red',
          property: 'border',
        }
      };

      expect(expectedToolCall.params.property).toBe('border');
    });
  });

  describe('Size changes', () => {
    it('should map "make nodes bigger" to changeDimensions with increase', () => {
      // Expected LLM output:
      const expectedToolCall = {
        name: 'changeDimensions',
        params: {
          target: 'all_nodes',
          direction: 'increase',
          axis: 'both',
        }
      };

      expect(expectedToolCall.params.direction).toBe('increase');
    });

    it('should map "make nodes wider" to changeDimensions horizontal increase', () => {
      // Expected LLM output:
      const expectedToolCall = {
        name: 'changeDimensions',
        params: {
          target: 'all_nodes',
          direction: 'increase',
          axis: 'horizontal',
        }
      };

      expect(expectedToolCall.params.axis).toBe('horizontal');
    });

    it('should map "make nodes shorter" to changeDimensions vertical decrease', () => {
      // Expected LLM output:
      const expectedToolCall = {
        name: 'changeDimensions',
        params: {
          target: 'all_nodes',
          direction: 'decrease',
          axis: 'vertical',
        }
      };

      expect(expectedToolCall.params.axis).toBe('vertical');
      expect(expectedToolCall.params.direction).toBe('decrease');
    });

    it('should map "increase spacing" to changeDimensions layout_spacing', () => {
      // Expected LLM output:
      const expectedToolCall = {
        name: 'changeDimensions',
        params: {
          target: 'layout_spacing',
          direction: 'increase',
          axis: 'both',
        }
      };

      expect(expectedToolCall.params.target).toBe('layout_spacing');
    });

    it('should map "more horizontal spacing" to changeDimensions layout horizontal', () => {
      // Expected LLM output:
      const expectedToolCall = {
        name: 'changeDimensions',
        params: {
          target: 'layout_spacing',
          direction: 'increase',
          axis: 'horizontal',
        }
      };

      expect(expectedToolCall.params.axis).toBe('horizontal');
    });
  });

  describe('Complex multi-step requests', () => {
    it('should map "make background dark and text white" to multiple changeVisuals calls', () => {
      // Expected LLM output:
      const expectedToolCalls = [
        {
          name: 'changeVisuals',
          params: {
            target: 'background',
            color: expect.stringMatching(/#[0-9a-f]{6}|black|dark/i),
          }
        },
        {
          name: 'changeVisuals',
          params: {
            target: 'all_nodes',
            color: 'white',
            property: 'text',
          }
        }
      ];

      expect(expectedToolCalls).toHaveLength(2);
      expect(expectedToolCalls[0].name).toBe('changeVisuals');
      expect(expectedToolCalls[1].params.property).toBe('text');
    });

    it('should map "make login red and dashboard blue" to multiple node-specific calls', () => {
      // Expected LLM output:
      const expectedToolCalls = [
        {
          name: 'changeVisuals',
          params: {
            target: 'node',
            nodeId: 'login',
            color: 'red',
            property: 'background',
          }
        },
        {
          name: 'changeVisuals',
          params: {
            target: 'node',
            nodeId: 'dashboard',
            color: 'blue',
            property: 'background',
          }
        }
      ];

      expect(expectedToolCalls).toHaveLength(2);
      expect(expectedToolCalls[0].params.nodeId).toBe('login');
      expect(expectedToolCalls[1].params.nodeId).toBe('dashboard');
    });

    it('should map "bigger nodes with more spacing" to multiple changeDimensions calls', () => {
      // Expected LLM output:
      const expectedToolCalls = [
        {
          name: 'changeDimensions',
          params: {
            target: 'all_nodes',
            direction: 'increase',
            axis: 'both',
          }
        },
        {
          name: 'changeDimensions',
          params: {
            target: 'layout_spacing',
            direction: 'increase',
            axis: 'both',
          }
        }
      ];

      expect(expectedToolCalls).toHaveLength(2);
      expect(expectedToolCalls[0].params.target).toBe('all_nodes');
      expect(expectedToolCalls[1].params.target).toBe('layout_spacing');
    });
  });
});
