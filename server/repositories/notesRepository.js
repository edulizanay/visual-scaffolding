// ABOUTME: Notes database repository for bullet and conversation storage
// ABOUTME: Handles persistence of notes with Supabase (singleton table pattern)

import { supabase } from '../supabase-client.js';

/**
 * Get notes (returns empty state if row doesn't exist yet)
 */
export async function getNotes() {
  const { data, error } = await supabase
    .from('notes')
    .select('bullets, conversation_history')
    .eq('id', 1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  // Return empty state if row doesn't exist
  if (!data) {
    return {
      bullets: [],
      conversationHistory: []
    };
  }

  return {
    bullets: data.bullets || [],
    conversationHistory: data.conversation_history || []
  };
}

/**
 * Save complete notes state (upsert to handle first-run)
 */
export async function saveNotes(bullets, conversationHistory) {
  const { error } = await supabase
    .from('notes')
    .upsert(
      {
        id: 1,
        bullets,
        conversation_history: conversationHistory,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: 'id'
      }
    );

  if (error) {
    throw error;
  }
}

/**
 * Update only bullets array, preserving conversation history
 * Upsert-tolerant for empty table (first-run behavior)
 */
export async function updateBullets(bullets) {
  // Load current state (handles missing row gracefully)
  const currentState = await getNotes();

  // Upsert with preserved conversation history
  await saveNotes(bullets, currentState.conversationHistory);
}
