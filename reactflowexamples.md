 ---


maybe this but to exemplify how functions are progressing? like ins and outs? 

Animating Edges
React Flow provides a simple built-in animation for the default edge type, but it is possible to create more advanced animations by using custom edges. Below are a collection of examples showing different ways an edge path might be used in

Animating SVG elements
It is possible to animate an SVG element along a path using the <animateMotion /> element. This example creates a custom edge that animates a circle along the edge path.


AnimatedSVGEdge.tsx
App.tsx
xy-theme.css
index.css
index.tsx




import React from 'react';
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
 
export function AnimatedSVGEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
 
  return (
    <>
      <BaseEdge id={id} path={edgePath} />
      <circle r="10" fill="#ff0073">
        <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
      </circle>
    </>
  );
}

----

Edge labels names:

import React, { useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  useEdgesState,
  useNodesState,
  type EdgeTypes,
  type Edge,
  type OnConnect,
  type Node,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

import CustomEdge from './CustomEdge';
import CustomEdgeStartEnd from './CustomEdgeStartEnd';

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Node 1' },
    position: { x: 0, y: 0 },
  },
  { id: '2', data: { label: 'Node 2' }, position: { x: 0, y: 300 } },
  { id: '3', data: { label: 'Node 3' }, position: { x: 200, y: 0 } },
  { id: '4', data: { label: 'Node 4' }, position: { x: 200, y: 300 } },
];

const initialEdges: Edge[] = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    data: {
      label: 'edge label',
    },
    type: 'custom',
  },
  {
    id: 'e3-4',
    source: '3',
    target: '4',
    data: {
      startLabel: 'start edge label',
      endLabel: 'end edge label',
    },
    type: 'start-end',
  },
];

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
  'start-end': CustomEdgeStartEnd,
};

const EdgesFlow = () => {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      edgeTypes={edgeTypes}
      fitView
    >
      <Controls />
      <Background />
    </ReactFlow>
  );
};

export default EdgesFlow;
---


## truly important, to create different levels of abstraction of the codebase:

Contextual Zoom
This example shows how the current zoom level can be used by a node to decide which content to show. We are using selecting the zoom via the useStore hook to update our custom node whenever the zoom changes.


App.jsx
ZoomNode.jsx
xy-theme.css
index.css




import React, { useCallback } from 'react';
import {
  Background,
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  MiniMap,
  Controls,
} from '@xyflow/react';
 
import '@xyflow/react/dist/style.css';
 
import ZoomNode from './ZoomNode';
 
const snapGrid = [20, 20];
const nodeTypes = {
  zoom: ZoomNode,
};
 
const initialNodes = [
  {
    id: '1',
    type: 'zoom',
    data: {
      content: <>Zoom to toggle content and placeholder</>,
    },
    position: { x: 0, y: 0 },
  },
  {
    id: '2',
    type: 'zoom',
    data: { content: <>this is a node with some lines of text in it.</> },
    position: { x: 200, y: 0 },
  },
  {
    id: '3',
    type: 'zoom',
    data: { content: <>this is another node with some more text.</> },
    position: { x: 400, y: 0 },
  },
];
 
const initialEdges = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    animated: true,
  },
  {
    id: 'e2-3',
    source: '2',
    target: '3',
    animated: true,
  },
];
 
const defaultViewport = { x: 0, y: 0, zoom: 1.5 };
 
const ContextualZoomFlow = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [],
  );
 
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      snapToGrid={true}
      snapGrid={snapGrid}
      defaultViewport={defaultViewport}
      attributionPosition="top-right"
      fitView
    >
      <Background />
      <MiniMap />
      <Controls />
    </ReactFlow>
  );
};
 
export default ContextualZoomFlow;


----


Selection Grouping
This example demonstrates how to create dynamic node grouping in React Flow. You can select multiple nodes by holding Shift and clicking, then use the “Group Nodes” button in the appearing toolbar to group them together. When a group node is selected, an “Ungroup” button appears that detaches all child nodes. Group nodes are fully resizable and automatically adjust their dimensions based on their child nodes.

This is a Pro example. Get all pro examples, templates, 1:1 support from the xyflow team and prioritized Github issues with a React Flow Pro subscription.

See Pricing Plans
Sign In

About this Pro Example
Dependencies: @xyflow/react 
License: xyflow Pro License 



.---
