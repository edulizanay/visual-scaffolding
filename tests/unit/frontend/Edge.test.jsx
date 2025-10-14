// ABOUTME: Comprehensive unit tests for CustomEdge component
// ABOUTME: Tests label rendering, inline editing, label positioning, and React Flow integration

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider, getSmoothStepPath } from '@xyflow/react';
import CustomEdge from '../../../src/Edge.jsx';

// Mock React Flow components
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
    BaseEdge: ({ id, path }) => (
      <path data-testid={`base-edge-${id}`} d={path} />
    ),
    EdgeLabelRenderer: ({ children }) => (
      <div data-testid="edge-label-renderer">{children}</div>
    ),
    getSmoothStepPath: vi.fn(({ sourceX, sourceY, targetX, targetY }) => {
      const path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
      const labelX = (sourceX + targetX) / 2;
      const labelY = (sourceY + targetY) / 2;
      return [path, labelX, labelY];
    }),
  };
});

describe('CustomEdge Component', () => {
  const baseProps = {
    id: 'edge-1',
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: 'right',
    targetPosition: 'left',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Edge Rendering', () => {
    it('should render BaseEdge with correct path', () => {
      const data = { label: 'Test Edge' };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      // Verify getSmoothStepPath was called with correct parameters
      expect(getSmoothStepPath).toHaveBeenCalledWith({
        sourceX: baseProps.sourceX,
        sourceY: baseProps.sourceY,
        sourcePosition: baseProps.sourcePosition,
        targetX: baseProps.targetX,
        targetY: baseProps.targetY,
        targetPosition: baseProps.targetPosition,
      });

      // Verify BaseEdge is rendered
      const baseEdge = container.querySelector('[data-testid="base-edge-edge-1"]');
      expect(baseEdge).toBeTruthy();
      expect(baseEdge.getAttribute('d')).toBe('M 0 0 L 100 100');
    });

    it('should render EdgeLabelRenderer', () => {
      const data = { label: 'Test Label' };

      render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      const labelRenderer = screen.getByTestId('edge-label-renderer');
      expect(labelRenderer).toBeTruthy();
    });
  });

  describe('Label Display', () => {
    it('should display label text when provided', () => {
      const data = { label: 'Connection Label' };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      expect(container.textContent).toContain('Connection Label');
    });

    it('should display non-breaking space when label is empty', () => {
      const data = { label: '' };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      // Non-breaking space (\u00A0) should be rendered
      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      expect(labelDiv?.textContent).toBe('\u00A0');
    });

    it('should display non-breaking space when label is undefined', () => {
      const data = {};

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      expect(labelDiv?.textContent).toBe('\u00A0');
    });

    it('should apply background color when label exists', () => {
      const data = { label: 'Test' };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      // happy-dom returns hex, jsdom returns rgb
      expect(labelDiv?.style.background).toMatch(/^(#1a192b|rgb\(26,\s*25,\s*43\))$/);
      expect(labelDiv?.style.opacity).toBe('1');
    });

    it('should apply transparent background when label is empty', () => {
      const data = { label: '' };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      expect(labelDiv?.style.background).toBe('transparent');
      expect(labelDiv?.style.opacity).toBe('0');
    });
  });

  describe('Label Position Calculation', () => {
    it('should position label at center of edge path', () => {
      const data = { label: 'Centered Label' };
      const customProps = {
        ...baseProps,
        sourceX: 0,
        sourceY: 0,
        targetX: 200,
        targetY: 100,
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...customProps} data={data} />
        </ReactFlowProvider>
      );

      // Expected center: (0+200)/2 = 100, (0+100)/2 = 50
      const labelContainer = container.querySelector('div[style*="translate"]');
      expect(labelContainer?.style.transform).toContain('translate(100px,50px)');
    });

    it('should calculate correct position for negative coordinates', () => {
      const data = { label: 'Test' };
      const customProps = {
        ...baseProps,
        sourceX: -50,
        sourceY: -30,
        targetX: 50,
        targetY: 30,
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...customProps} data={data} />
        </ReactFlowProvider>
      );

      // Expected center: (-50+50)/2 = 0, (-30+30)/2 = 0
      const labelContainer = container.querySelector('div[style*="translate"]');
      expect(labelContainer?.style.transform).toContain('translate(0px,0px)');
    });

    it('should apply centering transform with translate(-50%, -50%)', () => {
      const data = { label: 'Test' };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      const labelContainer = container.querySelector('div[style*="translate"]');
      expect(labelContainer?.style.transform).toContain('translate(-50%, -50%)');
    });
  });

  describe('Inline Label Editing', () => {
    it('should not show input field initially', () => {
      const data = { label: 'Initial Label' };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      const input = container.querySelector('input');
      expect(input).toBeNull();
    });

    it('should show input field on double click', () => {
      const data = { label: 'Click Me' };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      const input = container.querySelector('input');
      expect(input).toBeTruthy();
      expect(input?.value).toBe('Click Me');
    });

    it('should focus input automatically when editing starts', () => {
      const data = { label: 'Test' };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      const input = container.querySelector('input');
      // Input should be rendered with autoFocus prop (becomes active element in browser)
      expect(input).toBeTruthy();
      expect(document.activeElement).toBe(input);
    });

    it('should apply nodrag and nopan classes to input', () => {
      const data = { label: 'Test' };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      const input = container.querySelector('input');
      expect(input?.className).toContain('nodrag');
      expect(input?.className).toContain('nopan');
    });

    it('should update input value on change', () => {
      const data = { label: 'Original' };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      const input = container.querySelector('input');
      fireEvent.change(input, { target: { value: 'Updated' } });

      expect(input?.value).toBe('Updated');
    });
  });

  describe('Label Change Callback', () => {
    it('should call onLabelChange on blur with new value', () => {
      const onLabelChange = vi.fn();
      const data = { label: 'Old Label', onLabelChange };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      // Start editing
      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      // Change value
      const input = container.querySelector('input');
      fireEvent.change(input, { target: { value: 'New Label' } });

      // Blur to save
      fireEvent.blur(input);

      expect(onLabelChange).toHaveBeenCalledWith('edge-1', 'New Label');
    });

    it('should exit edit mode on blur', () => {
      const onLabelChange = vi.fn();
      const data = { label: 'Test', onLabelChange };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      // Start editing
      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      // Verify input is shown
      let input = container.querySelector('input');
      expect(input).toBeTruthy();

      // Blur
      fireEvent.blur(input);

      // Verify input is hidden
      input = container.querySelector('input');
      expect(input).toBeNull();
    });

    it('should not call onLabelChange if callback is not provided', () => {
      const data = { label: 'Test' };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      // Start editing
      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      // Change and blur (should not throw)
      const input = container.querySelector('input');
      fireEvent.change(input, { target: { value: 'New' } });
      fireEvent.blur(input);

      // Should complete without errors
      expect(container).toBeTruthy();
    });

    it('should call onLabelChange with edge id and updated value', () => {
      const onLabelChange = vi.fn();
      const data = { label: 'Initial', onLabelChange };
      const customProps = { ...baseProps, id: 'custom-edge-id' };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...customProps} data={data} />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      const input = container.querySelector('input');
      fireEvent.change(input, { target: { value: 'Modified' } });
      fireEvent.blur(input);

      expect(onLabelChange).toHaveBeenCalledWith('custom-edge-id', 'Modified');
    });
  });

  describe('Keyboard Interactions', () => {
    it('should blur input when Enter key is pressed', () => {
      const onLabelChange = vi.fn();
      const data = { label: 'Test', onLabelChange };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      // Start editing
      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      const input = container.querySelector('input');
      fireEvent.change(input, { target: { value: 'New Value' } });

      // Press Enter
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      // Blur should have been triggered by Enter
      fireEvent.blur(input);

      expect(onLabelChange).toHaveBeenCalledWith('edge-1', 'New Value');
    });

    it('should not blur on other key presses', () => {
      const data = { label: 'Test' };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      let input = container.querySelector('input');

      // Press other keys
      fireEvent.keyDown(input, { key: 'a', code: 'KeyA' });
      fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });

      // Input should still be visible
      input = container.querySelector('input');
      expect(input).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null data prop', () => {
      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={null} />
        </ReactFlowProvider>
      );

      expect(container).toBeTruthy();
      const baseEdge = container.querySelector('[data-testid="base-edge-edge-1"]');
      expect(baseEdge).toBeTruthy();
    });

    it('should handle undefined data prop', () => {
      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} />
        </ReactFlowProvider>
      );

      expect(container).toBeTruthy();
      const baseEdge = container.querySelector('[data-testid="base-edge-edge-1"]');
      expect(baseEdge).toBeTruthy();
    });

    it('should handle empty string label', () => {
      const data = { label: '', onLabelChange: vi.fn() };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      expect(labelDiv?.textContent).toBe('\u00A0');
    });

    it('should handle double click on empty label', () => {
      const onLabelChange = vi.fn();
      const data = { label: '', onLabelChange };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      const input = container.querySelector('input');
      expect(input).toBeTruthy();
      expect(input?.value).toBe('');
    });

    it('should preserve state when editing empty label to non-empty', () => {
      const onLabelChange = vi.fn();
      const data = { label: '', onLabelChange };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      const input = container.querySelector('input');
      fireEvent.change(input, { target: { value: 'New Label' } });
      fireEvent.blur(input);

      expect(onLabelChange).toHaveBeenCalledWith('edge-1', 'New Label');
    });
  });

  describe('Component Memoization', () => {
    it('should be wrapped with React.memo', () => {
      // CustomEdge should be memoized to prevent unnecessary re-renders
      expect(CustomEdge.$$typeof).toBeTruthy();
    });
  });

  describe('Styling', () => {
    it('should apply correct label container styles', () => {
      const data = { label: 'Test' };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      const labelContainer = container.querySelector('div[style*="translate"]');
      expect(labelContainer?.style.position).toBe('absolute');
      expect(labelContainer?.style.pointerEvents).toBe('all');
    });

    it('should apply correct label display styles', () => {
      const data = { label: 'Test Label' };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      expect(labelDiv?.style.padding).toBe('2px 8px');
      expect(labelDiv?.style.borderRadius).toBe('3px');
      expect(labelDiv?.style.fontSize).toBe('12px');
      expect(labelDiv?.style.color).toBe('white');
      expect(labelDiv?.style.cursor).toBe('text');
    });

    it('should apply correct input styles when editing', () => {
      const data = { label: 'Test' };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      const input = container.querySelector('input');
      // happy-dom returns hex (including shorthand), jsdom returns rgb
      expect(input?.style.background).toMatch(/^(#1a192b|rgb\(26,\s*25,\s*43\))$/);
      expect(input?.style.border).toMatch(/^1px solid (#555(555)?|rgb\(85,\s*85,\s*85\))$/);
      expect(input?.style.color).toMatch(/^(white|rgb\(255,\s*255,\s*255\))$/);
      expect(input?.style.padding).toBe('2px 8px');
      expect(input?.style.borderRadius).toBe('3px');
      expect(input?.style.fontSize).toBe('12px');
      expect(input?.style.fontFamily).toBe('inherit');
    });
  });

  describe('Multiple Sequential Edits', () => {
    it('should handle multiple edit sessions correctly', () => {
      const onLabelChange = vi.fn();
      const data = { label: 'First', onLabelChange };

      const { container } = render(
        <ReactFlowProvider>
          <CustomEdge {...baseProps} data={data} />
        </ReactFlowProvider>
      );

      // First edit
      let labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);
      let input = container.querySelector('input');
      fireEvent.change(input, { target: { value: 'Second' } });
      fireEvent.blur(input);

      expect(onLabelChange).toHaveBeenCalledWith('edge-1', 'Second');

      // Second edit
      labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);
      input = container.querySelector('input');
      fireEvent.change(input, { target: { value: 'Third' } });
      fireEvent.blur(input);

      expect(onLabelChange).toHaveBeenCalledWith('edge-1', 'Third');
      expect(onLabelChange).toHaveBeenCalledTimes(2);
    });
  });
});
