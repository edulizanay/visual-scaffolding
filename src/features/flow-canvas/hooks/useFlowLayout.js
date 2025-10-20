// ABOUTME: Custom hook for React Flow layout management with Dagre
// ABOUTME: Handles graph layout calculation, animation, and viewport fitting
import { useCallback, useState, useRef, useEffect } from 'react';
import { timer } from 'd3-timer';
import { THEME } from '../../../constants/theme.js';
import { applyDagreLayout } from '../../../../shared/layout/applyDagreLayout.js';
import { getAllDescendants } from '../../../../shared/flowUtils/subtreeHelpers.js';

// Re-export for backwards compatibility
export { getAllDescendants };

export const getLayoutedElements = (nodes, edges, direction = 'LR') => {
  return applyDagreLayout({
    nodes,
    edges,
    direction,
    nodeDimensions: {
      width: THEME.node.dimensions.width,
      height: THEME.node.dimensions.height,
    },
  });
};

export function useFlowLayout(setNodes, setEdges, reactFlowInstance) {
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimerRef = useRef(null);
  const fitViewPadding = THEME.canvas.fitViewPadding;

  const applyLayoutWithAnimation = useCallback((currentNodes, currentEdges) => {
    // Stop any existing animation
    if (animationTimerRef.current) {
      animationTimerRef.current.stop();
    }

    // Calculate final layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      currentNodes,
      currentEdges,
      'LR'
    );

    // Set animating flag
    setIsAnimating(true);

    const DURATION = 800;
    const startTime = Date.now();

    // Start animation
    animationTimerRef.current = timer(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / DURATION, 1);

      // Cubic ease-out (matches CSS cubic-bezier(0.4, 0, 0.2, 1))
      const eased = 1 - Math.pow(1 - progress, 3);

      // Interpolate node positions
      const animatedNodes = currentNodes.map((node) => {
        const targetNode = layoutedNodes.find(n => n.id === node.id);
        if (!targetNode) return node;

        return {
          ...targetNode,
          position: {
            x: node.position.x + (targetNode.position.x - node.position.x) * eased,
            y: node.position.y + (targetNode.position.y - node.position.y) * eased,
          },
        };
      });

      setNodes(animatedNodes);
      setEdges(layoutedEdges);

      // Animation complete
      if (progress === 1) {
        animationTimerRef.current.stop();
        setNodes(layoutedNodes); // Ensure exact final positions
        setEdges(layoutedEdges);
        setIsAnimating(false);

        // Center viewport
        setTimeout(() => {
          reactFlowInstance.current?.fitView({ duration: 400, padding: fitViewPadding });
        }, 50);
      }
    });

  }, [setNodes, setEdges, reactFlowInstance, fitViewPadding]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationTimerRef.current) {
        animationTimerRef.current.stop();
        setIsAnimating(false);
      }
    };
  }, []);

  return {
    applyLayoutWithAnimation,
    isAnimating,
    fitViewPadding,
    getAllDescendants,
  };
}
