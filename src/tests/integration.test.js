const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');
const path = require('path');
const app = require('../app');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Transaction Reconciliation API Integration Tests', () => {
  let runId = `RUN_INTEGRATION_TEST_${Date.now()}`;
  const userFilePath = path.join(__dirname, '../../user_transactions.csv');
  const exchangeFilePath = path.join(__dirname, '../../exchange_transactions.csv');

  test('POST /api/reconcile - should ingest files and complete matching', async () => {
    const userFileBuffer = fs.readFileSync(userFilePath);
    const exchangeFileBuffer = fs.readFileSync(exchangeFilePath);

    const response = await request(app)
      .post('/api/reconcile')
      .field('runId', runId)
      .field('timestampToleranceSeconds', 300)
      .field('quantityTolerancePct', 0.0001) // 0.01%
      .attach('userFile', userFileBuffer, 'user_transactions.csv')
      .attach('exchangeFile', exchangeFileBuffer, 'exchange_transactions.csv');

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.runId).toBe(runId);
    expect(response.body.data.status).toBe('COMPLETED');
    expect(response.body.data.summary.totalUserTransactions).toBeGreaterThan(0);
    expect(response.body.data.summary.totalExchangeTransactions).toBeGreaterThan(0);
  });

  test('POST /api/reconcile (Idempotency) - should return cached run details on repeated completed run with 200 OK', async () => {
    const userFileBuffer = fs.readFileSync(userFilePath);
    const exchangeFileBuffer = fs.readFileSync(exchangeFilePath);

    const response = await request(app)
      .post('/api/reconcile')
      .field('runId', runId)
      .attach('userFile', userFileBuffer, 'user_transactions.csv')
      .attach('exchangeFile', exchangeFileBuffer, 'exchange_transactions.csv');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toContain('already exists');
  });

  test('GET /api/report/:runId - should fetch report results (paginated)', async () => {
    const response = await request(app)
      .get(`/api/report/${runId}`)
      .query({ page: 1, limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.runDetails.runId).toBe(runId);
    expect(response.body.data.length).toBeLessThanOrEqual(10);
    expect(response.body.pagination).toBeDefined();
  });

  test('GET /api/report/:runId - should return CSV format if requested', async () => {
    const response = await request(app)
      .get(`/api/report/${runId}`)
      .query({ format: 'csv' });

    expect(response.status).toBe(200);
    expect(response.header['content-type']).toContain('text/csv');
    expect(response.text).toContain('user_transaction_id');
    expect(response.text).toContain('exchange_transaction_id');
    expect(response.text).toContain('status');
  });

  test('GET /api/report/:runId/summary - should fetch summary metrics', async () => {
    const response = await request(app)
      .get(`/api/report/${runId}/summary`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.summary.counts).toBeDefined();
    expect(response.body.auditTrail.length).toBeGreaterThan(0);
  });

  test('GET /api/report/:runId/unmatched - should fetch unmatched transactions with reasons', async () => {
    const response = await request(app)
      .get(`/api/report/${runId}/unmatched`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data[0].status).toBe('UNMATCHED');
    expect(response.body.data[0].reason).toBeDefined();
  });
});
