import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

class DatabaseAdapter {
  private pool: Pool | null = null;
  private isPostgresAvailable: boolean = false;
  private localDbPath: string = path.join(config.localStoragePath, 'vaultdrive_local_db.json');
  private localData: {
    users: any[];
    folders: any[];
    files: any[];
    file_versions: any[];
    shares: any[];
    sync_operations: any[];
    upload_sessions: any[];
  } = {
    users: [],
    folders: [],
    files: [],
    file_versions: [],
    shares: [],
    sync_operations: [],
    upload_sessions: []
  };

  async init(): Promise<void> {
    if (!fs.existsSync(config.localStoragePath)) {
      fs.mkdirSync(config.localStoragePath, { recursive: true });
    }

    try {
      this.pool = new Pool({
        connectionString: config.databaseUrl,
        connectionTimeoutMillis: 1500,
        idleTimeoutMillis: 5000,
      });

      const client = await this.pool.connect();
      console.log('✅ Connected to PostgreSQL database.');
      this.isPostgresAvailable = true;

      const candidatePaths = [
        path.resolve(__dirname, 'schema.sql'),
        path.resolve(process.cwd(), 'src/db/schema.sql'),
        path.resolve(process.cwd(), 'server/src/db/schema.sql')
      ];
      const schemaPath = candidatePaths.find(p => fs.existsSync(p));
      if (schemaPath) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await client.query(schemaSql);
        console.log('✅ PostgreSQL Schema initialized from ' + schemaPath);
      }
      client.release();
    } catch (err: any) {
      this.isPostgresAvailable = false;
      this.loadLocalData();
    }
  }

  private loadLocalData() {
    try {
      if (fs.existsSync(this.localDbPath)) {
        const raw = fs.readFileSync(this.localDbPath, 'utf8').trim();
        if (raw) {
          this.localData = JSON.parse(raw);
        } else {
          this.saveLocalData();
        }
      } else {
        this.saveLocalData();
      }
    } catch (e) {
      this.saveLocalData();
    }
  }

  private saveLocalData() {
    try {
      fs.writeFileSync(this.localDbPath, JSON.stringify(this.localData, null, 2), 'utf8');
    } catch (e) {
      // Ignored
    }
  }

  async query<T = any>(sqlText: string, params: any[] = []): Promise<QueryResult<T>> {
    if (this.isPostgresAvailable && this.pool) {
      const res = await this.pool.query(sqlText, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rowCount ?? res.rows.length
      };
    }

    return this.executeLocalQuery<T>(sqlText, params);
  }

  private executeLocalQuery<T = any>(sql: string, params: any[] = []): QueryResult<T> {
    const cleanSql = sql.trim().replace(/\s+/g, ' ');

    // USERS
    if (/INSERT INTO users/i.test(cleanSql)) {
      const user = {
        id: params[0],
        email: params[1],
        name: params[2],
        password_hash: params[3],
        storage_quota: params[4] || 10737418240,
        used_storage: params[5] || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.localData.users.push(user);
      this.saveLocalData();
      return { rows: [user as unknown as T], rowCount: 1 };
    }

    if (/SELECT .* FROM users WHERE email\s*=\s*\$1/i.test(cleanSql)) {
      const email = params[0]?.toLowerCase();
      const user = this.localData.users.find(u => u.email.toLowerCase() === email);
      return { rows: user ? [user as unknown as T] : [], rowCount: user ? 1 : 0 };
    }

    if (/SELECT .* FROM users WHERE id\s*=\s*\$1/i.test(cleanSql)) {
      const id = params[0];
      const user = this.localData.users.find(u => u.id === id);
      return { rows: user ? [user as unknown as T] : [], rowCount: user ? 1 : 0 };
    }

    if (/UPDATE users SET name = \$1/i.test(cleanSql)) {
      const name = params[0];
      const id = params[1];
      const user = this.localData.users.find(u => u.id === id);
      if (user) {
        user.name = name;
        user.updated_at = new Date().toISOString();
        this.saveLocalData();
      }
      return { rows: user ? [user as unknown as T] : [], rowCount: user ? 1 : 0 };
    }

    if (/UPDATE users SET password_hash = \$1/i.test(cleanSql)) {
      const hash = params[0];
      const id = params[1];
      const user = this.localData.users.find(u => u.id === id);
      if (user) {
        user.password_hash = hash;
        user.updated_at = new Date().toISOString();
        this.saveLocalData();
      }
      return { rows: user ? [user as unknown as T] : [], rowCount: user ? 1 : 0 };
    }

    if (/UPDATE users SET used_storage/i.test(cleanSql)) {
      const isDeltaAdd = /used_storage \+ \$1/i.test(cleanSql);
      const isDeltaSub = /used_storage - \$1/i.test(cleanSql);
      const amount = Number(params[0]);
      const id = params[1];
      const user = this.localData.users.find(u => u.id === id);
      if (user) {
        if (isDeltaAdd) {
          user.used_storage = Number(user.used_storage || 0) + amount;
        } else if (isDeltaSub) {
          user.used_storage = Math.max(0, Number(user.used_storage || 0) - amount);
        } else {
          user.used_storage = amount;
        }
        user.updated_at = new Date().toISOString();
        this.saveLocalData();
      }
      return { rows: user ? [user as unknown as T] : [], rowCount: user ? 1 : 0 };
    }

    // FOLDERS
    if (/INSERT INTO folders/i.test(cleanSql)) {
      const folder = {
        id: params[0],
        user_id: params[1],
        parent_id: params[2] || null,
        name: params[3],
        color: params[4] || '#0c8ee9',
        is_favorite: Boolean(params[5]),
        is_deleted: false,
        deleted_at: null,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.localData.folders.push(folder);
      this.saveLocalData();
      return { rows: [folder as unknown as T], rowCount: 1 };
    }

    if (/SELECT .* FROM folders WHERE id = \$1 AND user_id = \$2/i.test(cleanSql)) {
      const id = params[0];
      const userId = params[1];
      let folder = this.localData.folders.find(f => f.id === id && f.user_id === userId);
      if (folder && /is_deleted = false/i.test(cleanSql) && folder.is_deleted) {
        folder = undefined;
      }
      if (folder && /is_deleted = true/i.test(cleanSql) && !folder.is_deleted) {
        folder = undefined;
      }
      return { rows: folder ? [folder as unknown as T] : [], rowCount: folder ? 1 : 0 };
    }

    if (/SELECT .* FROM folders WHERE id = \$1/i.test(cleanSql)) {
      const id = params[0];
      const folder = this.localData.folders.find(f => f.id === id);
      return { rows: folder ? [folder as unknown as T] : [], rowCount: folder ? 1 : 0 };
    }

    if (/SELECT .* FROM folders WHERE user_id = \$1/i.test(cleanSql)) {
      const userId = params[0];
      let rows = this.localData.folders.filter(f => f.user_id === userId);
      if (/is_deleted = false/i.test(cleanSql)) {
        rows = rows.filter(f => !f.is_deleted);
      } else if (/is_deleted = true/i.test(cleanSql)) {
        rows = rows.filter(f => f.is_deleted);
      }
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    if (/UPDATE folders SET/i.test(cleanSql)) {
      const idParam = params.find(p => this.localData.folders.some(f => f.id === p));
      const folder = this.localData.folders.find(f => f.id === idParam);
      if (folder) {
        if (/is_deleted = true/i.test(cleanSql)) {
          folder.is_deleted = true;
          folder.deleted_at = new Date().toISOString();
        } else if (/is_deleted = false/i.test(cleanSql)) {
          folder.is_deleted = false;
          folder.deleted_at = null;
        }
        if (/name = \$1/i.test(cleanSql)) folder.name = params[0];
        if (/color = \$2/i.test(cleanSql)) folder.color = params[1];
        if (/is_favorite = \$3/i.test(cleanSql)) folder.is_favorite = params[2];
        if (/parent_id = \$4/i.test(cleanSql)) folder.parent_id = params[3];
        folder.version = (folder.version || 1) + 1;
        folder.updated_at = new Date().toISOString();
        this.saveLocalData();
        return { rows: [folder as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (/DELETE FROM folders WHERE/i.test(cleanSql)) {
      const id = params[0];
      const prevLen = this.localData.folders.length;
      if (/user_id = \$1 AND is_deleted = true/i.test(cleanSql)) {
        this.localData.folders = this.localData.folders.filter(f => !(f.user_id === id && f.is_deleted));
      } else {
        this.localData.folders = this.localData.folders.filter(f => f.id !== id);
      }
      this.saveLocalData();
      return { rows: [], rowCount: prevLen - this.localData.folders.length };
    }

    // FILES
    if (/INSERT INTO files/i.test(cleanSql)) {
      const file = {
        id: params[0],
        user_id: params[1],
        folder_id: params[2] || null,
        name: params[3],
        original_name: params[4],
        mime_type: params[5],
        size: Number(params[6]),
        extension: params[7],
        storage_path: params[8],
        storage_provider: params[9] || 'local',
        checksum: params[10],
        category: params[11] || 'other',
        is_favorite: Boolean(params[12]),
        is_offline: Boolean(params[13]),
        is_deleted: false,
        deleted_at: null,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.localData.files.push(file);
      this.saveLocalData();
      return { rows: [file as unknown as T], rowCount: 1 };
    }

    if (/SELECT .* FROM files WHERE id = \$1 AND user_id = \$2/i.test(cleanSql)) {
      const id = params[0];
      const userId = params[1];
      let file = this.localData.files.find(f => f.id === id && f.user_id === userId);
      if (file && /is_deleted = false/i.test(cleanSql) && file.is_deleted) {
        file = undefined;
      }
      if (file && /is_deleted = true/i.test(cleanSql) && !file.is_deleted) {
        file = undefined;
      }
      return { rows: file ? [file as unknown as T] : [], rowCount: file ? 1 : 0 };
    }

    if (/SELECT .* FROM files WHERE id = \$1/i.test(cleanSql)) {
      const id = params[0];
      let file = this.localData.files.find(f => f.id === id);
      if (file && /is_deleted = false/i.test(cleanSql) && file.is_deleted) {
        file = undefined;
      }
      return { rows: file ? [file as unknown as T] : [], rowCount: file ? 1 : 0 };
    }

    if (/SELECT .* FROM files WHERE user_id = \$1/i.test(cleanSql)) {
      const userId = params[0];
      let rows = this.localData.files.filter(f => f.user_id === userId);
      if (/is_deleted = false/i.test(cleanSql)) {
        rows = rows.filter(f => !f.is_deleted);
      } else if (/is_deleted = true/i.test(cleanSql)) {
        rows = rows.filter(f => f.is_deleted);
      }
      if (/checksum = \$2/i.test(cleanSql)) {
        const checksum = params[1];
        rows = rows.filter(f => f.checksum === checksum);
      }
      return { rows: rows as unknown as T[], rowCount: rows.length };
    }

    if (/UPDATE files SET/i.test(cleanSql)) {
      const idParam = params.find(p => this.localData.files.some(f => f.id === p));
      const file = this.localData.files.find(f => f.id === idParam);
      if (file) {
        if (/is_deleted = true/i.test(cleanSql)) {
          file.is_deleted = true;
          file.deleted_at = new Date().toISOString();
        } else if (/is_deleted = false/i.test(cleanSql)) {
          file.is_deleted = false;
          file.deleted_at = null;
        }
        if (/name = \$1/i.test(cleanSql)) file.name = params[0];
        if (/folder_id = \$2/i.test(cleanSql)) file.folder_id = params[1] || null;
        if (/is_favorite = \$3/i.test(cleanSql)) file.is_favorite = Boolean(params[2]);
        if (/is_offline = \$4/i.test(cleanSql)) file.is_offline = Boolean(params[3]);
        file.version = (file.version || 1) + 1;
        file.updated_at = new Date().toISOString();
        this.saveLocalData();
        return { rows: [file as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (/DELETE FROM files WHERE/i.test(cleanSql)) {
      const id = params[0];
      const prevLen = this.localData.files.length;
      if (/user_id = \$1 AND is_deleted = true/i.test(cleanSql)) {
        this.localData.files = this.localData.files.filter(f => !(f.user_id === id && f.is_deleted));
      } else {
        this.localData.files = this.localData.files.filter(f => f.id !== id);
      }
      this.saveLocalData();
      return { rows: [], rowCount: prevLen - this.localData.files.length };
    }

    // SHARES
    if (/INSERT INTO shares/i.test(cleanSql)) {
      const share = {
        id: params[0],
        user_id: params[1],
        file_id: params[2] || null,
        folder_id: params[3] || null,
        share_token: params[4],
        password_hash: params[5] || null,
        expires_at: params[6] || null,
        allow_download: params[7] !== undefined ? Boolean(params[7]) : true,
        access_count: 0,
        created_at: new Date().toISOString()
      };
      this.localData.shares.push(share);
      this.saveLocalData();
      return { rows: [share as unknown as T], rowCount: 1 };
    }

    if (/SELECT .* FROM shares WHERE share_token = \$1/i.test(cleanSql)) {
      const token = params[0];
      const share = this.localData.shares.find(s => s.share_token === token);
      return { rows: share ? [share as unknown as T] : [], rowCount: share ? 1 : 0 };
    }

    if (/SELECT .* FROM shares WHERE user_id = \$1/i.test(cleanSql)) {
      const userId = params[0];
      const shares = this.localData.shares.filter(s => s.user_id === userId);
      return { rows: shares as unknown as T[], rowCount: shares.length };
    }

    if (/DELETE FROM shares WHERE id = \$1/i.test(cleanSql)) {
      const id = params[0];
      const prevLen = this.localData.shares.length;
      this.localData.shares = this.localData.shares.filter(s => s.id !== id);
      this.saveLocalData();
      return { rows: [], rowCount: prevLen - this.localData.shares.length };
    }

    // SYNC OPERATIONS
    if (/INSERT INTO sync_operations/i.test(cleanSql)) {
      const op = {
        id: params[0],
        user_id: params[1],
        device_id: params[2],
        operation_type: params[3],
        entity_type: params[4],
        entity_id: params[5],
        payload: params[6],
        version: params[7],
        client_timestamp: params[8],
        server_timestamp: new Date().toISOString()
      };
      this.localData.sync_operations.push(op);
      this.saveLocalData();
      return { rows: [op as unknown as T], rowCount: 1 };
    }

    // UPLOAD SESSIONS
    if (/INSERT INTO upload_sessions/i.test(cleanSql)) {
      const session = {
        id: params[0],
        user_id: params[1],
        folder_id: params[2] || null,
        filename: params[3],
        total_size: Number(params[4]),
        total_chunks: Number(params[5]),
        uploaded_chunks: params[6] || [],
        chunk_size: Number(params[7]),
        checksum: params[8],
        temp_path: params[9],
        created_at: new Date().toISOString(),
        expires_at: params[10] || new Date(Date.now() + 24 * 3600 * 1000).toISOString()
      };
      this.localData.upload_sessions.push(session);
      this.saveLocalData();
      return { rows: [session as unknown as T], rowCount: 1 };
    }

    if (/SELECT .* FROM upload_sessions WHERE id = \$1/i.test(cleanSql)) {
      const id = params[0];
      const s = this.localData.upload_sessions.find(x => x.id === id);
      return { rows: s ? [s as unknown as T] : [], rowCount: s ? 1 : 0 };
    }

    if (/UPDATE upload_sessions/i.test(cleanSql)) {
      const id = params[1] || params[0];
      const s = this.localData.upload_sessions.find(x => x.id === id);
      if (s) {
        if (params[0] && Array.isArray(params[0])) {
          s.uploaded_chunks = params[0];
        }
        this.saveLocalData();
        return { rows: [s as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (/DELETE FROM upload_sessions WHERE id = \$1/i.test(cleanSql)) {
      const id = params[0];
      this.localData.upload_sessions = this.localData.upload_sessions.filter(x => x.id !== id);
      this.saveLocalData();
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

export const db = new DatabaseAdapter();
