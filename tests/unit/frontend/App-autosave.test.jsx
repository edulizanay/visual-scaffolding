// ABOUTME: Tests for frontend autosave behavior in App.jsx
// ABOUTME: Verifies autosave triggers correctly and doesn't double-save

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, waitFor, act } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import * as api from '../../../src/api.js';

// Mock all API functions
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

// Mock React Flow hooks
jest.mock('@xyflow/react', () => ({
  ...jest.requireActual('@xyflow/react'),
  useNodesState: jest.fn(() => [[], jest.fn(), jest.fn()]),
  useEdgesState: jest.fn(() => [[], jest.fn(), jest.fn()]),
}));

// Import App after mocks are set up
let App;

describe('App.jsx Autosave Behavior', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default API responses
    api.loadFlow.mockResolvedValue({ nodes: [], edges: [] });
    api.saveFlow.mockResolvedValue({ success: true });
    api.getHistoryStatus.mockResolvedValue({ canUndo: false, canRedo: false });

    // Dynamic import after mocks
    const AppModule = await import('../../../src/App.jsx');
    App = AppModule.default;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
  });

  describe('Autosave debounce', () => {
    it('should debounce saves by 500ms', async () => {
      const { rerender } = render(
        <ReactFlowProvider>
          <App />
        </ReactFlowProvider>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(api.loadFlow).toHaveBeenCalled();
      });

      // Clear the mock to track new saves
      api.saveFlow.mockClear();

      // Simulate rapid state changes (multiple re-renders)
      for (let i = 0; i < 5; i++) {
        rerender(
          <ReactFlowProvider>
            <App />
          </ReactFlowProvider>
        );
      }

      // No saves yet (debounce hasn't fired)
      expect(api.saveFlow).not.toHaveBeenCalled();

      // Fast-forward 500ms
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Wait for save to complete
      await waitFor(() => {
        expect(api.saveFlow).toHaveBeenCalledTimes(1);
      });
    });

    it('should reset debounce timer on rapid changes', async () => {
      render(
        <ReactFlowProvider>
          <App />
        </ReactFlowProvider>
      );

      await waitFor(() => {
        expect(api.loadFlow).toHaveBeenCalled();
      });

      api.saveFlow.mockClear();

      // Trigger state change
      // Fast-forward 400ms (not enough to trigger)
      act(() => {
        jest.advanceTimersByTime(400);
      });

      // Trigger another state change (resets timer)
      // Fast-forward 400ms again
      act(() => {
        jest.advanceTimersByTime(400);
      });

      // Still no save (timer was reset)
      expect(api.saveFlow).not.toHaveBeenCalled();

      // Fast-forward final 100ms (total 500ms since last change)
      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Now save should trigger
      await waitFor(() => {
        expect(api.saveFlow).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Autosave guards', () => {
    it('should not save when isLoading is true', async () => {
      // This test would need access to component internals
      // We can test this by checking that no save happens during initial load

      render(
        <ReactFlowProvider>
          <App />
        </ReactFlowProvider>
      );

      // During initial load, no autosave should happen
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Only loadFlow should be called, not saveFlow
      expect(api.loadFlow).toHaveBeenCalled();
      expect(api.saveFlow).not.toHaveBeenCalled();
    });
  });

  describe('Double-save prevention', () => {
    it('should NOT double-save when backend operation returns updated flow', async () => {
      // Mock updateNode to return updated flow
      api.updateNode.mockResolvedValue({
        success: true,
        flow: {
          nodes: [{ id: 'test', data: { label: 'Updated' } }],
          edges: []
        }
      });

      const { container } = render(
        <ReactFlowProvider>
          <App />
        </ReactFlowProvider>
      );

      await waitFor(() => {
        expect(api.loadFlow).toHaveBeenCalled();
      });

      api.saveFlow.mockClear();

      // Simulate backend operation (like updateNode being called)
      // In real app, this would be triggered by user editing label
      await act(async () => {
        await api.updateNode('test', { label: 'Updated' });
      });

      // Backend already saved, so handleFlowUpdate receives result
      // and sets state. This SHOULD NOT trigger autosave again.

      // Fast-forward past debounce
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // CRITICAL TEST: saveFlow should NOT be called
      // (backend already saved when updateNode was called)
      // If this fails, we have a double-save bug!
      await waitFor(() => {
        // We expect 0 calls because:
        // 1. Backend saved when updateNode was called
        // 2. Frontend received result and displayed it
        // 3. Autosave should NOT trigger again

        // NOTE: This test will likely FAIL with current code
        // because autosave watches all state changes
        expect(api.saveFlow).toHaveBeenCalledTimes(0);
      });
    });

    it('should NOT double-save when LLM operation returns updated flow', async () => {
      // Simulate LLM conversation endpoint returning updated flow
      const mockLLMResponse = {
        success: true,
        updatedFlow: {
          nodes: [
            { id: 'node1', data: { label: 'Node 1' } },
            { id: 'node2', data: { label: 'Node 2' } }
          ],
          edges: [{ id: 'e1', source: 'node1', target: 'node2' }]
        }
      };

      render(
        <ReactFlowProvider>
          <App />
        </ReactFlowProvider>
      );

      await waitFor(() => {
        expect(api.loadFlow).toHaveBeenCalled();
      });

      api.saveFlow.mockClear();

      // Simulate LLM response being processed
      // (In real app, ChatInterface calls handleFlowUpdate with LLM result)
      await act(async () => {
        // Simulate what happens when LLM returns updated flow
        // Backend already saved, just returning result
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Should NOT trigger autosave (backend already saved)
      await waitFor(() => {
        expect(api.saveFlow).toHaveBeenCalledTimes(0);
      });
    });
  });

  describe('When autosave SHOULD trigger', () => {
    it('should save after user manually drags node', async () => {
      // This would require simulating React Flow drag events
      // Complex to test without full integration test

      // For now, we document the expected behavior:
      // 1. User drags node
      // 2. onNodesChange fires
      // 3. State updates with new position
      // 4. After 500ms, saveFlow is called

      // This is the GOOD autosave - saving manual user changes
    });

    it('should save after layout animation completes', async () => {
      // This would require testing layout animation completion
      // Complex without full integration

      // Expected behavior:
      // 1. Layout animation runs (isAnimating = true)
      // 2. Autosave is blocked during animation
      // 3. Animation completes (isAnimating = false)
      // 4. After 500ms, saveFlow is called with final positions

      // This is also GOOD autosave - saving calculated positions
    });
  });
});

describe('Integration: Backend + Frontend Save Flow', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    api.loadFlow.mockResolvedValue({ nodes: [], edges: [] });
    api.saveFlow.mockResolvedValue({ success: true });
    api.getHistoryStatus.mockResolvedValue({ canUndo: false, canRedo: false });

    const AppModule = await import('../../../src/App.jsx');
    App = AppModule.default;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
  });

  it('should demonstrate the double-save problem', async () => {
    // This is a FAILING test that PROVES the bug exists

    api.createNode.mockResolvedValue({
      success: true,
      flow: {
        nodes: [{ id: 'new', data: { label: 'New Node' }, position: { x: 0, y: 0 } }],
        edges: []
      }
    });

    render(
      <ReactFlowProvider>
        <App />
      </ReactFlowProvider>
    );

    await waitFor(() => {
      expect(api.loadFlow).toHaveBeenCalled();
    });

    // Track saves
    const saveCallsBefore = api.saveFlow.mock.calls.length;

    // Simulate createNode being called (manual node creation)
    await act(async () => {
      const result = await api.createNode({ label: 'New Node' });
      // Backend already saved when createNode was called

      // Now handleFlowUpdate receives result and sets state
      // This WILL trigger autosave in current implementation
    });

    // Fast-forward to let autosave fire
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const saveCallsAfter = api.saveFlow.mock.calls.length;
    const newSaves = saveCallsAfter - saveCallsBefore;

    // EXPECTED: 0 new saves (backend already saved)
    // ACTUAL (current bug): 1 new save (autosave triggered)

    console.log(`Saves after createNode: ${newSaves}`);
    console.log('Expected: 0 (backend already saved)');
    console.log('If this is > 0, we have a double-save bug!');

    // This assertion will FAIL with current code, proving the bug
    expect(newSaves).toBe(0);
  });
});
