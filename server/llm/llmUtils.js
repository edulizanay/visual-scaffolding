// ABOUTME: Shared LLM utility functions
// ABOUTME: Provides common helpers for LLM availability checks and error logging

/**
 * Checks if LLM API keys are configured
 * @returns {boolean} True if at least one LLM API key is available
 */
export function checkLLMAvailability() {
  return Boolean(process.env.GROQ_API_KEY || process.env.CEREBRAS_API_KEY);
}

/**
 * Logs errors with consistent formatting
 * @param {string} operation - Description of the operation that failed
 * @param {Error} error - The error object
 */
export function logError(operation, error) {
  console.error(`Error ${operation}:`, error);
}
