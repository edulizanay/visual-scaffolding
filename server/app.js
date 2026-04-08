// ABOUTME: Express application configuration and middleware setup
// ABOUTME: Contains app instance, middleware, and route registrations
import express from 'express';
import cors from 'cors';
import { readFlow, writeFlow } from './services/flowService.js';
import { registerRoutes } from './routes/index.js';

// ==================== APP SETUP ====================

const app = express();

app.use(cors());
app.use(express.json());

// ==================== CORE DATA ACCESS ====================

export { readFlow, writeFlow };

// ==================== REGISTER ROUTES ====================

registerRoutes(app, { readFlow, writeFlow });

export default app;
