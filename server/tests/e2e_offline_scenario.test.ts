import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createApp } from '../src/app.js';
import { db } from '../src/db/dbAdapter.js';

const app = createApp();

describe('End-to-End Real Offline-First Workflow Scenario (#40)', () => {
  let authToken: string;
  let userId: string;
  let collegeFolderId: string;
  let pdfFileId: string;
  let imageFileId: string;
  let zipFileId: string;
  let videoFileId: string;
  const offlineDeviceId = 'client-device-e2e-scenario-01';

  beforeAll(async () => {
    await db.init();
    // 1. User logs in / registers while online
    const userEmail = `student_${Date.now()}@university.edu`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'College Student',
        email: userEmail,
        password: 'Password123!'
      });

    expect(regRes.status).toBe(201);
    authToken = regRes.body.token;
    userId = regRes.body.user.id;
  });

  it('Step 2: User creates a folder called "College"', async () => {
    const res = await request(app)
      .post('/api/folders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'College',
        color: '#0c8ee9'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.folder.name).toBe('College');
    collegeFolderId = res.body.folder.id;
  });

  it('Step 3: User uploads PDF, Image, ZIP, and Video into College folder', async () => {
    // 3a: Upload PDF
    const pdfRes = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .field('folder_id', collegeFolderId)
      .attach('file', Buffer.from('%PDF-1.4 Mock Syllabus Content'), 'syllabus.pdf');
    expect(pdfRes.status).toBe(201);
    expect(pdfRes.body.file.category).toBe('document');
    pdfFileId = pdfRes.body.file.id;

    // 3b: Upload Image
    const imgRes = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .field('folder_id', collegeFolderId)
      .attach('file', Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), 'campus.png');
    expect(imgRes.status).toBe(201);
    expect(imgRes.body.file.category).toBe('image');
    imageFileId = imgRes.body.file.id;

    // 3c: Upload ZIP
    const zipRes = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .field('folder_id', collegeFolderId)
      .attach('file', Buffer.from('PK0304mockzipcontent'), 'code_assignment.zip');
    expect(zipRes.status).toBe(201);
    expect(zipRes.body.file.category).toBe('archive');
    zipFileId = zipRes.body.file.id;

    // 3d: Upload Video
    const vidRes = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .field('folder_id', collegeFolderId)
      .attach('file', Buffer.from('mockvideobinarystream'), 'lecture.mp4');
    expect(vidRes.status).toBe(201);
    expect(vidRes.body.file.category).toBe('video');
    videoFileId = vidRes.body.file.id;
  });

  it('Step 4: User marks the PDF and image as Available Offline', async () => {
    const markPdf = await request(app)
      .patch(`/api/files/${pdfFileId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ is_offline: true });
    expect(markPdf.status).toBe(200);
    expect(markPdf.body.file.is_offline).toBe(true);

    const markImg = await request(app)
      .patch(`/api/files/${imageFileId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ is_offline: true });
    expect(markImg.status).toBe(200);
    expect(markImg.body.file.is_offline).toBe(true);
  });

  it('Step 5-9: Verification of offline accessibility & download stream', async () => {
    // Both PDF and Image are marked offline and streamable
    const pdfStream = await request(app)
      .get(`/api/files/${pdfFileId}/download`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(pdfStream.status).toBe(200);
    const content = pdfStream.text || (pdfStream.body ? pdfStream.body.toString('utf8') : '');
    expect(content).toContain('Mock Syllabus Content');

    const imgStream = await request(app)
      .get(`/api/files/${imageFileId}/download`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(imgStream.status).toBe(200);
  });

  let offlineCreatedFolderId: string;

  it('Step 10-11: User creates folder and prepares upload while offline', async () => {
    // The client generates UUID and writes to local IndexedDB & sync queue
    offlineCreatedFolderId = uuidv4();
    expect(offlineCreatedFolderId).toBeDefined();
  });

  it('Step 12-16: Internet restored -> Application detects connection and synchronizes batch operations', async () => {
    // Client syncEngine pushes queued offline operations
    const pushRes = await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        device_id: offlineDeviceId,
        operations: [
          {
            id: uuidv4(),
            operation_type: 'create_folder',
            entity_type: 'folder',
            entity_id: offlineCreatedFolderId,
            payload: {
              name: 'Assignments',
              parent_id: collegeFolderId,
              color: '#10b981'
            },
            version: 1,
            client_timestamp: new Date().toISOString()
          }
        ]
      });

    expect(pushRes.status).toBe(200);
    expect(pushRes.body.success).toBe(true);
    expect(pushRes.body.results.length).toBe(1);

    // Upload the offline-queued file
    const fileUploadRes = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .field('folder_id', offlineCreatedFolderId)
      .attach('file', Buffer.from('Offline drafted homework solution'), 'homework_1.txt');

    expect(fileUploadRes.status).toBe(201);
    expect(fileUploadRes.body.file.name).toBe('homework_1.txt');
    expect(fileUploadRes.body.file.folder_id).toBe(offlineCreatedFolderId);

    // Verify folder hierarchy
    const fldRes = await request(app)
      .get(`/api/folders/${offlineCreatedFolderId}/breadcrumbs`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(fldRes.status).toBe(200);
    expect(fldRes.body.breadcrumbs.length).toBe(2);
    expect(fldRes.body.breadcrumbs[0].name).toBe('College');
    expect(fldRes.body.breadcrumbs[1].name).toBe('Assignments');

    // Pull sync to confirm everything matches
    const pullRes = await request(app)
      .get('/api/sync/pull?since=1970-01-01T00:00:00.000Z')
      .set('Authorization', `Bearer ${authToken}`);

    expect(pullRes.status).toBe(200);
    expect(pullRes.body.files.some((f: any) => f.name === 'homework_1.txt')).toBe(true);
  });

  it('Step 17: Storage stats correctly reflect all uploaded files', async () => {
    const statsRes = await request(app)
      .get('/api/storage/stats')
      .set('Authorization', `Bearer ${authToken}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.stats.total_files).toBeGreaterThanOrEqual(5); // syllabus, campus, code, lecture, homework
    expect(statsRes.body.stats.total_folders).toBeGreaterThanOrEqual(2); // College, Assignments
    expect(statsRes.body.stats.offline_files).toBeGreaterThanOrEqual(2);
  });
});
