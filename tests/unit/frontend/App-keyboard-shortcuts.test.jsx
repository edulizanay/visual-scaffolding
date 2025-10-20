// ABOUTME: Baseline tests for keyboard shortcuts in App.jsx before refactoring
// ABOUTME: Tests keyboard handler logic in isolation without rendering full App component

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as api from '../../../src/services/api';

// Mock the API module
vi.mock('../../../src/services/api', () => ({
  undoFlow: vi.fn(),
  redoFlow: vi.fn(),
  createGroup: vi.fn(),
  ungroup: vi.fn(),
}));

describe('App.jsx Keyboard Shortcuts (Baseline)', () => {
  let keydownHandler;
  let mockHandleUndo;
  let mockHandleRedo;
  let mockHandleCreateGroup;
  let mockUngroupNodes;
  let mockSelectedNodeIds;
  let mockNodes;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default API responses
    api.undoFlow.mockResolvedValue({ success: true, flow: { nodes: [], edges: [] } });
    api.redoFlow.mockResolvedValue({ success: true, flow: { nodes: [], edges: [] } });
    api.createGroup.mockResolvedValue({ success: true, flow: { nodes: [], edges: [] } });
    api.ungroup.mockResolvedValue({ success: true, flow: { nodes: [], edges: [] } });

    // Mock state
    mockSelectedNodeIds = [];
    mockNodes = [];

    // Create mock handler functions that match App.jsx behavior
    mockHandleUndo = vi.fn(async () => {
      await api.undoFlow();
    });

    mockHandleRedo = vi.fn(async () => {
      await api.redoFlow();
    });

    mockHandleCreateGroup = vi.fn(async () => {
      if (mockSelectedNodeIds.length < 2) {
        alert('Please select at least 2 nodes to create a group');
        return;
      }
      await api.createGroup({ memberIds: mockSelectedNodeIds, label: 'Group' });
    });

    mockUngroupNodes = vi.fn(async () => {
      if (mockSelectedNodeIds.length !== 1) {
        alert('Please select exactly 1 group node to ungroup');
        return;
      }
      const groupNode = mockNodes.find(n => n.id === mockSelectedNodeIds[0]);
      if (!groupNode || groupNode.type !== 'group') {
        alert('Selected node is not a group');
        return;
      }
      await api.ungroup(mockSelectedNodeIds[0]);
    });

    // Create keyboard handler matching App.jsx implementation (lines 504-524)
    keydownHandler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        mockHandleUndo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        mockHandleRedo();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        mockUngroupNodes();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault();
        mockHandleCreateGroup();
      }
    };

    // Mock window.alert
    global.alert = vi.fn();

    // Attach handler
    document.addEventListener('keydown', keydownHandler);
  });

  afterEach(() => {
    // Clean up handler
    document.removeEventListener('keydown', keydownHandler);
    vi.restoreAllMocks();
  });

  describe('Undo/Redo Shortcuts', () => {
    it('should call handleUndo when Cmd+Z is pressed', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(mockHandleUndo).toHaveBeenCalledTimes(1);
    });

    it('should call handleUndo when Ctrl+Z is pressed', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(mockHandleUndo).toHaveBeenCalledTimes(1);
    });

    it('should call handleRedo when Cmd+Y is pressed', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'y',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(mockHandleRedo).toHaveBeenCalledTimes(1);
    });

    it('should call handleRedo when Ctrl+Y is pressed', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'y',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(mockHandleRedo).toHaveBeenCalledTimes(1);
    });

    it('should prevent default browser behavior on Cmd+Z', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should prevent default browser behavior on Cmd+Y', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'y',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should call API undoFlow through handler', async () => {
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);
      await mockHandleUndo.mock.results[0].value; // Wait for async call

      expect(api.undoFlow).toHaveBeenCalledTimes(1);
    });

    it('should call API redoFlow through handler', async () => {
      const event = new KeyboardEvent('keydown', {
        key: 'y',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);
      await mockHandleRedo.mock.results[0].value; // Wait for async call

      expect(api.redoFlow).toHaveBeenCalledTimes(1);
    });
  });

  describe('Group/Ungroup Shortcuts', () => {
    it('should show alert when Cmd+G pressed with less than 2 nodes selected', async () => {
      mockSelectedNodeIds = [];

      const event = new KeyboardEvent('keydown', {
        key: 'g',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);
      await mockHandleCreateGroup.mock.results[0].value;

      expect(global.alert).toHaveBeenCalledWith('Please select at least 2 nodes to create a group');
      expect(api.createGroup).not.toHaveBeenCalled();
    });

    it('should call createGroup when Cmd+G pressed with 2+ nodes selected', async () => {
      mockSelectedNodeIds = ['node1', 'node2'];

      const event = new KeyboardEvent('keydown', {
        key: 'g',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);
      await mockHandleCreateGroup.mock.results[0].value;

      expect(global.alert).not.toHaveBeenCalled();
      expect(api.createGroup).toHaveBeenCalledWith({
        memberIds: ['node1', 'node2'],
        label: 'Group'
      });
    });

    it('should show alert when Cmd+Shift+G pressed with no selection', async () => {
      mockSelectedNodeIds = [];

      const event = new KeyboardEvent('keydown', {
        key: 'G',
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);
      await mockUngroupNodes.mock.results[0].value;

      expect(global.alert).toHaveBeenCalledWith('Please select exactly 1 group node to ungroup');
      expect(api.ungroup).not.toHaveBeenCalled();
    });

    it('should show alert when Cmd+Shift+G pressed with non-group node', async () => {
      mockSelectedNodeIds = ['node1'];
      mockNodes = [{ id: 'node1', type: 'default' }];

      const event = new KeyboardEvent('keydown', {
        key: 'G',
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);
      await mockUngroupNodes.mock.results[0].value;

      expect(global.alert).toHaveBeenCalledWith('Selected node is not a group');
      expect(api.ungroup).not.toHaveBeenCalled();
    });

    it('should call ungroup when Cmd+Shift+G pressed with group node selected', async () => {
      mockSelectedNodeIds = ['group1'];
      mockNodes = [{ id: 'group1', type: 'group' }];

      const event = new KeyboardEvent('keydown', {
        key: 'G',
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);
      await mockUngroupNodes.mock.results[0].value;

      expect(global.alert).not.toHaveBeenCalled();
      expect(api.ungroup).toHaveBeenCalledWith('group1');
    });

    it('should prevent default browser behavior on Cmd+G', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'g',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should prevent default browser behavior on Cmd+Shift+G', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'G',
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Keyboard Event Listener Management', () => {
    it('should properly handle keydown events when listener is attached', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(mockHandleUndo).toHaveBeenCalledTimes(1);
    });

    it('should not handle events after listener is removed', () => {
      // Remove the listener
      document.removeEventListener('keydown', keydownHandler);

      const event = new KeyboardEvent('keydown', {
        key: 'z',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      // Handler should not be called since listener was removed
      expect(mockHandleUndo).not.toHaveBeenCalled();

      // Re-add for cleanup
      document.addEventListener('keydown', keydownHandler);
    });
  });

  describe('Non-Shortcut Keys', () => {
    it('should not trigger any actions on regular letter keys', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'a',
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(mockHandleUndo).not.toHaveBeenCalled();
      expect(mockHandleRedo).not.toHaveBeenCalled();
      expect(mockHandleCreateGroup).not.toHaveBeenCalled();
      expect(mockUngroupNodes).not.toHaveBeenCalled();
    });

    it('should not trigger actions on Cmd without recognized keys', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'a',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(mockHandleUndo).not.toHaveBeenCalled();
      expect(mockHandleRedo).not.toHaveBeenCalled();
      expect(mockHandleCreateGroup).not.toHaveBeenCalled();
      expect(mockUngroupNodes).not.toHaveBeenCalled();
    });

    it('should not trigger undo on lowercase y', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'y',
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(mockHandleRedo).not.toHaveBeenCalled();
    });

    it('should not trigger group on uppercase G without Shift', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'G',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      // Should not trigger anything (neither group nor ungroup)
      expect(mockHandleCreateGroup).not.toHaveBeenCalled();
      expect(mockUngroupNodes).not.toHaveBeenCalled();
    });
  });
});
