import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  CompletedPart
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import crypto from 'crypto';
import { StorageProvider, FileStorageResult, StorageStreamOptions } from './StorageProvider.js';
import { sanitizeFilename } from '../../utils/pathSanitizer.js';
import { config } from '../../config/env.js';

export class S3StorageProvider implements StorageProvider {
  private s3: S3Client;
  private bucket: string;
  private multipartSessions: Map<string, { uploadId: string; key: string; parts: CompletedPart[] }> = new Map();

  constructor() {
    this.bucket = config.s3.bucket;
    this.s3 = new S3Client({
      region: config.s3.region,
      endpoint: config.s3.endpoint || undefined,
      forcePathStyle: config.s3.forcePathStyle,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      }
    });
  }

  async saveFile(
    userId: string,
    fileId: string,
    category: string,
    filename: string,
    data: Buffer | Readable
  ): Promise<FileStorageResult> {
    const safeCat = sanitizeFilename(category || 'other');
    const safeName = sanitizeFilename(filename);
    const key = `users/${userId}/${safeCat}/${fileId}_${safeName}`;

    let buffer: Buffer;
    if (Buffer.isBuffer(data)) {
      buffer = data;
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of data) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      buffer = Buffer.concat(chunks);
    }

    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        Metadata: {
          checksum,
          originalName: encodeURIComponent(filename)
        }
      })
    );

    return {
      storagePath: key,
      size: buffer.length,
      checksum
    };
  }

  async getFileStream(storagePath: string, options?: StorageStreamOptions): Promise<Readable> {
    let range: string | undefined;
    if (options?.start !== undefined || options?.end !== undefined) {
      range = `bytes=${options.start ?? 0}-${options.end ?? ''}`;
    }

    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
        Range: range
      })
    );

    if (!response.Body) {
      throw new Error(`Empty body returned for S3 object: ${storagePath}`);
    }

    return response.Body as Readable;
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: storagePath
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  async getFileSize(storagePath: string): Promise<number> {
    const response = await this.s3.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: storagePath
      })
    );
    return response.ContentLength || 0;
  }

  async deleteFile(storagePath: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: storagePath
        })
      );
    } catch (e) {
      console.warn(`Failed to delete S3 file ${storagePath}:`, e);
    }
  }

  async saveChunk(sessionId: string, chunkIndex: number, chunkBuffer: Buffer): Promise<void> {
    let session = this.multipartSessions.get(sessionId);
    if (!session) {
      const key = `temp_multipart/${sessionId}`;
      const initRes = await this.s3.send(
        new CreateMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key
        })
      );
      session = {
        uploadId: initRes.UploadId!,
        key,
        parts: []
      };
      this.multipartSessions.set(sessionId, session);
    }

    const partNumber = chunkIndex + 1;
    const uploadPartRes = await this.s3.send(
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: session.key,
        UploadId: session.uploadId,
        PartNumber: partNumber,
        Body: chunkBuffer
      })
    );

    session.parts.push({
      PartNumber: partNumber,
      ETag: uploadPartRes.ETag
    });
  }

  async assembleChunks(
    sessionId: string,
    _totalChunks: number,
    userId: string,
    fileId: string,
    category: string,
    filename: string
  ): Promise<FileStorageResult> {
    const session = this.multipartSessions.get(sessionId);
    if (!session) {
      throw new Error(`Multipart session not found: ${sessionId}`);
    }

    session.parts.sort((a, b) => (a.PartNumber || 0) - (b.PartNumber || 0));

    await this.s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: session.key,
        UploadId: session.uploadId,
        MultipartUpload: {
          Parts: session.parts
        }
      })
    );

    const safeCat = sanitizeFilename(category || 'other');
    const safeName = sanitizeFilename(filename);
    const targetKey = `users/${userId}/${safeCat}/${fileId}_${safeName}`;

    // Get metadata and calculate checksum
    const head = await this.s3.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: session.key
      })
    );

    this.multipartSessions.delete(sessionId);

    return {
      storagePath: session.key,
      size: head.ContentLength || 0,
      checksum: head.ETag?.replace(/"/g, '') || ''
    };
  }

  async cleanupSession(sessionId: string): Promise<void> {
    const session = this.multipartSessions.get(sessionId);
    if (session) {
      try {
        await this.s3.send(
          new AbortMultipartUploadCommand({
            Bucket: this.bucket,
            Key: session.key,
            UploadId: session.uploadId
          })
        );
      } catch (e) {
        console.warn(`Failed to abort S3 multipart upload ${sessionId}:`, e);
      }
      this.multipartSessions.delete(sessionId);
    }
  }
}
