import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../../../src/App.jsx';
import { ReactFlow } from '@xyflow/react';
import * as api from '../../../src/api.js';

jest.mock('@xyflow/react', () => {
  const React = require('react');
  const ReactFlowComponent = (props) => {
    ReactFlowComponent.mockProps = props;
    return React.createElement('div', { 'data-testid': 'react-flow' }, props.children);
  };
  ReactFlowComponent.mockProps = null;

  const Handle = (props) => React.createElement('div', props);

  const useNodesState = (initial) => {
    const React = require('react');
    const [nodes, setNodes] = React.useState(initial);
    const onNodesChange = jest.fn();
    return [nodes, setNodes, onNodesChange];
  };

  const useEdgesState = (initial) => {
    const React = require('react');
    const [edges, setEdges] = React.useState(initial);
    const onEdgesChange = jest.fn();
    return [edges, setEdges, onEdgesChange];
  };

  return {
    __esModule: true,
    ReactFlow: ReactFlowComponent,
    Handle,
    useNodesState,
    useEdgesState,
    useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    Position: { Right: 'right', Left: 'left' },
  };
});

jest.mock('../../../src/ChatInterface', () => {
  const React = require('react');
  const MockChatInterface = ({ onFlowUpdate, onProcessingChange }) => {
    MockChatInterface.handlers = { onFlowUpdate, onProcessingChange };
    return React.createElement('div', { 'data-testid': 'chat-interface' });
  };
  MockChatInterface.handlers = {};

  const Kbd = ({ children, ...props }) => React.createElement('span', props, children);

  return {
    __esModule: true,
    default: MockChatInterface,
    Kbd,
  };
});

jest.mock('../../../src/HotkeysPanel', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('div', { 'data-testid': 'hotkeys-panel' }),
  };
});

jest.mock('../../../src/Node', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('div', { 'data-testid': 'node' }),
  };
});

jest.mock('../../../src/Edge', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('div', { 'data-testid': 'edge' }),
  };
});

jest.mock('../../../src/hooks/useFlowLayout', () => ({
  useFlowLayout: jest.fn(() => ({
    applyLayoutWithAnimation: jest.fn(),
    isAnimating: false,
    fitViewPadding: 0,
    getAllDescendants: jest.fn(() => []),
  })),
}));

jest.mock('../../../src/hooks/useHotkeys', () => ({
  useHotkeys: jest.fn(),
}));

jest.mock('../../../src/api.js', () => ({
  loadFlow: jest.fn(),
  saveFlow: jest.fn(),
  undoFlow: jest.fn(),
  redoFlow: jest.fn(),
  getHistoryStatus: jest.fn(),
  createNode: jest.fn(),
  updateNode: jest.fn(),
  createEdge: jest.fn(),
  updateEdge: jest.fn(),
  createGroup: jest.fn(),
  ungroup: jest.fn(),
  toggleGroupExpansion: jest.fn(),
}));

const getChatHandlers = () => {
  const module = jest.requireMock('../../../src/ChatInterface');
  return module.default.handlers || {};
};

const defaultFlow = {
  nodes: [
    { id: 'group-1', type: 'group', isCollapsed: true, position: { x: 0, y: 0 }, data: { label: 'Group 1' } },
    { id: 'node-1', type: 'default', position: { x: 100, y: 0 }, data: { label: 'Node 1' } },
    { id: 'node-2', type: 'default', position: { x: 200, y: 0 }, data: { label: 'Node 2' } },
  ],
  edges: [],
};

const originalAlert = global.alert;

