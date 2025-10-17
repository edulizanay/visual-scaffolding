// ABOUTME: Visual halo overlay for expanded group nodes
// ABOUTME: Renders SVG rectangles around group members with hover states and morphing animations

import { useState, useRef, useEffect } from 'react';
import { useViewport } from '@xyflow/react';
import { THEME } from './constants/theme.js';

export const GroupHaloOverlay = ({
  halos,
  onCollapse,
  collapsedGroups = [],
  expandingGroupId = null,
  onExpand,
  getNodeDimensions
}) => {
  const [hoveredId, setHoveredId] = useState(null);
  const [collapsingId, setCollapsingId] = useState(null);
  const { x = 0, y = 0, zoom = 1 } = useViewport() || {};
  const rectRefs = useRef(new Map());
  const expandOverlayRef = useRef(null);

  // Calculate target bounds for collapsed group node (centroid of member node centers)
  const calculateTargetBounds = (halo) => {
    if (!halo.memberNodes || halo.memberNodes.length === 0) {
      return null;
    }

    // Calculate centroid from CENTER of each member node, not top-left corner
    let sumCenterX = 0;
    let sumCenterY = 0;

    halo.memberNodes.forEach((node) => {
      const dims = getNodeDimensions?.(node) || { width: 172, height: 70 };
      const centerX = node.position.x + dims.width / 2;
      const centerY = node.position.y + dims.height / 2;
      sumCenterX += centerX;
      sumCenterY += centerY;
    });

    const centroidX = sumCenterX / halo.memberNodes.length;
    const centroidY = sumCenterY / halo.memberNodes.length;

    // Get dimensions for the collapsed group node
    const groupNodeDimensions = getNodeDimensions?.({ id: halo.groupId }) || { width: 172, height: 70 };

    // Position the group node centered at the centroid
    return {
      x: centroidX - groupNodeDimensions.width / 2,
      y: centroidY - groupNodeDimensions.height / 2,
      width: groupNodeDimensions.width,
      height: groupNodeDimensions.height,
    };
  };

  // Handle expand animation when expandingGroupId changes
  useEffect(() => {
    if (!expandingGroupId || !onExpand) return;

    // Find the collapsed group node
    const groupNode = collapsedGroups.find(g => g.id === expandingGroupId);
    if (!groupNode) return;

    // Find the future halo bounds (need to calculate where it will be after expansion)
    // For now, we'll need to get this from the backend or estimate it
    // This is a simplified version - we may need to pass target bounds from App.jsx
    const rect = expandOverlayRef.current;
    if (rect && typeof rect.animate === 'function') {
      // Get GroupNode screen position
      const nodeDims = getNodeDimensions(groupNode);
      const nodeScreenX = groupNode.position.x * zoom + x;
      const nodeScreenY = groupNode.position.y * zoom + y;
      const nodeScreenWidth = nodeDims.width * zoom;
      const nodeScreenHeight = nodeDims.height * zoom;

      // TODO: Calculate target expanded halo bounds
      // For now, animate to a placeholder position
      // We'll need to pass the target halo from App.jsx after we know member positions

      const animation = rect.animate([
        {
          x: `${nodeScreenX}px`,
          y: `${nodeScreenY}px`,
          width: `${nodeScreenWidth}px`,
          height: `${nodeScreenHeight}px`,
          opacity: 1.0,
          stroke: THEME.groupNode.colors.border,
          fill: THEME.groupNode.colors.background,
        },
        {
          x: `${nodeScreenX - 50}px`,  // Placeholder expansion
          y: `${nodeScreenY - 50}px`,
          width: `${nodeScreenWidth + 100}px`,
          height: `${nodeScreenHeight + 100}px`,
          opacity: 1.0,
          stroke: THEME.groupNode.halo.colors.normal,
          fill: 'transparent',
        },
      ], {
        duration: 400,
        easing: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
        fill: 'forwards',
      });

      animation.onfinish = () => {
        onExpand(expandingGroupId);
      };
    } else {
      // No animation support, expand immediately
      onExpand(expandingGroupId);
    }
  }, [expandingGroupId, collapsedGroups, onExpand, getNodeDimensions, x, y, zoom]);

  const hasHalos = halos && halos.length > 0;

  if (!hasHalos && !expandingGroupId) {
    return null;
  }

  const sortedHalos = hasHalos ? [...halos].sort((a, b) => {
    const areaA = a.bounds.width * a.bounds.height;
    const areaB = b.bounds.width * b.bounds.height;
    return areaA - areaB;
  }) : [];

  return (
    <svg
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1500 }}
      width="100%"
      height="100%"
    >
      {sortedHalos.map((halo) => {
        const isCollapsing = collapsingId === halo.groupId;
        const targetBounds = calculateTargetBounds(halo);

        const screenX = halo.bounds.x * zoom + x;
        const screenY = halo.bounds.y * zoom + y;
        const screenWidth = halo.bounds.width * zoom;
        const screenHeight = halo.bounds.height * zoom;
        const isHovered = hoveredId === halo.groupId;
        const currentStroke = isHovered
          ? THEME.groupNode.halo.colors.hovered
          : THEME.groupNode.halo.colors.normal;

        return (
          <rect
            key={halo.groupId}
            ref={(el) => {
              if (el) rectRefs.current.set(halo.groupId, el);
            }}
            x={screenX}
            y={screenY}
            width={screenWidth}
            height={screenHeight}
            rx={THEME.groupNode.halo.borderRadius}
            ry={THEME.groupNode.halo.borderRadius}
            fill="transparent"
            stroke={currentStroke}
            strokeWidth={
              isHovered
                ? THEME.groupNode.halo.strokeWidth.hovered
                : THEME.groupNode.halo.strokeWidth.normal
            }
            pointerEvents="stroke"
            data-target-x={targetBounds?.x}
            data-target-y={targetBounds?.y}
            data-target-width={targetBounds?.width}
            data-target-height={targetBounds?.height}
            data-opacity="1"
            data-target-opacity="0.3"
            data-initial-stroke={currentStroke}
            data-target-stroke={THEME.groupNode.colors.border}
            data-initial-fill="transparent"
            data-target-fill={THEME.groupNode.colors.background}
            data-animating={isCollapsing ? 'true' : undefined}
            onMouseEnter={() => setHoveredId(halo.groupId)}
            onMouseLeave={() =>
              setHoveredId((current) => (current === halo.groupId ? null : current))
            }
            onDoubleClick={(event) => {
              event.stopPropagation();
              if (event.metaKey || event.ctrlKey) {
                return;
              }

              setCollapsingId(halo.groupId);

              const rect = rectRefs.current.get(halo.groupId);
              if (rect && targetBounds && typeof rect.animate === 'function') {
                const targetX = targetBounds.x * zoom + x;
                const targetY = targetBounds.y * zoom + y;
                const targetWidth = targetBounds.width * zoom;
                const targetHeight = targetBounds.height * zoom;

                // Get colors for animation
                const initialStroke = rect.getAttribute('data-initial-stroke');
                const targetStroke = rect.getAttribute('data-target-stroke');
                const initialFill = rect.getAttribute('data-initial-fill');
                const targetFill = rect.getAttribute('data-target-fill');

                // Animate using Web Animations API (need string values for SVG)
                const animation = rect.animate([
                  {
                    x: `${screenX}px`,
                    y: `${screenY}px`,
                    width: `${screenWidth}px`,
                    height: `${screenHeight}px`,
                    opacity: 1.0,
                    stroke: initialStroke,
                    fill: initialFill,
                  },
                  {
                    x: `${targetX}px`,
                    y: `${targetY}px`,
                    width: `${targetWidth}px`,
                    height: `${targetHeight}px`,
                    opacity: 0.3,
                    stroke: targetStroke,
                    fill: targetFill,
                  },
                ], {
                  duration: 400,
                  easing: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
                  fill: 'forwards',
                });

                // Wait for animation to finish before collapsing
                animation.onfinish = () => {
                  onCollapse?.(halo.groupId);
                };
              } else {
                // No animation support, collapse immediately
                onCollapse?.(halo.groupId);
              }
            }}
          />
        );
      })}

      {/* Expand overlay - temporary rect for expand animation */}
      {expandingGroupId && (() => {
        const groupNode = collapsedGroups.find(g => g.id === expandingGroupId);
        if (!groupNode) return null;

        const nodeDims = getNodeDimensions(groupNode);
        const nodeScreenX = groupNode.position.x * zoom + x;
        const nodeScreenY = groupNode.position.y * zoom + y;
        const nodeScreenWidth = nodeDims.width * zoom;
        const nodeScreenHeight = nodeDims.height * zoom;

        return (
          <rect
            ref={expandOverlayRef}
            x={nodeScreenX}
            y={nodeScreenY}
            width={nodeScreenWidth}
            height={nodeScreenHeight}
            rx={THEME.groupNode.halo.borderRadius}
            ry={THEME.groupNode.halo.borderRadius}
            fill={THEME.groupNode.colors.background}
            stroke={THEME.groupNode.colors.border}
            strokeWidth={1}
            pointerEvents="none"
            data-expanding="true"
          />
        );
      })()}
    </svg>
  );
};
