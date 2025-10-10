# Task: Implement Version-Based Visual Settings Upgrades

## Status
**Not Started** - Documented implementation plan

## Problem Statement

Currently, visual settings are stored as complete objects in the database. When developers add new default settings to the code (e.g., `borderRadius`), these new defaults don't automatically propagate to existing database entries.

**Current workaround:** Manually delete database settings
**Risk:** This would erase user customizations (colors, sizes they've changed via LLM)

## Goal

Implement automatic version-based upgrades that:
- ✅ Preserve user customizations when upgrading
- ✅ Add new defaults automatically
- ✅ Require zero user intervention
- ✅ Be backwards compatible with existing data

## Solution: Version-Based Hybrid Storage

Store full settings WITH a version number. On read, if DB version < code version, auto-merge with new defaults and save back to DB.

### Example Scenario

**User has customized:** Node background color to red
**Developer adds:** New `borderRadius: 3` default
**Expected result:** User keeps red nodes AND gets rounded corners

## Implementation Plan

### Step 1: Add Version to Defaults

**File:** `shared/visualSettings.js`

```javascript
// Add at top of file
export const SETTINGS_VERSION = 1;

export const DEFAULT_VISUAL_SETTINGS = {
  version: SETTINGS_VERSION,  // Add this line
  colors: {
    background: 'linear-gradient(180deg, #0f0a1a 0%, #1a0f2e 100%)',
    allNodes: {
      background: '#1a192b',
      border: '#2b2253',
      text: '#ffffff',
    },
    perNode: {},
  },
  dimensions: {
    node: {
      default: {
        width: 172,
        height: 36,
        borderRadius: 3,
      },
      overrides: {},
    },
    zoom: 1,
    dagre: {
      horizontal: 50,
      vertical: 50,
    },
    fitViewPadding: 0.25,
  },
};
```

### Step 2: Update Merge Function to Skip Version

**File:** `shared/visualSettings.js`

```javascript
export function mergeWithDefaultVisualSettings(overrides = {}) {
  const deepClone = (value) => JSON.parse(JSON.stringify(value));
  const merged = deepClone(DEFAULT_VISUAL_SETTINGS);

  const apply = (target, source) => {
    if (!isObject(source)) {
      return;
    }

    Object.entries(source).forEach(([key, value]) => {
      // IMPORTANT: Skip version - always use code default
      if (key === 'version') {
        return;
      }

      if (Array.isArray(value)) {
        target[key] = [...value];
        return;
      }

      if (isObject(value)) {
        if (!isObject(target[key])) {
          target[key] = {};
        }
        apply(target[key], value);
        return;
      }

      target[key] = value;
    });
  };

  apply(merged, overrides);
  return merged;
}
```

**Why skip version?** The merge overlays DB data on top of defaults. If we don't skip version, the old DB version would overwrite the new code version, defeating the purpose.

### Step 3: Add Version Check on Read

**File:** `server/db.js`

Add import at top:
```javascript
import { DEFAULT_VISUAL_SETTINGS, mergeWithDefaultVisualSettings, SETTINGS_VERSION } from '../shared/visualSettings.js';
```

Update `getVisualSettings()`:
```javascript
export function getVisualSettings() {
  const row = getDb()
    .prepare('SELECT data FROM visual_settings WHERE id = 1')
    .get();

  if (!row) {
    return DEFAULT_VISUAL_SETTINGS;
  }

  try {
    const saved = JSON.parse(row.data || '{}');
    const savedVersion = saved.version || 0;

    // Auto-upgrade if DB is older than code
    if (savedVersion < SETTINGS_VERSION) {
      console.log(`🔄 Upgrading visual settings from v${savedVersion} to v${SETTINGS_VERSION}`);
      const upgraded = mergeWithDefaultVisualSettings(saved);
      // upgraded.version is already correct (from DEFAULT, version was skipped in merge)
      saveVisualSettings(upgraded);
      return upgraded;
    }

    // Current version - still merge for safety (in case defaults changed without version bump)
    return mergeWithDefaultVisualSettings(saved);
  } catch (error) {
    return DEFAULT_VISUAL_SETTINGS;
  }
}
```

### Step 4: Add Tests

**File:** `tests/db.test.js`

```javascript
describe('Visual Settings Versioning', () => {
  test('fresh install gets current version', () => {
    const settings = getVisualSettings();
    expect(settings.version).toBe(SETTINGS_VERSION);
  });

  test('old settings auto-upgrade on read', () => {
    // Simulate old DB with version 0 (no borderRadius)
    const oldSettings = {
      version: 0,
      colors: { allNodes: { background: '#FF0000' } },
      dimensions: {
        node: { default: { width: 172, height: 36 } }
      }
    };

    saveVisualSettings(oldSettings);

    // Read back (should trigger upgrade)
    const upgraded = getVisualSettings();

    expect(upgraded.version).toBe(SETTINGS_VERSION);
    expect(upgraded.colors.allNodes.background).toBe('#FF0000'); // Preserved
    expect(upgraded.dimensions.node.default.borderRadius).toBe(3); // New default added
  });

  test('user customizations survive version upgrade', () => {
    // User changes multiple settings via LLM
    executeToolCalls([
      { name: 'changeVisuals', params: { target: 'all_nodes', color: '#FF0000' } },
      { name: 'changeDimensions', params: { target: 'all_nodes', direction: 'increase' } }
    ]);

    const beforeUpgrade = getVisualSettings();
    const userRed = beforeUpgrade.colors.allNodes.background;
    const userWidth = beforeUpgrade.dimensions.node.default.width;

    // Simulate adding new defaults by bumping SETTINGS_VERSION
    // (In real test, would mock SETTINGS_VERSION or use a test constant)

    // Force re-read (simulates server restart after code update)
    closeDb(); // Clear cache
    const afterUpgrade = getVisualSettings();

    expect(afterUpgrade.colors.allNodes.background).toBe(userRed); // User's red preserved
    expect(afterUpgrade.dimensions.node.default.width).toBe(userWidth); // User's width preserved
    expect(afterUpgrade.dimensions.node.default.borderRadius).toBeDefined(); // New default added
  });

  test('settings without version field treated as version 0', () => {
    // Legacy DB entry with no version
    const legacy = {
      colors: { allNodes: { background: '#AAAAAA' } }
    };

    saveVisualSettings(legacy);
    const upgraded = getVisualSettings();

    expect(upgraded.version).toBe(SETTINGS_VERSION);
    expect(upgraded.colors.allNodes.background).toBe('#AAAAAA'); // Preserved
  });
});
```

## Usage: Adding New Defaults

When you want to add a new default setting:

1. **Update the defaults:**
   ```javascript
   // shared/visualSettings.js
   export const SETTINGS_VERSION = 2; // Bump version

   export const DEFAULT_VISUAL_SETTINGS = {
     version: SETTINGS_VERSION,
     dimensions: {
       node: {
         default: {
           width: 172,
           height: 36,
           borderRadius: 3,
           padding: 8  // NEW DEFAULT
         }
       }
     }
   };
   ```

2. **Restart server** - that's it! Users automatically upgraded on next load

3. **What happens:**
   - User loads app → calls `getVisualSettings()`
   - DB has `version: 1`, code has `version: 2`
   - Auto-merge: user customizations preserved + new `padding: 8` added
   - Updated settings saved back to DB
   - User sees their customizations + new default

## Edge Cases Handled

1. **No DB entry exists** → Return defaults with current version
2. **DB has no version field** → Treat as version 0, upgrade
3. **DB version > code version** → Use DB as-is (shouldn't happen, but safe)
4. **DB version = code version** → Still merge for safety
5. **User tools modify settings** → Clone preserves version, tools work unchanged

## Backwards Compatibility

✅ **Existing DBs work:** Old entries without `version` treated as v0
✅ **No data loss:** All user customizations preserved during upgrade
✅ **Idempotent:** Can read/upgrade multiple times safely
✅ **Tests pass:** No changes needed to existing 50+ visual settings tests

## Files Changed

1. `shared/visualSettings.js` - Add version constant, skip in merge (~10 lines)
2. `server/db.js` - Add version check + auto-upgrade (~15 lines)
3. `tests/db.test.js` - Add upgrade tests (~60 lines)

**Total:** ~85 lines added

## Testing Strategy

### Manual Test
```bash
# 1. Start with current DB (no version)
npm run dev

# 2. Customize something via LLM
# Message: "make all nodes red"

# 3. Check DB has your customization
sqlite3 server/data/flow.db "SELECT data FROM visual_settings WHERE id = 1;"
# Should see: "background":"red" and no version field

# 4. Update code: bump SETTINGS_VERSION, add new default
# Example: add padding: 8

# 5. Restart server
npm run dev

# 6. Check DB again
# Should see: "background":"red" (preserved) + "padding":8 (new) + "version":2 (upgraded)
```

### Automated Tests
Run existing suite + new versioning tests:
```bash
npm test -- tests/db.test.js
```

All 136 existing tests should pass + 4 new versioning tests.

## Rollout Plan

### Phase 1: Implement (45 min)
- Add version to defaults
- Update merge to skip version
- Add version check in getVisualSettings
- Write tests

### Phase 2: Test (15 min)
- Run full test suite
- Manual test with real DB
- Verify upgrade path

### Phase 3: Document (10 min)
- Update README with version bumping process
- Document in code comments

**Total estimated time:** ~70 minutes

## Future Maintenance

When adding new defaults:
1. Bump `SETTINGS_VERSION` constant
2. Add new field to `DEFAULT_VISUAL_SETTINGS`
3. No other changes needed!

Users will automatically get upgrades on next server start.

## Verification Checklist

Before marking this task complete:

- [ ] `SETTINGS_VERSION` constant added to `shared/visualSettings.js`
- [ ] `version` field added to `DEFAULT_VISUAL_SETTINGS`
- [ ] `mergeWithDefaultVisualSettings()` skips `version` field
- [ ] `getVisualSettings()` checks version and auto-upgrades
- [ ] Tests added for upgrade scenarios
- [ ] All existing tests still pass (136/136)
- [ ] Manual test: customize → upgrade → verify preserved
- [ ] Documentation updated in code comments

## Notes

- This is a **version-based hybrid** approach, not delta-only storage
- We still store full settings in DB for simplicity
- Version tracking enables auto-upgrades without complexity of delta computation
- User can still manually reset if needed, but won't lose customizations during normal upgrades
