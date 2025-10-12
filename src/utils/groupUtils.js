// ABOUTME: Unified group manager handling creation, collapse, visibility, and halos
//
// IMPORTANT: This file manages GROUP COLLAPSE only (via isCollapsed property).
// There is a SEPARATE collapse system for subtrees (via data.collapsed in App.jsx).
//
// GROUP COLLAPSE (this file):
// - Uses isCollapsed: true/false on group nodes
// - Managed by backend API (toggleGroupExpansion)
// - Affects nodes based on parentGroupId hierarchy
// - Creates synthetic edges for collapsed groups
// - Nodes hidden when their parent group is collapsed
//
// SUBTREE COLLAPSE (Alt+Click in App.jsx):
// - Uses data.collapsed: true/false on any node
// - Frontend-only (no backend API)
// - Affects nodes based on edge-based hierarchy
// - Uses collapseSubtreeByHandles() function
// - No synthetic edges generated
//
// These two systems are independent but can coexist on the same nodes.

import { createElement, useState } from 'react';
import { useViewport } from '@xyflow/react';
import { THEME } from '../constants/theme.js';

const GROUP_EDGE_PREFIX = 'group-edge-';

const buildNodeMap = (nodes) =>
  nodes.reduce((acc, node) => {
    acc.set(node.id, node);
    return acc;
  }, new Map());

/**
 * Traverse descendants by parentGroupId (used by multiple operations).
 */
export const getGroupDescendants = (nodeId, nodes) => {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return [];

  const visited = new Set();
  const descendants = [];

  const traverse = (currentId) => {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    const children = nodes.filter((n) => n.parentGroupId === currentId);
    children.forEach((child) => {
      descendants.push(child.id);
      traverse(child.id);
    });
  };

  traverse(nodeId);
  return descendants;
};

export const detectCircularReference = (nodeId, potentialParentId, nodes) => {
  const node = nodes.find((n) => n.id === nodeId);
  const potentialParent = nodes.find((n) => n.id === potentialParentId);

  if (!node || !potentialParent) return false;

  const descendants = getGroupDescendants(nodeId, nodes);
  return descendants.includes(potentialParentId);
};

export const validateGroupMembership = (selectedIds, nodes) => {
  if (selectedIds.length < 2) {
    return { valid: false, error: 'Group must contain at least 2 nodes' };
  }

  const uniqueIds = new Set(selectedIds);
  if (uniqueIds.size !== selectedIds.length) {
    return { valid: false, error: 'Cannot group duplicate nodes' };
  }

  for (const id of selectedIds) {
    const node = nodes.find((n) => n.id === id);
    if (!node) {
      return { valid: false, error: `Node ${id} not found` };
    }
  }

  for (let i = 0; i < selectedIds.length; i += 1) {
    for (let j = i + 1; j < selectedIds.length; j += 1) {
      const a = selectedIds[i];
      const b = selectedIds[j];

      const descendantsA = getGroupDescendants(a, nodes);
      if (descendantsA.includes(b)) {
        return { valid: false, error: 'Cannot group node with its descendant' };
      }

      const descendantsB = getGroupDescendants(b, nodes);
      if (descendantsB.includes(a)) {
        return { valid: false, error: 'Cannot group node with its descendant' };
      }
    }
  }

  return { valid: true };
};

const computeAncestorHiddenSet = (nodes) => {
  const nodeMap = buildNodeMap(nodes);
  const memo = new Map();

  const isHiddenByAncestor = (node) => {
    if (memo.has(node.id)) return memo.get(node.id);

    let current = node;
    while (current?.parentGroupId) {
      const parent = nodeMap.get(current.parentGroupId);
      if (!parent) break;
      if (parent.isCollapsed === true) {
        memo.set(node.id, true);
        return true;
      }
      current = parent;
    }

    memo.set(node.id, false);
    return false;
  };

  const hidden = new Set();
  nodes.forEach((node) => {
    if (isHiddenByAncestor(node)) {
      hidden.add(node.id);
    }
  });

  return hidden;
};

