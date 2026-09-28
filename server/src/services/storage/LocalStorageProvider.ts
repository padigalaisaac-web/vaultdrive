import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable, pipeline } from 'stream';
import { promisify } from 'util';
import { StorageProvider, FileStorageResult, StorageStreamOptions } from './StorageProvider.js';
import { resolveSafePath, sanitizeFilename } from '../../utils/pathSanitizer.js';
import { config } from '../../config/env.js';

const streamPipeline = promisify(pipeline);

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;
  private tempDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || config.localStoragePath;
    this.tempDir = path.join(this.baseDir, 'temp_chunks');

    // Ensure base and temp directories exist
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
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
    const userFolder = resolveSafePath(this.baseDir, 'users', userId, safeCat);

    if (!fs.existsSync(userFolder)) {
      fs.mkdirSync(userFolder, { recursive: true });
    }

    const targetFilename = `${fileId}_${safeName}`;
    const targetPath = resolveSafePath(userFolder, targetFilename);
    const relativeStoragePath = path.join('users', userId, safeCat, targetFilename).replace(/\\/g, '/');

    const hash = crypto.createHash('sha256');
    let totalSize = 0;

    if (Buffer.isBuffer(data)) {
      hash.update(data);
      totalSize = data.length;
      await fs.promises.writeFile(targetPath, data);
    } else {
      const writeStream = fs.createWriteStream(targetPath);
      data.on('data', (chunk) => {
        hash.update(chunk);
        totalSize += chunk.length;
      });
      await streamPipeline(data, writeStream);
    }

    const checksum = hash.digest('hex');

    return {
      storagePath: relativeStoragePath,
      size: totalSize,
      checksum
    };
  }

  async getFileStream(storagePath: string, options?: StorageStreamOptions): Promise<Readable> {
    const fullPath = resolveSafePath(this.baseDir, storagePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found on storage: ${storagePath}`);
    }

    const streamOpts: { start?: number; end?: number } = {};
    if (options?.start !== undefined) streamOpts.start = options.start;
    if (options?.end !== undefined) streamOpts.end = options.end;

    return fs.createReadStream(fullPath, streamOpts);
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      const fullPath = resolveSafePath(this.baseDir, storagePath);
      return fs.existsSync(fullPath);
    } catch {
      return false;
    }
  }

  async getFileSize(storagePath: string): Promise<number> {
    const fullPath = resolveSafePath(this.baseDir, storagePath);
    const stats = await fs.promises.stat(fullPath);
    return stats.size;
  }

  async deleteFile(storagePath: string): Promise<void> {
    try {
      const fullPath = resolveSafePath(this.baseDir, storagePath);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }
    } catch (e) {
      console.warn(`Failed to delete file from storage: ${storagePath}`, e);
    }
  }

  async saveChunk(sessionId: string, chunkIndex: number, chunkBuffer: Buffer): Promise<void> {
    const sessionDir = resolveSafePath(this.tempDir, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    const chunkPath = resolveSafePath(sessionDir, `chunk_${chunkIndex.toString().padStart(6, '0')}`);
    await fs.promises.writeFile(chunkPath, chunkBuffer);
  }

  async assembleChunks(
    sessionId: string,
    totalChunks: number,
    userId: string,
    fileId: string,
    category: string,
    filename: string
  ): Promise<FileStorageResult> {
    const sessionDir = resolveSafePath(this.tempDir, sessionId);
    const safeCat = sanitizeFilename(category || 'other');
    const safeName = sanitizeFilename(filename);
    const userFolder = resolveSafePath(this.baseDir, 'users', userId, safeCat);

    if (!fs.existsSync(userFolder)) {
      fs.mkdirSync(userFolder, { recursive: true });
    }

    const targetFilename = `${fileId}_${safeName}`;
    const targetPath = resolveSafePath(userFolder, targetFilename);
    const relativeStoragePath = path.join('users', userId, safeCat, targetFilename).replace(/\\/g, '/');

    const writeStream = fs.createWriteStream(targetPath);
    const hash = crypto.createHash('sha256');
    let totalSize = 0;

    for (let i = 0; i < totalChunks; i++) {
      const chunkFile = resolveSafePath(sessionDir, `chunk_${i.toString().padStart(6, '0')}`);
      if (!fs.existsSync(chunkFile)) {
        writeStream.close();
        await fs.promises.unlink(targetPath).catch(() => {});
        throw new Error(`Missing chunk ${i} during assembly.`);
      }

      const chunkBuffer = await fs.promises.readFile(chunkFile);
      hash.update(chunkBuffer);
      totalSize += chunkBuffer.length;
      
      const canContinue = writeStream.write(chunkBuffer);
      if (!canContinue) {
        await new Promise<void>((resolve) => writeStream.once('drain', () => resolve()));
      }
    }

    writeStream.end();
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });

    const checksum = hash.digest('hex');

    // Clean up temporary chunks
    await this.cleanupSession(sessionId);

    return {
      storagePath: relativeStoragePath,
      size: totalSize,
      checksum
    };
  }

  async cleanupSession(sessionId: string): Promise<void> {
    try {
      const sessionDir = resolveSafePath(this.tempDir, sessionId);
      if (fs.existsSync(sessionDir)) {
        await fs.promises.rm(sessionDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn(`Failed to clean up upload session ${sessionId}:`, e);
    }
  }
}
