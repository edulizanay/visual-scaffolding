# Scratchpad

## 2025-10-06 - Undo/Redo Bug Fix

✅ Fixed undo/redo auto-save bug in historyService.js
- Moved truncation (lines 108-111) to AFTER duplicate checks
- Auto-save after undo now checks for duplicates first, preserving redo chain
- Tests passing: both duplicate and position-only change scenarios work

## 2025-10-06 - Canvas Component Extraction

