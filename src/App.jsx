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

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [toast, setToast] = useState(null); // 'undo' | 'redo' | null
  const reactFlowInstance = useRef(null);

  const { applyLayoutWithAnimation, isAnimating, FIT_VIEW_PADDING, getAllDescendants } = useFlowLayout(
    setNodes,
    setEdges,
    reactFlowInstance
  );

  const onInit = useCallback((instance) => {
    reactFlowInstance.current = instance;
  }, []);

  useEffect(() => {
    const fetchFlow = async () => {
      try {
        const flow = await loadFlow();

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
    if (isLoading || isAnimating) return;

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
  }, [nodes, edges, isLoading, canUndo, isAnimating]);

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

  const nodesWithHandlers = useMemo(() =>
    nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onLabelChange: updateNodeLabel,
        onDescriptionChange: updateNodeDescription,
      },
      style: {
        ...(node.style || {}),
        ...(node.data.collapsed ? {
          borderWidth: '2px',
          borderColor: 'rgba(255, 255, 255, 0.4)',
        } : {}),
      },
    })),
    [nodes, updateNodeLabel, updateNodeDescription]
  );

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
        style={{ background: 'linear-gradient(180deg, #0f0a1a 0%, #1a0f2e 100%)' }}
        fitView
        fitViewOptions={{ padding: FIT_VIEW_PADDING }}
        proOptions={{ hideAttribution: true }}
      >
      </ReactFlow>
      <ChatInterface onFlowUpdate={handleFlowUpdate} />
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
