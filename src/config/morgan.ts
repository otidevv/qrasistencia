// src/config/morgan.ts
import morgan from 'morgan';
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { logger, stream } from '../utils/logger';

// Crear directorio de logs si no existe
const logDirectory = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

// Custom tokens para Morgan
morgan.token('user-id', (req: Request) => req.user?.userId || 'anonymous');
morgan.token('user-role', (req: Request) => req.user?.role || 'guest');
morgan.token('request-id', (req: Request) => req.headers['x-request-id'] as string || '-');

// Formato personalizado para desarrollo
const devFormat = ':method :url :status :response-time ms - :res[content-length]';

// Formato personalizado para producción
const prodFormat = ':remote-addr - :user-id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms';

// Formato personalizado para QR scans
const qrFormat = ':date[iso] :user-id :user-role "QR_SCAN :url" :status :response-time ms';

// Configuración para desarrollo
export const morganDev = morgan(devFormat, {
  stream,
  skip: (req: Request) => req.path === '/api/health' // Skip health checks
});

// Configuración para producción
export const morganProd = morgan(prodFormat, {
  stream,
  skip: (req: Request, res: Response) => {
    // Skip health checks y requests exitosos
    return req.path === '/api/health' || res.statusCode < 400;
  }
});

// Logger específico para rutas de QR
export const morganQR = morgan(qrFormat, {
  stream,
  skip: (req: Request) => !req.path.includes('/attendance/scan')
});

// Logger para escribir en archivo
export const morganFile = morgan('combined', {
  stream: fs.createWriteStream(path.join(logDirectory, 'access.log'), { flags: 'a' })
});

// Función para obtener el middleware correcto según el entorno
export const getMorganMiddleware = () => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return morganProd;
    case 'test':
      return morgan('tiny', { stream }); // Minimal para tests
    default:
      return morganDev;
  }
};

// Middleware personalizado para logging detallado
export const detailedLogger = (req: Request, res: Response, next: Function) => {
  const start = Date.now();
  
  // Log de request
  logger.http(`Incoming ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    user: req.user?.userId,
    body: req.method !== 'GET' ? req.body : undefined
  });
  
  // Interceptar response
  const originalSend = res.send;
  res.send = function(data: any) {
    const duration = Date.now() - start;
    
    // Log de response
    logger.http(`Response ${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      user: req.user?.userId
    });
    
    return originalSend.call(this, data);
  };
  
  next();
};