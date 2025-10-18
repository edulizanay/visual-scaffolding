// ABOUTME: File-based storage service for notes
// ABOUTME: Handles CRUD operations for notes-debug.json file
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to notes file in project root
const NOTES_FILE_PATH = join(__dirname, '..', 'notes-debug.json');

/**
 * Load notes from file
 * Returns empty state if file doesn't exist (ENOENT)
 */
export function loadNotes() {
  try {
    const fileContent = readFileSync(NOTES_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(fileContent);

    // Ensure structure has required fields
    return {
      bullets: parsed.bullets || [],
      conversationHistory: parsed.conversationHistory || []
    };
  } catch (error) {
    // Handle file not found or corrupted JSON gracefully
    if (error.code === 'ENOENT') {
      // File doesn't exist - return empty state
      return {
        bullets: [],
        conversationHistory: []
      };
    }

    // Handle corrupted JSON - return empty state
    if (error instanceof SyntaxError) {
      console.warn('Notes file corrupted, returning empty state:', error.message);
      return {
        bullets: [],
        conversationHistory: []
      };
    }

    // Re-throw unexpected errors
    throw error;
  }
}

/**
 * Save notes to file
 * Writes complete state with bullets and conversation history
 */
export function saveNotes(bullets, conversationHistory) {
  const data = {
    bullets,
    conversationHistory
  };

  writeFileSync(NOTES_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Update only bullets array, preserving conversation history
 */
export function updateBullets(bullets) {
  // Load current state
  const currentState = loadNotes();

  // Update only bullets, keep conversation history
  saveNotes(bullets, currentState.conversationHistory);
}
