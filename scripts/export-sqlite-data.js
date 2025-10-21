// ABOUTME: Export script to dump all SQLite data to JSON
// ABOUTME: Used for migrating from SQLite to Supabase (Phase 2)

import Database from 'better-sqlite3';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', 'server', 'data', 'flow.db');
const db = new Database(dbPath, { readonly: true });

console.log('Exporting data from SQLite database:', dbPath);

// Export flows
const flows = db.prepare('SELECT * FROM flows').all();
console.log(`- flows: ${flows.length} rows`);

// Export conversation_history
const conversation = db.prepare('SELECT * FROM conversation_history').all();
console.log(`- conversation_history: ${conversation.length} rows`);

// Export undo_history
const undoHistory = db.prepare('SELECT * FROM undo_history').all();
console.log(`- undo_history: ${undoHistory.length} rows`);

// Export undo_state
const undoState = db.prepare('SELECT * FROM undo_state').all();
console.log(`- undo_state: ${undoState.length} rows`);

const exportData = {
  flows: flows.map(row => ({
    ...row,
    data: JSON.parse(row.data) // Parse JSON text to object for Supabase JSONB
  })),
  conversation_history: conversation.map(row => ({
    ...row,
    tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : null
  })),
  undo_history: undoHistory.map(row => ({
    ...row,
    snapshot: JSON.parse(row.snapshot)
  })),
  undo_state: undoState
};

const outputPath = join(__dirname, 'migration-data.json');
writeFileSync(outputPath, JSON.stringify(exportData, null, 2));

console.log(`\nExported to: ${outputPath}`);
console.log(`Total rows: ${flows.length + conversation.length + undoHistory.length + undoState.length}`);

db.close();
