// ABOUTME: Group node operations (create, ungroup, collapse, halos, synthetic edges)
// ABOUTME: Manages GROUP collapse (isCollapsed) only; subtree collapse (data.collapsed) lives in App.jsx

import { THEME } from '../../../constants/theme.js';
import { collapseSubtreeByHandles as collapseSubtreeCore } from '../../../../shared/flowUtils/subtreeHelpers.js';

const GROUP_EDGE_PREFIX = 'group-edge-';

const buildNodeMap = (nodes) =>
  nodes.reduce((acc, node) => {
    acc.set(node.id, node);
    return acc;
  }, new Map());

/**
 * Normalizes a single axis config (x or y) by merging with fallback defaults.
 * Validates that all numeric properties are actually numbers, falling back otherwise.
 */
const normalizeAxisConfig = (value, fallback) => {
  if (typeof value === 'number') {
    return { ...fallback, base: value };
  }
  if (!value || typeof value !== 'object') {
    return fallback;
  }
  return {
    base: typeof value.base === 'number' ? value.base : fallback.base,
    increment: typeof value.increment === 'number' ? value.increment : fallback.increment,
    decay: typeof value.decay === 'number' ? value.decay : fallback.decay,
    minStep: typeof value.minStep === 'number' ? value.minStep : fallback.minStep,
  };
};

/**
 * Extracts x/y axis pair from config (handles number, object with x/y, or object with base).
 */
const extractAxisPair = (config, defaults) => ({
  x: normalizeAxisConfig(config?.x ?? config?.base ?? config, defaults.x),
  y: normalizeAxisConfig(config?.y ?? config?.base ?? config, defaults.y),
});

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

// validate group creation, at least two nodes, no duplicates, no circular references
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

  // Pre-compute descendants once per node to avoid O(n²) traversals
  const descendantMap = new Map(
    selectedIds.map((id) => [id, new Set(getGroupDescendants(id, nodes))])
  );

  for (let i = 0; i < selectedIds.length; i += 1) {
    for (let j = i + 1; j < selectedIds.length; j += 1) {
      const a = selectedIds[i];
      const b = selectedIds[j];

      if (descendantMap.get(a).has(b) || descendantMap.get(b).has(a)) {
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

/**
 * Computes visibility state for a node (group or regular).
 *
 * Group nodes: Visible when collapsed, hidden when expanded (shows members instead).
 * Regular nodes: Hidden if inside a collapsed ancestor or explicitly hidden by user.
 *
 * Preserves user-initiated hiding (hidden=true but groupHidden=false) so that
 * manually hidden nodes stay hidden even when ancestor groups expand.
 */
const computeNodeVisibility = (node, hiddenByAncestor) => {
  const subtreeHidden = node.subtreeHidden === true;

  // Calculate node-type-specific hiding logic
  let nodeSpecificHidden;
  if (node.type === 'group') {
    // Group nodes are hidden when expanded (NOT collapsed)
    // This shows the halo border and members instead of the group wrapper
    const isCollapsed = node.isCollapsed === true;
    nodeSpecificHidden = !isCollapsed;
  } else {
    // Regular nodes preserve user-initiated hiding
    // Only hide if previously hidden AND that hiding wasn't caused by group collapse
    const previouslyHidden = node.hidden ?? false;
    const previousGroupHidden = node.groupHidden ?? false;
    nodeSpecificHidden = previouslyHidden && !previousGroupHidden;
  }

  const result = {
    ...node,
    groupHidden: hiddenByAncestor,
    hidden: hiddenByAncestor || subtreeHidden || nodeSpecificHidden,
  };

  // Cleanup: Set or remove subtreeHidden flag based on current state
  if (subtreeHidden) {
    result.subtreeHidden = true;
  } else if ('subtreeHidden' in result) {
    delete result.subtreeHidden;
  }

  return result;
};

/**
 * Applies visibility rules to edges based on their endpoint nodes.
 * An edge is hidden if either its source or target node is hidden.
 */
const applyEdgeVisibility = (edges, nodeVisibilityMap) => {
  return edges.map((edge) => {
    const sourceInfo = nodeVisibilityMap.get(edge.source);
    const targetInfo = nodeVisibilityMap.get(edge.target);
    const effectiveGroupHidden = (sourceInfo?.groupHidden ?? false) || (targetInfo?.groupHidden ?? false);
    const effectiveHidden = (sourceInfo?.hidden ?? false) || (targetInfo?.hidden ?? false);

    return {
      ...edge,
      groupHidden: effectiveGroupHidden,
      hidden: effectiveHidden,
    };
  });
};

/**
 * Computes visibility state for all nodes and edges based on group collapse state.
 * 1. Determines which nodes are hidden by collapsed ancestor groups
 * 2. Generates synthetic edges for collapsed groups
 * 3. Hides edges whose endpoints are hidden
 */
export const applyGroupVisibility = (nodes, edges) => {
  const ancestorHidden = computeAncestorHiddenSet(nodes);

  // Single pass: compute visibility and build lookup map simultaneously
  const { nextNodes, nodeHiddenLookup } = nodes.reduce(
    (acc, node) => {
      const hiddenByAncestor = ancestorHidden.has(node.id);
      const next = computeNodeVisibility(node, hiddenByAncestor);
      acc.nextNodes.push(next);
      acc.nodeHiddenLookup.set(next.id, {
        hidden: next.hidden,
        groupHidden: next.groupHidden,
      });
      return acc;
    },
    { nextNodes: [], nodeHiddenLookup: new Map() }
  );

  // Filter out old synthetic edges and compute new ones dynamically
  const realEdges = edges.filter(e => !e.data?.isSyntheticGroupEdge);
  const syntheticEdges = computeSyntheticEdges(nextNodes, realEdges);
  const allEdges = [...realEdges, ...syntheticEdges];

  const nextEdges = applyEdgeVisibility(allEdges, nodeHiddenLookup);

  return { nodes: nextNodes, edges: nextEdges };
};

/**
 * Creates a synthetic edge object for collapsed group boundaries.
 * Synthetic edges maintain visual flow continuity when groups are collapsed.
 */
const createSyntheticEdge = (source, target) => ({
  id: `${GROUP_EDGE_PREFIX}${source}->${target}`,
  source,
  target,
  type: 'smoothstep',
  data: { isSyntheticGroupEdge: true },
});

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
          syntheticMap.set(key, createSyntheticEdge(groupId, edge.target));
        }
      }
      // Inbound: external -> member becomes external -> group
      else if (!sourceIsMember && targetIsMember) {
        const key = `${edge.source}->${groupId}`;
        if (!syntheticMap.has(key)) {
          syntheticMap.set(key, createSyntheticEdge(edge.source, groupId));
        }
      }
    });

    syntheticEdges.push(...Array.from(syntheticMap.values()));
  });

  return syntheticEdges;
};

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
  return applyGroupVisibility(nextNodes, edges);
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

  return applyGroupVisibility(updatedNodes, edges);
};

