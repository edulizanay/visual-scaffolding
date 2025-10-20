// ABOUTME: Server startup and lifecycle management
// ABOUTME: Handles server listen, initialization, and shutdown hooks
import app, { readFlow, writeFlow } from './app.js';
import { initializeHistory } from './historyService.js';

const PORT = process.env.PORT || 3001;

// Re-export for backward compatibility
export { readFlow, writeFlow };

// Logs errors with consistent formatting
function logError(operation, error) {
  console.error(`Error ${operation}:`, error);
}

// ==================== SERVER STARTUP ====================

// Only start server if not imported for testing
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // Initialize history with current flow state
    try {
      const currentFlow = await readFlow();
      await initializeHistory(currentFlow);
      console.log('History initialized with current flow state');
    } catch (error) {
      logError('initializing history', error);
    }
  });
}

export default app;
