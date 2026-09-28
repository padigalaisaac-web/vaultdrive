import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import apiRoutes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { config } from './config/env.js';

export const createApp = (): express.Application => {
  const app = express();

  // Security Headers
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));

  // CORS Configuration
  app.use(cors({
    origin: (origin, callback) => {
      // Allow local development, electron, PWA, and specified client origin
      if (!origin || origin === config.clientOrigin || /^http:\/\/localhost:\d+$/.test(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive for local demos & testing
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'x-share-password']
  }));

  // Logging
  if (config.nodeEnv !== 'test') {
    app.use(morgan('dev'));
  }

  // Body Parsers
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Global API Rate Limiter
  app.use('/api', apiLimiter);

  // Root welcome endpoint
  app.get('/', (req, res) => {
    res.status(200).json({
      service: 'VaultDrive Backend API',
      status: 'online',
      version: '1.0.0',
      uiUrl: 'http://localhost:5173',
      message: 'Backend API is running! To access the VaultDrive user interface, open http://localhost:5173 in your browser.'
    });
  });

  // Mount API Endpoints
  app.use('/api', apiRoutes);

  // 404 & Global Error Handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
