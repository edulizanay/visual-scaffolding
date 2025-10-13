# How to Add or Modify Keyboard Shortcuts

All keyboard shortcuts are defined in [src/hooks/useHotkeys.jsx](../../src/hooks/useHotkeys.jsx). Changes automatically appear in the HotkeysPanel (? button).

## Adding a New Shortcut

### 1. Add to Registry

Edit [src/hooks/useHotkeys.jsx](../../src/hooks/useHotkeys.jsx):

```javascript
export const HOTKEYS = [
  // ... existing entries
  {
    id: 'myFeature.myAction',        // Unique ID
    category: 'My Feature',          // Display grouping
    keys: ['Meta', 'K'],             // Key combination
    label: 'Do Something',           // Short name
    description: 'What it does',     // Longer explanation
    type: 'keyboard',                // 'keyboard' or 'mouse'
    isActive: (state) => true        // Optional: conditional enable
  }
];
```

### 2. Register Handler

In your component (typically `App.jsx` or `ChatInterface.jsx`):

```javascript
import { useHotkeys } from './hooks/useHotkeys';

useHotkeys([
  {
    keys: ['Meta', 'K'],
    handler: handleMyAction,
    isActive: (state) => state.someCondition
  }
], { someCondition: myValue });  // State for guards
```

### 3. Add Test

In [tests/unit/backend/hotkeys-registry.test.js](../../../tests/unit/backend/hotkeys-registry.test.js):

```javascript
it('should include my new hotkey', () => {
  const myHotkey = HOTKEYS.find(hk => hk.id === 'myFeature.myAction');
  expect(myHotkey).toBeDefined();
  expect(myHotkey.keys).toEqual(['Meta', 'K']);
});
```

## Key Names

**Modifiers:** `'Meta'`, `'Control'`, `'Alt'`, `'Shift'`
**Special:** `'Enter'`, `'Escape'`, `'Tab'`, `'Space'`
**Regular:** Use capitals (`'G'`, `'Z'`) or full names (`'ArrowUp'`)

## Categories

Reuse existing categories when possible:
- **History**, **Group Operations**, **Node Operations**, **Selection**, **Chat**, **Editing**

## Mouse Interactions

Add to registry with `type: 'mouse'` for documentation only. Handle in component event handlers (e.g., `onNodeClick`), not via `useHotkeys`.

## See Also

- [src/hooks/useHotkeys.jsx](../../src/hooks/useHotkeys.jsx) - Registry and hook implementation
- [project_architecture.md](../system/project_architecture.md#1-centralized-hotkeys-registry) - Design pattern docs
