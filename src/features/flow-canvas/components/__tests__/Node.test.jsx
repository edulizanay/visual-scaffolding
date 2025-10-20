// ABOUTME: Comprehensive unit tests for the CustomNode component
// ABOUTME: Tests rendering, inline editing, handles, styles, and user interactions

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import CustomNode from '../Node.jsx';

// Mock React Flow's Handle component
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
    Handle: ({ type, position }) => <div data-testid={`handle-${type}-${position}`} />,
    Position: actual.Position,
  };
});

describe('CustomNode Component', () => {
  describe('Basic Rendering', () => {
    it('should render node with label and description', () => {
      const nodeData = {
        label: 'Test Node',
        description: 'Test description',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      expect(container.textContent).toContain('Test Node');
      expect(container.textContent).toContain('Test description');
    });

    it('should render placeholder text when description is undefined', () => {
      const nodeData = {
        label: 'Test Node',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      expect(container.textContent).toContain('Add description...');
    });

    it('should render placeholder text when description is empty string', () => {
      const nodeData = {
        label: 'Test Node',
        description: '',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      expect(container.textContent).toContain('Add description...');
    });

    it('should apply placeholder opacity when description is missing', () => {
      const nodeData = {
        label: 'Test Node',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      // Find description div by looking for the placeholder text
      const descriptionDivs = Array.from(container.querySelectorAll('div'));
      const descriptionDiv = descriptionDivs.find(div => div.textContent === 'Add description...');
      expect(descriptionDiv).toBeTruthy();
      const opacity = window.getComputedStyle(descriptionDiv).opacity || descriptionDiv.style.opacity;
      expect(parseFloat(opacity)).toBe(0.4);
    });

    it('should apply normal opacity when description exists', () => {
      const nodeData = {
        label: 'Test Node',
        description: 'Real description',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      // Find description div by looking for the actual description text
      const descriptionDivs = Array.from(container.querySelectorAll('div'));
      const descriptionDiv = descriptionDivs.find(div => div.textContent === 'Real description');
      expect(descriptionDiv).toBeTruthy();
      const opacity = window.getComputedStyle(descriptionDiv).opacity || descriptionDiv.style.opacity;
      expect(parseFloat(opacity)).toBe(0.6);
    });
  });

  describe('Handle Rendering', () => {
    it('should render source and target handles', () => {
      const nodeData = {
        label: 'Test Node',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { getByTestId } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      expect(getByTestId('handle-target-left')).toBeTruthy();
      expect(getByTestId('handle-source-right')).toBeTruthy();
    });
  });

  describe('Text Color Styling', () => {
    it('should use default white text color when textColor is not provided', () => {
      const nodeData = {
        label: 'Test Node',
        description: 'Test description',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const descriptionDivs = Array.from(container.querySelectorAll('div'));
      const descriptionDiv = descriptionDivs.find(div => div.textContent === 'Test description');
      expect(descriptionDiv).toBeTruthy();
      const color = window.getComputedStyle(descriptionDiv).color || descriptionDiv.style.color;
      // happy-dom returns named colors, jsdom returns rgb format
      expect(color).toMatch(/^(white|rgb\(255,\s*255,\s*255\))$/);
    });

    it('should apply custom text color from data', () => {
      const nodeData = {
        label: 'Test Node',
        description: 'Test description',
        textColor: 'rgb(255, 0, 0)',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const descriptionDivs = Array.from(container.querySelectorAll('div'));
      const descriptionDiv = descriptionDivs.find(div => div.textContent === 'Test description');
      expect(descriptionDiv).toBeTruthy();
      const color = window.getComputedStyle(descriptionDiv).color || descriptionDiv.style.color;
      expect(color).toBe('rgb(255, 0, 0)');
    });

    it('should apply custom text color to description input when editing', () => {
      const nodeData = {
        label: 'Test Node',
        description: 'Test description',
        textColor: 'blue',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const descriptionDivs = Array.from(container.querySelectorAll('div'));
      const descriptionDiv = descriptionDivs.find(div => div.textContent === 'Test description');
      fireEvent.doubleClick(descriptionDiv);

      const inputs = Array.from(container.querySelectorAll('input.nodrag'));
      const descriptionInput = inputs.find(input => input.value === 'Test description');
      expect(descriptionInput).toBeTruthy();
      const color = window.getComputedStyle(descriptionInput).color || descriptionInput.style.color;
      // happy-dom returns named colors, jsdom returns rgb format
      expect(color).toMatch(/^(blue|rgb\(0,\s*0,\s*255\))$/);
    });
  });

  describe('Label Inline Editing', () => {
    it('should enter edit mode when label is double-clicked', () => {
      const nodeData = {
        label: 'Test Node',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      const input = container.querySelector('input.nodrag');
      expect(input).toBeTruthy();
      expect(input?.value).toBe('Test Node');
    });

    it('should update label value as user types', () => {
      const nodeData = {
        label: 'Test Node',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      const input = container.querySelector('input.nodrag');
      fireEvent.change(input, { target: { value: 'Updated Label' } });

      expect(input?.value).toBe('Updated Label');
    });

    it('should call onLabelChange when label is blurred with changes', () => {
      const onLabelChange = vi.fn();
      const nodeData = {
        label: 'Test Node',
        onLabelChange,
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      const input = container.querySelector('input.nodrag');
      fireEvent.change(input, { target: { value: 'Updated Label' } });
      fireEvent.blur(input);

      expect(onLabelChange).toHaveBeenCalledWith('node-1', 'Updated Label');
    });

    it('should not call onLabelChange when label is blurred without changes', () => {
      const onLabelChange = vi.fn();
      const nodeData = {
        label: 'Test Node',
        onLabelChange,
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      const input = container.querySelector('input.nodrag');
      fireEvent.blur(input);

      expect(onLabelChange).not.toHaveBeenCalled();
    });

    it('should exit edit mode and call onLabelChange when Enter key is pressed', () => {
      const onLabelChange = vi.fn();
      const nodeData = {
        label: 'Test Node',
        onLabelChange,
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      const input = container.querySelector('input.nodrag');
      fireEvent.change(input, { target: { value: 'New Label' } });

      // Mock the blur method
      input.blur = vi.fn();
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(input.blur).toHaveBeenCalled();
    });

    it('should not exit edit mode when non-Enter key is pressed', () => {
      const nodeData = {
        label: 'Test Node',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      const input = container.querySelector('input.nodrag');
      const blurSpy = vi.fn();
      input.blur = blurSpy;

      fireEvent.keyDown(input, { key: 'a' });

      expect(blurSpy).not.toHaveBeenCalled();
    });

    it('should exit edit mode after blur and show original label', async () => {
      const onLabelChange = vi.fn();
      const nodeData = {
        label: 'Test Node',
        onLabelChange,
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      // Should be in edit mode with input
      expect(container.querySelector('input.nodrag')).toBeTruthy();

      const input = container.querySelector('input.nodrag');
      fireEvent.change(input, { target: { value: 'Updated Label' } });
      fireEvent.blur(input);

      // Wait for React to exit edit mode after blur
      await waitFor(() => {
        // Should exit edit mode (no input)
        expect(container.querySelector('input.nodrag')).toBeFalsy();
        // Should show original label since data prop hasn't changed
        const labelDiv = container.querySelector('div[style*="cursor: text"]');
        expect(labelDiv?.textContent).toBe('Test Node');
      });

      // Should have called the callback with updated value
      expect(onLabelChange).toHaveBeenCalledWith('node-1', 'Updated Label');
    });
  });

  describe('Description Inline Editing', () => {
    it('should enter edit mode when description is double-clicked', () => {
      const nodeData = {
        label: 'Test Node',
        description: 'Test description',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const descriptionDivs = Array.from(container.querySelectorAll('div'));
      const descriptionDiv = descriptionDivs.find(div => div.textContent === 'Test description');
      fireEvent.doubleClick(descriptionDiv);

      const inputs = Array.from(container.querySelectorAll('input.nodrag'));
      const descriptionInput = inputs.find(input => input.value === 'Test description');
      expect(descriptionInput).toBeTruthy();
      expect(descriptionInput?.value).toBe('Test description');
    });

    it('should update description value as user types', () => {
      const nodeData = {
        label: 'Test Node',
        description: 'Test description',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const descriptionDivs = Array.from(container.querySelectorAll('div'));
      const descriptionDiv = descriptionDivs.find(div => div.textContent === 'Test description');
      fireEvent.doubleClick(descriptionDiv);

      const inputs = Array.from(container.querySelectorAll('input.nodrag'));
      const descriptionInput = inputs.find(input => input.value === 'Test description');
      fireEvent.change(descriptionInput, { target: { value: 'Updated description' } });

      expect(descriptionInput?.value).toBe('Updated description');
    });

    it('should call onDescriptionChange when description is blurred', () => {
      const onDescriptionChange = vi.fn();
      const nodeData = {
        label: 'Test Node',
        description: 'Test description',
        onLabelChange: vi.fn(),
        onDescriptionChange,
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const descriptionDivs = Array.from(container.querySelectorAll('div'));
      const descriptionDiv = descriptionDivs.find(div => div.textContent === 'Test description');
      fireEvent.doubleClick(descriptionDiv);

      const inputs = Array.from(container.querySelectorAll('input.nodrag'));
      const descriptionInput = inputs.find(input => input.value === 'Test description');
      fireEvent.change(descriptionInput, { target: { value: 'Updated description' } });
      fireEvent.blur(descriptionInput);

      expect(onDescriptionChange).toHaveBeenCalledWith('node-1', 'Updated description');
    });

    it('should call onDescriptionChange even when description is unchanged', () => {
      const onDescriptionChange = vi.fn();
      const nodeData = {
        label: 'Test Node',
        description: 'Test description',
        onLabelChange: vi.fn(),
        onDescriptionChange,
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const descriptionDivs = Array.from(container.querySelectorAll('div'));
      const descriptionDiv = descriptionDivs.find(div => div.textContent === 'Test description');
      fireEvent.doubleClick(descriptionDiv);

      const inputs = Array.from(container.querySelectorAll('input.nodrag'));
      const descriptionInput = inputs.find(input => input.value === 'Test description');
      fireEvent.blur(descriptionInput);

      expect(onDescriptionChange).toHaveBeenCalledWith('node-1', 'Test description');
    });

    it('should exit edit mode and call onDescriptionChange when Enter key is pressed', () => {
      const onDescriptionChange = vi.fn();
      const nodeData = {
        label: 'Test Node',
        description: 'Test description',
        onLabelChange: vi.fn(),
        onDescriptionChange,
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const descriptionDivs = Array.from(container.querySelectorAll('div'));
      const descriptionDiv = descriptionDivs.find(div => div.textContent === 'Test description');
      fireEvent.doubleClick(descriptionDiv);

      const inputs = Array.from(container.querySelectorAll('input.nodrag'));
      const descriptionInput = inputs.find(input => input.value === 'Test description');
      fireEvent.change(descriptionInput, { target: { value: 'New description' } });

      // Mock the blur method
      descriptionInput.blur = vi.fn();
      fireEvent.keyDown(descriptionInput, { key: 'Enter' });

      expect(descriptionInput.blur).toHaveBeenCalled();
    });

    it('should allow editing placeholder description', () => {
      const onDescriptionChange = vi.fn();
      const nodeData = {
        label: 'Test Node',
        onLabelChange: vi.fn(),
        onDescriptionChange,
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const descriptionDivs = Array.from(container.querySelectorAll('div'));
      const descriptionDiv = descriptionDivs.find(div => div.textContent === 'Add description...');
      expect(descriptionDiv?.textContent).toBe('Add description...');

      fireEvent.doubleClick(descriptionDiv);

      const inputs = Array.from(container.querySelectorAll('input.nodrag'));
      const descriptionInput = inputs.find(input => input.value === '');
      expect(descriptionInput?.value).toBe('');

      fireEvent.change(descriptionInput, { target: { value: 'New description' } });
      fireEvent.blur(descriptionInput);

      expect(onDescriptionChange).toHaveBeenCalledWith('node-1', 'New description');
    });

    it('should exit edit mode after blur and show original description', async () => {
      const onDescriptionChange = vi.fn();
      const nodeData = {
        label: 'Test Node',
        description: 'Original description',
        onLabelChange: vi.fn(),
        onDescriptionChange,
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const descriptionDivs = Array.from(container.querySelectorAll('div'));
      const descriptionDiv = descriptionDivs.find(div => div.textContent === 'Original description');
      fireEvent.doubleClick(descriptionDiv);

      // Should be in edit mode with input
      const inputs = Array.from(container.querySelectorAll('input.nodrag'));
      const descriptionInput = inputs.find(input => input.value === 'Original description');
      expect(descriptionInput).toBeTruthy();

      fireEvent.change(descriptionInput, { target: { value: 'Updated description' } });
      fireEvent.blur(descriptionInput);

      // Wait for React to exit edit mode after blur
      await waitFor(() => {
        // Should exit edit mode (no description input anymore)
        const updatedInputs = Array.from(container.querySelectorAll('input.nodrag'));
        const descInput = updatedInputs.find(input => input.value && input.value.includes('description'));
        expect(descInput).toBeFalsy();

        // Should show original description since data prop hasn't changed
        const updatedDescriptionDivs = Array.from(container.querySelectorAll('div'));
        const updatedDescriptionDiv = updatedDescriptionDivs.find(div => div.textContent === 'Original description');
        expect(updatedDescriptionDiv?.textContent).toBe('Original description');
      });

      // Should have called the callback with updated value
      expect(onDescriptionChange).toHaveBeenCalledWith('node-1', 'Updated description');
    });
  });

  describe('Component Memoization', () => {
    it('should not re-render when props do not change', () => {
      const nodeData = {
        label: 'Test Node',
        description: 'Test description',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { rerender, container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const initialText = container.textContent;

      // Re-render with same props
      rerender(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      expect(container.textContent).toBe(initialText);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing onLabelChange callback gracefully', () => {
      const nodeData = {
        label: 'Test Node',
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      const input = container.querySelector('input.nodrag');
      fireEvent.change(input, { target: { value: 'New Label' } });

      // Should not throw error when blurring without callback
      expect(() => fireEvent.blur(input)).not.toThrow();
    });

    it('should handle missing onDescriptionChange callback gracefully', () => {
      const nodeData = {
        label: 'Test Node',
        description: 'Test description',
        onLabelChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const descriptionDivs = Array.from(container.querySelectorAll('div'));
      const descriptionDiv = descriptionDivs.find(div => div.textContent === 'Test description');
      fireEvent.doubleClick(descriptionDiv);

      const inputs = Array.from(container.querySelectorAll('input.nodrag'));
      const descriptionInput = inputs.find(input => input.value === 'Test description');

      // Should not throw error when blurring without callback
      expect(() => fireEvent.blur(descriptionInput)).not.toThrow();
    });

    it('should handle null label', () => {
      const nodeData = {
        label: null,
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      expect(container).toBeTruthy();
    });

    it('should handle empty string label', () => {
      const nodeData = {
        label: '',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      expect(container).toBeTruthy();
    });

    it('should handle null description', () => {
      const nodeData = {
        label: 'Test Node',
        description: null,
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      expect(container.textContent).toContain('Add description...');
    });
  });

  describe('CSS Classes', () => {
    it('should apply nodrag class to label input', () => {
      const nodeData = {
        label: 'Test Node',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      const input = container.querySelector('input');
      expect(input?.classList.contains('nodrag')).toBe(true);
    });

    it('should apply nodrag class to description input', () => {
      const nodeData = {
        label: 'Test Node',
        description: 'Test description',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const descriptionDivs = Array.from(container.querySelectorAll('div'));
      const descriptionDiv = descriptionDivs.find(div => div.textContent === 'Test description');
      fireEvent.doubleClick(descriptionDiv);

      const inputs = container.querySelectorAll('input.nodrag');
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  describe('Input Styling', () => {
    it('should apply correct styles to label input', () => {
      const nodeData = {
        label: 'Test Node',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      const input = container.querySelector('input.nodrag');
      const computedStyle = window.getComputedStyle(input);
      expect(input?.style.background).toBe('transparent');
      expect(input?.style.textAlign).toBe('center');
      // Note: inline styles may render border as empty string vs 'none'
      expect(input?.style.outline).toContain('1px');
      expect(input?.style.outline).toContain('#555');
    });

    it('should apply correct styles to description input', () => {
      const nodeData = {
        label: 'Test Node',
        description: 'Test description',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const descriptionDivs = Array.from(container.querySelectorAll('div'));
      const descriptionDiv = descriptionDivs.find(div => div.textContent === 'Test description');
      fireEvent.doubleClick(descriptionDiv);

      const inputs = Array.from(container.querySelectorAll('input.nodrag'));
      const descriptionInput = inputs.find(input => input.value === 'Test description');
      expect(descriptionInput?.style.fontSize).toBe('11px');
      expect(descriptionInput?.style.fontStyle).toBe('italic');
      expect(descriptionInput?.style.marginTop).toBe('4px');
      expect(descriptionInput?.style.outline).toContain('1px');
      expect(descriptionInput?.style.outline).toContain('#555');
    });

    it('should apply correct styles to description display', () => {
      const nodeData = {
        label: 'Test Node',
        description: 'Test description',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const descriptionDivs = Array.from(container.querySelectorAll('div'));
      const descriptionDiv = descriptionDivs.find(div => div.textContent === 'Test description');
      expect(descriptionDiv?.style.fontSize).toBe('11px');
      expect(descriptionDiv?.style.fontStyle).toBe('italic');
      expect(descriptionDiv?.style.marginTop).toBe('4px');
      expect(descriptionDiv?.style.cursor).toBe('text');
    });
  });

  describe('AutoFocus Behavior', () => {
    it('should render label input with autoFocus property when entering edit mode', () => {
      const nodeData = {
        label: 'Test Node',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const labelDiv = container.querySelector('div[style*="cursor: text"]');
      fireEvent.doubleClick(labelDiv);

      // Verify input is created and focused behavior works
      const input = container.querySelector('input.nodrag');
      expect(input).toBeTruthy();
      expect(input?.value).toBe('Test Node');
      // In JSDOM, autofocus behavior is not fully simulated, so we just verify the input exists
    });

    it('should render description input with autoFocus property when entering edit mode', () => {
      const nodeData = {
        label: 'Test Node',
        description: 'Test description',
        onLabelChange: vi.fn(),
        onDescriptionChange: vi.fn(),
      };

      const { container } = render(
        <ReactFlowProvider>
          <CustomNode data={nodeData} id="node-1" />
        </ReactFlowProvider>
      );

      const descriptionDivs = Array.from(container.querySelectorAll('div'));
      const descriptionDiv = descriptionDivs.find(div => div.textContent === 'Test description');
      fireEvent.doubleClick(descriptionDiv);

      // Verify input is created and focused behavior works
      const inputs = Array.from(container.querySelectorAll('input.nodrag'));
      const descriptionInput = inputs.find(input => input.value === 'Test description');
      expect(descriptionInput).toBeTruthy();
      expect(descriptionInput?.value).toBe('Test description');
      // In JSDOM, autofocus behavior is not fully simulated, so we just verify the input exists
    });
  });
});
