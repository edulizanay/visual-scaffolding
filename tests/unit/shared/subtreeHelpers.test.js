// ABOUTME: Unit tests for subtree collapse routing helpers
// ABOUTME: Tests pure functions for backend vs legacy path decision logic

import { describe, it, expect } from 'vitest';
import { shouldUseBackendSubtree, getTargetCollapseState } from '../../../src/utils/subtreeHelpers.js';

describe('subtreeHelpers', () => {
  describe('shouldUseBackendSubtree', () => {
    it('should return true when flag is enabled', () => {
      const result = shouldUseBackendSubtree(true);
      expect(result).toBe(true);
    });

    it('should return false when flag is disabled', () => {
      const result = shouldUseBackendSubtree(false);
      expect(result).toBe(false);
    });
  });

  describe('getTargetCollapseState', () => {
    it('should return true when node is not collapsed', () => {
      const node = { data: { collapsed: false } };
      const result = getTargetCollapseState(node);
      expect(result).toBe(true);
    });

    it('should return false when node is collapsed', () => {
      const node = { data: { collapsed: true } };
      const result = getTargetCollapseState(node);
      expect(result).toBe(false);
    });

    it('should return true when collapsed property is missing (default uncollapsed)', () => {
      const node = { data: {} };
      const result = getTargetCollapseState(node);
      expect(result).toBe(true);
    });

    it('should return true when data is missing (default uncollapsed)', () => {
      const node = {};
      const result = getTargetCollapseState(node);
      expect(result).toBe(true);
    });
  });
});
