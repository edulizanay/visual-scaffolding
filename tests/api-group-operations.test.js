// ABOUTME: Integration tests for group operation endpoints
// ABOUTME: Tests group creation, ungrouping, and expansion via API

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { setupTestDb, cleanupTestDb } from './test-db-setup.js';
import { executeToolCalls } from '../server/tools/executor.js';

async function executeTool(toolName, params) {
  const results = await executeToolCalls([{ name: toolName, params }]);
  return results[0];
}

let app;

beforeAll(async () => {
  // Import server setup
  const serverModule = await import('../server/server.js');
  app = serverModule.default || serverModule.app;
});

beforeEach(async () => {
  await setupTestDb();
});

afterEach(async () => {
  await cleanupTestDb();
});

describe('POST /api/group', () => {
  it('should create group with multiple nodes', async () => {
    // Create nodes first
    const node1Result = await executeTool('addNode', { label: 'Node 1' });
    const node2Result = await executeTool('addNode', { label: 'Node 2' });
    const node3Result = await executeTool('addNode', { label: 'Node 3' });

    // Create edges to test synthetic edge generation
    await executeTool('addEdge', { sourceNodeId: node1Result.nodeId, targetNodeId: node3Result.nodeId });
    await executeTool('addEdge', { sourceNodeId: node3Result.nodeId, targetNodeId: node2Result.nodeId });

    // Create group
    const response = await request(app)
      .post('/api/flow/group')
      .send({
        memberIds: [node1Result.nodeId, node2Result.nodeId],
        label: 'Test Group'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.flow).toBeDefined();
    expect(response.body.groupId).toBeDefined();

    const flow = response.body.flow;

    // Check group node exists
    const groupNode = flow.nodes.find(n => n.id === response.body.groupId);
    expect(groupNode).toBeDefined();
    expect(groupNode.type).toBe('group');
    expect(groupNode.data.label).toBe('Test Group');
    expect(groupNode.isCollapsed).toBe(true);

    // Check member nodes have parentGroupId
    const member1 = flow.nodes.find(n => n.id === node1Result.nodeId);
    const member2 = flow.nodes.find(n => n.id === node2Result.nodeId);
    expect(member1.parentGroupId).toBe(response.body.groupId);
    expect(member2.parentGroupId).toBe(response.body.groupId);
    expect(member1.hidden).toBe(true);
    expect(member2.hidden).toBe(true);

    // Check node3 is not affected
    const node3 = flow.nodes.find(n => n.id === node3Result.nodeId);
    expect(node3.parentGroupId).toBeUndefined();
    expect(node3.hidden).toBeUndefined();

    // Synthetic edges are created dynamically by frontend applyGroupVisibility
    // Backend doesn't create them anymore - they'll be computed when frontend loads
    const syntheticEdges = flow.edges.filter(e => e.data?.isSyntheticGroupEdge);
    expect(syntheticEdges).toHaveLength(0); // Backend doesn't create synthetic edges
  });

  it('should create group with auto-generated label', async () => {
    const node1Result = await executeTool('addNode', { label: 'Node 1' });
    const node2Result = await executeTool('addNode', { label: 'Node 2' });

    const response = await request(app)
      .post('/api/flow/group')
      .send({
        memberIds: [node1Result.nodeId, node2Result.nodeId]
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const groupNode = response.body.flow.nodes.find(n => n.id === response.body.groupId);
    expect(groupNode.data.label).toMatch(/Group \d+/);
  });

  it('should fail when less than 2 memberIds provided', async () => {
    const node1Result = await executeTool('addNode', { label: 'Node 1' });

    const response = await request(app)
      .post('/api/flow/group')
      .send({
        memberIds: [node1Result.nodeId]
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('At least 2 memberIds');
  });

  it('should fail when memberIds is not an array', async () => {
    const response = await request(app)
      .post('/api/flow/group')
      .send({
        memberIds: 'not-an-array'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('At least 2 memberIds');
  });

  it('should fail when member node does not exist', async () => {
    const node1Result = await executeTool('addNode', { label: 'Node 1' });

    const response = await request(app)
      .post('/api/flow/group')
      .send({
        memberIds: [node1Result.nodeId, 'nonexistent-node']
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('not found');
  });

  it('should fail when trying to group nodes from different parent groups', async () => {
    // Create two separate groups
    const node1Result = await executeTool('addNode', { label: 'Node 1' });
    const node2Result = await executeTool('addNode', { label: 'Node 2' });
    await executeTool('createGroup', {
      memberIds: [node1Result.nodeId, node2Result.nodeId]
    });

    const node3Result = await executeTool('addNode', { label: 'Node 3' });
    const node4Result = await executeTool('addNode', { label: 'Node 4' });
    await executeTool('createGroup', {
      memberIds: [node3Result.nodeId, node4Result.nodeId]
    });

    // Try to group nodes from different parent groups
    const response = await request(app)
      .post('/api/flow/group')
      .send({
        memberIds: [node1Result.nodeId, node3Result.nodeId]
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('different parent groups');
  });

  it('should allow grouping nodes from the same parent group (sub-grouping)', async () => {
    // Create initial group with 3 nodes
    const node1Result = await executeTool('addNode', { label: 'Node 1' });
    const node2Result = await executeTool('addNode', { label: 'Node 2' });
    const node3Result = await executeTool('addNode', { label: 'Node 3' });
    const parentGroupResult = await executeTool('createGroup', {
      memberIds: [node1Result.nodeId, node2Result.nodeId, node3Result.nodeId],
      label: 'Parent Group'
    });

    // Group two nodes from the same parent group into a sub-group
    const response = await request(app)
      .post('/api/flow/group')
      .send({
        memberIds: [node1Result.nodeId, node2Result.nodeId],
        label: 'Sub Group'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const flow = response.body.flow;

    // Check sub-group was created
    const subGroupNode = flow.nodes.find(n => n.id === response.body.groupId);
    expect(subGroupNode).toBeDefined();
    expect(subGroupNode.type).toBe('group');
    expect(subGroupNode.data.label).toBe('Sub Group');

    // Check sub-group has the parent group as its parent
    expect(subGroupNode.parentGroupId).toBe(parentGroupResult.groupId);

    // Ensure the remaining node stays inside the parent group
    const remainingNode = flow.nodes.find(n => n.id === node3Result.nodeId);
    expect(remainingNode.parentGroupId).toBe(parentGroupResult.groupId);

    // Parent group should now contain the new sub-group and the remaining node
    const parentGroupChildren = flow.nodes
      .filter(n => n.parentGroupId === parentGroupResult.groupId)
      .map(n => n.id);
    expect(parentGroupChildren).toContain(response.body.groupId);
    expect(parentGroupChildren).toContain(node3Result.nodeId);
  });

  it('should allow grouping group nodes to create nested groups', async () => {
    // Create two separate groups
    const node1Result = await executeTool('addNode', { label: 'Node 1' });
    const node2Result = await executeTool('addNode', { label: 'Node 2' });
    const group1Result = await executeTool('createGroup', {
      memberIds: [node1Result.nodeId, node2Result.nodeId],
      label: 'Group 1'
    });

    const node3Result = await executeTool('addNode', { label: 'Node 3' });
    const node4Result = await executeTool('addNode', { label: 'Node 4' });
    const group2Result = await executeTool('createGroup', {
      memberIds: [node3Result.nodeId, node4Result.nodeId],
      label: 'Group 2'
    });

    // Group the two group nodes together
    const response = await request(app)
      .post('/api/flow/group')
      .send({
        memberIds: [group1Result.groupId, group2Result.groupId],
        label: 'Super Group'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const flow = response.body.flow;

    // Check super group was created
    const superGroupNode = flow.nodes.find(n => n.id === response.body.groupId);
    expect(superGroupNode).toBeDefined();
    expect(superGroupNode.type).toBe('group');
    expect(superGroupNode.data.label).toBe('Super Group');

    // Check both child groups now have the super group as their parent
    const childGroup1 = flow.nodes.find(n => n.id === group1Result.groupId);
    const childGroup2 = flow.nodes.find(n => n.id === group2Result.groupId);
    expect(childGroup1.parentGroupId).toBe(response.body.groupId);
    expect(childGroup2.parentGroupId).toBe(response.body.groupId);
  });
});

describe('DELETE /api/group/:id', () => {
  it('should ungroup and restore member nodes', async () => {
    // Create group first
    const node1Result = await executeTool('addNode', { label: 'Node 1' });
    const node2Result = await executeTool('addNode', { label: 'Node 2' });
    const groupResult = await executeTool('createGroup', {
      memberIds: [node1Result.nodeId, node2Result.nodeId]
    });

    // Ungroup
    const response = await request(app)
      .delete(`/api/group/${groupResult.groupId}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    const flow = response.body.flow;

    // Check group node is removed
    const groupNode = flow.nodes.find(n => n.id === groupResult.groupId);
    expect(groupNode).toBeUndefined();

    // Check member nodes are restored
    const member1 = flow.nodes.find(n => n.id === node1Result.nodeId);
    const member2 = flow.nodes.find(n => n.id === node2Result.nodeId);
    expect(member1.parentGroupId).toBeUndefined();
    expect(member2.parentGroupId).toBeUndefined();
    expect(member1.hidden).toBe(false);
    expect(member2.hidden).toBe(false);

    // Synthetic edges are computed by frontend, automatically cleaned up
  });

  it('should fail when group does not exist', async () => {
    const response = await request(app)
      .delete('/api/flow/group/nonexistent-group')
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('not found');
  });

  it('should keep members within ancestor when ungrouping nested group', async () => {
    const node1 = await executeTool('addNode', { label: 'Node 1' });
    const node2 = await executeTool('addNode', { label: 'Node 2' });
    const node3 = await executeTool('addNode', { label: 'Node 3' });
    const node4 = await executeTool('addNode', { label: 'Node 4' });

    const innerGroupResult = await executeTool('createGroup', {
      memberIds: [node3.nodeId, node4.nodeId]
    });
    expect(innerGroupResult.success).toBe(true);

    const outerGroupResponse = await request(app)
      .post('/api/flow/group')
      .send({
        memberIds: [node1.nodeId, node2.nodeId, innerGroupResult.groupId],
        label: 'Outer Group'
      })
      .expect(200);

    expect(outerGroupResponse.body.success).toBe(true);
    const outerGroupId = outerGroupResponse.body.groupId;

    const ungroupResponse = await request(app)
      .delete(`/api/group/${innerGroupResult.groupId}`)
      .expect(200);

    expect(ungroupResponse.body.success).toBe(true);
    const flow = ungroupResponse.body.flow;

    const removedGroup = flow.nodes.find(n => n.id === innerGroupResult.groupId);
    expect(removedGroup).toBeUndefined();

    const member3 = flow.nodes.find(n => n.id === node3.nodeId);
    const member4 = flow.nodes.find(n => n.id === node4.nodeId);

    expect(member3).toBeDefined();
    expect(member4).toBeDefined();
    expect(member3.parentGroupId).toBe(outerGroupId);
    expect(member4.parentGroupId).toBe(outerGroupId);
  });

  it('should fail when trying to ungroup non-group node', async () => {
    const nodeResult = await executeTool('addNode', { label: 'Regular Node' });

    const response = await request(app)
      .delete(`/api/group/${nodeResult.nodeId}`)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('not found');
  });
});

describe('PUT /api/group/:id/expand', () => {
  it('should expand group and show members', async () => {
    // Create collapsed group
    const node1Result = await executeTool('addNode', { label: 'Node 1' });
    const node2Result = await executeTool('addNode', { label: 'Node 2' });
    const groupResult = await executeTool('createGroup', {
      memberIds: [node1Result.nodeId, node2Result.nodeId]
    });

    // Expand group
    const response = await request(app)
      .put(`/api/group/${groupResult.groupId}/expand`)
      .send({
        expand: true
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const flow = response.body.flow;

    // Check group is expanded
    const groupNode = flow.nodes.find(n => n.id === groupResult.groupId);
    expect(groupNode.isCollapsed).toBe(false);

    // Check members are visible
    const member1 = flow.nodes.find(n => n.id === node1Result.nodeId);
    const member2 = flow.nodes.find(n => n.id === node2Result.nodeId);
    expect(member1.hidden).toBe(false);
    expect(member2.hidden).toBe(false);

    // Synthetic edges are computed by frontend, not backend
  });

  it('should collapse group and hide members', async () => {
    // Create expanded group
    const node1Result = await executeTool('addNode', { label: 'Node 1' });
    const node2Result = await executeTool('addNode', { label: 'Node 2' });
    const groupResult = await executeTool('createGroup', {
      memberIds: [node1Result.nodeId, node2Result.nodeId]
    });

    // First expand, then collapse
    await executeTool('toggleGroupExpansion', {
      groupId: groupResult.groupId,
      expand: true
    });

    const response = await request(app)
      .put(`/api/group/${groupResult.groupId}/expand`)
      .send({
        expand: false
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const flow = response.body.flow;

    // Check group is collapsed
    const groupNode = flow.nodes.find(n => n.id === groupResult.groupId);
    expect(groupNode.isCollapsed).toBe(true);

    // Check members are hidden
    const member1 = flow.nodes.find(n => n.id === node1Result.nodeId);
    const member2 = flow.nodes.find(n => n.id === node2Result.nodeId);
    expect(member1.hidden).toBe(true);
    expect(member2.hidden).toBe(true);

    // Synthetic edges are computed by frontend, not backend
  });

  it('should fail when group does not exist', async () => {
    const response = await request(app)
      .put('/api/flow/group/nonexistent-group/expand')
      .send({
        expand: true
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('not found');
  });
});
