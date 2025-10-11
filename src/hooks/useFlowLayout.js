// ABOUTME: Custom hook for React Flow layout management with Dagre
// ABOUTME: Handles graph layout calculation, animation, and viewport fitting
import { useCallback, useState, useRef, useEffect } from 'react';
import { timer } from 'd3-timer';
import { getOutgoers } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { DEFAULT_VISUAL_SETTINGS } from '../../shared/visualSettings.js';

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

// Traverse descendants by parentGroupId (for group collapse)
export const getAllDescendantsByGroup = (nodeId, nodes) => {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return [];

  // Track visited nodes to prevent infinite loops from circular references
  const visited = new Set();
  const descendants = [];

  const traverse = (currentNodeId) => {
    if (visited.has(currentNodeId)) return;
    visited.add(currentNodeId);

    // Find all nodes that have this node as parentGroupId
    const children = nodes.filter(n => n.parentGroupId === currentNodeId);

    children.forEach(child => {
      descendants.push(child.id);
      // Recursively traverse nested groups
      traverse(child.id);
    });
  };

  traverse(nodeId);

  return descendants;
};

// Detect if making nodeId a member of potentialParentId would create circular reference
export const detectCircularReference = (nodeId, potentialParentId, nodes) => {
  const node = nodes.find(n => n.id === nodeId);
  const potentialParent = nodes.find(n => n.id === potentialParentId);

  if (!node || !potentialParent) return false;

  // Check if potentialParent is a descendant of nodeId
  const descendants = getAllDescendantsByGroup(nodeId, nodes);
  return descendants.includes(potentialParentId);
};

// Validate that a set of nodes can be grouped together
export const validateGroupMembership = (selectedIds, nodes) => {
  // Require at least 2 nodes
  if (selectedIds.length < 2) {
    return { valid: false, error: 'Group must contain at least 2 nodes' };
  }

  // Check for duplicates
  const uniqueIds = new Set(selectedIds);
  if (uniqueIds.size !== selectedIds.length) {
    return { valid: false, error: 'Cannot group duplicate nodes' };
  }

  // Check all nodes exist
  for (const id of selectedIds) {
    const node = nodes.find(n => n.id === id);
    if (!node) {
      return { valid: false, error: `Node ${id} not found` };
    }
  }

  // Check for ancestor-descendant relationships
  for (let i = 0; i < selectedIds.length; i++) {
    for (let j = i + 1; j < selectedIds.length; j++) {
      const id1 = selectedIds[i];
      const id2 = selectedIds[j];

      // Check if id1 is ancestor of id2
      const descendants1 = getAllDescendantsByGroup(id1, nodes);
      if (descendants1.includes(id2)) {
        return { valid: false, error: `Cannot group node with its descendant` };
      }

      // Check if id2 is ancestor of id1
      const descendants2 = getAllDescendantsByGroup(id2, nodes);
      if (descendants2.includes(id1)) {
        return { valid: false, error: `Cannot group node with its descendant` };
      }
    }
  }

  return { valid: true };
};

// Get all node IDs that should be hidden when collapsing a group
export const getAffectedNodesForCollapse = (groupId, nodes) => {
  return getAllDescendantsByGroup(groupId, nodes);
};

// Get all edge IDs that should be hidden (edges connected to hidden nodes)
export const getAffectedEdgesForCollapse = (hiddenNodeIds, edges) => {
  const hiddenSet = new Set(hiddenNodeIds);
  return edges
    .filter(edge => hiddenSet.has(edge.source) || hiddenSet.has(edge.target))
    .map(edge => edge.id);
};

export const getLayoutedElements = (nodes, edges, visualSettings, direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  const isHorizontal = direction === 'LR';
  const settings = visualSettings || DEFAULT_VISUAL_SETTINGS;
  const dagreSpacing = settings.dimensions?.dagre || DEFAULT_VISUAL_SETTINGS.dimensions.dagre;
  const defaultNode = settings.dimensions?.node?.default || DEFAULT_VISUAL_SETTINGS.dimensions.node.default;
  const overrides = settings.dimensions?.node?.overrides || {};

  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: dagreSpacing.horizontal ?? DEFAULT_VISUAL_SETTINGS.dimensions.dagre.horizontal,
    nodesep: dagreSpacing.vertical ?? DEFAULT_VISUAL_SETTINGS.dimensions.dagre.vertical,
  });

  const visibleNodes = nodes.filter(node => !node.hidden);

  visibleNodes.forEach((node) => {
    const override = overrides[node.id] || {};
    const width = override.width ?? defaultNode.width;
    const height = override.height ?? defaultNode.height;
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    if (node.hidden) return node;

    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) return node;

    const override = overrides[node.id] || {};
    const width = override.width ?? defaultNode.width;
    const height = override.height ?? defaultNode.height;

    return {
      ...node,
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

export function useFlowLayout(setNodes, setEdges, reactFlowInstance, visualSettings) {
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimerRef = useRef(null);
  const settings = visualSettings || DEFAULT_VISUAL_SETTINGS;
  const fitViewPadding = settings.dimensions?.fitViewPadding ?? DEFAULT_VISUAL_SETTINGS.dimensions.fitViewPadding;

  const applyLayoutWithAnimation = useCallback((currentNodes, currentEdges) => {
    // Stop any existing animation
    if (animationTimerRef.current) {
      animationTimerRef.current.stop();
    }

    // Calculate final layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      currentNodes,
      currentEdges,
      visualSettings,
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
        if (!targetNode) return targetNode || node;

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

  }, [setNodes, setEdges, reactFlowInstance, visualSettings, fitViewPadding]);

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
    getLayoutedElements,
  };
}
