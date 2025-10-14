// ABOUTME: Visual halo overlay for expanded group nodes
// ABOUTME: Renders SVG rectangles around group members with hover states

import { useState } from 'react';
import { useViewport } from '@xyflow/react';
import { THEME } from './constants/theme.js';

export const GroupHaloOverlay = ({ halos, onCollapse }) => {
  const [hoveredId, setHoveredId] = useState(null);
  const { x = 0, y = 0, zoom = 1 } = useViewport() || {};

  if (!halos || halos.length === 0) {
    return null;
  }

  const sortedHalos = [...halos].sort((a, b) => {
    const areaA = a.bounds.width * a.bounds.height;
    const areaB = b.bounds.width * b.bounds.height;
    return areaA - areaB;
  });

  return (
    <svg
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1500 }}
      width="100%"
      height="100%"
    >
      {sortedHalos.map((halo) => {
        const screenX = halo.bounds.x * zoom + x;
        const screenY = halo.bounds.y * zoom + y;
        const screenWidth = halo.bounds.width * zoom;
        const screenHeight = halo.bounds.height * zoom;
        const isHovered = hoveredId === halo.groupId;

        return (
          <rect
            key={halo.groupId}
            x={screenX}
            y={screenY}
            width={screenWidth}
            height={screenHeight}
            rx={THEME.groupNode.halo.borderRadius}
            ry={THEME.groupNode.halo.borderRadius}
            fill="none"
            stroke={
              isHovered
                ? THEME.groupNode.halo.colors.hovered
                : THEME.groupNode.halo.colors.normal
            }
            strokeWidth={
              isHovered
                ? THEME.groupNode.halo.strokeWidth.hovered
                : THEME.groupNode.halo.strokeWidth.normal
            }
            pointerEvents="stroke"
            onMouseEnter={() => setHoveredId(halo.groupId)}
            onMouseLeave={() =>
              setHoveredId((current) => (current === halo.groupId ? null : current))
            }
            onDoubleClick={(event) => {
              event.stopPropagation();
              if (event.metaKey || event.ctrlKey) {
                return;
              }
              onCollapse?.(halo.groupId);
            }}
          />
        );
      })}
    </svg>
  );
};
