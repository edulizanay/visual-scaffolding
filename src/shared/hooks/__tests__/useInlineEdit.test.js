// ABOUTME: Tests for useInlineEdit hook
// ABOUTME: Validates inline editing behavior and state management
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInlineEdit } from '../useInlineEdit.js';

describe('useInlineEdit', () => {
  it('should initialize with correct values', () => {
    const { result } = renderHook(() => useInlineEdit('initial', vi.fn(), 'test-id', 'initial'));

    expect(result.current.isEditing).toBe(false);
    expect(result.current.editValue).toBe('initial');
  });

  it('should enter editing mode on double click', () => {
    const { result } = renderHook(() => useInlineEdit('initial', vi.fn(), 'test-id', 'initial'));

    act(() => {
      result.current.handleDoubleClick();
    });

    expect(result.current.isEditing).toBe(true);
  });

  it('should update editValue on change', () => {
    const { result } = renderHook(() => useInlineEdit('initial', vi.fn(), 'test-id', 'initial'));

    act(() => {
      result.current.handleChange({ target: { value: 'updated' } });
    });

    expect(result.current.editValue).toBe('updated');
  });

  it('should call onSave and exit editing mode on blur when value changed', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useInlineEdit('initial', onSave, 'test-id', 'initial'));

    act(() => {
      result.current.handleDoubleClick();
      result.current.handleChange({ target: { value: 'updated' } });
      result.current.handleBlur();
    });

    expect(result.current.isEditing).toBe(false);
    expect(onSave).toHaveBeenCalledWith('test-id', 'updated');
  });

  it('should not call onSave if value unchanged', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useInlineEdit('initial', onSave, 'test-id', 'initial'));

    act(() => {
      result.current.handleDoubleClick();
      result.current.handleBlur();
    });

    expect(result.current.isEditing).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('should trigger blur on Enter key', () => {
    const { result } = renderHook(() => useInlineEdit('initial', vi.fn(), 'test-id', 'initial'));
    const mockBlur = vi.fn();

    act(() => {
      result.current.handleKeyDown({
        key: 'Enter',
        target: { blur: mockBlur }
      });
    });

    expect(mockBlur).toHaveBeenCalled();
  });

  it('should not trigger blur on other keys', () => {
    const { result } = renderHook(() => useInlineEdit('initial', vi.fn(), 'test-id', 'initial'));
    const mockBlur = vi.fn();

    act(() => {
      result.current.handleKeyDown({
        key: 'Escape',
        target: { blur: mockBlur }
      });
    });

    expect(mockBlur).not.toHaveBeenCalled();
  });

  it('should allow manual editValue updates', () => {
    const { result } = renderHook(() => useInlineEdit('initial', vi.fn(), 'test-id', 'initial'));

    act(() => {
      result.current.setEditValue('manually updated');
    });

    expect(result.current.editValue).toBe('manually updated');
  });
});
