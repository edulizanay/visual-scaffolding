import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GroupHaloOverlay } from '../../../src/features/flow-canvas/components/GroupHaloOverlay.jsx';
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
});
