import { Readable } from 'stream';

export interface FileStorageResult {
  storagePath: string;
  size: number;
  checksum: string;
}

export interface StorageStreamOptions {
  start?: number;
  end?: number;
}

export interface StorageProvider {
  /**
   * Saves a file buffer or stream to the underlying storage engine.
   */
  saveFile(
    userId: string,
    fileId: string,
    category: string,
    filename: string,
    data: Buffer | Readable
  ): Promise<FileStorageResult>;

  /**
   * Retrieves a file as a readable stream with optional byte range support.
   */
  getFileStream(storagePath: string, options?: StorageStreamOptions): Promise<Readable>;

  /**
   * Checks if a file exists at the given storage path.
   */
  exists(storagePath: string): Promise<boolean>;

  /**
   * Gets the file size and metadata from storage.
   */
  getFileSize(storagePath: string): Promise<number>;

  /**
   * Deletes a file permanently from storage.
   */
  deleteFile(storagePath: string): Promise<void>;

  /**
   * Appends or writes a chunk for resumable uploads.
   */
  saveChunk(
    sessionId: string,
    chunkIndex: number,
    chunkBuffer: Buffer
  ): Promise<void>;

  /**
   * Combines uploaded chunks into a finalized storage file.
   */
  assembleChunks(
    sessionId: string,
    totalChunks: number,
    userId: string,
    fileId: string,
    category: string,
    filename: string
  ): Promise<FileStorageResult>;

  /**
   * Cleans up temporary chunk files for a session.
   */
  cleanupSession(sessionId: string): Promise<void>;
}
