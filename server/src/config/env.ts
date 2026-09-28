import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vaultdrive',
  jwtSecret: process.env.JWT_SECRET || 'vaultdrive_super_secure_jwt_secret_key_2026_dev',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  storageProvider: (process.env.STORAGE_PROVIDER || 'local') as 'local' | 's3',
  localStoragePath: path.resolve(process.cwd(), process.env.LOCAL_STORAGE_PATH || './storage'),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  maxUploadSizeBytes: parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || '5368709120', 10), // Default 5GB
  defaultUserQuotaBytes: parseInt(process.env.DEFAULT_USER_QUOTA_BYTES || '10737418240', 10), // Default 10GB
  s3: {
    endpoint: process.env.S3_ENDPOINT || '',
    region: process.env.S3_REGION || 'us-east-1',
    bucket: process.env.S3_BUCKET || 'vaultdrive-storage',
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  }
};
