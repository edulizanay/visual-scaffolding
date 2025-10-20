// ABOUTME: Reusable hook for debounced callbacks
// ABOUTME: Delays function execution until after specified wait time has elapsed
import { useRef, useCallback, useEffect } from 'react';

/**
 * Hook that creates a debounced version of a callback with flush and cancel utilities
 * @param {Function} callback - The function to debounce
 * @param {number} delay - Delay in milliseconds (default: 500)
 * @returns {Object} Object with debounced function, flush, and cancel methods
 */
export function useDebouncedCallback(callback, delay = 500) {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);
  const pendingArgsRef = useRef(null);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingArgsRef.current = null;
  }, []);

  const flush = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pendingArgsRef.current) {
      const args = pendingArgsRef.current;
      pendingArgsRef.current = null;
      return await callbackRef.current(...args);
    }
  }, []);

  const debouncedFn = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    pendingArgsRef.current = args;

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
      pendingArgsRef.current = null;
    }, delay);
  }, [delay]);

  return { debouncedFn, flush, cancel };
}
