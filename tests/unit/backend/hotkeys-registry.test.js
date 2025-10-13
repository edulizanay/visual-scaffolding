// ABOUTME: Tests for the centralized hotkeys registry
// ABOUTME: Validates structure, uniqueness, and helper functions

import { describe, it, expect } from 'vitest';
import {
  HOTKEYS,
  getHotkeys,
  getHotkeyById,
  getCategories,
  formatKeys
} from '../../../src/hooks/useHotkeys.jsx';

describe('Hotkeys Registry', () => {
  describe('Registry Structure', () => {
    it('should export HOTKEYS array', () => {
      expect(Array.isArray(HOTKEYS)).toBe(true);
      expect(HOTKEYS.length).toBeGreaterThan(0);
    });

    it('should have valid structure for all hotkeys', () => {
      HOTKEYS.forEach(hotkey => {
        expect(hotkey).toHaveProperty('id');
        expect(hotkey).toHaveProperty('category');
        expect(hotkey).toHaveProperty('keys');
        expect(hotkey).toHaveProperty('label');
        expect(hotkey).toHaveProperty('description');
        expect(hotkey).toHaveProperty('type');

        expect(typeof hotkey.id).toBe('string');
        expect(typeof hotkey.category).toBe('string');
        expect(Array.isArray(hotkey.keys)).toBe(true);
        expect(typeof hotkey.label).toBe('string');
        expect(typeof hotkey.description).toBe('string');
        expect(['keyboard', 'mouse']).toContain(hotkey.type);

        // Ensure keys array is not empty
        expect(hotkey.keys.length).toBeGreaterThan(0);
      });
    });

    it('should have unique IDs', () => {
      const ids = HOTKEYS.map(hk => hk.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have non-empty labels and descriptions', () => {
      HOTKEYS.forEach(hotkey => {
        expect(hotkey.label.trim()).not.toBe('');
        expect(hotkey.description.trim()).not.toBe('');
      });
    });
  });

  describe('isActive Guards', () => {
    it('should have isActive function for group.create', () => {
      const groupCreate = HOTKEYS.find(hk => hk.id === 'group.create');
      expect(groupCreate).toBeDefined();
      expect(typeof groupCreate.isActive).toBe('function');
    });

    it('group.create isActive should require 2+ selected nodes', () => {
      const groupCreate = HOTKEYS.find(hk => hk.id === 'group.create');

      expect(groupCreate.isActive({ selectedNodeIds: [] })).toBe(false);
      expect(groupCreate.isActive({ selectedNodeIds: ['node1'] })).toBe(false);
      expect(groupCreate.isActive({ selectedNodeIds: ['node1', 'node2'] })).toBe(true);
      expect(groupCreate.isActive({ selectedNodeIds: ['node1', 'node2', 'node3'] })).toBe(true);
    });

    it('should have isActive function for group.ungroup', () => {
      const ungroup = HOTKEYS.find(hk => hk.id === 'group.ungroup');
      expect(ungroup).toBeDefined();
      expect(typeof ungroup.isActive).toBe('function');
    });

    it('group.ungroup isActive should require exactly 1 group node selected', () => {
      const ungroup = HOTKEYS.find(hk => hk.id === 'group.ungroup');

      // No selection
      expect(ungroup.isActive({ selectedNodeIds: [], nodes: [] })).toBe(false);

      // Multiple nodes selected
      expect(ungroup.isActive({
        selectedNodeIds: ['node1', 'node2'],
        nodes: []
      })).toBe(false);

      // One regular node selected
      expect(ungroup.isActive({
        selectedNodeIds: ['node1'],
        nodes: [{ id: 'node1', type: 'default' }]
      })).toBe(false);

      // One group node selected
      expect(ungroup.isActive({
        selectedNodeIds: ['group1'],
        nodes: [{ id: 'group1', type: 'group' }]
      })).toBe(true);
    });

    it('should handle missing state gracefully in isActive', () => {
      const groupCreate = HOTKEYS.find(hk => hk.id === 'group.create');
      const ungroup = HOTKEYS.find(hk => hk.id === 'group.ungroup');

      expect(groupCreate.isActive({})).toBe(false);
      expect(groupCreate.isActive(null)).toBe(false);
      expect(ungroup.isActive({})).toBe(false);
      expect(ungroup.isActive(null)).toBe(false);
    });
  });

  describe('Expected Hotkeys', () => {
    it('should include undo hotkey', () => {
      const undo = HOTKEYS.find(hk => hk.id === 'history.undo');
      expect(undo).toBeDefined();
      expect(undo.keys).toEqual(['Meta', 'Z']);
      expect(undo.type).toBe('keyboard');
    });

    it('should include redo hotkey', () => {
      const redo = HOTKEYS.find(hk => hk.id === 'history.redo');
      expect(redo).toBeDefined();
      expect(redo.keys).toEqual(['Meta', 'Y']);
      expect(redo.type).toBe('keyboard');
    });

    it('should include group create hotkey', () => {
      const groupCreate = HOTKEYS.find(hk => hk.id === 'group.create');
      expect(groupCreate).toBeDefined();
      expect(groupCreate.keys).toEqual(['Meta', 'G']);
      expect(groupCreate.type).toBe('keyboard');
    });

    it('should include group ungroup hotkey', () => {
      const ungroup = HOTKEYS.find(hk => hk.id === 'group.ungroup');
      expect(ungroup).toBeDefined();
      expect(ungroup.keys).toEqual(['Meta', 'Shift', 'G']);
      expect(ungroup.type).toBe('keyboard');
    });

    it('should include multi-select hotkey', () => {
      const multiSelect = HOTKEYS.find(hk => hk.id === 'node.multiSelect');
      expect(multiSelect).toBeDefined();
      expect(multiSelect.keys).toEqual(['Meta', 'Click']);
      expect(multiSelect.type).toBe('mouse');
    });

    it('should include collapse subtree hotkey', () => {
      const collapse = HOTKEYS.find(hk => hk.id === 'node.collapseSubtree');
      expect(collapse).toBeDefined();
      expect(collapse.keys).toEqual(['Alt', 'Click']);
      expect(collapse.type).toBe('mouse');
    });

    it('should include chat submit hotkey', () => {
      const submit = HOTKEYS.find(hk => hk.id === 'chat.submit');
      expect(submit).toBeDefined();
      expect(submit.keys).toEqual(['Meta', 'Enter']);
      expect(submit.type).toBe('keyboard');
    });
  });

  describe('getHotkeys()', () => {
    it('should return all hotkeys when no category specified', () => {
      const all = getHotkeys();
      expect(all).toEqual(HOTKEYS);
    });

    it('should filter by category', () => {
      const history = getHotkeys('History');
      expect(history.length).toBeGreaterThan(0);
      expect(history.every(hk => hk.category === 'History')).toBe(true);
    });

    it('should return empty array for non-existent category', () => {
      const result = getHotkeys('NonExistent');
      expect(result).toEqual([]);
    });
  });

  describe('getHotkeyById()', () => {
    it('should return hotkey by ID', () => {
      const undo = getHotkeyById('history.undo');
      expect(undo).toBeDefined();
      expect(undo.id).toBe('history.undo');
    });

    it('should return undefined for non-existent ID', () => {
      const result = getHotkeyById('nonexistent.id');
      expect(result).toBeUndefined();
    });
  });

  describe('getCategories()', () => {
    it('should return array of unique categories', () => {
      const categories = getCategories();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);

      // Check uniqueness
      const uniqueCategories = new Set(categories);
      expect(uniqueCategories.size).toBe(categories.length);
    });

    it('should include expected categories', () => {
      const categories = getCategories();
      expect(categories).toContain('History');
      expect(categories).toContain('Group Operations');
      expect(categories).toContain('Chat');
    });
  });

  describe('formatKeys()', () => {
    it('should format Meta key as ⌘', () => {
      expect(formatKeys(['Meta', 'Z'])).toBe('⌘ Z');
    });

    it('should format Control as Ctrl', () => {
      expect(formatKeys(['Control', 'Z'])).toBe('Ctrl Z');
    });

    it('should format Alt as ⌥', () => {
      expect(formatKeys(['Alt', 'Click'])).toBe('⌥ Click');
    });

    it('should format Shift as ⇧', () => {
      expect(formatKeys(['Shift', 'Enter'])).toBe('⇧ ⏎');
    });

    it('should format Enter as ⏎', () => {
      expect(formatKeys(['Enter'])).toBe('⏎');
    });

    it('should format Escape as Esc', () => {
      expect(formatKeys(['Escape'])).toBe('Esc');
    });

    it('should handle multiple modifier keys', () => {
      expect(formatKeys(['Meta', 'Shift', 'G'])).toBe('⌘ ⇧ G');
    });

    it('should leave unmapped keys as-is', () => {
      expect(formatKeys(['A', 'B'])).toBe('A B');
      expect(formatKeys(['Click'])).toBe('Click');
    });
  });
});
