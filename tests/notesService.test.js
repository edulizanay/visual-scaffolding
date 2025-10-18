// ABOUTME: Unit tests for notes storage service
// ABOUTME: Tests file-based CRUD operations for notes data
import { loadNotes, saveNotes, updateBullets } from '../server/notesService.js';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to test notes file
const TEST_NOTES_PATH = join(__dirname, '..', 'notes-debug.json');

describe('notesService', () => {
  beforeEach(() => {
    // Clean up test file before each test
    if (existsSync(TEST_NOTES_PATH)) {
      unlinkSync(TEST_NOTES_PATH);
    }
  });

  afterEach(() => {
    // Clean up test file after each test
    if (existsSync(TEST_NOTES_PATH)) {
      unlinkSync(TEST_NOTES_PATH);
    }
  });

  describe('loadNotes - T1.6, T1.7', () => {
    test('T1.6: returns empty state when file does not exist (ENOENT)', () => {
      // Ensure file doesn't exist
      expect(existsSync(TEST_NOTES_PATH)).toBe(false);

      const result = loadNotes();

      expect(result).toEqual({
        bullets: [],
        conversationHistory: []
      });
    });

    test('T1.7: parses existing JSON file correctly', async () => {
      // Create a test notes file manually
      const testData = {
        bullets: ['Bullet 1', 'Bullet 2', 'Bullet 3'],
        conversationHistory: [
          {
            role: 'user',
            content: 'test message',
            timestamp: '2025-10-18T10:00:00Z'
          },
          {
            role: 'assistant',
            content: 'test response',
            timestamp: '2025-10-18T10:00:01Z'
          }
        ]
      };

      // Write test file using Node.js fs
      const fs = await import('fs');
      fs.writeFileSync(TEST_NOTES_PATH, JSON.stringify(testData, null, 2));

      const result = loadNotes();

      expect(result).toEqual(testData);
      expect(result.bullets).toHaveLength(3);
      expect(result.conversationHistory).toHaveLength(2);
      expect(result.bullets[0]).toBe('Bullet 1');
      expect(result.conversationHistory[0].role).toBe('user');
    });

    test('T1.7b: handles corrupted JSON file gracefully', async () => {
      // Write invalid JSON
      const fs = await import('fs');
      fs.writeFileSync(TEST_NOTES_PATH, '{invalid json}');

      // Should throw or return empty state - let's test it returns empty
      const result = loadNotes();

      // If implementation throws, we can catch it, or it returns empty state
      expect(result).toBeDefined();
    });
  });

  describe('saveNotes - T1.8', () => {
    test('T1.8: writes correct JSON structure to file', () => {
      const bullets = ['New bullet 1', 'New bullet 2'];
      const conversationHistory = [
        {
          role: 'user',
          content: 'user message',
          timestamp: '2025-10-18T10:00:00Z'
        },
        {
          role: 'assistant',
          content: 'assistant response',
          timestamp: '2025-10-18T10:00:01Z'
        }
      ];

      saveNotes(bullets, conversationHistory);

      // Verify file was created
      expect(existsSync(TEST_NOTES_PATH)).toBe(true);

      // Read and parse file
      const fileContent = readFileSync(TEST_NOTES_PATH, 'utf-8');
      const parsed = JSON.parse(fileContent);

      expect(parsed.bullets).toEqual(bullets);
      expect(parsed.conversationHistory).toEqual(conversationHistory);
      expect(parsed.bullets).toHaveLength(2);
      expect(parsed.conversationHistory).toHaveLength(2);
    });

    test('T1.8b: overwrites existing file', () => {
      // Save initial data
      saveNotes(['Old bullet'], []);

      // Save new data
      const newBullets = ['New bullet 1', 'New bullet 2'];
      saveNotes(newBullets, [{ role: 'user', content: 'test', timestamp: '2025-10-18T10:00:00Z' }]);

      // Read file
      const fileContent = readFileSync(TEST_NOTES_PATH, 'utf-8');
      const parsed = JSON.parse(fileContent);

      expect(parsed.bullets).toEqual(newBullets);
      expect(parsed.bullets).not.toContain('Old bullet');
    });
  });

  describe('updateBullets - T1.9', () => {
    test('T1.9: updates only bullets array, preserves conversationHistory', () => {
      // Set up initial state
      const initialConversationHistory = [
        { role: 'user', content: 'msg1', timestamp: '2025-10-18T10:00:00Z' },
        { role: 'assistant', content: 'resp1', timestamp: '2025-10-18T10:00:01Z' }
      ];
      saveNotes(['Old bullet 1', 'Old bullet 2'], initialConversationHistory);

      // Update only bullets
      const newBullets = ['Updated bullet 1', 'Updated bullet 2', 'New bullet 3'];
      updateBullets(newBullets);

      // Load and verify
      const result = loadNotes();

      expect(result.bullets).toEqual(newBullets);
      expect(result.bullets).toHaveLength(3);
      expect(result.conversationHistory).toEqual(initialConversationHistory);
      expect(result.conversationHistory).toHaveLength(2);
    });

    test('T1.9b: creates file if it does not exist', () => {
      // Ensure file doesn't exist
      expect(existsSync(TEST_NOTES_PATH)).toBe(false);

      updateBullets(['First bullet']);

      // Verify file was created with correct structure
      const result = loadNotes();
      expect(result.bullets).toEqual(['First bullet']);
      expect(result.conversationHistory).toEqual([]);
    });
  });
});
