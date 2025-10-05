// ABOUTME: Express server for visual scaffolding flow API
// ABOUTME: Handles GET/POST operations for flow data persistence
import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const FLOW_DATA_PATH = process.env.FLOW_DATA_PATH || join(__dirname, 'data', 'flow.json');

app.use(cors());
app.use(express.json());

const DEFAULT_FLOW = {
  nodes: [],
  edges: []
};

async function readFlow() {
  try {
    const data = await fs.readFile(FLOW_DATA_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return DEFAULT_FLOW;
    }
    throw error;
  }
}

async function writeFlow(flowData) {
  const dataDir = dirname(FLOW_DATA_PATH);
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(FLOW_DATA_PATH, JSON.stringify(flowData, null, 2));
}

function validateFlow(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }
  if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    return false;
  }
  return true;
}

app.get('/api/flow', async (req, res) => {
  try {
    const flow = await readFlow();
    res.json(flow);
  } catch (error) {
    console.error('Error reading flow:', error);
    res.status(500).json({ error: 'Failed to load flow data' });
  }
});

app.post('/api/flow', async (req, res) => {
  try {
    const flowData = req.body;

    if (!validateFlow(flowData)) {
      return res.status(400).json({ error: 'Invalid flow data structure' });
    }

    await writeFlow(flowData);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving flow:', error);
    res.status(500).json({ error: 'Failed to save flow data' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
