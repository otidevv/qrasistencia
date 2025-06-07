// src/app.ts
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { corsOptions } from './config/cors';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { generalLimiter } from './middlewares/rateLimit.middleware';
import { stream } from './utils/logger';
import routes from './routes';

// Create Express app
const app: Application = express();

// ==================== SECURITY MIDDLEWARES ====================
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
  crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production'
}));

// ==================== CORS ====================
app.use(cors(corsOptions));

// ==================== COMPRESSION ====================
app.use(compression());

// ==================== LOGGING ====================
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream }));
}

// ==================== RATE LIMITING ====================
app.use(generalLimiter);

// ==================== BODY PARSING ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==================== STATIC FILES (if needed) ====================
// app.use('/uploads', express.static('uploads'));

// ==================== API ROUTES ====================
app.use('/api', routes);

// ==================== ROOT ROUTE ====================
app.get('/', (req, res) => {
  res.json({
    message: 'QR Attendance System API',
    version: process.env.API_VERSION || '1.0.0',
    documentation: '/api/docs',
    health: '/api/health'
  });
});

// ==================== ERROR HANDLING ====================
// 404 handler (debe estar antes del error handler)
app.use(notFoundHandler);

// General error handler (debe ser el último middleware)
app.use(errorHandler);

export default app;