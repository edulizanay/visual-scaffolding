// ABOUTME: Integration tests for group operation endpoints
// ABOUTME: Tests group creation, ungrouping, and expansion via API

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { closeDb } from '../server/db.js';
import { executeToolCalls } from '../server/tools/executor.js';

async function executeTool(toolName, params) {
  const results = await executeToolCalls([{ name: toolName, params }]);
  return results[0];
}

let app;

beforeAll(async () => {
  process.env.DB_PATH = ':memory:';

  // Import server setup
  const serverModule = await import('../server/server.js');
  app = serverModule.default || serverModule.app;
});

beforeEach(() => {
  process.env.DB_PATH = ':memory:';
});

afterEach(() => {
  closeDb();
});

describe('POST /api/group', () => {
  it('should create group with multiple nodes', async () => {
    // Create nodes first
    const node1Result = await executeTool('addNode', { label: 'Node 1' });
    const node2Result = await executeTool('addNode', { label: 'Node 2' });
    const node3Result = await executeTool('addNode', { label: 'Node 3' });

    // Create group
    const response = await request(app)
      .post('/api/group')
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
    expect(groupNode.isExpanded).toBe(false);

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

    // Check synthetic edges exist
    const syntheticEdges = flow.edges.filter(e => e.data?.isSyntheticGroupEdge);
    expect(syntheticEdges).toHaveLength(2);
  });

  it('should create group with auto-generated label', async () => {
    const node1Result = await executeTool('addNode', { label: 'Node 1' });
    const node2Result = await executeTool('addNode', { label: 'Node 2' });

    const response = await request(app)
      .post('/api/group')
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
      .post('/api/group')
      .send({
        memberIds: [node1Result.nodeId]
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('At least 2 memberIds');
  });

  it('should fail when memberIds is not an array', async () => {
    const response = await request(app)
      .post('/api/group')
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
      .post('/api/group')
      .send({
        memberIds: [node1Result.nodeId, 'nonexistent-node']
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('not found');
  });

  it('should fail when trying to group nodes already in groups', async () => {
    // Create first group
    const node1Result = await executeTool('addNode', { label: 'Node 1' });
    const node2Result = await executeTool('addNode', { label: 'Node 2' });
    const group1Result = await executeTool('createGroup', {
      memberIds: [node1Result.nodeId, node2Result.nodeId]
    });

    // Try to create second group with overlapping member
    const node3Result = await executeTool('addNode', { label: 'Node 3' });
    const response = await request(app)
      .post('/api/group')
      .send({
        memberIds: [node1Result.nodeId, node3Result.nodeId]
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('already in groups');
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

    // Check synthetic edges are removed
    const syntheticEdges = flow.edges.filter(e => e.data?.isSyntheticGroupEdge);
    expect(syntheticEdges).toHaveLength(0);
  });

  it('should fail when group does not exist', async () => {
    const response = await request(app)
      .delete('/api/group/nonexistent-group')
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('not found');
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
    expect(groupNode.isExpanded).toBe(true);

    // Check members are visible
    const member1 = flow.nodes.find(n => n.id === node1Result.nodeId);
    const member2 = flow.nodes.find(n => n.id === node2Result.nodeId);
    expect(member1.hidden).toBe(false);
    expect(member2.hidden).toBe(false);

    // Check synthetic edges are visible
    const syntheticEdges = flow.edges.filter(e => e.data?.isSyntheticGroupEdge);
    expect(syntheticEdges.every(e => !e.hidden)).toBe(true);
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
    expect(groupNode.isExpanded).toBe(false);

    // Check members are hidden
    const member1 = flow.nodes.find(n => n.id === node1Result.nodeId);
    const member2 = flow.nodes.find(n => n.id === node2Result.nodeId);
    expect(member1.hidden).toBe(true);
    expect(member2.hidden).toBe(true);

    // Check synthetic edges are hidden
    const syntheticEdges = flow.edges.filter(e => e.data?.isSyntheticGroupEdge);
    expect(syntheticEdges.every(e => e.hidden)).toBe(true);
  });

  it('should fail when group does not exist', async () => {
    const response = await request(app)
      .put('/api/group/nonexistent-group/expand')
      .send({
        expand: true
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('not found');
  });
});
