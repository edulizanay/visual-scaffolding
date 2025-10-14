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

const buildGroupDepthMap = (nodes, edges) => {
  const depthById = new Map();

  if (!Array.isArray(nodes) || nodes.length === 0) {
    return depthById;
  }

  const nodeById = new Map();
  nodes.forEach((node) => {
    if (node && typeof node.id === 'string') {
      nodeById.set(node.id, node);
    }
  });

  const visibleGroupMembers = new Map();

  nodes.forEach((node) => {
    if (!node || node.hidden || node.groupHidden) return;
    if (!node.parentGroupId) return;

    const members = visibleGroupMembers.get(node.parentGroupId) ?? new Set();
    members.add(node.id);
    visibleGroupMembers.set(node.parentGroupId, members);
  });

  if (visibleGroupMembers.size === 0) {
    return depthById;
  }

  const outgoingByGroup = new Map();
  const incomingByGroup = new Map();

  edges.forEach((edge) => {
    if (!edge) return;
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) return;
    if (sourceNode.hidden || sourceNode.groupHidden) return;
    if (targetNode.hidden || targetNode.groupHidden) return;

    const groupId = sourceNode.parentGroupId;
    if (!groupId || groupId !== targetNode.parentGroupId) return;

    const groupMembers = visibleGroupMembers.get(groupId);
    if (!groupMembers) return;

    let outgoing = outgoingByGroup.get(groupId);
    if (!outgoing) {
      outgoing = new Map();
      outgoingByGroup.set(groupId, outgoing);
    }

    let children = outgoing.get(edge.source);
    if (!children) {
      children = new Set();
      outgoing.set(edge.source, children);
    }
    children.add(edge.target);

    let incoming = incomingByGroup.get(groupId);
    if (!incoming) {
      incoming = new Map();
      incomingByGroup.set(groupId, incoming);
    }

    let parents = incoming.get(edge.target);
    if (!parents) {
      parents = new Set();
      incoming.set(edge.target, parents);
    }
    parents.add(edge.source);
  });

  visibleGroupMembers.forEach((memberSet, groupId) => {
    const members = Array.from(memberSet);
    if (members.length === 0) return;

    const incoming = incomingByGroup.get(groupId) ?? new Map();
    const outgoing = outgoingByGroup.get(groupId) ?? new Map();

    const roots = members.filter(memberId => {
      const parents = incoming.get(memberId);
      return !parents || parents.size === 0;
    });

    const queue = roots.length > 0
      ? roots.map(memberId => ({ id: memberId, depth: 0 }))
      : members.map(memberId => ({ id: memberId, depth: 0 }));

    const visited = new Set();
    const memberLookup = new Set(members);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current.id)) continue;

      visited.add(current.id);
      const existingDepth = depthById.get(current.id);
      if (existingDepth === undefined || current.depth < existingDepth) {
        depthById.set(current.id, current.depth);
      }

      const children = outgoing.get(current.id);
      if (!children || children.size === 0) continue;

      children.forEach((childId) => {
        if (!memberLookup.has(childId)) return;
        queue.push({ id: childId, depth: current.depth + 1 });
      });
    }

    members.forEach((memberId) => {
      if (!depthById.has(memberId)) {
        depthById.set(memberId, 0);
      }
    });
  });

  return depthById;
};

const compressGroupMembers = (nodes, gap, depthById = new Map()) => {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return nodes;
  }
  if (!Number.isFinite(gap) || gap <= 0) {
    return nodes;
  }

  const result = nodes.slice();
  const membersByGroup = new Map();

  nodes.forEach((node, index) => {
    if (!node || node.hidden || node.groupHidden) return;

    const parentGroupId = node.parentGroupId;
    if (!parentGroupId) return;

    const positionY = node?.position?.y;
    if (!Number.isFinite(positionY)) return;

    const depth = depthById.get(node.id) ?? 0;

    let depthBuckets = membersByGroup.get(parentGroupId);
    if (!depthBuckets) {
      depthBuckets = new Map();
      membersByGroup.set(parentGroupId, depthBuckets);
    }

    const members = depthBuckets.get(depth) ?? [];
    members.push({ index, y: positionY });
    depthBuckets.set(depth, members);
  });

  membersByGroup.forEach((depthBuckets) => {
    depthBuckets.forEach((members) => {
      if (!Array.isArray(members) || members.length < 2) return;

      const sorted = members.slice().sort((a, b) => a.y - b.y);
      const firstY = sorted[0].y;
      const lastY = sorted[sorted.length - 1].y;

      if (!Number.isFinite(firstY) || !Number.isFinite(lastY)) {
        return;
      }

      const centerY = (firstY + lastY) / 2;
      const offsetBase = (sorted.length - 1) / 2;

      sorted.forEach((entry, positionIndex) => {
        const originalNode = nodes[entry.index];
        if (!originalNode) return;

        const nextY = centerY + (positionIndex - offsetBase) * gap;
        const nextPosition = {
          ...(originalNode.position || {}),
          y: nextY,
        };

        result[entry.index] = {
          ...originalNode,
          position: nextPosition,
        };
      });
    });
  });

  return result;
};

export const getLayoutedElements = (nodes, edges, direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  const isHorizontal = direction === 'LR';

  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: THEME.dagre.spacing.horizontal,
    nodesep: THEME.dagre.spacing.vertical,
  });

  const visibleNodes = nodes.filter(node => !node.hidden);

  visibleNodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: THEME.node.dimensions.width,
      height: THEME.node.dimensions.height
    });
  });

  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));

  const syntheticEdges = edges.filter(e => e.data?.isSyntheticGroupEdge);
  const skippedSynthetic = syntheticEdges.filter(e =>
    !visibleNodeIds.has(e.source) || !visibleNodeIds.has(e.target)
  );

  if (skippedSynthetic.length > 0) {
    console.log('[DEBUG DAGRE] Skipping synthetic edges:', skippedSynthetic.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceVisible: visibleNodeIds.has(e.source),
      targetVisible: visibleNodeIds.has(e.target),
    })));
  }

  edges.forEach((edge) => {
    if (visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    if (node.hidden) return node;

    const nodeWithPosition = dagreGraph.node(node.id);
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

  const groupGap = THEME?.groupNode?.layout?.memberVerticalGap ?? 0;
  const depthById = buildGroupDepthMap(newNodes, edges);
  const compactedNodes = compressGroupMembers(newNodes, groupGap, depthById);

  return { nodes: compactedNodes, edges };
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
    getLayoutedElements,
  };
}
