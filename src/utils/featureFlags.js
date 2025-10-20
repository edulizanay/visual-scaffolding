// ABOUTME: Client-side feature flag utility
// ABOUTME: Fetches and caches server feature flags for backend save funnel

let cachedFlags = null;

/**
 * Fetch feature flags from server
 * Caches the result to avoid multiple API calls
 */
export async function getFeatureFlags() {
  if (cachedFlags) {
    return cachedFlags;
  }

  try {
    const response = await fetch('/api/flow/config');
    if (!response.ok) {
      throw new Error('Failed to fetch feature flags');
    }
    cachedFlags = await response.json();
    return cachedFlags;
  } catch (error) {
    console.error('Failed to load feature flags, using defaults:', error);
    // Default to false (legacy behavior)
    cachedFlags = {
      ENABLE_BACKEND_DRAG_SAVE: false,
      ENABLE_BACKEND_SUBTREE: false,
    };
    return cachedFlags;
  }
}

/**
 * Clear cached flags (useful for testing)
 */
export function clearFeatureFlagsCache() {
  cachedFlags = null;
}
