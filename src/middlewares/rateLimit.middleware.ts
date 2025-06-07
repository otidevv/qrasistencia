// src/middlewares/rateLimit.middleware.ts
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';

// Rate limiter general para todas las rutas
export const generalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite de 100 requests por ventana
  message: 'Demasiadas peticiones desde esta IP, por favor intente más tarde',
  standardHeaders: true, // Retorna rate limit info en headers `RateLimit-*`
  legacyHeaders: false, // Deshabilita headers `X-RateLimit-*`
  skip: (req: Request) => {
    // Skip rate limiting para IPs en whitelist
    const whitelist = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];
    const clientIp = req.ip || req.socket.remoteAddress || '';
    return whitelist.includes(clientIp);
  },
});

// Rate limiter estricto para autenticación
export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 intentos de login
  message: 'Demasiados intentos de login, por favor intente en 15 minutos',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // No contar requests exitosos
});

// Rate limiter para registro
export const registerLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // Máximo 3 registros por hora
  message: 'Demasiados registros desde esta IP, por favor intente más tarde',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para escaneo de QR
export const qrScanLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // Máximo 10 escaneos por minuto
  message: 'Demasiados escaneos de QR, por favor espere un momento',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Usar userId si está autenticado, sino usar IP
    return req.user?.userId || req.ip || req.socket.remoteAddress || 'anonymous';
  },
});

// Rate limiter para reportes (costosos en recursos)
export const reportLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 5, // Máximo 5 reportes cada 5 minutos
  message: 'Demasiadas solicitudes de reportes, por favor espere',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter personalizado basado en rol
export const createRoleLimiter = (limits: { [role: string]: number }) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: (req: Request) => {
      const userRole = req.user?.role || 'guest';
      return limits[userRole] || limits.default || 50;
    },
    message: 'Límite de peticiones excedido para su rol',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return req.user?.userId || req.ip || req.socket.remoteAddress || 'anonymous';
    },
  });
};

// Ejemplo de uso del rate limiter por rol
export const apiLimiterByRole = createRoleLimiter({
  ADMIN: 1000,      // Admins: 1000 requests por ventana
  JEFE_LAB: 500,    // Jefes de lab: 500 requests
  DOCENTE: 200,     // Docentes: 200 requests
  ESTUDIANTE: 100,  // Estudiantes: 100 requests
  default: 50       // No autenticados: 50 requests
});

// Middleware para manejar respuestas cuando se excede el límite
export const rateLimitHandler = (req: Request, res: Response): void => {
  res.status(429).json({
    success: false,
    error: {
      message: 'Demasiadas peticiones',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: res.getHeader('Retry-After')
    }
  });
};