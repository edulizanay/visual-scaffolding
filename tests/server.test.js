// ABOUTME: Backend API tests for flow endpoints
// ABOUTME: Tests GET and POST operations, error handling, and data validation
const request = require('supertest');
const fs = require('fs').promises;
const path = require('path');

const TEST_FLOW_PATH = path.join(__dirname, 'data', 'flow.test.json');
const BACKUP_PATH = path.join(__dirname, 'data', 'flow.json.backup');

let app;
let server;

beforeAll(async () => {
  // Backup original flow.json
  try {
    const original = await fs.readFile(path.join(__dirname, 'data', 'flow.json'), 'utf-8');
    await fs.writeFile(BACKUP_PATH, original);
  } catch (err) {
    // File might not exist yet
  }

  // Set test environment
  process.env.FLOW_DATA_PATH = TEST_FLOW_PATH;

  // Import app after setting env
  app = require('./server');
});

afterAll(async () => {
  // Restore original flow.json
  try {
    const backup = await fs.readFile(BACKUP_PATH, 'utf-8');
    await fs.writeFile(path.join(__dirname, 'data', 'flow.json'), backup);
    await fs.unlink(BACKUP_PATH);
  } catch (err) {
    // Backup might not exist
  }

  // Clean up test file
  try {
    await fs.unlink(TEST_FLOW_PATH);
  } catch (err) {
    // File might not exist
  }

  // Close server if running
  if (server) {
    server.close();
  }
});

beforeEach(async () => {
  // Create fresh test data before each test
  const testData = {
    nodes: [
      { id: '1', position: { x: 0, y: 0 }, data: { label: 'Test Node' } }
    ],
    edges: []
  };
  await fs.writeFile(TEST_FLOW_PATH, JSON.stringify(testData, null, 2));
});

describe('GET /api/flow', () => {
  test('successfully loads flow data', async () => {
    const response = await request(app).get('/api/flow');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('nodes');
    expect(response.body).toHaveProperty('edges');
    expect(response.body.nodes).toHaveLength(1);
    expect(response.body.nodes[0].data.label).toBe('Test Node');
  });

  test('handles missing file gracefully', async () => {
    // Delete the test file
    await fs.unlink(TEST_FLOW_PATH);

    const response = await request(app).get('/api/flow');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('nodes');
    expect(response.body).toHaveProperty('edges');
    expect(Array.isArray(response.body.nodes)).toBe(true);
    expect(Array.isArray(response.body.edges)).toBe(true);
  });
});

describe('POST /api/flow', () => {
  test('successfully saves flow data', async () => {
    const newFlow = {
      nodes: [
        { id: '1', position: { x: 100, y: 200 }, data: { label: 'Updated Node' } },
        { id: '2', position: { x: 300, y: 400 }, data: { label: 'New Node' } }
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' }
      ]
    };

    const response = await request(app)
      .post('/api/flow')
      .send(newFlow);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);

    // Verify file was updated
    const fileContent = await fs.readFile(TEST_FLOW_PATH, 'utf-8');
    const savedData = JSON.parse(fileContent);
    expect(savedData.nodes).toHaveLength(2);
    expect(savedData.nodes[0].data.label).toBe('Updated Node');
    expect(savedData.edges).toHaveLength(1);
  });

  test('validates data structure', async () => {
    const invalidFlow = {
      nodes: 'not an array'
    };

    const response = await request(app)
      .post('/api/flow')
      .send(invalidFlow);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  test('handles concurrent writes', async () => {
    const flow1 = {
      nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Flow 1' } }],
      edges: []
    };

    const flow2 = {
      nodes: [{ id: '2', position: { x: 100, y: 100 }, data: { label: 'Flow 2' } }],
      edges: []
    };

    // Make concurrent requests
    const [response1, response2] = await Promise.all([
      request(app).post('/api/flow').send(flow1),
      request(app).post('/api/flow').send(flow2)
    ]);

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);

    // Verify file is valid JSON and contains one of the flows
    const fileContent = await fs.readFile(TEST_FLOW_PATH, 'utf-8');
    const savedData = JSON.parse(fileContent);
    expect(savedData).toHaveProperty('nodes');
    expect(savedData).toHaveProperty('edges');
    expect(Array.isArray(savedData.nodes)).toBe(true);
  });
});
