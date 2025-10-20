// ABOUTME: Main application component with React Flow canvas
// ABOUTME: Loads flow from backend and auto-saves changes
import { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Position,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import { Node, Edge, GroupHaloOverlay, useFlowLayout, validateGroupMembership, collapseSubtreeByHandles, getExpandedGroupHalos, applyGroupVisibility } from './features/flow-canvas';

import {
  loadFlow,
  saveFlow,
  undoFlow,
  redoFlow,
  createNode,
  updateNode,
  createEdge,
  updateEdge,
  createGroup as apiCreateGroup,
  ungroup as apiUngroup,
  toggleGroupExpansion as apiToggleGroupExpansion,
  toggleSubtreeCollapse as apiToggleSubtreeCollapse
} from './services/api';
import { ChatInterface, KeyboardShortcutsPanel } from './features/chat';
import { NotesPanel } from './features/notes';

import { useHotkeys } from './hooks/useHotkeys';
import { useDebouncedCallback } from './shared/hooks/useDebouncedCallback.js';
import { THEME } from './constants/theme.js';
import { getFeatureFlags } from './utils/featureFlags.js';

function App() {
  const [nodes, setNodes, onNodesChangeRaw] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendProcessing, setIsBackendProcessing] = useState(false);
  const reactFlowInstance = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState([]); // Multi-select state
  const [isNotesPanelOpen, setIsNotesPanelOpen] = useState(false);
  const [notesBullets, setNotesBullets] = useState(null);

  // Phase 3: Backend save funnel dual-run state
  const [featureFlags, setFeatureFlags] = useState({ ENABLE_BACKEND_DRAG_SAVE: false, ENABLE_BACKEND_SUBTREE: false });
  const dragStartPositionsRef = useRef(null);
  const lastChangeWasPositionalRef = useRef(false);

  const {
    applyLayoutWithAnimation,
    isAnimating,
    fitViewPadding,
    getAllDescendants,
  } = useFlowLayout(
    setNodes,
    setEdges,
    reactFlowInstance
  );

  const onInit = useCallback((instance) => {
    reactFlowInstance.current = instance;
  }, []);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const normalizeFlow = useCallback((flow) => {
    const nodesWithPosition = flow.nodes.map(node => ({
      ...node,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }));
    return applyGroupVisibility(nodesWithPosition, flow.edges);
  }, []);

  // Phase 3: Drag start handler - capture original positions
  const onNodeDragStart = useCallback(() => {
    const positionMap = {};
    nodesRef.current.forEach(node => {
      positionMap[node.id] = { ...node.position };
    });
    dragStartPositionsRef.current = positionMap;
  }, []);

  // Phase 3: Wrapped onNodesChange to detect drag-end and call backend
  const onNodesChange = useCallback((changes) => {
    // Pass through to React Flow's handler first
    onNodesChangeRaw(changes);

    // Check if this is a drag-end event
    const dragEndChanges = changes.filter(
      change => change.type === 'position' && change.dragging === false
    );

    if (dragEndChanges.length > 0 && featureFlags.ENABLE_BACKEND_DRAG_SAVE) {
      // Collect all moved nodes
      const movedNodes = dragEndChanges
        .map(change => {
          const node = nodesRef.current.find(n => n.id === change.id);
          const originalPos = dragStartPositionsRef.current?.[change.id];
          if (!node || !originalPos) return null;

          // Check if position actually changed
          if (
            Math.abs(node.position.x - originalPos.x) < 0.1 &&
            Math.abs(node.position.y - originalPos.y) < 0.1
          ) {
            return null;
          }

          return {
            id: node.id,
            position: { ...node.position },
            originalPosition: originalPos
          };
        })
        .filter(Boolean);

      if (movedNodes.length > 0) {
        // Call backend API for each moved node
        const updatePromises = movedNodes.map(async ({ id, position, originalPosition }) => {
          try {
            const result = await updateNode(id, { position });
            if (!result.success) {
              console.error(`Failed to update node ${id} position:`, result.error);
              // Revert this node's position
              setNodes(prev => prev.map(n =>
                n.id === id ? { ...n, position: originalPosition } : n
              ));
              return { success: false, nodeId: id, error: result.error };
            }
            return { success: true, nodeId: id };
          } catch (error) {
            console.error(`Error updating node ${id} position:`, error);
            // Revert this node's position
            setNodes(prev => prev.map(n =>
              n.id === id ? { ...n, position: originalPosition } : n
            ));
            return { success: false, nodeId: id, error: error.message };
          }
        });

        Promise.all(updatePromises).then(results => {
          const failures = results.filter(r => !r.success);
          if (failures.length > 0) {
            alert(`Failed to save position for ${failures.length} node(s). Positions have been reverted.`);
          } else {
            // Mark as positional change to skip autosave
            lastChangeWasPositionalRef.current = true;
          }
        });
      }
    }
  }, [onNodesChangeRaw, featureFlags.ENABLE_BACKEND_DRAG_SAVE, setNodes]);

  // Load feature flags on mount
  useEffect(() => {
    const loadFlags = async () => {
      const flags = await getFeatureFlags();
      setFeatureFlags(flags);
    };
    loadFlags();
  }, []);

  useEffect(() => {
    const fetchFlow = async () => {
      try {
        const flow = await loadFlow();
        const normalizedFlow = normalizeFlow(flow);

        setNodes(normalizedFlow.nodes);
        setEdges(normalizedFlow.edges);
      } catch (error) {
        console.error('Failed to load flow:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFlow();
  }, [setNodes, setEdges, normalizeFlow]);

  const { debouncedFn: debouncedAutoSave, flush: flushAutoSave } = useDebouncedCallback(async (nodes, edges) => {
    // Skip autosave if last change was positional (already handled by backend)
    if (lastChangeWasPositionalRef.current) {
      lastChangeWasPositionalRef.current = false;
      return;
    }
    try {
      await saveFlow(nodes, edges);
    } catch (error) {
      console.error('Failed to save flow:', error);
    }
  }, 500);

  useEffect(() => {
    if (isLoading || isAnimating || isBackendProcessing) return;
    debouncedAutoSave(nodes, edges);
  }, [nodes, edges, isLoading, isAnimating, isBackendProcessing, debouncedAutoSave]);

  const handleFlowUpdate = useCallback((updatedFlow, options = {}) => {
    if (!updatedFlow) return;

    const { animateLayout = false } = options;
    const normalizedFlow = normalizeFlow(updatedFlow);

    setNodes(normalizedFlow.nodes);
    setEdges(normalizedFlow.edges);

    // Only animate layout when explicitly requested (e.g., autoLayout tool)
    if (animateLayout) {
      setTimeout(() => {
        applyLayoutWithAnimation(normalizedFlow.nodes, normalizedFlow.edges);
      }, 100);
    }
  }, [setNodes, setEdges, applyLayoutWithAnimation, normalizeFlow]);

  const handleMutation = useCallback(async (apiCall, {
    errorContext = 'perform operation',
    onSuccess,
    onError,
  } = {}) => {
    try {
      const result = await apiCall();

      if (!result.success) {
        const errorMsg = `Failed to ${errorContext}: ${result.error}`;
        console.error(errorMsg);
        onError?.(errorMsg);
        return;
      }

      handleFlowUpdate(result.flow);
      onSuccess?.();

    } catch (error) {
      const errorMsg = `Error ${errorContext}: ${error}`;
      console.error(errorMsg);
      onError?.(errorMsg);
    }
  }, [handleFlowUpdate]);

  const updateNodeLabel = useCallback(
    (nodeId, newLabel) => handleMutation(
      () => updateNode(nodeId, { label: newLabel }),
      { errorContext: 'update node label' }
    ),
    [handleMutation]
  );

  const updateNodeDescription = useCallback(
    (nodeId, newDescription) => handleMutation(
      () => updateNode(nodeId, { description: newDescription }),
      { errorContext: 'update node description' }
    ),
    [handleMutation]
  );

  const updateEdgeLabel = useCallback(
    (edgeId, newLabel) => handleMutation(
      () => updateEdge(edgeId, { label: newLabel }),
      { errorContext: 'update edge label' }
    ),
    [handleMutation]
  );

  const createChildNode = useCallback(
    (parentNodeId) => handleMutation(
      () => createNode({
        label: `Node ${Date.now()}`,
        description: '',
        parentNodeId: parentNodeId,
        edgeLabel: ''
      }),
      { errorContext: 'create child node' }
    ),
    [handleMutation]
  );

  const getNodeDimensions = useCallback((node) => {
    return {
      width: THEME.node.dimensions.width,
      height: THEME.node.dimensions.height,
      borderRadius: THEME.node.dimensions.borderRadius,
    };
  }, []);

  const scheduleLayout = useCallback((nextNodes, nextEdges) => {
    setTimeout(() => {
      applyLayoutWithAnimation(nextNodes, nextEdges);
    }, 0);
  }, [applyLayoutWithAnimation]);

  const commitFlow = useCallback((nextFlow, { selection = null, layout = true } = {}) => {
    if (!nextFlow) return;
    setNodes(nextFlow.nodes);
    setEdges(nextFlow.edges);
    if (selection) {
      setSelectedNodeIds(selection);
    }
    if (layout) {
      scheduleLayout(nextFlow.nodes, nextFlow.edges);
    }
  }, [scheduleLayout, setNodes, setEdges]);

  const nodesWithHandlers = useMemo(() => {
    return nodes.map((node) => {
      const isGroupNode = node.type === 'group';
      const { width, height, borderRadius } = getNodeDimensions(node);

      // Use group-specific colors for group nodes, regular colors for others
      const nodeColors = isGroupNode ? THEME.groupNode.colors : THEME.node.colors;
      const background = nodeColors.background;
      const border = nodeColors.border;
      const text = nodeColors.text;

      const isSelected = selectedNodeIds.includes(node.id);

      const baseStyle = {
        background,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: border,
        color: text,
        width,
        minWidth: width,
        height,
        minHeight: height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
        boxSizing: 'border-box',
        borderRadius: `${borderRadius}px`,
      };

      return {
        ...node,
        data: {
          ...node.data,
          onLabelChange: updateNodeLabel,
          onDescriptionChange: updateNodeDescription,
          textColor: text,
          label: node.data.label,
        },
        style: {
          ...(node.style || {}),
          ...baseStyle,
          ...(node.data.collapsed
            ? {
                borderWidth: THEME.node.states.collapsedSubtree.borderWidth,
                borderColor: THEME.node.states.collapsedSubtree.colors.border,
              }
            : {}),
          // Selection visual: 40% more prominent stroke
          ...(isSelected
            ? {
                borderWidth: THEME.node.states.selection.borderWidth,
                borderColor: THEME.node.states.selection.colors.border,
                boxShadow: `0 0 0 ${THEME.node.states.selection.shadowSpread} ${THEME.node.states.selection.colors.shadow}`,
              }
            : {}),
        },
      };
    });
  }, [nodes, updateNodeLabel, updateNodeDescription, selectedNodeIds, getNodeDimensions]);

  const edgesWithHandlers = useMemo(() => {
    return edges.map((edge) => ({
      ...edge,
      type: 'smoothstep',
      data: {
        ...edge.data,
        onLabelChange: updateEdgeLabel,
      },
    }));
  }, [edges, updateEdgeLabel]);

  const nodeTypes = useMemo(() => ({ default: Node, group: Node }), []);
  const edgeTypes = useMemo(() => ({ smoothstep: Edge }), []);

  const onConnect = useCallback(
    (params) => handleMutation(
      () => createEdge({
        sourceNodeId: params.source,
        targetNodeId: params.target,
        label: ''
      }),
      { errorContext: 'create edge' }
    ),
    [handleMutation]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeIds([]);
  }, [setSelectedNodeIds]);

  const applyGroupExpansion = useCallback(async (groupId, expandState = null) => {
    try {
      // If expandState is null, toggle based on current state
      let expand = expandState;
      if (expand === null) {
        const groupNode = nodesRef.current.find(n => n.id === groupId);
        expand = groupNode?.isCollapsed ?? false;
      }

      const result = await apiToggleGroupExpansion(groupId, expand);
      if (result.success) {
        handleFlowUpdate(result.flow);
      } else {
        console.error('Failed to toggle group expansion:', result.error);
      }
    } catch (error) {
      console.error('Error toggling group expansion:', error);
    }
  }, [handleFlowUpdate]);

  const groupHalos = useMemo(
    () => getExpandedGroupHalos(nodes, getNodeDimensions, THEME.groupNode.halo.padding),
    [nodes, getNodeDimensions],
  );

  const selectedGroupNode = useMemo(() => {
    if (selectedNodeIds.length !== 1) {
      return null;
    }
    const [selectedId] = selectedNodeIds;
    const node = nodes.find((n) => n.id === selectedId);
    return node?.type === 'group' ? node : null;
  }, [selectedNodeIds, nodes]);

  const collapseExpandedGroup = useCallback(
    (groupId) => applyGroupExpansion(groupId, false),
    [applyGroupExpansion],
  );

  const onNodeDoubleClick = useCallback(
    (event, node) => {
      // Double-click on group node: toggle collapse/expand
      if (node.type === 'group') {
        applyGroupExpansion(node.id);
        return;
      }
      // Cmd+Double-click: Create child node (existing behavior)
      else if (event.metaKey || event.ctrlKey) {
        createChildNode(node.id);
      }
    },
    [applyGroupExpansion, createChildNode],
  );

  const onNodeClick = useCallback(
    async (event, node) => {
      // Alt+Click: Collapse/expand subtree
      // NOTE: This is SUBTREE COLLAPSE, separate from GROUP COLLAPSE
      // - Uses data.collapsed property
      // - Affects edge-based hierarchy via getAllDescendants
      // - No synthetic edges generated
      // - Phase 3: Calls backend when ENABLE_BACKEND_SUBTREE flag is enabled
      if (event.altKey) {
        const isCurrentlyCollapsed = node.data?.collapsed || false;
        const targetCollapsedState = !isCurrentlyCollapsed;

        if (featureFlags.ENABLE_BACKEND_SUBTREE) {
          // Backend path: call API
          try {
            const result = await apiToggleSubtreeCollapse(node.id, targetCollapsedState);
            if (result.success && result.flow) {
              handleFlowUpdate(result.flow);
            } else {
              console.error('Failed to toggle subtree collapse:', result.error);
              alert(`Failed to ${targetCollapsedState ? 'collapse' : 'expand'} subtree: ${result.error}`);
            }
          } catch (error) {
            console.error('Error toggling subtree collapse:', error);
            alert(`Error ${targetCollapsedState ? 'collapsing' : 'expanding'} subtree: ${error.message}`);
          }
        } else {
          // Legacy frontend-only path
          const nextFlow = collapseSubtreeByHandles(
            { nodes: nodesRef.current, edges: edgesRef.current },
            node.id,
            targetCollapsedState,
            getAllDescendants
          );
          commitFlow(nextFlow);
        }
      }
      // Cmd+Click: Toggle selection
      else if (event.metaKey || event.ctrlKey) {
        setSelectedNodeIds(prev => {
          if (prev.includes(node.id)) {
            // Deselect
            return prev.filter(id => id !== node.id);
          } else {
            // Select
            return [...prev, node.id];
          }
        });
      }
      // Regular click: Clear selection
      else {
        setSelectedNodeIds([]);
      }
    },
    [commitFlow, setSelectedNodeIds, getAllDescendants, featureFlags.ENABLE_BACKEND_SUBTREE, handleFlowUpdate]
  );

  const handleUndo = useCallback(async () => {
    try {
      const result = await undoFlow();
      if (result.success && result.flow) {
        handleFlowUpdate(result.flow);
      }
    } catch (error) {
      console.error('Failed to undo:', error);
    }
  }, [handleFlowUpdate]);

  const handleRedo = useCallback(async () => {
    try {
      const result = await redoFlow();
      if (result.success && result.flow) {
        handleFlowUpdate(result.flow);
      }
    } catch (error) {
      console.error('Failed to redo:', error);
    }
  }, [handleFlowUpdate]);

  const handleCreateGroup = useCallback(async () => {
    if (selectedNodeIds.length < 2) {
      alert('Please select at least 2 nodes to create a group');
      return;
    }

    const validation = validateGroupMembership(selectedNodeIds, nodes);
    if (!validation.valid) {
      alert(`Cannot create group: ${validation.error}`);
      return;
    }

    await handleMutation(
      () => apiCreateGroup({
        memberIds: selectedNodeIds,
        label: `Group ${Date.now()}`
      }),
      {
        errorContext: 'create group',
        onSuccess: () => setSelectedNodeIds([]),
        onError: (msg) => alert(msg),
      }
    );
  }, [selectedNodeIds, nodes, handleMutation, setSelectedNodeIds]);

  const ungroupNodes = useCallback(async () => {
    if (selectedNodeIds.length !== 1) {
      alert('Please select exactly 1 group node to ungroup');
      return;
    }

    const groupNode = nodes.find((n) => n.id === selectedNodeIds[0]);

    if (!groupNode || groupNode.type !== 'group') {
      alert('Selected node is not a group');
      return;
    }

    await handleMutation(
      () => apiUngroup(selectedNodeIds[0]),
      {
        errorContext: 'ungroup',
        onSuccess: () => setSelectedNodeIds([]),
        onError: (msg) => alert(msg),
      }
    );
  }, [selectedNodeIds, nodes, handleMutation, setSelectedNodeIds]);

  // Register keyboard shortcuts
  // Note: Meta keys are automatically expanded to include Control variants for cross-platform support
  useHotkeys([
    { keys: ['Meta', 'Z'], handler: handleUndo },
    { keys: ['Meta', 'Y'], handler: handleRedo },
    {
      keys: ['Meta', 'G'],
      handler: handleCreateGroup,
      isActive: (state) => state?.selectedNodeIds?.length >= 2,
    },
    {
      keys: ['Meta', 'Shift', 'G'],
      handler: ungroupNodes,
      isActive: (state) => {
        if (!state?.selectedNodeIds || state.selectedNodeIds.length !== 1) return false;
        const selectedNode = state.nodes?.find(n => n.id === state.selectedNodeIds[0]);
        return selectedNode?.type === 'group';
      },
    },
  ], { selectedNodeIds, nodes });

  if (isLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100vw', height: '100vh', color: 'white' }}>Loading...</div>;
  }

  const canGroup = selectedNodeIds.length >= 2;
  const canUngroup = Boolean(selectedGroupNode);
  const tooltipConfig = canGroup
    ? { keys: '⌘ G', label: 'to group' }
    : canUngroup
      ? { keys: '⌘ ⇧ G', label: 'to ungroup' }
      : null;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Notes Panel */}
      <NotesPanel
        isOpen={isNotesPanelOpen}
        onToggle={() => setIsNotesPanelOpen(!isNotesPanelOpen)}
        externalBullets={notesBullets}
        onFlowUpdate={handleFlowUpdate}
      />

      <ReactFlow
        nodes={nodesWithHandlers}
        edges={edgesWithHandlers}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeClick={onNodeClick}
        onNodeDragStart={onNodeDragStart}
        onPaneClick={onPaneClick}
        onInit={onInit}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode="dark"
        style={{ background: THEME.canvas.background }}
        fitView
        fitViewOptions={{ padding: fitViewPadding }}
        proOptions={{ hideAttribution: true }}
      >
        <GroupHaloOverlay halos={groupHalos} onCollapse={collapseExpandedGroup} />
      </ReactFlow>
      <ChatInterface
        onFlowUpdate={handleFlowUpdate}
        onProcessingChange={setIsBackendProcessing}
        onFlushPendingSave={flushAutoSave}
        isNotesPanelOpen={isNotesPanelOpen}
        onNotesUpdate={setNotesBullets}
      />
      <KeyboardShortcutsPanel tooltipConfig={tooltipConfig} />
    </div>
  );
}

export default App;
