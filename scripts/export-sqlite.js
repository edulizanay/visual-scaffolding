// ABOUTME: Exports all data from SQLite database to JSON for Supabase migration
// ABOUTME: Handles JSON column parsing and generates migration-data.json

import Database from 'better-sqlite3';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../server/data/flow.db');
const outputPath = join(__dirname, '../migration-data.json');

console.log('📦 Exporting SQLite data...\n');

const db = new Database(dbPath, { readonly: true });

// Export all tables
const exportData = {
  flows: [],
  undo_history: [],
  undo_state: [],
  conversation_history: []
};

// Export flows table
console.log('Exporting flows table...');
const flows = db.prepare('SELECT * FROM flows').all();
exportData.flows = flows.map(row => ({
  id: row.id,
  user_id: row.user_id,
  name: row.name,
  data: JSON.parse(row.data), // Parse JSON string to object for JSONB
  created_at: row.created_at,
  updated_at: row.updated_at,
  visual_settings: JSON.parse(row.visual_settings) // Parse JSON string to object
}));
console.log(`  ✓ ${exportData.flows.length} records`);

// Export undo_history table
console.log('Exporting undo_history table...');
const undoHistory = db.prepare('SELECT * FROM undo_history').all();
exportData.undo_history = undoHistory.map(row => ({
  id: row.id,
  snapshot: JSON.parse(row.snapshot), // Parse JSON string to object for JSONB
  created_at: row.created_at
}));
console.log(`  ✓ ${exportData.undo_history.length} records`);

// Export undo_state table
console.log('Exporting undo_state table...');
const undoState = db.prepare('SELECT * FROM undo_state').all();
exportData.undo_state = undoState;
console.log(`  ✓ ${exportData.undo_state.length} records`);

// Export conversation_history table
console.log('Exporting conversation_history table...');
const conversationHistory = db.prepare('SELECT * FROM conversation_history').all();
exportData.conversation_history = conversationHistory.map(row => ({
  id: row.id,
  role: row.role,
  content: row.content,
  tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : null, // Parse if not null
  timestamp: row.timestamp
}));
console.log(`  ✓ ${exportData.conversation_history.length} records`);

// Write to JSON file
writeFileSync(outputPath, JSON.stringify(exportData, null, 2));

const totalRecords =
  exportData.flows.length +
  exportData.undo_history.length +
  exportData.undo_state.length +
  exportData.conversation_history.length;

console.log(`\n✅ Export complete!`);
console.log(`Total records: ${totalRecords}`);
console.log(`Output: ${outputPath}`);

db.close();
