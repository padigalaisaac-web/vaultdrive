import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createApp } from '../src/app.js';
import { db } from '../src/db/dbAdapter.js';

const app = createApp();

describe('Sync Engine API Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    await db.init();
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Dana Sync Tester',
        email: `dana_${Date.now()}@example.com`,
        password: 'Password123!'
      });
    authToken = res.body.token;
  });

  it('should respond to sync ping heartbeat', async () => {
    const res = await request(app).get('/api/sync/ping');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('online');
    expect(res.body.serverTime).toBeDefined();
  });

  it('should push offline batch mutations and apply them', async () => {
    const offlineFolderId = uuidv4();
    const res = await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        device_id: 'test-device-uuid-1',
        operations: [
          {
            id: uuidv4(),
            operation_type: 'create_folder',
            entity_type: 'folder',
            entity_id: offlineFolderId,
            payload: {
              name: 'Offline Created Folder',
              color: '#6366f1'
            },
            version: 1,
            client_timestamp: new Date().toISOString()
          }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results.length).toBe(1);

    // Verify folder exists
    const listRes = await request(app)
      .get('/api/folders')
      .set('Authorization', `Bearer ${authToken}`);

    const found = listRes.body.folders.find((f: any) => f.id === offlineFolderId);
    expect(found).toBeDefined();
    expect(found.name).toBe('Offline Created Folder');
  });

  it('should pull incremental changes', async () => {
    const res = await request(app)
      .get('/api/sync/pull?since=1970-01-01T00:00:00.000Z')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.folders)).toBe(true);
    expect(Array.isArray(res.body.files)).toBe(true);
  });
});
