// ABOUTME: Centralized keyboard shortcuts registry and React hook for managing them
// ABOUTME: Single source of truth for all hotkeys, including data and behavior

import { useEffect, useRef, useCallback } from 'react';

/**
 * Hotkey definition structure:
 * - id: Unique identifier for the hotkey
 * - category: Grouping for display in the panel
 * - keys: Array of keys that trigger this action (e.g., ['Meta', 'G'] or ['Alt', 'Click'])
 * - label: Short display name
 * - description: Longer explanation of what the hotkey does
 * - type: 'keyboard' or 'mouse' - determines how the keys are displayed
 * - isActive: Optional function that returns true if this hotkey should execute
 */

export const HOTKEYS = [
  // History Operations
  {
    id: 'history.undo',
    category: 'History',
    keys: ['Meta', 'Z'],
    label: 'Undo',
    description: 'Undo the last action',
    type: 'keyboard',
  },
  {
    id: 'history.redo',
    category: 'History',
    keys: ['Meta', 'Y'],
    label: 'Redo',
    description: 'Redo the last undone action',
    type: 'keyboard',
  },

  // Group Operations
  {
    id: 'group.create',
    category: 'Group Operations',
    keys: ['Meta', 'G'],
    label: 'Group Nodes',
    description: 'Combine 2+ selected nodes into a group',
    type: 'keyboard',
    isActive: (state) => state?.selectedNodeIds?.length >= 2,
  },
  {
    id: 'group.ungroup',
    category: 'Group Operations',
    keys: ['Meta', 'Shift', 'G'],
    label: 'Ungroup',
    description: 'Release nodes from a group',
    type: 'keyboard',
    isActive: (state) => {
      if (!state?.selectedNodeIds || state.selectedNodeIds.length !== 1) return false;
      const selectedNode = state.nodes?.find(n => n.id === state.selectedNodeIds[0]);
      return selectedNode?.type === 'group';
    },
  },

  // Node Operations (Mouse + Keyboard)
  {
    id: 'node.multiSelect',
    category: 'Selection',
    keys: ['Meta', 'Click'],
    label: 'Multi-Select',
    description: 'Click nodes with Cmd held to select multiple nodes',
    type: 'mouse',
  },
  {
    id: 'node.collapseSubtree',
    category: 'Node Operations',
    keys: ['Alt', 'Click'],
    label: 'Collapse/Expand Subtree',
    description: 'Alt+Click on a node to collapse or expand its entire subtree',
    type: 'mouse',
  },
  {
    id: 'node.createChild',
    category: 'Node Operations',
    keys: ['Meta', 'Double-Click'],
    label: 'Create Child Node',
    description: 'Cmd+Double-click on a node to create a child node',
    type: 'mouse',
  },

  // Group Node Operations
  {
    id: 'group.toggleExpansion',
    category: 'Group Operations',
    keys: ['Double-Click'],
    label: 'Toggle Group Expansion',
    description: 'Double-click on a group node to collapse or expand it',
    type: 'mouse',
  },

  // Chat Operations
  {
    id: 'chat.submit',
    category: 'Chat',
    keys: ['Meta', 'Enter'],
    label: 'Submit Message',
    description: 'Send a message to the AI assistant',
    type: 'keyboard',
  },

  // Editing Operations
  {
    id: 'edit.commit',
    category: 'Editing',
    keys: ['Enter'],
    label: 'Commit Edit',
    description: 'Save changes when editing a node label or description',
    type: 'keyboard',
  },
  {
    id: 'edit.cancel',
    category: 'Editing',
    keys: ['Escape'],
    label: 'Cancel Edit',
    description: 'Discard changes when editing',
    type: 'keyboard',
  },
];

/**
 * Get all hotkeys, optionally filtered by category
 */
export function getHotkeys(category = null) {
  if (!category) return HOTKEYS;
  return HOTKEYS.filter(hk => hk.category === category);
}

/**
 * Get a specific hotkey by ID
 */
export function getHotkeyById(id) {
  return HOTKEYS.find(hk => hk.id === id);
}

