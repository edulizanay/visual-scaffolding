// ABOUTME: Unit tests for drag-end position update helpers
// ABOUTME: Tests pure functions for moved node detection

import { describe, it, expect } from 'vitest';
import { getMovedNodes } from '../../../src/utils/dragHelpers.js';

describe('dragHelpers', () => {
  describe('getMovedNodes', () => {
    it('should return moved nodes that exceed threshold', () => {
      const dragEndChanges = [
        { id: 'node1', type: 'position', position: { x: 150, y: 200 } },
        { id: 'node2', type: 'position', position: { x: 100.05, y: 100.05 } } // Below threshold
      ];

      const originalPositions = {
        node1: { x: 0, y: 0 },
        node2: { x: 100, y: 100 }
      };

      const result = getMovedNodes(dragEndChanges, originalPositions);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'node1',
        position: { x: 150, y: 200 },
        originalPosition: { x: 0, y: 0 }
      });
    });

    it('should return empty array when no nodes moved significantly', () => {
      const dragEndChanges = [{ id: 'node1', type: 'position', position: { x: 100.05, y: 100.05 } }];
      const originalPositions = { node1: { x: 100, y: 100 } };

      const result = getMovedNodes(dragEndChanges, originalPositions);

      expect(result).toHaveLength(0);
    });

    it('should handle missing original positions', () => {
      const dragEndChanges = [{ id: 'node1', type: 'position', position: { x: 150, y: 200 } }];
      const originalPositions = {};

      const result = getMovedNodes(dragEndChanges, originalPositions);

      expect(result).toHaveLength(0);
    });

    it('should handle missing position in change payload', () => {
      const dragEndChanges = [{ id: 'node1', type: 'position' }]; // No position property
      const originalPositions = { node1: { x: 0, y: 0 } };

      const result = getMovedNodes(dragEndChanges, originalPositions);

      expect(result).toHaveLength(0);
    });

    it('should respect custom threshold', () => {
      const dragEndChanges = [{ id: 'node1', type: 'position', position: { x: 0.5, y: 0.5 } }];
      const originalPositions = { node1: { x: 0, y: 0 } };

      // With default threshold 0.1, should return node (moved 0.5)
      const defaultResult = getMovedNodes(dragEndChanges, originalPositions);
      expect(defaultResult).toHaveLength(1);

      // With threshold 1.0, should return empty (0.5 < 1.0)
      const customResult = getMovedNodes(dragEndChanges, originalPositions, 1.0);
      expect(customResult).toHaveLength(0);
    });
  });
});