export const ungroup = (flow, groupId) => {
  const { nodes, edges } = flow;
  const groupNode = nodes.find((node) => node.id === groupId && node.type === 'group');
  if (!groupNode) return flow;

  const parentGroupId = groupNode.parentGroupId;

  const updatedNodes = nodes
    .filter((node) => node.id !== groupId)
    .map((node) => {
      if (node.parentGroupId !== groupId) {
        return node;
      }

      const next = {
        ...node,
        hidden: false,
        groupHidden: false,
      };

      if (parentGroupId) {
        next.parentGroupId = parentGroupId;
      } else if ('parentGroupId' in next) {
        delete next.parentGroupId;
      }

      if ('subtreeHidden' in next) {
        delete next.subtreeHidden;
      }

      return next;
    });

  // Synthetic edges are automatically cleaned up by applyGroupVisibility
  // since the group no longer exists, no synthetic edges will be generated for it
  return applyGroupVisibility(updatedNodes, edges);
};

export const collapseSubtreeByHandles = (flow, nodeId, collapsed, getDescendantsFn = null) => {
  // Use shared core function, then reapply group visibility rules
  const result = collapseSubtreeCore(flow, nodeId, collapsed, getDescendantsFn);
  return applyGroupVisibility(result.nodes, result.edges);
};

export const addChildNode = (flow, parentId, factory) => {
  const { nodes, edges } = flow;
  const parent = nodes.find((node) => node.id === parentId);
  if (!parent) return flow;

  const { node: newNode, edge: newEdge } = factory(parent);

  const nextNodes = [...nodes, newNode];
  const nextEdges = [...edges, newEdge];

  return applyGroupVisibility(nextNodes, nextEdges);
};

