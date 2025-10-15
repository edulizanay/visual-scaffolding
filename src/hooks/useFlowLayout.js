// ABOUTME: Custom hook for React Flow layout management with Dagre
// ABOUTME: Handles graph layout calculation, animation, and viewport fitting
import { useCallback, useState, useRef, useEffect } from 'react';
import { timer } from 'd3-timer';
import { getOutgoers } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { THEME } from '../constants/theme.js';

// Traverse descendants by edges (for Alt+Click collapse)
export const getAllDescendants = (nodeId, nodes, edges) => {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return [];

  const children = getOutgoers(node, nodes, edges);
  const descendants = [...children];

  children.forEach(child => {
    descendants.push(...getAllDescendants(child.id, nodes, edges));
  });

  return descendants;
};

export const getLayoutedElements = (nodes, edges, direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  const isHorizontal = direction === 'LR';

  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: THEME.dagre.spacing.horizontal,
    nodesep: THEME.dagre.spacing.vertical,
  });

  const visibleNodes = nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => !node.hidden)
    .sort((a, b) => {
      const groupA = a.node.parentGroupId ?? '';
      const groupB = b.node.parentGroupId ?? '';
      return groupA.localeCompare(groupB) || a.index - b.index;
    })
    .map(({ node }) => node);

  const visibleNodeMap = new Map(visibleNodes.map(node => [node.id, node]));

  visibleNodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: THEME.node.dimensions.width,
      height: THEME.node.dimensions.height
    });
  });

  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));

  const edgesBySource = new Map();
  edges.forEach((edge, index) => {
    if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) {
      return;
    }

    const bucket = edgesBySource.get(edge.source);
    const entry = { edge, index };
    if (bucket) {
      bucket.push(entry);
    } else {
      edgesBySource.set(edge.source, [entry]);
    }
  });

  const compareTargets = (left, right) => {
    const nodeA = visibleNodeMap.get(left.edge.target);
    const nodeB = visibleNodeMap.get(right.edge.target);
    const groupA = nodeA?.parentGroupId ?? '';
    const groupB = nodeB?.parentGroupId ?? '';
    const groupedA = groupA ? 0 : 1;
    const groupedB = groupB ? 0 : 1;

    return groupedA - groupedB
      || groupA.localeCompare(groupB)
      || left.index - right.index;
  };

  edgesBySource.forEach((bucket) => {
    // Emit grouped children first so Dagre keeps them contiguous, then reuse creation order.
    bucket.sort(compareTargets).forEach(({ edge }) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = !node.hidden && dagreGraph.node(node.id);
    if (!nodeWithPosition) return node;

    return {
      ...node,
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      position: {
        x: nodeWithPosition.x - THEME.node.dimensions.width / 2,
        y: nodeWithPosition.y - THEME.node.dimensions.height / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
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
