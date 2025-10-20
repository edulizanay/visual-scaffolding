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
  toggleGroupExpansion as apiToggleGroupExpansion
} from './services/api';
import { ChatInterface, KeyboardUI } from './features/chat';
import { NotesPanel } from './features/notes';

import { useHotkeys } from './hooks/useHotkeys';
import { THEME } from './constants/theme.js';

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendProcessing, setIsBackendProcessing] = useState(false);
  const reactFlowInstance = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState([]); // Multi-select state
  const [isNotesPanelOpen, setIsNotesPanelOpen] = useState(false);
  const [notesBullets, setNotesBullets] = useState(null);

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

  useEffect(() => {
    if (isLoading || isAnimating || isBackendProcessing) return;

    const timeoutId = setTimeout(async () => {
      try {
        await saveFlow(nodes, edges);
      } catch (error) {
        console.error('Failed to save flow:', error);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, isLoading, isAnimating, isBackendProcessing]);

  const handleFlowUpdate = useCallback((updatedFlow) => {
    if (!updatedFlow) return;

    const normalizedFlow = normalizeFlow(updatedFlow);

    setNodes(normalizedFlow.nodes);
    setEdges(normalizedFlow.edges);

    // Auto-layout when LLM adds nodes
    setTimeout(() => {
      applyLayoutWithAnimation(normalizedFlow.nodes, normalizedFlow.edges);
    }, 100);
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
    (event, node) => {
      // Alt+Click: Collapse/expand subtree
      // NOTE: This is SUBTREE COLLAPSE, separate from GROUP COLLAPSE
      // - Frontend-only (no backend API call)
      // - Uses data.collapsed property
      // - Affects edge-based hierarchy via getAllDescendants
      // - No synthetic edges generated
      if (event.altKey) {
        const isCurrentlyCollapsed = node.data?.collapsed || false;
        const nextFlow = collapseSubtreeByHandles(
          { nodes: nodesRef.current, edges: edgesRef.current },
          node.id,
          !isCurrentlyCollapsed,
          getAllDescendants
        );

        commitFlow(nextFlow);
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
    [commitFlow, setSelectedNodeIds, getAllDescendants]
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
        isNotesPanelOpen={isNotesPanelOpen}
        onNotesUpdate={setNotesBullets}
      />
      <KeyboardUI tooltipConfig={tooltipConfig} />
    </div>
  );
}

export default App;