const normalizeHaloPaddingConfig = (paddingConfig) => {
  const defaultAxis = { base: 16, increment: 0, decay: 1, minStep: 0 };
  const themePadding = THEME?.groupNode?.halo?.padding ?? {};

  const themeDefaults = extractAxisPair(themePadding, { x: defaultAxis, y: defaultAxis });
  return extractAxisPair(paddingConfig, themeDefaults);
};

const buildEligibleGroupChildMap = (nodes, eligibleGroupIds) => {
  const childGroupMap = new Map();

  eligibleGroupIds.forEach((groupId) => {
    childGroupMap.set(groupId, []);
  });

  nodes.forEach((node) => {
    if (node?.type !== 'group') return;
    if (!eligibleGroupIds.has(node.id)) return;

    const parentId = node.parentGroupId;
    if (!parentId) return;
    if (!eligibleGroupIds.has(parentId)) return;

    const children = childGroupMap.get(parentId);
    if (children) {
      children.push(node.id);
    }
  });

  return childGroupMap;
};

const computeEligibleGroupDepthMap = (childGroupMap) => {
  const memo = new Map();

  const visit = (groupId, stack) => {
    if (memo.has(groupId)) return memo.get(groupId);
    if (stack.has(groupId)) {
      memo.set(groupId, 0);
      return 0;
    }

    stack.add(groupId);
    const children = childGroupMap.get(groupId) ?? [];
    let maxDepth = 0;

    children.forEach((childId) => {
      const depth = visit(childId, stack);
      if (depth > maxDepth) {
        maxDepth = depth;
      }
    });

    stack.delete(groupId);

    const result = children.length ? maxDepth + 1 : 0;
    memo.set(groupId, result);
    return result;
  };

  childGroupMap.forEach((_, groupId) => {
    if (!memo.has(groupId)) {
      visit(groupId, new Set());
    }
  });

  return memo;
};

const computeHaloPaddingForDepth = (depth, config) => {
  const { base = 0, minStep = 0, decay = 1, increment = 0 } = config;

  if (!Number.isFinite(depth) || depth <= 0) {
    return base;
  }

  // Compute: base + sum of (increment × decay^level) for each nesting level
  return Array.from({ length: depth }).reduce((padding, _, level) => {
    const step = increment * Math.pow(decay, level);
    const appliedStep = Number.isFinite(step)
      ? Math.max(minStep, Math.round(step))
      : minStep;
    return padding + appliedStep;
  }, base);
};

/**
 * Computes the axis-aligned bounding box for a collection of nodes.
 * Returns null if nodes array is empty or bounds are invalid (non-finite).
 */
export const computeNodeBounds = (nodes, getNodeDimensions) => {
  if (!nodes || nodes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((node) => {
    const { width = 0, height = 0 } = getNodeDimensions?.(node) ?? {};
    const x = node?.position?.x ?? 0;
    const y = node?.position?.y ?? 0;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  });

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return null;
  }

  return { minX, minY, maxX, maxY };
};

export const getExpandedGroupHalos = (nodes, getNodeDimensions, paddingConfig = THEME.groupNode.halo.padding) => {
  if (!Array.isArray(nodes) || !nodes.length) return [];

  const config = normalizeHaloPaddingConfig(paddingConfig);
  const candidates = [];

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

    const bounds = computeNodeBounds(descendants, getNodeDimensions);
    if (!bounds) return;

    candidates.push({
      node: groupNode,
      bounds,
    });
  });

  if (!candidates.length) return [];

  const eligibleGroupIds = new Set(candidates.map(({ node }) => node.id));
  const childGroupMap = buildEligibleGroupChildMap(nodes, eligibleGroupIds);
  const depthMap = computeEligibleGroupDepthMap(childGroupMap);

  return candidates.map(({ node, bounds }) => {
    const nestedDepth = depthMap.get(node.id) ?? 0;
    const horizontalPadding = computeHaloPaddingForDepth(0, config.x);
    const verticalPadding = computeHaloPaddingForDepth(nestedDepth, config.y);

    return {
      groupId: node.id,
      label: node?.data?.label ?? 'Group',
      bounds: {
        x: bounds.minX - horizontalPadding,
        y: bounds.minY - verticalPadding,
        width: (bounds.maxX - bounds.minX) + horizontalPadding * 2,
        height: (bounds.maxY - bounds.minY) + verticalPadding * 2,
      },
    };
  });
};

export const constants = {
  GROUP_EDGE_PREFIX,
};
