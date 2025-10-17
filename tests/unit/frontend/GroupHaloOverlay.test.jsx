import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GroupHaloOverlay } from '../../../src/GroupHaloOverlay.jsx';
import { THEME } from '../../../src/constants/theme.js';

vi.mock('@xyflow/react', () => {
  const React = require('react');
  return {
    __esModule: true,
    useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
  };
});

describe('GroupHaloOverlay', () => {
  const halo = {
    groupId: 'group-1',
    label: 'Group 1',
    bounds: { x: 10, y: 20, width: 120, height: 80 },
  };

  test('calls onCollapse when halo is double-clicked', () => {
    const onCollapse = vi.fn();

    const { container } = render(<GroupHaloOverlay halos={[halo]} onCollapse={onCollapse} />);
    const rect = container.querySelector('rect');
    expect(rect).toBeInTheDocument();

    act(() => {
      fireEvent.doubleClick(rect);
    });

    expect(onCollapse).toHaveBeenCalledWith('group-1');
  });

  test('does not call onCollapse when modifier keys are pressed', () => {
    const onCollapse = vi.fn();

    const { container } = render(<GroupHaloOverlay halos={[halo]} onCollapse={onCollapse} />);
    const rect = container.querySelector('rect');

    act(() => {
      fireEvent.doubleClick(rect, { metaKey: true });
      fireEvent.doubleClick(rect, { ctrlKey: true });
    });

    expect(onCollapse).not.toHaveBeenCalled();
  });

  test('applies hover styling when halo is hovered', () => {
    const { container } = render(<GroupHaloOverlay halos={[halo]} onCollapse={vi.fn()} />);
    const rect = container.querySelector('rect');
    expect(rect).toHaveAttribute('stroke', `${THEME.groupNode.halo.colors.normal}`);

    act(() => {
      fireEvent.mouseEnter(rect);
    });

    expect(rect).toHaveAttribute('stroke', `${THEME.groupNode.halo.colors.hovered}`);
    expect(rect).toHaveAttribute('stroke-width', `${THEME.groupNode.halo.strokeWidth.hovered}`);
  });

  describe('collapse animation - Stage 1: target bounds calculation', () => {
    test('should calculate target bounds from member nodes when collapse starts', () => {
      const mockGetNodeDimensions = vi.fn((node) => {
        // Mock dimensions for the collapsed group node
        if (node.id === 'group-1') {
          return { width: 172, height: 70 }; // Standard node size from theme
        }
        return { width: 100, height: 50 };
      });

      const haloWithNodes = {
        ...halo,
        memberNodes: [
          { id: 'node-1', position: { x: 15, y: 25 } },
          { id: 'node-2', position: { x: 95, y: 75 } },
        ],
      };

      const onCollapse = vi.fn();
      const { container } = render(
        <GroupHaloOverlay
          halos={[haloWithNodes]}
          onCollapse={onCollapse}
          getNodeDimensions={mockGetNodeDimensions}
        />
      );

      const rect = container.querySelector('rect');

      act(() => {
        fireEvent.doubleClick(rect);
      });

      // Should calculate target bounds as centroid of member nodes
      // Expected: center of members is at (55, 50), GroupNode will be positioned there
      // with size 172x70 from theme
      const expectedTargetBounds = {
        x: 55 - 172/2, // center x - half width
        y: 50 - 70/2,  // center y - half height
        width: 172,
        height: 70,
      };

      // Check that rect has data attribute with target bounds for animation
      expect(rect).toHaveAttribute('data-target-x', String(expectedTargetBounds.x));
      expect(rect).toHaveAttribute('data-target-y', String(expectedTargetBounds.y));
      expect(rect).toHaveAttribute('data-target-width', String(expectedTargetBounds.width));
      expect(rect).toHaveAttribute('data-target-height', String(expectedTargetBounds.height));
    });
  });
});
