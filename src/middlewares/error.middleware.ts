// src/middlewares/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Interfaz para errores personalizados
export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

// Clase base para errores de la aplicación
export class AppError extends Error implements CustomError {
  statusCode: number;
  code?: string;
  details?: any;

  constructor(message: string, statusCode: number, code?: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Errores específicos de la aplicación
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'No autenticado') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'No autorizado') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} no encontrado`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Demasiadas solicitudes') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

// Middleware para manejar errores async
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Middleware para manejar errores de Prisma
const handlePrismaError = (error: any): AppError => {
  switch (error.code) {
    case 'P2002':
      // Error de valor único duplicado
      const field = error.meta?.target?.[0] || 'campo';
      return new ConflictError(`El ${field} ya está registrado`);
    
    case 'P2003':
      // Error de clave foránea
      return new ValidationError('Referencia a registro inválida');
    
    case 'P2025':
      // Registro no encontrado
      return new NotFoundError('Registro');
    
    case 'P2016':
      // Error de consulta
      return new ValidationError('Error en la consulta');
    
    default:
      return new AppError('Error en la base de datos', 500, 'DATABASE_ERROR');
  }
};

// Middleware para manejar errores de JWT
const handleJWTError = (error: any): AppError => {
  switch (error.name) {
    case 'JsonWebTokenError':
      return new AuthenticationError('Token inválido');
    
    case 'TokenExpiredError':
      return new AuthenticationError('Token expirado');
    
    default:
      return new AuthenticationError('Error de autenticación');
  }
};

// Middleware principal de manejo de errores
export const errorHandler = (
  error: Error | CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let customError: CustomError = error;

  // Manejar errores específicos
  if (error.name === 'PrismaClientKnownRequestError') {
    customError = handlePrismaError(error);
  } else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    customError = handleJWTError(error);
  } else if (error.name === 'ValidationError' && 'details' in error) {
    // Error de Joi
    customError = new ValidationError('Error de validación', error.details);
  } else if (!(error instanceof AppError)) {
    // Error genérico no manejado
    customError = new AppError(
      'Error interno del servidor',
      500,
      'INTERNAL_SERVER_ERROR'
    );
  }

  // Asegurar que statusCode tenga un valor por defecto
  const statusCode = customError.statusCode || 500;

  // Log del error
  if (statusCode >= 500) {
    logger.error(`Error ${statusCode}: ${customError.message}`, {
      statusCode: statusCode,
      code: customError.code,
      stack: customError.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
      user: req.user?.userId
    });
  } else {
    logger.warn(`Warning ${statusCode}: ${customError.message}`, {
      statusCode: statusCode,
      code: customError.code,
      path: req.path,
      method: req.method,
      user: req.user?.userId
    });
  }

  // Respuesta al cliente
  res.status(statusCode).json({
    success: false,
    error: {
      message: customError.message,
      code: customError.code,
      ...(process.env.NODE_ENV === 'development' && {
        details: customError.details,
        stack: customError.stack
      })
    },
    timestamp: new Date().toISOString(),
    path: req.path
  });
};

// Middleware para manejar rutas no encontradas
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new NotFoundError(`Ruta ${req.path}`);
  next(error);
};