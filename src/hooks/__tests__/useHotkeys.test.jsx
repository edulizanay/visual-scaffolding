// ABOUTME: Tests for useHotkeys hook
// ABOUTME: Validates keyboard event handling, isActive guards, and cleanup

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHotkeys } from '../useHotkeys.jsx';

describe('useHotkeys Hook', () => {
  let mockHandler1;
  let mockHandler2;
  let addEventListenerSpy;
  let removeEventListenerSpy;

  beforeEach(() => {
    mockHandler1 = vi.fn();
    mockHandler2 = vi.fn();
    addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Event Listener Management', () => {
    it('should register keydown event listener on mount', () => {
      renderHook(() => useHotkeys([
        { keys: ['Meta', 'G'], handler: mockHandler1 }
      ]));

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });

    it('should remove keydown event listener on unmount', () => {
      const { unmount } = renderHook(() => useHotkeys([
        { keys: ['Meta', 'G'], handler: mockHandler1 }
      ]));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });
  });

  describe('Single Key Shortcuts', () => {
    it('should trigger handler for Meta+G', () => {
      renderHook(() => useHotkeys([
        { keys: ['Meta', 'G'], handler: mockHandler1 }
      ]));

      const event = new KeyboardEvent('keydown', {
        key: 'G',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(mockHandler1).toHaveBeenCalledTimes(1);
      expect(mockHandler1).toHaveBeenCalledWith(event);
    });

    it('should trigger handler for Meta+g (lowercase)', () => {
      renderHook(() => useHotkeys([
        { keys: ['Meta', 'G'], handler: mockHandler1 }
      ]));

      const event = new KeyboardEvent('keydown', {
        key: 'g',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(mockHandler1).toHaveBeenCalledTimes(1);
    });

    it('should trigger handler for Meta+Z', () => {
      renderHook(() => useHotkeys([
        { keys: ['Meta', 'Z'], handler: mockHandler1 }
      ]));

      const event = new KeyboardEvent('keydown', {
        key: 'z',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(mockHandler1).toHaveBeenCalledTimes(1);
    });

    it('should trigger handler for Ctrl+Z (Control key)', () => {
      renderHook(() => useHotkeys([
        { keys: ['Control', 'Z'], handler: mockHandler1 }
      ]));

      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(mockHandler1).toHaveBeenCalledTimes(1);
    });

    it('should trigger handler for Alt+Click (simulated)', () => {
      renderHook(() => useHotkeys([
        { keys: ['Alt', 'Click'], handler: mockHandler1 }
      ]));

      const event = new KeyboardEvent('keydown', {
        key: 'Click',
        altKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(mockHandler1).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multiple Modifier Keys', () => {
    it('should trigger handler for Meta+Shift+G', () => {
      renderHook(() => useHotkeys([
        { keys: ['Meta', 'Shift', 'G'], handler: mockHandler1 }
      ]));

      const event = new KeyboardEvent('keydown', {
        key: 'G',
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(mockHandler1).toHaveBeenCalledTimes(1);
    });

    it('should NOT trigger handler when missing a modifier', () => {
      renderHook(() => useHotkeys([
        { keys: ['Meta', 'Shift', 'G'], handler: mockHandler1 }
      ]));

      // Press Meta+G without Shift
      const event = new KeyboardEvent('keydown', {
        key: 'G',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(mockHandler1).not.toHaveBeenCalled();
    });

    it('should NOT trigger handler when extra modifier is pressed', () => {
      renderHook(() => useHotkeys([
        { keys: ['Meta', 'G'], handler: mockHandler1 }
      ]));

      // Press Meta+Shift+G when only Meta+G is registered
      const event = new KeyboardEvent('keydown', {
        key: 'G',
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(mockHandler1).not.toHaveBeenCalled();
    });
  });

  describe('Multiple Hotkeys', () => {
    it('should register multiple hotkeys independently', () => {
      renderHook(() => useHotkeys([
        { keys: ['Meta', 'G'], handler: mockHandler1 },
        { keys: ['Meta', 'Z'], handler: mockHandler2 }
      ]));

      // Trigger first hotkey
      const event1 = new KeyboardEvent('keydown', {
        key: 'G',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event1);

      expect(mockHandler1).toHaveBeenCalledTimes(1);
      expect(mockHandler2).not.toHaveBeenCalled();

      // Trigger second hotkey
      const event2 = new KeyboardEvent('keydown', {
        key: 'Z',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event2);

      expect(mockHandler1).toHaveBeenCalledTimes(1);
      expect(mockHandler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('isActive Guards', () => {
    it('should call handler when isActive returns true', () => {
      const isActive = vi.fn(() => true);

      renderHook(() => useHotkeys([
        { keys: ['Meta', 'G'], handler: mockHandler1, isActive }
      ], { someState: 'value' }));

      const event = new KeyboardEvent('keydown', {
        key: 'G',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(isActive).toHaveBeenCalledWith({ someState: 'value' });
      expect(mockHandler1).toHaveBeenCalledTimes(1);
    });

    it('should NOT call handler when isActive returns false', () => {
      const isActive = vi.fn(() => false);

      renderHook(() => useHotkeys([
        { keys: ['Meta', 'G'], handler: mockHandler1, isActive }
      ], { someState: 'value' }));

      const event = new KeyboardEvent('keydown', {
        key: 'G',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(isActive).toHaveBeenCalledWith({ someState: 'value' });
      expect(mockHandler1).not.toHaveBeenCalled();
    });

    it('should update isActive behavior when state changes', () => {
      const isActive = vi.fn((state) => state.selectedNodeIds?.length >= 2);

      const { rerender } = renderHook(
        ({ state }) => useHotkeys([
          { keys: ['Meta', 'G'], handler: mockHandler1, isActive }
        ], state),
        { initialProps: { state: { selectedNodeIds: [] } } }
      );

      // With empty selection, should not trigger
      const event1 = new KeyboardEvent('keydown', {
        key: 'G',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event1);
      expect(mockHandler1).not.toHaveBeenCalled();

      // Update state to have 2 selected nodes
      rerender({ state: { selectedNodeIds: ['node1', 'node2'] } });

      // Now should trigger
      const event2 = new KeyboardEvent('keydown', {
        key: 'G',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event2);
      expect(mockHandler1).toHaveBeenCalledTimes(1);
    });
  });

  describe('preventDefault Behavior', () => {
    it('should call preventDefault when hotkey matches', () => {
      renderHook(() => useHotkeys([
        { keys: ['Meta', 'G'], handler: mockHandler1 }
      ]));

      const event = new KeyboardEvent('keydown', {
        key: 'G',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should NOT call preventDefault when hotkey does not match', () => {
      renderHook(() => useHotkeys([
        { keys: ['Meta', 'G'], handler: mockHandler1 }
      ]));

      const event = new KeyboardEvent('keydown', {
        key: 'A',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('should NOT call preventDefault when isActive guard fails', () => {
      const isActive = vi.fn(() => false);

      renderHook(() => useHotkeys([
        { keys: ['Meta', 'G'], handler: mockHandler1, isActive }
      ]));

      const event = new KeyboardEvent('keydown', {
        key: 'G',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty hotkeys array', () => {
      renderHook(() => useHotkeys([]));

      const event = new KeyboardEvent('keydown', {
        key: 'G',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      // Should not throw
      expect(() => document.dispatchEvent(event)).not.toThrow();
    });

    it('should handle undefined state', () => {
      renderHook(() => useHotkeys([
        { keys: ['Meta', 'G'], handler: mockHandler1 }
      ]));

      const event = new KeyboardEvent('keydown', {
        key: 'G',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(mockHandler1).toHaveBeenCalledTimes(1);
    });

    it('should not trigger on modifier keys alone', () => {
      renderHook(() => useHotkeys([
        { keys: ['Meta', 'G'], handler: mockHandler1 }
      ]));

      // Press only Meta key
      const event = new KeyboardEvent('keydown', {
        key: 'Meta',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      document.dispatchEvent(event);

      expect(mockHandler1).not.toHaveBeenCalled();
    });
  });
});