export const applyGroupVisibility = (nodes, edges) => {
  const ancestorHidden = computeAncestorHiddenSet(nodes);

  const nextNodes = nodes.map((node) => {
    const hiddenByAncestor = ancestorHidden.has(node.id);
    const previousGroupHidden = node.groupHidden ?? false;
    const previouslyHidden = node.hidden ?? false;

    if (node.type === 'group') {
      const isCollapsed = node.isCollapsed === true;
      // Group node is visible when collapsed, hidden when expanded (shows members instead)
      // Also hidden if inside a collapsed ancestor group
      return {
        ...node,
        groupHidden: hiddenByAncestor,
        hidden: hiddenByAncestor || !isCollapsed,
      };
    }

    return {
      ...node,
      groupHidden: hiddenByAncestor,
      hidden: hiddenByAncestor || (previouslyHidden && !previousGroupHidden),
    };
  });

  // Filter out old synthetic edges and compute new ones dynamically
  const realEdges = edges.filter(e => !e.data?.isSyntheticGroupEdge);
  const syntheticEdges = computeSyntheticEdges(nextNodes, realEdges);
  const allEdges = [...realEdges, ...syntheticEdges];

  const nodeHiddenLookup = nextNodes.reduce((acc, node) => {
    acc.set(node.id, { hidden: node.hidden, groupHidden: node.groupHidden });
    return acc;
  }, new Map());

  const nextEdges = allEdges.map((edge) => {
    const sourceInfo = nodeHiddenLookup.get(edge.source);
    const targetInfo = nodeHiddenLookup.get(edge.target);
    const effectiveGroupHidden = (sourceInfo?.groupHidden ?? false) || (targetInfo?.groupHidden ?? false);
    const effectiveHidden = (sourceInfo?.hidden ?? false) || (targetInfo?.hidden ?? false);

    // If either endpoint node is hidden, hide the edge
    return {
      ...edge,
      groupHidden: effectiveGroupHidden,
      hidden: effectiveHidden,
    };
  });

  return { nodes: nextNodes, edges: nextEdges };
};

/**
 * Computes synthetic edges for all collapsed groups.
 * Synthetic edges are boundary edges that connect external nodes to/from a collapsed group.
 * These replace the individual member edges when a group is collapsed.
 */
const computeSyntheticEdges = (nodes, edges) => {
  const syntheticEdges = [];

  // Find all collapsed groups
  const collapsedGroups = nodes.filter(n => n.type === 'group' && n.isCollapsed === true);

  collapsedGroups.forEach(groupNode => {
    const groupId = groupNode.id;
    const memberIds = getGroupDescendants(groupId, nodes);
    const memberSet = new Set(memberIds);

    // Track unique synthetic edges (avoid duplicates)
    const syntheticMap = new Map();

    edges.forEach((edge) => {
      // Skip edges that are already synthetic (from previous computation)
      if (edge.data?.isSyntheticGroupEdge) return;

      const sourceIsMember = memberSet.has(edge.source);
      const targetIsMember = memberSet.has(edge.target);

      // Outbound: member -> external becomes group -> external
      if (sourceIsMember && !targetIsMember) {
        const key = `${groupId}->${edge.target}`;
        if (!syntheticMap.has(key)) {
          syntheticMap.set(key, {
            id: `${GROUP_EDGE_PREFIX}${key}`,
            source: groupId,
            target: edge.target,
            type: 'smoothstep',
            data: { isSyntheticGroupEdge: true },
          });
        }
      }
      // Inbound: external -> member becomes external -> group
      else if (!sourceIsMember && targetIsMember) {
        const key = `${edge.source}->${groupId}`;
        if (!syntheticMap.has(key)) {
          syntheticMap.set(key, {
            id: `${GROUP_EDGE_PREFIX}${key}`,
            source: edge.source,
            target: groupId,
            type: 'smoothstep',
            data: { isSyntheticGroupEdge: true },
          });
        }
      }
    });

    syntheticEdges.push(...Array.from(syntheticMap.values()));
  });

  return syntheticEdges;
};

const normalizeState = (nodes, edges) => applyGroupVisibility(nodes, edges);

export const createGroup = (flow, options) => {
  const { nodes, edges } = flow;
  const {
    groupNode,
    memberIds,
    collapse = true,
  } = options;

  if (!groupNode || !groupNode.id) {
    throw new Error('groupNode with valid id is required');
  }

  const groupId = groupNode.id;
  const memberSet = new Set(memberIds);

  const updatedNodes = nodes.map((node) =>
    memberSet.has(node.id) ? { ...node, parentGroupId: groupId } : node
  );

  const normalizedGroupNode = {
    ...groupNode,
    type: 'group',
    isCollapsed: collapse ? true : groupNode.isCollapsed ?? false,
    hidden: false,
    groupHidden: false,
  };

  const nextNodes = [...updatedNodes, normalizedGroupNode];

  // Synthetic edges are now computed dynamically in applyGroupVisibility
  return normalizeState(nextNodes, edges);
};

export const toggleGroupExpansion = (flow, groupId, collapseState = null) => {
  const { nodes, edges } = flow;
  const groupNode = nodes.find((node) => node.id === groupId && node.type === 'group');
  if (!groupNode) return flow;

  const currentCollapsed = groupNode.isCollapsed === true;
  const nextCollapsed = collapseState === null ? !currentCollapsed : collapseState;

  const updatedNodes = nodes.map((node) =>
    node.id === groupId
      ? { ...node, isCollapsed: nextCollapsed, hidden: false, groupHidden: false }
      : node
  );

  return normalizeState(updatedNodes, edges);
};