/**
 * Get all unique categories
 */
export function getCategories() {
  return [...new Set(HOTKEYS.map(hk => hk.category))];
}

/**
 * Format keys for display (e.g., ['Meta', 'G'] => '⌘ G')
 */
export function formatKeys(keys) {
  const keyMap = {
    'Meta': '⌘',
    'Control': 'Ctrl',
    'Alt': '⌥',
    'Shift': '⇧',
    'Enter': '⏎',
    'Escape': 'Esc',
  };

  return keys
    .map(key => keyMap[key] || key)
    .join(' ');
}

/**
 * useHotkeys hook
 *
 * Registers keyboard shortcuts with automatic cleanup and conditional execution.
 *
 * @param {Array} hotkeys - Array of hotkey configurations
 *   Each config should have:
 *   - keys: Array of keys that trigger this action (e.g., ['Meta', 'G'])
 *   - handler: Function to call when hotkey is triggered
 *   - isActive: Optional function that returns true if hotkey should execute
 *
 * @param {Object} state - Current application state passed to isActive guards
 *
 * @example
 * useHotkeys([
 *   {
 *     keys: ['Meta', 'G'],
 *     handler: handleGroup,
 *     isActive: (state) => state.selectedNodeIds.length >= 2
 *   }
 * ], { selectedNodeIds, nodes });
 */
export function useHotkeys(hotkeys, state = {}) {
  // Store handlers in ref to avoid re-registering on every render
  const handlersRef = useRef({});

  // Update handlers ref when they change
  useEffect(() => {
    hotkeys.forEach(({ keys, handler }) => {
      const keyCombo = keys.join('+');
      handlersRef.current[keyCombo] = handler;
    });
  }, [hotkeys]);

  // Memoize keyboard event handler
  const handleKeyDown = useCallback((e) => {
    hotkeys.forEach(({ keys, handler, isActive }) => {
      // Check if isActive guard passes (if present)
      if (isActive && !isActive(state)) {
        return;
      }

      // Build the key combination from the event
      const pressedKeys = [];

      if (e.metaKey) pressedKeys.push('Meta');
      if (e.ctrlKey) pressedKeys.push('Control');
      if (e.altKey) pressedKeys.push('Alt');
      if (e.shiftKey) pressedKeys.push('Shift');

      // Add the main key (normalize to match registry format)
      if (e.key && e.key !== 'Meta' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift') {
        pressedKeys.push(e.key);
      }

      // Check if pressed keys match this hotkey
      if (keysMatch(pressedKeys, keys)) {
        e.preventDefault();
        handler(e);
      }
    });
  }, [hotkeys, state]);

  // Register and cleanup event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

/**
 * Check if pressed keys match the hotkey definition
 * Handles both exact matches and case variations (e.g., 'g' vs 'G')
 */
function keysMatch(pressedKeys, hotkeyKeys) {
  if (pressedKeys.length !== hotkeyKeys.length) {
    return false;
  }

  // Create normalized versions for comparison
  const normalizedPressed = pressedKeys.map(k => k.toLowerCase());
  const normalizedHotkey = hotkeyKeys.map(k => k.toLowerCase());

  // Check if all keys match (order-independent for modifiers, order-dependent for main key)
  const modifiers = ['meta', 'control', 'alt', 'shift'];

  // Extract modifiers and main keys
  const pressedModifiers = normalizedPressed.filter(k => modifiers.includes(k)).sort();
  const hotkeyModifiers = normalizedHotkey.filter(k => modifiers.includes(k)).sort();
  const pressedMainKey = normalizedPressed.find(k => !modifiers.includes(k));
  const hotkeyMainKey = normalizedHotkey.find(k => !modifiers.includes(k));

  // Check modifiers match
  if (pressedModifiers.length !== hotkeyModifiers.length) {
    return false;
  }

  for (let i = 0; i < pressedModifiers.length; i++) {
    if (pressedModifiers[i] !== hotkeyModifiers[i]) {
      return false;
    }
  }

  // Check main key matches
  return pressedMainKey === hotkeyMainKey;
}
