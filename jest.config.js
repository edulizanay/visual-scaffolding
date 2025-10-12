export default {
  testEnvironment: 'node', // Default for backend tests
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/tests/**/*.test.js', '**/tests/**/*.test.jsx'],
  collectCoverageFrom: ['server/**/*.js', 'src/**/*.{js,jsx}', '!server/**/*.test.js', '!src/**/*.test.jsx'],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  // Use jsdom for frontend tests
  projects: [
    {
      displayName: 'backend',
      testEnvironment: 'node',
      testMatch: ['**/tests/unit/backend/**/*.test.js', '**/tests/integration/**/*.test.js', '**/tests/e2e/**/*.test.js', '**/tests/llm/**/*.test.js'],
    },
    {
      displayName: 'frontend-api',
      testEnvironment: 'node',
      testMatch: ['**/tests/unit/frontend/**/*.test.js'],
    },
    {
      displayName: 'frontend-ui',
      testEnvironment: 'jsdom',
      testMatch: ['**/tests/unit/frontend/**/*.test.jsx', '**/tests/security/**/*.test.jsx'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup-frontend.js'],
    },
  ],
};
