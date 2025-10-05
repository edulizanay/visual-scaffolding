// ABOUTME: Main component that renders the interactive tree visualization
// ABOUTME: Uses react-d3-tree to display a collapsible folder/file structure
import React from 'react'
import Tree from 'react-d3-tree'

const treeData = {
  name: 'Root',
  children: [
    {
      name: 'Folder A',
      attributes: {
        type: 'folder'
      },
      children: [
        {
          name: 'File 1',
          attributes: {
            type: 'file'
          }
        }
      ]
    },
    {
      name: 'Folder B',
      attributes: {
        type: 'folder'
      },
      children: [
        {
          name: 'Folder B1',
          attributes: {
            type: 'folder'
          }
        },
        {
          name: 'File 2',
          attributes: {
            type: 'file'
          }
        }
      ]
    },
    {
      name: 'Folder C',
      attributes: {
        type: 'folder'
      },
      children: [
        {
          name: 'File 3',
          attributes: {
            type: 'file'
          }
        }
      ]
    }
  ]
}

const renderCustomNode = ({ nodeDatum, toggleNode }) => {
  const isFolder = nodeDatum.attributes?.type === 'folder'

  return (
    <g onClick={toggleNode}>
      <rect
        width="120"
        height="40"
        x="-60"
        y="-20"
        rx="8"
        fill="#f8fafc"
        stroke="#cbd5e1"
        strokeWidth="2"
        style={{ cursor: 'pointer' }}
      />
      <text
        fill="#334155"
        x="0"
        y="5"
        textAnchor="middle"
        style={{
          fontSize: '14px',
          fontWeight: 'normal',
          pointerEvents: 'none'
        }}
      >
        {isFolder ? '📁' : '📄'} {nodeDatum.name}
      </text>
    </g>
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
        #root {
          width: 100vw;
          height: 100vh;
          background: #ffffff;
        }
        .rd3t-link {
          stroke: #cbd5e1;
          stroke-width: 2px;
          fill: none;
        }
      `}</style>
      <Tree
        data={treeData}
        orientation="horizontal"
        pathFunc="step"
        translate={{ x: 100, y: 300 }}
        separation={{ siblings: 1.5, nonSiblings: 2 }}
        nodeSize={{ x: 200, y: 100 }}
        renderCustomNodeElement={renderCustomNode}
        transitionDuration={500}
        enableLegacyTransitions
      />
    </>
  )
}

export default App
