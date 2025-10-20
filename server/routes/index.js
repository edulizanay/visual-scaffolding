// ABOUTME: Central router that registers all API endpoints
// ABOUTME: Mounts all domain routes and handles route organization
import { Router } from 'express';
import { registerFlowRoutes } from './flowRoutes.js';
import { registerConversationRoutes } from './conversationRoutes.js';
import { registerNotesRoutes } from './notesRoutes.js';

export function registerRoutes(app, { readFlow, writeFlow }) {
  const flowRouter = Router();
  const conversationRouter = Router();
  const notesRouter = Router();

  // Register domain-specific routes
  registerFlowRoutes(flowRouter, { readFlow, writeFlow });
  registerConversationRoutes(conversationRouter, { readFlow });
  registerNotesRoutes(notesRouter);

  // Mount domain routers under /api
  app.use('/api/flow', flowRouter);
  app.use('/api/conversation', conversationRouter);
  app.use('/api/notes', notesRouter);

  // Legacy flat routes under /api
  // /api/node, /api/edge, /api/group (not nested under /api/flow)
  const legacyRouter = Router();
  registerFlowRoutes(legacyRouter, { readFlow, writeFlow });
  app.use('/api', legacyRouter);
}
