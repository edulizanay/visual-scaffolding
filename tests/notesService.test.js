// ABOUTME: Unit tests for notes repository
// ABOUTME: Tests Supabase-based CRUD operations for notes data
import { getNotes, saveNotes, updateBullets } from '../server/repositories/notesRepository.js';
import { setupTestDb, cleanupTestDb, testSupabase } from './test-db-setup.js';

describe('notesRepository', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  afterEach(async () => {
    await cleanupTestDb();
  });

  describe('getNotes - T1.6, T1.7', () => {
    test('T1.6: returns empty state when notes table is empty', async () => {
      // setupTestDb already ensures notes row exists with empty arrays
      const result = await getNotes();

      expect(result).toEqual({
        bullets: [],
        conversationHistory: []
      });
    });

    test('T1.7: retrieves existing notes from Supabase correctly', async () => {
      // Insert test notes into Supabase
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

      await testSupabase
        .from('notes')
        .upsert({
          id: 1,
          bullets: testData.bullets,
          conversation_history: testData.conversationHistory
        }, { onConflict: 'id' });

      const result = await getNotes();

      expect(result).toEqual(testData);
      expect(result.bullets).toHaveLength(3);
      expect(result.conversationHistory).toHaveLength(2);
      expect(result.bullets[0]).toBe('Bullet 1');
      expect(result.conversationHistory[0].role).toBe('user');
    });

    test('T1.7b: handles missing row gracefully (returns empty state)', async () => {
      // Delete the notes row to simulate missing data
      await testSupabase
        .from('notes')
        .delete()
        .eq('id', 1);

      // Should return empty state (graceful degradation)
      const result = await getNotes();

      expect(result).toEqual({
        bullets: [],
        conversationHistory: []
      });
    });
  });

  describe('saveNotes - T1.8', () => {
    test('T1.8: writes correct structure to Supabase', async () => {
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

      await saveNotes(bullets, conversationHistory);

      // Verify data was saved to Supabase
      const { data: saved } = await testSupabase
        .from('notes')
        .select('bullets, conversation_history')
        .eq('id', 1)
        .single();

      expect(saved.bullets).toEqual(bullets);
      expect(saved.conversation_history).toEqual(conversationHistory);
      expect(saved.bullets).toHaveLength(2);
      expect(saved.conversation_history).toHaveLength(2);
    });

    test('T1.8b: overwrites existing data (upsert)', async () => {
      // Save initial data
      await saveNotes(['Old bullet'], []);

      // Save new data
      const newBullets = ['New bullet 1', 'New bullet 2'];
      await saveNotes(newBullets, [{ role: 'user', content: 'test', timestamp: '2025-10-18T10:00:00Z' }]);

      // Read from Supabase
      const { data: saved } = await testSupabase
        .from('notes')
        .select('bullets')
        .eq('id', 1)
        .single();

      expect(saved.bullets).toEqual(newBullets);
      expect(saved.bullets).not.toContain('Old bullet');
    });
  });

  describe('updateBullets - T1.9', () => {
    test('T1.9: updates only bullets array, preserves conversationHistory', async () => {
      // Set up initial state
      const initialConversationHistory = [
        { role: 'user', content: 'msg1', timestamp: '2025-10-18T10:00:00Z' },
        { role: 'assistant', content: 'resp1', timestamp: '2025-10-18T10:00:01Z' }
      ];
      await saveNotes(['Old bullet 1', 'Old bullet 2'], initialConversationHistory);

      // Update only bullets
      const newBullets = ['Updated bullet 1', 'Updated bullet 2', 'New bullet 3'];
      await updateBullets(newBullets);

      // Load and verify
      const result = await getNotes();

      expect(result.bullets).toEqual(newBullets);
      expect(result.bullets).toHaveLength(3);
      expect(result.conversationHistory).toEqual(initialConversationHistory);
      expect(result.conversationHistory).toHaveLength(2);
    });

    test('T1.9b: creates row if it does not exist (upsert)', async () => {
      // Delete the notes row to simulate missing data
      await testSupabase
        .from('notes')
        .delete()
        .eq('id', 1);

      await updateBullets(['First bullet']);

      // Verify row was created with correct structure
      const result = await getNotes();
      expect(result.bullets).toEqual(['First bullet']);
      expect(result.conversationHistory).toEqual([]);
    });
  });
});
