// ABOUTME: Main component with collapsible tree visualization using ReactFlow and ELK.js
// ABOUTME: Manages expand/collapse state and layout updates with smooth animations
import React, { useCallback, useState, useLayoutEffect } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import ELK from 'elkjs/lib/elk.bundled.js'

const elk = new ELK()

const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.layered.spacing.nodeNodeBetweenLayers': '100',
  'elk.spacing.nodeNode': '80',
  'elk.direction': 'RIGHT',
}

const initialNodes = [
  {
    id: 'root',
    data: { label: 'Root', type: 'folder' },
    position: { x: 0, y: 0 },
  },
  {
    id: 'folder-a',
    data: { label: 'Folder A', type: 'folder' },
    position: { x: 0, y: 0 },
  },
  {
    id: 'file-1',
    data: { label: 'File 1', type: 'file' },
    position: { x: 0, y: 0 },
  },
  {
    id: 'folder-b',
    data: { label: 'Folder B', type: 'folder' },
    position: { x: 0, y: 0 },
  },
  {
    id: 'folder-b1',
    data: { label: 'Folder B1', type: 'folder' },
    position: { x: 0, y: 0 },
  },
  {
    id: 'file-2',
    data: { label: 'File 2', type: 'file' },
    position: { x: 0, y: 0 },
  },
  {
    id: 'folder-c',
    data: { label: 'Folder C', type: 'folder' },
    position: { x: 0, y: 0 },
  },
  {
    id: 'file-3',
    data: { label: 'File 3', type: 'file' },
    position: { x: 0, y: 0 },
  },
]

const initialEdges = [
  { id: 'e-root-a', source: 'root', target: 'folder-a' },
  { id: 'e-a-file1', source: 'folder-a', target: 'file-1' },
  { id: 'e-root-b', source: 'root', target: 'folder-b' },
  { id: 'e-b-b1', source: 'folder-b', target: 'folder-b1' },
  { id: 'e-b-file2', source: 'folder-b', target: 'file-2' },
  { id: 'e-root-c', source: 'root', target: 'folder-c' },
  { id: 'e-c-file3', source: 'folder-c', target: 'file-3' },
]

const getLayoutedElements = (nodes, edges, options = {}) => {
  const isHorizontal = options?.['elk.direction'] === 'RIGHT'
  const graph = {
    id: 'root',
    layoutOptions: options,
    children: nodes.map((node) => ({
      ...node,
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      width: 150,
      height: 50,
    })),
    edges: edges,
  }

  return elk
    .layout(graph)
    .then((layoutedGraph) => ({
      nodes: layoutedGraph.children.map((node) => ({
        ...node,
        position: { x: node.x, y: node.y },
      })),
      edges: layoutedGraph.edges,
    }))
    .catch(console.error)
}

const CustomNode = ({ data, id }) => {
  const isFolder = data.type === 'folder'

  return (
    <div
      style={{
        padding: '10px 20px',
        borderRadius: '8px',
        background: '#f8fafc',
        border: '2px solid #cbd5e1',
        fontSize: '14px',
        fontWeight: 'normal',
        cursor: 'pointer',
        minWidth: '120px',
        textAlign: 'center',
      }}
    >
      {isFolder ? '📁' : '📄'} {data.label}
    </div>
  )
}

const nodeTypes = {
  custom: CustomNode,
}

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [expandedNodes, setExpandedNodes] = useState(new Set(['root']))
  const { fitView } = useReactFlow()

  const getVisibleNodesAndEdges = useCallback(() => {
    const visibleNodeIds = new Set()

    const addVisibleChildren = (nodeId) => {
      visibleNodeIds.add(nodeId)

      if (expandedNodes.has(nodeId)) {
        const childEdges = initialEdges.filter((e) => e.source === nodeId)
        childEdges.forEach((edge) => {
          addVisibleChildren(edge.target)
        })
      }
    }

    addVisibleChildren('root')

    const visibleNodes = initialNodes
      .filter((node) => visibleNodeIds.has(node.id))
      .map((node) => ({
        ...node,
        type: 'custom',
        data: {
          ...node.data,
          expanded: expandedNodes.has(node.id),
        },
      }))

    const visibleEdges = initialEdges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    )

    return { visibleNodes, visibleEdges }
  }, [expandedNodes])

  const onLayout = useCallback(
    ({ visibleNodes, visibleEdges }) => {
      getLayoutedElements(visibleNodes, visibleEdges, elkOptions).then(
        ({ nodes: layoutedNodes, edges: layoutedEdges }) => {
          setNodes(layoutedNodes)
          setEdges(layoutedEdges)

          window.requestAnimationFrame(() => {
            fitView()
          })
        }
      )
    },
    [setNodes, setEdges, fitView]
  )

  useLayoutEffect(() => {
    const { visibleNodes, visibleEdges } = getVisibleNodesAndEdges()
    onLayout({ visibleNodes, visibleEdges })
  }, [expandedNodes, getVisibleNodesAndEdges, onLayout])

  const onNodeClick = useCallback(
    (event, node) => {
      if (node.data.type === 'folder') {
        setExpandedNodes((prev) => {
          const next = new Set(prev)
          if (next.has(node.id)) {
            next.delete(node.id)
          } else {
            next.add(node.id)
          }
          return next
        })
      }
    },
    []
  )

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        defaultEdgeOptions={{
          style: { stroke: '#cbd5e1', strokeWidth: 2 },
          animated: false,
        }}
      >
        <Panel position="top-left">
          <div style={{ background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            Click folders to expand/collapse
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}

function App() {
  return (
    <>
      <style>{`
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
      `}</style>
      <ReactFlowProvider>
        <Flow />
      </ReactFlowProvider>
    </>
  )
}

export default App
