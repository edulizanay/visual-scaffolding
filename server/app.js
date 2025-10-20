// ABOUTME: Express application configuration and middleware setup
// ABOUTME: Contains app instance, middleware, and route registrations
import express from 'express';
import cors from 'cors';
import { getFlow as dbGetFlow, saveFlow as dbSaveFlow } from './db.js';
import { pushSnapshot } from './historyService.js';
import { registerRoutes } from './routes/index.js';

// ==================== APP SETUP ====================

const app = express();

app.use(cors());
app.use(express.json());

// ==================== CORE DATA ACCESS ====================

export async function readFlow() {
  return dbGetFlow();
}

export async function writeFlow(flowData, skipSnapshot = false) {
  dbSaveFlow(flowData);

  if (!skipSnapshot) {
    await pushSnapshot(flowData);
  }
}

// ==================== REGISTER ROUTES ====================

registerRoutes(app, { readFlow, writeFlow });

export default app;