describe('App group behaviour', () => {
  beforeAll(() => {
    global.alert = jest.fn();
  });

  afterAll(() => {
    global.alert = originalAlert;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    ReactFlow.mockProps = null;

    api.loadFlow.mockResolvedValue(defaultFlow);
    api.saveFlow.mockResolvedValue({ success: true });
    api.getHistoryStatus.mockResolvedValue({ canUndo: false });
    api.toggleGroupExpansion.mockResolvedValue({ success: true, flow: defaultFlow });
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  const renderApp = async () => {
    await act(async () => {
      render(<App />);
    });

    await waitFor(() => expect(api.loadFlow).toHaveBeenCalled());
    await waitFor(() => expect(ReactFlow.mockProps).not.toBeNull());
  };

  test('double-click on collapsed group triggers expand API call', async () => {
    api.loadFlow.mockResolvedValueOnce(defaultFlow);

    await renderApp();

    const { onNodeDoubleClick, nodes } = ReactFlow.mockProps;

    await act(async () => {
      onNodeDoubleClick({ metaKey: false, ctrlKey: false }, nodes[0]);
    });

    expect(api.toggleGroupExpansion).toHaveBeenCalledWith('group-1', true);
  });

  test('double-click on expanded group triggers collapse API call', async () => {
    const expandedFlow = {
      ...defaultFlow,
      nodes: defaultFlow.nodes.map((node) =>
        node.id === 'group-1' ? { ...node, isCollapsed: false } : node
      ),
    };
    api.loadFlow.mockResolvedValueOnce(expandedFlow);

    await renderApp();

    const { onNodeDoubleClick, nodes } = ReactFlow.mockProps;

    await act(async () => {
      onNodeDoubleClick({ metaKey: false, ctrlKey: false }, nodes[0]);
    });

    expect(api.toggleGroupExpansion).toHaveBeenCalledWith('group-1', false);
  });

  test('tooltip shows group shortcut when multiple nodes selected', async () => {
    api.loadFlow.mockResolvedValueOnce(defaultFlow);

    await renderApp();

    const { onNodeClick, nodes } = ReactFlow.mockProps;

    const metaEvent = { metaKey: true, ctrlKey: false };

    await act(async () => {
      onNodeClick(metaEvent, nodes[1]);
      onNodeClick(metaEvent, nodes[2]);
    });

    expect(screen.getByText('⌘ G')).toBeInTheDocument();
    expect(screen.getByText('to group')).toBeInTheDocument();
  });

  test('tooltip shows ungroup shortcut when single group selected', async () => {
    const flowWithGroup = {
      ...defaultFlow,
      nodes: [
        { id: 'group-1', type: 'group', isCollapsed: false, position: { x: 0, y: 0 }, data: { label: 'Group 1' } },
      ],
    };
    api.loadFlow.mockResolvedValueOnce(flowWithGroup);

    await renderApp();

    const { onNodeClick, nodes } = ReactFlow.mockProps;

    const metaEvent = { metaKey: true, ctrlKey: false };

    await act(async () => {
      onNodeClick(metaEvent, nodes[0]);
    });

    expect(screen.getByText('⌘ ⇧ G')).toBeInTheDocument();
    expect(screen.getByText('to ungroup')).toBeInTheDocument();
  });

  test('auto-save skips while backend is processing', async () => {
    api.loadFlow.mockResolvedValueOnce(defaultFlow);

    await renderApp();

    // Flush initial debounce timers
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    api.saveFlow.mockClear();

    const handlers = getChatHandlers();
    expect(handlers.onFlowUpdate).toBeDefined();
    expect(handlers.onProcessingChange).toBeDefined();

    await act(async () => {
      handlers.onProcessingChange(true);
    });

    await act(async () => {
      handlers.onFlowUpdate({
        nodes: [
          { id: 'group-1', type: 'group', isCollapsed: false, position: { x: 0, y: 0 }, data: { label: 'Group 1' } },
        ],
        edges: [],
      });
    });

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    expect(api.saveFlow).not.toHaveBeenCalled();
  });

  test('undo toast appears when auto-save runs with undo available', async () => {
    api.loadFlow.mockResolvedValueOnce(defaultFlow);
    api.getHistoryStatus.mockResolvedValueOnce({ canUndo: true });

    await renderApp();

    await act(async () => {
      jest.advanceTimersByTime(600);
    });

    expect(api.saveFlow).toHaveBeenCalled();
    expect(screen.getByText('⌘ Z')).toBeInTheDocument();
    expect(screen.getByText('to undo')).toBeInTheDocument();
  });
});
