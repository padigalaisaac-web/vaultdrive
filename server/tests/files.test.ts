import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/dbAdapter.js';

const app = createApp();

describe('Files API Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    await db.init();
    // Register test user
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Bob Tester',
        email: `bob_${Date.now()}@example.com`,
        password: 'Password123!'
      });
    authToken = res.body.token;
  });

  let createdFileId: string;

  it('should upload a new file', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', Buffer.from('Hello VaultDrive Offline-First Storage!'), 'sample.txt')
      .field('is_favorite', 'true')
      .field('is_offline', 'true');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.file).toBeDefined();
    expect(res.body.file.name).toBe('sample.txt');
    expect(res.body.file.category).toBe('document');
    expect(res.body.file.is_favorite).toBe(true);
    expect(res.body.file.is_offline).toBe(true);

    createdFileId = res.body.file.id;
  });

  it('should list uploaded files', async () => {
    const res = await request(app)
      .get('/api/files')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.files)).toBe(true);
    expect(res.body.files.length).toBeGreaterThan(0);
  });

  it('should download uploaded file content', async () => {
    const res = await request(app)
      .get(`/api/files/${createdFileId}/download`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.text).toBe('Hello VaultDrive Offline-First Storage!');
  });

  it('should update file metadata', async () => {
    const res = await request(app)
      .patch(`/api/files/${createdFileId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'renamed_sample.txt',
        is_favorite: false
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.file.name).toBe('renamed_sample.txt');
  });

  it('should move file to trash', async () => {
    const res = await request(app)
      .delete(`/api/files/${createdFileId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
