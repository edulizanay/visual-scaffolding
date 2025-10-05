// ABOUTME: Manages flow state history for undo/redo functionality
// ABOUTME: Stores snapshots in history.json with configurable max limit
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MAX_SNAPSHOTS = 50;

function getHistoryPath() {
  return process.env.HISTORY_DATA_PATH || join(__dirname, 'data', 'history.json');
}

const DEFAULT_HISTORY = {
  states: [],
  currentIndex: -1
};

function cleanSnapshot(flowState) {
  return {
    nodes: flowState.nodes.map(node => {
      const cleanNode = {
        id: node.id
      };

      if (node.position) {
        cleanNode.position = node.position;
      }

      if (node.data) {
        cleanNode.data = {};
        if (node.data.label !== undefined) {
          cleanNode.data.label = node.data.label;
        }
        if (node.data.description !== undefined) {
          cleanNode.data.description = node.data.description;
        }
      }

      return cleanNode;
    }),
    edges: flowState.edges.map(edge => {
      const cleanEdge = {
        id: edge.id,
        source: edge.source,
        target: edge.target
      };

      if (edge.data?.label !== undefined) {
        cleanEdge.data = { label: edge.data.label };
      }

      return cleanEdge;
    })
  };
}

async function readHistory() {
  try {
    const data = await fs.readFile(getHistoryPath(), 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return DEFAULT_HISTORY;
    }
    throw error;
  }
}

async function writeHistory(historyData) {
  const historyPath = getHistoryPath();
  const dataDir = dirname(historyPath);
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(historyPath, JSON.stringify(historyData, null, 2));
}

export async function pushSnapshot(flowState) {
  const cleanState = cleanSnapshot(flowState);
  const history = await readHistory();

  // If we're not at the end, truncate future states
  if (history.currentIndex < history.states.length - 1) {
    history.states = history.states.slice(0, history.currentIndex + 1);
  }

  // Add new state
  history.states.push(cleanState);
  history.currentIndex = history.states.length - 1;

  // Limit snapshots
  if (history.states.length > MAX_SNAPSHOTS) {
    history.states.shift();
    history.currentIndex--;
  }

  await writeHistory(history);
}

export async function undo() {
  const history = await readHistory();

  if (history.currentIndex <= 0) {
    return null; // Can't undo
  }

  history.currentIndex--;
  await writeHistory(history);

  return history.states[history.currentIndex];
}

export async function redo() {
  const history = await readHistory();

  if (history.currentIndex >= history.states.length - 1) {
    return null; // Can't redo
  }

  history.currentIndex++;
  await writeHistory(history);

  return history.states[history.currentIndex];
}

export async function canUndo() {
  const history = await readHistory();
  return history.currentIndex > 0;
}

export async function canRedo() {
  const history = await readHistory();
  return history.currentIndex < history.states.length - 1;
}

export async function getHistoryStatus() {
  const history = await readHistory();
  return {
    canUndo: history.currentIndex > 0,
    canRedo: history.currentIndex < history.states.length - 1,
    snapshotCount: history.states.length,
    currentIndex: history.currentIndex
  };
}

export async function clearHistory() {
  await writeHistory(DEFAULT_HISTORY);
}

export async function initializeHistory(currentFlow) {
  await clearHistory();
  await pushSnapshot(currentFlow);
}
