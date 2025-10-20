import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Enable globals for Jest-compatible API
    globals: true,

    // Multi-environment setup using projects
    projects: [
      // Backend tests - Node environment
      {
        test: {
          name: 'backend',
          environment: 'node',
          globals: true,
          include: [
            'tests/unit/backend/**/*.test.js',
            'tests/unit/shared/**/*.test.js',
            'tests/integration/**/*.test.js',
            'tests/e2e/**/*.test.js',
            'tests/llm/**/*.test.js',
            'tests/api-*.test.js',
            'tests/conversationService.test.js',
            'tests/db.test.js',
            'tests/groupHelpers.test.js',
            'tests/historyService.test.js',
            'tests/notesService.test.js',
            'tests/schema-migration.test.js',
            'tests/toolExecution*.test.js',
            'tests/undo-redo-autosave.test.js',
          ],
          // Run integration/E2E tests sequentially to avoid file conflicts
          pool: 'forks',
          poolOptions: {
            forks: {
              singleFork: true
            }
          },
        }
      },

      // Frontend API tests - Node environment
      {
        test: {
          name: 'frontend-api',
          environment: 'node',
          globals: true,
          include: [
            'tests/unit/frontend/**/*.test.js',
          ],
        }
      },

      // Frontend UI tests - DOM environment
      {
        plugins: [react()],
        test: {
          name: 'frontend-ui',
          environment: 'happy-dom',
          globals: true,
          include: [
            'tests/unit/frontend/**/*.test.jsx',
            'tests/security/**/*.test.jsx',
            'src/**/__tests__/**/*.test.{js,jsx}',
          ],
          setupFiles: ['./tests/setup-frontend.js'],
        }
      },

      // Security backend tests - Node environment
      {
        test: {
          name: 'security',
          environment: 'node',
          globals: true,
          include: [
            'tests/security/**/*.test.js',
          ],
        }
      }
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{js,jsx}', 'server/**/*.js'],
      exclude: [
        '**/*.test.{js,jsx}',
        'node_modules/**',
        'tests/**',
      ],
    },
  },
});
