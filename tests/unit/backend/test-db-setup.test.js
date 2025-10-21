// ABOUTME: Tests for Supabase test infrastructure (test-db-setup.js)
// ABOUTME: Verifies that test helpers work correctly for database isolation

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  truncateAllTables,
  seedTestFlow,
  seedConversationHistory,
  setupTestDb,
  cleanupTestDb,
  testSupabase
} from '../../test-db-setup.js';

beforeEach(async () => {
  await setupTestDb();
});

afterEach(async () => {
  await cleanupTestDb();
});

describe('Test Infrastructure - truncateAllTables', () => {
  it('should clear all data from flows table', async () => {
    // Seed some data
    await seedTestFlow();

    // Verify data exists
    const { data: beforeData } = await testSupabase.from('flows').select('*');
    expect(beforeData).toHaveLength(1);

    // Truncate
    await truncateAllTables();

    // Verify data is cleared
    const { data: afterData } = await testSupabase.from('flows').select('*');
    expect(afterData).toHaveLength(0);
  });

  it('should clear all data from conversation_history table', async () => {
    // Seed some data
    await seedConversationHistory([
      { role: 'user', content: 'test message' }
    ]);

    // Verify data exists
    const { data: beforeData } = await testSupabase.from('conversation_history').select('*');
    expect(beforeData).toHaveLength(1);

    // Truncate
    await truncateAllTables();

    // Verify data is cleared
    const { data: afterData } = await testSupabase.from('conversation_history').select('*');
    expect(afterData).toHaveLength(0);
  });

  it('should reset undo_state to initial state', async () => {
    // Set current_index to something other than -1
    await testSupabase
      .from('undo_state')
      .update({ current_index: 999 })
      .eq('id', 1);

    // Verify it changed
    const { data: beforeData } = await testSupabase
      .from('undo_state')
      .select('current_index')
      .eq('id', 1)
      .single();
    expect(beforeData.current_index).toBe(999);

    // Truncate
    await truncateAllTables();

    // Verify reset to -1
    const { data: afterData } = await testSupabase
      .from('undo_state')
      .select('current_index')
      .eq('id', 1)
      .single();
    expect(afterData.current_index).toBe(-1);
  });
});

describe('Test Infrastructure - seedTestFlow', () => {
  it('should seed a test flow with default values', async () => {
    const flow = await seedTestFlow();

    expect(flow).toBeDefined();
    expect(flow.user_id).toBe('default');
    expect(flow.name).toBe('main');
    expect(flow.data.nodes).toHaveLength(1);
    expect(flow.data.nodes[0].id).toBe('test-node-1');
    expect(flow.data.edges).toHaveLength(0);
  });

  it('should seed a test flow with custom user and name', async () => {
    const flow = await seedTestFlow('test-user', 'custom-flow');

    expect(flow.user_id).toBe('test-user');
    expect(flow.name).toBe('custom-flow');
  });

  it('should create retrievable flow data', async () => {
    await seedTestFlow();

    const { data } = await testSupabase
      .from('flows')
      .select('*')
      .eq('user_id', 'default')
      .eq('name', 'main')
      .single();

    expect(data).toBeDefined();
    expect(data.data.nodes).toHaveLength(1);
  });
});

describe('Test Infrastructure - seedConversationHistory', () => {
  it('should seed conversation messages', async () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' }
    ];

    const seeded = await seedConversationHistory(messages);

    expect(seeded).toHaveLength(2);
    expect(seeded[0].role).toBe('user');
    expect(seeded[0].content).toBe('Hello');
    expect(seeded[1].role).toBe('assistant');
    expect(seeded[1].content).toBe('Hi there');
  });

  it('should create retrievable conversation data', async () => {
    await seedConversationHistory([
      { role: 'user', content: 'Test message' }
    ]);

    const { data } = await testSupabase
      .from('conversation_history')
      .select('*');

    expect(data).toHaveLength(1);
    expect(data[0].content).toBe('Test message');
  });
});

describe('Test Infrastructure - Test Isolation', () => {
  it('should start with clean database in each test', async () => {
    // This test should have no data from previous tests
    const { data: flows } = await testSupabase.from('flows').select('*');
    const { data: conversations } = await testSupabase.from('conversation_history').select('*');
    const { data: undoHistory } = await testSupabase.from('undo_history').select('*');

    expect(flows).toHaveLength(0);
    expect(conversations).toHaveLength(0);
    expect(undoHistory).toHaveLength(0);
  });

  it('should clean up data after test runs', async () => {
    // Add some data
    await seedTestFlow();
    await seedConversationHistory([{ role: 'user', content: 'test' }]);

    // Verify data exists
    const { data: flows } = await testSupabase.from('flows').select('*');
    expect(flows).toHaveLength(1);

    // After this test, afterEach will clean up
    // The next test will verify cleanup happened
  });
});
