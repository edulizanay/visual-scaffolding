// ABOUTME: Migration script to convert JSON files to SQLite database
// ABOUTME: Imports flow.json, conversation.json, and history.json into database
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  saveFlow,
  addConversationMessage,
  pushUndoSnapshot,
  getFlow,
  getConversationHistory,
  getUndoStatus,
  closeDb
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '../server/data');
const FLOW_PATH = join(DATA_DIR, 'flow.json');
const CONVERSATION_PATH = join(DATA_DIR, 'conversation.json');
const HISTORY_PATH = join(DATA_DIR, 'history.json');

async function loadJsonFile(path) {
  try {
    const content = await fs.readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.log(`  ⚠️  File not found: ${path}`);
    return null;
  }
}

async function migrateFlow() {
  console.log('\n📊 Migrating flow.json...');

  const flowData = await loadJsonFile(FLOW_PATH);
  if (!flowData) {
    console.log('  ℹ️  No flow.json found, skipping');
    return { nodes: 0, edges: 0 };
  }

  const nodeCount = flowData.nodes?.length || 0;
  const edgeCount = flowData.edges?.length || 0;

  console.log(`  Found ${nodeCount} nodes, ${edgeCount} edges`);

  await saveFlow(flowData);

  // Verify
  const savedFlow = await getFlow();
  const savedNodeCount = savedFlow.nodes?.length || 0;
  const savedEdgeCount = savedFlow.edges?.length || 0;

  if (savedNodeCount !== nodeCount || savedEdgeCount !== edgeCount) {
    throw new Error(`Migration verification failed: expected ${nodeCount}/${edgeCount}, got ${savedNodeCount}/${savedEdgeCount}`);
  }

  console.log(`  ✅ Migrated ${nodeCount} nodes, ${edgeCount} edges`);
  return { nodes: nodeCount, edges: edgeCount };
}

async function migrateConversation() {
  console.log('\n💬 Migrating conversation.json...');

  const conversationData = await loadJsonFile(CONVERSATION_PATH);
  if (!conversationData || !conversationData.history) {
    console.log('  ℹ️  No conversation.json found, skipping');
    return 0;
  }

  const messages = conversationData.history;
  console.log(`  Found ${messages.length} messages`);

  for (const msg of messages) {
    const toolCalls = msg.toolCalls || [];
    addConversationMessage(msg.role, msg.content, toolCalls.length > 0 ? toolCalls : null);
  }

  // Verify
  const savedHistory = await getConversationHistory();
  if (savedHistory.length !== messages.length) {
    throw new Error(`Migration verification failed: expected ${messages.length} messages, got ${savedHistory.length}`);
  }

  console.log(`  ✅ Migrated ${messages.length} messages`);
  return messages.length;
}

async function migrateHistory() {
  console.log('\n⏮️  Migrating history.json...');

  const historyData = await loadJsonFile(HISTORY_PATH);
  if (!historyData || !historyData.snapshots) {
    console.log('  ℹ️  No history.json found, skipping');
    return 0;
  }

  const snapshots = historyData.snapshots;
  const currentIndex = historyData.currentIndex ?? -1;

  console.log(`  Found ${snapshots.length} snapshots, currentIndex: ${currentIndex}`);

  // Migrate all snapshots
  for (const snapshot of snapshots) {
    pushUndoSnapshot(snapshot);
  }

  // Verify snapshot count
  const status = getUndoStatus();
  if (status.snapshotCount !== snapshots.length) {
    throw new Error(`Migration verification failed: expected ${snapshots.length} snapshots, got ${status.snapshotCount}`);
  }

  console.log(`  ✅ Migrated ${snapshots.length} snapshots`);
  return snapshots.length;
}

async function backupJsonFiles() {
  console.log('\n📦 Creating backup of JSON files...');

  const backupDir = join(DATA_DIR, 'backup-' + new Date().toISOString().replace(/[:.]/g, '-'));
  await fs.mkdir(backupDir, { recursive: true });

  const files = [
    { src: FLOW_PATH, name: 'flow.json' },
    { src: CONVERSATION_PATH, name: 'conversation.json' },
    { src: HISTORY_PATH, name: 'history.json' }
  ];

  let backedUp = 0;
  for (const file of files) {
    try {
      await fs.copyFile(file.src, join(backupDir, file.name));
      backedUp++;
    } catch (error) {
      // File doesn't exist, skip
    }
  }

  console.log(`  ✅ Backed up ${backedUp} files to ${backupDir}`);
  return backupDir;
}

async function migrate() {
  console.log('\n🚀 Starting SQLite Migration\n');
  console.log('This will migrate your JSON data to SQLite database.');
  console.log('Your original JSON files will be backed up.\n');

  try {
    // Backup first
    const backupDir = await backupJsonFiles();

    // Migrate data
    const flowStats = await migrateFlow();
    const conversationCount = await migrateConversation();
    const historyCount = await migrateHistory();

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ Migration completed successfully!\n');
    console.log('Summary:');
    console.log(`  • Nodes migrated: ${flowStats.nodes}`);
    console.log(`  • Edges migrated: ${flowStats.edges}`);
    console.log(`  • Conversation messages: ${conversationCount}`);
    console.log(`  • History snapshots: ${historyCount}`);
    console.log(`  • Backup location: ${backupDir}`);
    console.log('='.repeat(50) + '\n');

    console.log('Next steps:');
    console.log('  1. Restart your server');
    console.log('  2. Test that everything works correctly');
    console.log('  3. If something goes wrong, restore from backup');
    console.log('  4. Once verified, you can delete the JSON files\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nYour original JSON files are still intact in the backup.');
    process.exit(1);
  } finally {
    closeDb();
  }
}

// Run migration
migrate();
