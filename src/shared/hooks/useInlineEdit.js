// ABOUTME: Reusable hook for inline editing functionality
// ABOUTME: Provides state and handlers for double-click-to-edit UI pattern
import { useState, useCallback } from 'react';

/**
 * Hook for inline editing with double-click activation
 * @param {string} initialValue - Initial value for the edit field
 * @param {Function} onSave - Callback when edit is complete (id, newValue)
 * @param {string} id - ID of the element being edited
 * @param {string} currentValue - Current value to compare against for changes
 * @param {boolean} alwaysSave - If true, calls onSave even when value unchanged (default: false)
 * @returns {Object} Edit state and handlers
 */
export function useInlineEdit(initialValue, onSave, id, currentValue, alwaysSave = false) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(initialValue);

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleChange = useCallback((evt) => {
    setEditValue(evt.target.value);
  }, []);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (onSave && (alwaysSave || editValue !== currentValue)) {
      onSave(id, editValue);
    }
  }, [onSave, id, editValue, currentValue, alwaysSave]);

  const handleKeyDown = useCallback((evt) => {
    if (evt.key === 'Enter') {
      evt.target.blur();
    }
  }, []);

  return {
    isEditing,
    editValue,
    setEditValue,
    handleDoubleClick,
    handleChange,
    handleBlur,
    handleKeyDown,
  };
}
