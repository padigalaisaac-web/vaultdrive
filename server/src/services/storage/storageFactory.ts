import { StorageProvider } from './StorageProvider.js';
import { LocalStorageProvider } from './LocalStorageProvider.js';
import { S3StorageProvider } from './S3StorageProvider.js';
import { config } from '../../config/env.js';

let storageInstance: StorageProvider | null = null;

export const getStorageProvider = (): StorageProvider => {
  if (storageInstance) {
    return storageInstance;
  }

  if (config.storageProvider === 's3') {
    console.log('📦 Using S3 Storage Provider.');
    storageInstance = new S3StorageProvider();
  } else {
    console.log(`📁 Using Local Filesystem Storage Provider at ${config.localStoragePath}.`);
    storageInstance = new LocalStorageProvider();
  }

  return storageInstance;
};
