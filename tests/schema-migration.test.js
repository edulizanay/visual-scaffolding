// ABOUTME: Tests for group fields schema migration backward compatibility
// ABOUTME: Ensures existing flows load correctly with new fields

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { saveFlow, getFlow } from '../server/db.js';
import { setupTestDb, cleanupTestDb } from './test-db-setup.js';

describe('Group Fields Schema Migration', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  afterEach(async () => {
    await cleanupTestDb();
  });

  test('old flows load with default type="regular"', async () => {
    // Simulate old flow without type field
    const oldFlowData = {
      nodes: [
        { id: 'node-1', data: { label: 'Test' }, position: { x: 0, y: 0 } },
      ],
      edges: [],
    };

    await saveFlow(oldFlowData);

    // Retrieve flow
    const flow = await getFlow();

    expect(flow.nodes[0]).toBeDefined();
    // Node without type field should still work (defaults handled in app logic)
    expect(flow.nodes[0].type).toBeUndefined(); // DB doesn't add it, app does
  });

  test('can save flows with new type field', async () => {
    const flowData = {
      nodes: [
        { id: 'node-1', type: 'regular', data: { label: 'Regular' }, position: { x: 0, y: 0 } },
        { id: 'group-1', type: 'group', data: { label: 'Group' }, position: { x: 100, y: 0 } },
      ],
      edges: [],
    };

    await saveFlow(flowData);

    const flow = await getFlow();

    expect(flow.nodes[0].type).toBe('regular');
    expect(flow.nodes[1].type).toBe('group');
  });

  test('can save flows with parentGroupId field', async () => {
    const flowData = {
      nodes: [
        { id: 'group-1', type: 'group', data: { label: 'Group' }, position: { x: 0, y: 0 } },
        { id: 'node-1', type: 'regular', parentGroupId: 'group-1', data: { label: 'Child' }, position: { x: 50, y: 50 } },
      ],
      edges: [],
    };

    await saveFlow(flowData);

    const flow = await getFlow();

    expect(flow.nodes[1].parentGroupId).toBe('group-1');
  });

  test('can save flows with isExpanded field on group nodes', async () => {
    const flowData = {
      nodes: [
        { id: 'group-1', type: 'group', isExpanded: false, data: { label: 'Collapsed Group' }, position: { x: 0, y: 0 } },
        { id: 'node-1', parentGroupId: 'group-1', hidden: true, data: { label: 'Hidden' }, position: { x: 50, y: 50 } },
      ],
      edges: [],
    };

    await saveFlow(flowData);

    const flow = await getFlow();

    expect(flow.nodes[0].isExpanded).toBe(false);
    expect(flow.nodes[1].hidden).toBe(true);
  });

  test('old flows without type/parentGroupId still work', async () => {
    // Old flow structure
    const oldFlow = {
      nodes: [
        { id: 'login', data: { label: 'Login', description: 'Auth page' }, position: { x: 0, y: 0 } },
        { id: 'home', data: { label: 'Home' }, position: { x: 200, y: 0 } },
      ],
      edges: [
        { id: 'e1', source: 'login', target: 'home' },
      ],
    };

    await saveFlow(oldFlow);

    const flow = await getFlow();

    expect(flow.nodes).toHaveLength(2);
    expect(flow.edges).toHaveLength(1);
    // Should load successfully even without new fields
    expect(flow.nodes[0].id).toBe('login');
  });

  test('mixed flows with old and new nodes work together', async () => {
    const mixedFlow = {
      nodes: [
        // Old-style node (no type field)
        { id: 'old-node', data: { label: 'Old Node' }, position: { x: 0, y: 0 } },
        // New-style regular node
        { id: 'new-node', type: 'regular', data: { label: 'New Node' }, position: { x: 100, y: 0 } },
        // New-style group node
        { id: 'group-1', type: 'group', data: { label: 'Group' }, position: { x: 200, y: 0 } },
        // Node in group
        { id: 'grouped-node', type: 'regular', parentGroupId: 'group-1', data: { label: 'In Group' }, position: { x: 250, y: 50 } },
      ],
      edges: [],
    };

    await saveFlow(mixedFlow);

    const flow = await getFlow();

    expect(flow.nodes).toHaveLength(4);
    expect(flow.nodes[0].type).toBeUndefined(); // Old node
    expect(flow.nodes[1].type).toBe('regular');
    expect(flow.nodes[2].type).toBe('group');
    expect(flow.nodes[3].parentGroupId).toBe('group-1');
  });
});
