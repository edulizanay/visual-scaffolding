// ABOUTME: Centralized flow data access service
// ABOUTME: Consolidates readFlow/writeFlow logic from app.js and executor.js
import { getFlow, saveFlow } from '../db.js';
import { pushSnapshot } from '../historyService.js';

export async function readFlow(userId = 'default', name = 'main') {
  return await getFlow(userId, name);
}

export async function writeFlow(flowData, skipSnapshot = false, origin = null, userId = 'default', name = 'main') {
  await saveFlow(flowData, userId, name);

  if (!skipSnapshot) {
    await pushSnapshot(flowData, origin);
  }
}