export const ungroup = (flow, groupId) => {
  const { nodes, edges } = flow;
  const groupNode = nodes.find((node) => node.id === groupId && node.type === 'group');
  if (!groupNode) return flow;

  const updatedNodes = nodes
    .filter((node) => node.id !== groupId)
    .map((node) =>
      node.parentGroupId === groupId
        ? { ...node, parentGroupId: undefined }
        : node
    );

  // Synthetic edges are automatically cleaned up by applyGroupVisibility
  // since the group no longer exists, no synthetic edges will be generated for it
  return normalizeState(updatedNodes, edges);
};

export const collapseSubtreeByHandles = (flow, nodeId, collapsed, getDescendantsFn = null) => {
  const { nodes, edges } = flow;
  const target = nodes.find((node) => node.id === nodeId);
  if (!target) return flow;

  const descendants = getDescendantsFn
    ? getDescendantsFn(nodeId, nodes, edges).map((entry) => (typeof entry === 'string' ? entry : entry.id))
    : getGroupDescendants(nodeId, nodes);
  const descendantSet = new Set(descendants);

  const updatedNodes = nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, data: { ...node.data, collapsed } };
    }
    if (descendantSet.has(node.id)) {
      return { ...node, hidden: collapsed };
    }
    return node;
  });

  const updatedEdges = edges.map((edge) =>
    descendantSet.has(edge.source) || descendantSet.has(edge.target)
      ? { ...edge, hidden: collapsed }
      : edge
  );

  return { nodes: updatedNodes, edges: updatedEdges };
};

export const addChildNode = (flow, parentId, factory) => {
  const { nodes, edges } = flow;
  const parent = nodes.find((node) => node.id === parentId);
  if (!parent) return flow;

  const { node: newNode, edge: newEdge } = factory(parent);

  const nextNodes = [...nodes, newNode];
  const nextEdges = [...edges, newEdge];

  return normalizeState(nextNodes, nextEdges);
};

export const getExpandedGroupHalos = (nodes, getNodeDimensions, padding = 16) => {
  if (!Array.isArray(nodes) || !nodes.length) return [];

  const halos = [];

  nodes.forEach((groupNode) => {
    if (groupNode?.type !== 'group') return;
    if (groupNode.groupHidden) return;

    const isCollapsed = groupNode.isCollapsed === true;
    if (isCollapsed) return;

    const descendantIds = getGroupDescendants(groupNode.id, nodes);
    if (!descendantIds.length) return;

    const descendants = descendantIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node) => node && !node.hidden && !node.groupHidden);

    if (!descendants.length) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    descendants.forEach((node) => {
      const { width = 0, height = 0 } = getNodeDimensions ? getNodeDimensions(node) : {};
      const x = node?.position?.x ?? 0;
      const y = node?.position?.y ?? 0;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return;
    }

    halos.push({
      groupId: groupNode.id,
      label: groupNode?.data?.label ?? 'Group',
      bounds: {
        x: minX - padding,
        y: minY - padding,
        width: (maxX - minX) + padding * 2,
        height: (maxY - minY) + padding * 2,
      },
    });
  });

  return halos;
};

export const constants = {
  GROUP_EDGE_PREFIX,
};

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

  return createElement(
    'svg',
    {
      style: { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1500 },
      width: '100%',
      height: '100%'
    },
    sortedHalos.map((halo) => {
      const screenX = halo.bounds.x * zoom + x;
      const screenY = halo.bounds.y * zoom + y;
      const screenWidth = halo.bounds.width * zoom;
      const screenHeight = halo.bounds.height * zoom;
      const isHovered = hoveredId === halo.groupId;

      return createElement('rect', {
        key: halo.groupId,
        x: screenX,
        y: screenY,
        width: screenWidth,
        height: screenHeight,
        rx: THEME.groupNode.halo.borderRadius,
        ry: THEME.groupNode.halo.borderRadius,
        fill: 'none',
        stroke: isHovered ? THEME.groupNode.halo.colors.hovered : THEME.groupNode.halo.colors.normal,
        strokeWidth: isHovered ? THEME.groupNode.halo.strokeWidth.hovered : THEME.groupNode.halo.strokeWidth.normal,
        pointerEvents: 'stroke',
        onMouseEnter: () => setHoveredId(halo.groupId),
        onMouseLeave: () => setHoveredId((current) => (current === halo.groupId ? null : current)),
        onDoubleClick: (event) => {
          event.stopPropagation();
          if (event.metaKey || event.ctrlKey) {
            return;
          }
          onCollapse?.(halo.groupId);
        }
      });
    })
  );
};
