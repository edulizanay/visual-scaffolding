# Feature Flag Strategy: Backend Save Funnel

> **Date**: 2025-10-20
> **Status**: ACTIVE
> **Decision**: Keep flags as permanent kill switches

---

## Current State

**Flags**:
- `ENABLE_BACKEND_DRAG_SAVE` - Backend persistence for drag-end position updates
- `ENABLE_BACKEND_SUBTREE` - Backend persistence for subtree collapse/expand

**Defaults**: Both flags default to `false`

**Configured via**: Environment variables
```bash
ENABLE_BACKEND_DRAG_SAVE=true ENABLE_BACKEND_SUBTREE=true npm run dev:all
```

---

## Strategy Decision: Permanent Kill Switches

### Decision

**Keep feature flags indefinitely as permanent kill switches.**

### Rationale

1. **Proven Rollback Mechanism**
   - Phase 4 validation confirmed flags OFF restores autosave behavior seamlessly
   - No code deployment needed for rollback - just env var change
   - Critical safety net for production incidents

2. **Minimal Ongoing Cost**
   - Flags add ~10 lines of code total
   - No performance impact (single boolean check)
   - No maintenance burden (stable, tested code)

3. **Autosave Preserved**
   - Autosave code remains functional as fallback
   - Removing autosave would require git revert for rollback
   - Keeping both paths provides operational flexibility

4. **Operational Benefits**
   - Can toggle behavior without deployment
   - Enables gradual rollout per environment
   - Facilitates A/B testing if needed
   - Provides emergency "off switch" for unforeseen issues

### Alternative Considered

**Remove flags + autosave after 6 months of stability**

**Rejected because**:
- Rollback requires code deployment (slower, riskier)
- Loss of operational flexibility
- Minimal benefit vs. risk trade-off
- 10 lines of code not worth removing safety net

---

## Default Value Strategy

### Current: Defaults = `false`

**Rationale**:
- No staging/production validation completed yet
- Conservative approach: explicit opt-in
- Allows controlled rollout and monitoring

### Future: When to Change Defaults to `true`

**Prerequisites** (all must be met):
1. ✅ Local QA validation complete (Phase 4)
2. ⏳ Staging deployment with flags ON
3. ⏳ Monitor 24-48 hours minimum
4. ⏳ Metrics validation:
   - Drag-end & subtree success rate ≥99%
   - p95 latency <300ms
   - No unusual error patterns
5. ⏳ Stakeholder approval

**Once prerequisites met**:
- Update `server/config.js` defaults to `true`
- Document change in commit message
- Keep environment variable override functional
- Update this doc with decision date

---

## Rollback Procedures

### Emergency Rollback (Flags ON → OFF)

**Scenario**: Production incident, need immediate rollback

**Steps**:
1. Set environment variables to `false`:
   ```bash
   ENABLE_BACKEND_DRAG_SAVE=false
   ENABLE_BACKEND_SUBTREE=false
   ```

2. Redeploy/restart server

3. **Verify**:
   - No `[TOOL_EXECUTION]` logs for drag/subtree operations
   - Autosave logs confirm persistence working
   - User actions persist correctly

**Expected behavior**: System reverts to autosave-based persistence immediately.

**Downtime**: Minimal (restart only, no code changes)

---

### Permanent Rollback (Remove Backend Path)

**Scenario**: Decision made to permanently remove backend save funnel

**Steps**:
1. Set flags to `false` via env vars (interim safety measure)

2. Remove backend-specific code:
   - `server/tools/executor.js` - `updateNode`/`toggleSubtreeCollapse` cases
   - `server/routes/flowRoutes.js` - toggle subtree route
   - `src/App.jsx` - backend API call branches
   - `src/utils/dragHelpers.js` + `src/utils/subtreeHelpers.js`
   - `src/services/api/flowApi.js` - API functions

3. Keep autosave code (required for persistence)

4. Remove feature flags:
   - `server/config.js` - flag definitions
   - `server/routes/flowRoutes.js` - `/config` endpoint
   - `src/utils/featureFlags.js`

5. Update tests to remove backend-specific assertions

6. Full regression QA (autosave-only path)

**Note**: This is a **major code change** requiring full QA cycle. Not recommended unless backend path proves fundamentally flawed.

---

## Monitoring & Observability

### Key Metrics to Track

**When flags ON**:
- **Success rate**: % of successful drag/subtree API calls
- **Latency**: p50, p95, p99 for `updateNode` and `toggleSubtreeCollapse`
- **Error rate**: Failed API calls / total calls
- **Origin tag distribution**: Verify snapshots tagged correctly

**When flags OFF**:
- **Autosave success**: Debounce triggers, saveFlow completions
- **Snapshot frequency**: Expected ~500ms debounce pattern

### Log Queries

**Check backend API usage** (flags ON expected):
```bash
# Count tool executions by origin
grep "TOOL_EXECUTION" server.log | grep "ui.node.update\|ui.subtree" | wc -l
```

**Check autosave activity** (flags OFF expected):
```bash
# Check for autosave pattern in snapshots
sqlite3 server/data/flow.db "SELECT COUNT(*) FROM undo_history WHERE created_at > datetime('now', '-1 hour');"
```

**Verify no duplicate snapshots**:
```bash
# Look for suspiciously frequent snapshots (potential race condition)
sqlite3 server/data/flow.db "SELECT created_at, COUNT(*) FROM undo_history GROUP BY created_at HAVING COUNT(*) > 5;"
```

---

## Decision History

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-10-20 | Keep flags as permanent kill switches | Proven rollback, minimal cost, operational flexibility |
| 2025-10-20 | Defaults remain `false` | No staging validation yet; conservative rollout |
| TBD | Change defaults to `true` | After staging validation + metrics review |

---

## Future Considerations

### If Flags Cause Issues

**Scenario**: Feature flags create confusion or maintenance burden

**Options**:
1. **Better documentation**: Update this doc, add inline comments
2. **Tooling**: Script to check current flag state
3. **Monitoring**: Alert if flags unexpectedly change
4. **Remove flags** (last resort, see Permanent Rollback above)

### If New Persistence Actions Added

**Pattern**: Use same flag strategy
- Default: `false`
- Environment variable toggle
- Keep autosave fallback
- Document in this file

**Example**: If adding "delete node" persistence:
- Flag: `ENABLE_BACKEND_NODE_DELETE`
- Default: `false`
- Follow [adding-persistence-actions.md](../SOP/adding-persistence-actions.md) SOP

---

## References

- **Implementation Plan**: [backend-save-funnel-implementation-plan.md](backend-save-funnel-implementation-plan.md)
- **Phase 5 Completion Notes**: [phase5-completion-notes.md](phase5-completion-notes.md)
- **Config File**: `server/config.js`
- **SOP for New Actions**: [adding-persistence-actions.md](../SOP/adding-persistence-actions.md)

---

**Last Updated**: 2025-10-20
**Next Review**: After staging deployment + metrics collection
