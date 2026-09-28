import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/dbAdapter.js';

const app = createApp();

describe('Folders API Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    await db.init();
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Charlie Folder Tester',
        email: `charlie_${Date.now()}@example.com`,
        password: 'Password123!'
      });
    authToken = res.body.token;
  });

  let rootFolderId: string;
  let childFolderId: string;

  it('should create a root folder', async () => {
    const res = await request(app)
      .post('/api/folders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Projects',
        color: '#0c8ee9'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.folder.name).toBe('Projects');
    rootFolderId = res.body.folder.id;
  });

  it('should create a nested child folder', async () => {
    const res = await request(app)
      .post('/api/folders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'College',
        parent_id: rootFolderId,
        color: '#10b981'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.folder.parent_id).toBe(rootFolderId);
    childFolderId = res.body.folder.id;
  });

  it('should get folder breadcrumbs hierarchy', async () => {
    const res = await request(app)
      .get(`/api/folders/${childFolderId}/breadcrumbs`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.breadcrumbs.length).toBe(2);
    expect(res.body.breadcrumbs[0].name).toBe('Projects');
    expect(res.body.breadcrumbs[1].name).toBe('College');
  });

  it('should rename a folder', async () => {
    const res = await request(app)
      .patch(`/api/folders/${rootFolderId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'My Best Projects'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.folder.name).toBe('My Best Projects');
  });
});
