// ABOUTME: Tests undo/redo functionality with auto-save to ensure redo chain isn't truncated
// ABOUTME: Verifies that auto-save after undo doesn't destroy the redo chain
import { pushSnapshot, undo, redo, canRedo, clearHistory } from '../server/historyService.js';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_HISTORY_PATH = join(__dirname, 'test-data', 'test-undo-redo-history.json');

describe('Undo/Redo with Auto-save', () => {
  beforeEach(async () => {
    process.env.HISTORY_DATA_PATH = TEST_HISTORY_PATH;
    await fs.mkdir(dirname(TEST_HISTORY_PATH), { recursive: true });
    await clearHistory();
  });

  test('auto-save after undo should not truncate redo chain', async () => {
    // Create state A
    const stateA = {
      nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'A' } }],
      edges: []
    };
    await pushSnapshot(stateA);

    // Create state B
    const stateB = {
      nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'B' } }],
      edges: []
    };
    await pushSnapshot(stateB);

    // Create state C
    const stateC = {
      nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'C' } }],
      edges: []
    };
    await pushSnapshot(stateC);

    // Undo to B
    const undoResult = await undo();
    expect(undoResult.nodes[0].data.label).toBe('B');

    // Verify we can redo before auto-save
    expect(await canRedo()).toBe(true);

    // Simulate auto-save (pushSnapshot with same state B)
    await new Promise(resolve => setTimeout(resolve, 500));
    await pushSnapshot(stateB);

    // Verify we can still redo after auto-save
    expect(await canRedo()).toBe(true);

    // Verify redo actually works and returns state C
    const redoResult = await redo();
    expect(redoResult.nodes[0].data.label).toBe('C');
  });

  test('auto-save with position change after undo should not truncate redo chain', async () => {
    // Create state A
    const stateA = {
      nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'A' } }],
      edges: []
    };
    await pushSnapshot(stateA);

    // Create state B
    const stateB = {
      nodes: [{ id: '1', position: { x: 100, y: 100 }, data: { label: 'B' } }],
      edges: []
    };
    await pushSnapshot(stateB);

    // Create state C
    const stateC = {
      nodes: [{ id: '1', position: { x: 200, y: 200 }, data: { label: 'C' } }],
      edges: []
    };
    await pushSnapshot(stateC);

    // Undo to B
    await undo();

    // Simulate auto-save with position change (same label, different position)
    const stateBMoved = {
      nodes: [{ id: '1', position: { x: 150, y: 150 }, data: { label: 'B' } }],
      edges: []
    };
    await pushSnapshot(stateBMoved);

    // Should update position but keep redo chain
    expect(await canRedo()).toBe(true);

    // Verify redo still returns state C
    const redoResult = await redo();
    expect(redoResult.nodes[0].data.label).toBe('C');
  });
});
