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

      // Should calculate target bounds as centroid of member node CENTERS
      // Node 1: position (15, 25) + dims (100, 50) = center at (65, 50)
      // Node 2: position (95, 75) + dims (100, 50) = center at (145, 100)
      // Centroid: ((65+145)/2, (50+100)/2) = (105, 75)
      // GroupNode positioned centered at centroid
      const expectedTargetBounds = {
        x: 105 - 172/2, // 19
        y: 75 - 70/2,   // 40
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

  describe('collapse animation - Stage 2: bounds morphing', () => {
    test('should set data-animating flag on double-click', () => {
      const mockGetNodeDimensions = vi.fn(() => ({ width: 172, height: 70 }));

      const haloWithNodes = {
        groupId: 'group-1',
        label: 'Group 1',
        bounds: { x: 10, y: 20, width: 200, height: 150 },
        memberNodes: [
          { id: 'node-1', position: { x: 50, y: 50 } },
          { id: 'node-2', position: { x: 100, y: 100 } },
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

      // Double-click to trigger collapse animation
      act(() => {
        fireEvent.doubleClick(rect);
      });

      // Should set animating flag (actual animation happens via Web Animations API in browser)
      expect(rect).toHaveAttribute('data-animating', 'true');
    });
  });

  describe('collapse animation - Stage 3: opacity fade', () => {
    test('should animate halo opacity from 1.0 to 0.3 during collapse', () => {
      const mockGetNodeDimensions = vi.fn(() => ({ width: 172, height: 70 }));

      const haloWithNodes = {
        groupId: 'group-1',
        label: 'Group 1',
        bounds: { x: 10, y: 20, width: 200, height: 150 },
        memberNodes: [
          { id: 'node-1', position: { x: 50, y: 50 } },
          { id: 'node-2', position: { x: 100, y: 100 } },
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

      // Verify initial opacity
      expect(rect).toHaveAttribute('data-opacity', '1');

      // Double-click to trigger collapse animation
      act(() => {
        fireEvent.doubleClick(rect);
      });

      // Should set target opacity for animation
      expect(rect).toHaveAttribute('data-target-opacity', '0.3');
    });
  });

  describe('collapse animation - Stage 4: color transition', () => {
    test('should transition halo stroke color to GroupNode border color during collapse', () => {
      const mockGetNodeDimensions = vi.fn(() => ({ width: 172, height: 70 }));

      const haloWithNodes = {
        groupId: 'group-1',
        label: 'Group 1',
        bounds: { x: 10, y: 20, width: 200, height: 150 },
        memberNodes: [
          { id: 'node-1', position: { x: 50, y: 50 } },
          { id: 'node-2', position: { x: 100, y: 100 } },
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

      // Verify initial stroke color (from theme)
      expect(rect).toHaveAttribute('data-initial-stroke', 'rgba(99, 102, 241, 0.45)');

      // Double-click to trigger collapse animation
      act(() => {
        fireEvent.doubleClick(rect);
      });

      // Should set target stroke color to GroupNode border color
      expect(rect).toHaveAttribute('data-target-stroke', '#6366f1');
    });

    test('should transition halo fill from transparent to GroupNode background color during collapse', () => {
      const mockGetNodeDimensions = vi.fn(() => ({ width: 172, height: 70 }));

      const haloWithNodes = {
        groupId: 'group-1',
        label: 'Group 1',
        bounds: { x: 10, y: 20, width: 200, height: 150 },
        memberNodes: [
          { id: 'node-1', position: { x: 50, y: 50 } },
          { id: 'node-2', position: { x: 100, y: 100 } },
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

      // Verify initial fill is transparent
      expect(rect).toHaveAttribute('data-initial-fill', 'transparent');

      // Double-click to trigger collapse animation
      act(() => {
        fireEvent.doubleClick(rect);
      });

      // Should set target fill color to GroupNode background color
      expect(rect).toHaveAttribute('data-target-fill', '#3730a3');
    });
  });

});
