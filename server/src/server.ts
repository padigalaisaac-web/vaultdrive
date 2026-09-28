import { createApp } from './app.js';
import { db } from './db/dbAdapter.js';
import { config } from './config/env.js';

const startServer = async () => {
  try {
    // Initialize Database connection & migrations
    await db.init();

    const app = createApp();

    const server = app.listen(config.port, () => {
      console.log(`
=====================================================
🚀 VaultDrive Server running on http://localhost:${config.port}
🔒 Environment: ${config.nodeEnv}
💾 Storage Provider: ${config.storageProvider.toUpperCase()}
🗄️ Database: Connected
=====================================================
      `);
    });

    // Graceful shutdown handling
    const shutdown = async () => {
      console.log('Shutting down server gracefully...');
      server.close(async () => {
        await db.close();
        console.log('Server and database connections closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('❌ Failed to start VaultDrive server:', error);
    process.exit(1);
  }
};

startServer();
