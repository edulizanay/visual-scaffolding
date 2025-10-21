// ABOUTME: Supabase test database setup and cleanup utilities
// ABOUTME: Provides helpers for test isolation and data seeding

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'Missing test environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for tests'
  );
}

// Create Supabase client with service role key (for test cleanup)
export const testSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

/**
 * Truncate all tables to ensure test isolation
 * Uses service_role key to bypass RLS policies
 */
export async function truncateAllTables() {
  const tables = ['conversation_history', 'undo_history', 'flows'];

  for (const table of tables) {
    const { error } = await testSupabase.from(table).delete().neq('id', 0);
    if (error) {
      console.error(`Failed to truncate ${table}:`, error);
      throw error;
    }

    // Verify table is empty
    const { count, error: countError } = await testSupabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error(`Failed to count ${table}:`, countError);
    } else {
      console.log(`[CLEANUP] ${table}: ${count} rows remaining`);
    }
  }

  // Ensure undo_state row exists first
  const { data: undoStateExists } = await testSupabase
    .from('undo_state')
    .select('id')
    .eq('id', 1)
    .maybeSingle();

  if (!undoStateExists) {
    const { error: insertError } = await testSupabase
      .from('undo_state')
      .insert({ id: 1, current_snapshot_time: null });

    if (insertError) {
      console.error('Failed to initialize undo_state:', insertError);
      throw insertError;
    }
  } else {
    // Reset undo_state to initial state
    const { error: undoStateError } = await testSupabase
      .from('undo_state')
      .update({ current_snapshot_time: null })
      .eq('id', 1)
      .select();

    if (undoStateError) {
      console.error('Failed to reset undo_state:', undoStateError);
      throw undoStateError;
    }
  }

  // Final verification
  const { data: finalState } = await testSupabase
    .from('undo_state')
    .select('current_snapshot_time')
    .eq('id', 1)
    .single();

  console.log(`[CLEANUP] undo_state.current_snapshot_time: ${finalState?.current_snapshot_time}`);
}

/**
 * Seed a basic flow for testing
 */
export async function seedTestFlow(userId = 'default', name = 'main') {
  const testFlow = {
    user_id: userId,
    name: name,
    data: {
      nodes: [
        {
          id: 'test-node-1',
          type: 'default',
          position: { x: 0, y: 0 },
          data: { label: 'Test Node 1', description: 'Test description' }
        }
      ],
      edges: []
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await testSupabase
    .from('flows')
    .insert(testFlow)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Seed conversation history for testing
 */
export async function seedConversationHistory(messages) {
  const { data, error } = await testSupabase
    .from('conversation_history')
    .insert(messages)
    .select();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Setup function for tests - call in beforeEach
 */
export async function setupTestDb() {
  await truncateAllTables();
}

/**
 * Cleanup function for tests - call in afterEach
 */
export async function cleanupTestDb() {
  await truncateAllTables();
}
