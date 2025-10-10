// ABOUTME: Main application component with React Flow canvas
// ABOUTME: Loads flow from backend and auto-saves changes
import { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Position,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import Node from './Node';
import Edge from './Edge';
import { loadFlow, saveFlow, undoFlow, redoFlow, getHistoryStatus } from './api';
import ChatInterface, { Kbd } from './ChatInterface';
import { useFlowLayout } from './hooks/useFlowLayout';
import { DEFAULT_VISUAL_SETTINGS, mergeWithDefaultVisualSettings } from '../shared/visualSettings.js';

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [toast, setToast] = useState(null); // 'undo' | 'redo' | null
  const [isBackendProcessing, setIsBackendProcessing] = useState(false);
  const reactFlowInstance = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const [visualSettings, setVisualSettings] = useState(DEFAULT_VISUAL_SETTINGS);

  const { applyLayoutWithAnimation, isAnimating, fitViewPadding, getAllDescendants } = useFlowLayout(
    setNodes,
    setEdges,
    reactFlowInstance,
    visualSettings
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

  useEffect(() => {
    if (isLoading) return;
    if (!reactFlowInstance.current) return;
    const hasElements = nodesRef.current.length > 0 || edgesRef.current.length > 0;
    if (!hasElements) return;

    applyLayoutWithAnimation(nodesRef.current, edgesRef.current);
  }, [visualSettings.dimensions, applyLayoutWithAnimation, isLoading]);

  useEffect(() => {
    const fetchFlow = async () => {
      try {
        const flow = await loadFlow();
        const settings = mergeWithDefaultVisualSettings(flow.settings || {});
        setVisualSettings(settings);

        const nodesWithPosition = flow.nodes.map(node => ({
          ...node,
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        }));

        setNodes(nodesWithPosition);
        setEdges(flow.edges);
      } catch (error) {
        console.error('Failed to load flow:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFlow();
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (isLoading || isAnimating || isBackendProcessing) return;

    const timeoutId = setTimeout(async () => {
      try {
        await saveFlow(nodes, edges);
        if (canUndo) {
          setToast('undo');
        }
      } catch (error) {
        console.error('Failed to save flow:', error);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, isLoading, canUndo, isAnimating, isBackendProcessing]);

  const updateNodeLabel = useCallback((nodeId, newLabel) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n
      )
    );
  }, [setNodes]);

  const updateNodeDescription = useCallback((nodeId, newDescription) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, description: newDescription } } : n
      )
    );
  }, [setNodes]);

  const updateEdgeLabel = useCallback((edgeId, newLabel) => {
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, label: newLabel } } : e
      )
    );
  }, [setEdges]);

  const nodesWithHandlers = useMemo(() => {
    const defaultNode = visualSettings.dimensions?.node?.default ?? DEFAULT_VISUAL_SETTINGS.dimensions.node.default;
    const overrides = visualSettings.dimensions?.node?.overrides ?? {};
    const globalColors = visualSettings.colors?.allNodes ?? DEFAULT_VISUAL_SETTINGS.colors.allNodes;
    const perNodeColors = visualSettings.colors?.perNode ?? {};

    return nodes.map((node) => {
      const override = overrides[node.id] || {};
      const width = override.width ?? defaultNode.width;
      const height = override.height ?? defaultNode.height;
      const borderRadius = override.borderRadius ?? defaultNode.borderRadius;

      const nodeColorOverrides = perNodeColors[node.id] || {};
      const background = nodeColorOverrides.background ?? globalColors.background;
      const border = nodeColorOverrides.border ?? globalColors.border;
      const text = nodeColorOverrides.text ?? globalColors.text;

      const baseStyle = {
        background,
        border: `1px solid ${border}`,
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
        },
        style: {
          ...(node.style || {}),
          ...baseStyle,
          ...(node.data.collapsed
            ? {
                borderWidth: '2px',
                borderColor: 'rgba(255, 255, 255, 0.4)',
              }
            : {}),
        },
      };
    });
  }, [nodes, updateNodeLabel, updateNodeDescription, visualSettings]);

  const edgesWithHandlers = useMemo(() =>
    edges.map((edge) => ({
      ...edge,
      type: 'smoothstep',
      data: {
        ...edge.data,
        onLabelChange: updateEdgeLabel,
      },
    })),
    [edges, updateEdgeLabel]
  );

  const nodeTypes = useMemo(() => ({ default: Node }), []);
  const edgeTypes = useMemo(() => ({ smoothstep: Edge }), []);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', data: { onLabelChange: updateEdgeLabel } }, eds)),
    [setEdges, updateEdgeLabel],
  );

  const onNodeDoubleClick = useCallback(
    (event, node) => {
      if (event.metaKey || event.ctrlKey) {
        const newNodeId = `${Date.now()}`;
        const newNode = {
          id: newNodeId,
          position: { x: node.position.x + 200, y: node.position.y },
          data: {
            label: `Node ${newNodeId}`,
            description: '',
            onLabelChange: updateNodeLabel,
            onDescriptionChange: updateNodeDescription,
          },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        };

        const newEdge = {
          id: `e${node.id}-${newNodeId}`,
          source: node.id,
          target: newNodeId,
          type: 'smoothstep',
          data: { onLabelChange: updateEdgeLabel },
        };

        const updatedNodes = [...nodes, newNode];
        const updatedEdges = [...edges, newEdge];

        setTimeout(() => {
          applyLayoutWithAnimation(updatedNodes, updatedEdges);
        }, 0);
      }
    },
    [nodes, edges, applyLayoutWithAnimation, updateNodeLabel, updateNodeDescription, updateEdgeLabel],
  );

  const onNodeClick = useCallback(
    (event, node) => {
      if (event.altKey) {
        const isCurrentlyCollapsed = node.data.collapsed || false;

        const updatedNodes = nodes.map(n =>
          n.id === node.id
            ? { ...n, data: { ...n.data, collapsed: !isCurrentlyCollapsed }}
            : n
        );

        const descendants = getAllDescendants(node.id, nodes, edges);
        const descendantIds = descendants.map(d => d.id);

        const finalNodes = updatedNodes.map(n =>
          descendantIds.includes(n.id)
            ? { ...n, hidden: !isCurrentlyCollapsed }
            : n
        );

        const finalEdges = edges.map(e =>
          (descendantIds.includes(e.source) || descendantIds.includes(e.target))
            ? { ...e, hidden: !isCurrentlyCollapsed }
            : e
        );

        setTimeout(() => {
          applyLayoutWithAnimation(finalNodes, finalEdges);
        }, 0);
      }
    },
    [nodes, edges, applyLayoutWithAnimation]
  );

  const handleFlowUpdate = useCallback((updatedFlow) => {
    if (!updatedFlow) return;

    const mergedSettings = mergeWithDefaultVisualSettings(updatedFlow.settings || {});
    setVisualSettings(mergedSettings);

    const nodesWithPosition = updatedFlow.nodes.map(node => ({
      ...node,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }));

    setNodes(nodesWithPosition);
    setEdges(updatedFlow.edges);

    // Auto-layout when LLM adds nodes
    setTimeout(() => {
      applyLayoutWithAnimation(nodesWithPosition, updatedFlow.edges);
    }, 100);
  }, [setNodes, setEdges, applyLayoutWithAnimation]);

  const updateHistoryStatus = useCallback(async () => {
    try {
      const status = await getHistoryStatus();
      setCanUndo(status.canUndo);
    } catch (error) {
      console.error('Failed to get history status:', error);
    }
  }, []);

  const handleUndo = useCallback(async () => {
    try {
      const result = await undoFlow();
      if (result.success && result.flow) {
        handleFlowUpdate(result.flow);
        await updateHistoryStatus();
        setToast('redo');
      }
    } catch (error) {
      console.error('Failed to undo:', error);
    }
  }, [handleFlowUpdate, updateHistoryStatus]);

  const handleRedo = useCallback(async () => {
    try {
      const result = await redoFlow();
      if (result.success && result.flow) {
        handleFlowUpdate(result.flow);
        await updateHistoryStatus();
        setToast('undo');
      }
    } catch (error) {
      console.error('Failed to redo:', error);
    }
  }, [handleFlowUpdate, updateHistoryStatus]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  useEffect(() => {
    updateHistoryStatus();
    const interval = setInterval(updateHistoryStatus, 1000);
    return () => clearInterval(interval);
  }, [updateHistoryStatus]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (isLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100vw', height: '100vh', color: 'white' }}>Loading...</div>;
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={edgesWithHandlers}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeClick={onNodeClick}
        onInit={onInit}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode="dark"
        style={{ background: visualSettings.colors?.background ?? DEFAULT_VISUAL_SETTINGS.colors.background }}
        fitView
        fitViewOptions={{ padding: fitViewPadding }}
        proOptions={{ hideAttribution: true }}
      >
      </ReactFlow>
      <ChatInterface onFlowUpdate={handleFlowUpdate} onProcessingChange={setIsBackendProcessing} />
      {toast && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'slideIn 0.3s ease-out',
        }}>
          <Kbd style={{ gap: '4px', padding: '4px 8px', borderRadius: '6px', fontSize: '14px' }}>{toast === 'undo' ? '⌘ Z' : '⌘ Y'}</Kbd>
          <span style={{ color: '#e5e7eb', fontSize: '14px' }}>
            {toast === 'undo' ? 'to undo' : 'to redo'}
          </span>
        </div>
      )}
    </div>
  );
}

export default App;
