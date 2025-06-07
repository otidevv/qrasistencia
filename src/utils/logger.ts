// src/utils/logger.ts
import winston from 'winston';
import path from 'path';

// Definir niveles de log personalizados
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Colores para cada nivel
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Agregar colores a winston
winston.addColors(colors);

// Función helper para obtener timestamp en hora de Perú
const peruTimestamp = () => {
  return new Date().toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

// Formato para desarrollo
const devFormat = winston.format.combine(
  winston.format.timestamp({ 
    format: () => peruTimestamp() // Usar hora de Perú
  }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Formato para producción con hora de Perú
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const peruTime = peruTimestamp();
    return JSON.stringify({
      ...info,
      timestamp: info.timestamp,        // Mantener UTC para compatibilidad
      localTimestamp: peruTime,        // Agregar hora local
      timezone: 'America/Lima'          // Indicar zona horaria
    });
  })
);

// Determinar el nivel de log según el entorno
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Configuración de transports - CORRECCIÓN: especificar el tipo correcto
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'development' ? devFormat : prodFormat,
  }),
];

// En producción, agregar archivo de logs
if (process.env.NODE_ENV === 'production') {
  transports.push(
    // Archivo para errores
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Archivo para todos los logs
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Crear el logger
export const logger = winston.createLogger({
  level: level(),
  levels,
  transports,
});

// Stream para Morgan (HTTP request logger)
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Funciones helper para logging
export const logError = (error: Error, req?: any) => {
  logger.error({
    message: error.message,
    stack: error.stack,
    ...(req && {
      method: req.method,
      url: req.url,
      ip: req.ip,
      user: req.user?.userId,
    }),
  });
};

export const logInfo = (message: string, meta?: any) => {
  logger.info(message, meta);
};

export const logWarning = (message: string, meta?: any) => {
  logger.warn(message, meta);
};

export const logDebug = (message: string, meta?: any) => {
  logger.debug(message, meta);
};

// Logger para auditoría con hora de Perú
export const auditLog = (action: string, userId: string, details?: any) => {
  logger.info({
    type: 'AUDIT',
    action,
    userId,
    timestamp: new Date(),
    localTimestamp: peruTimestamp(),
    timezone: 'America/Lima',
    ...details,
  });
};

// Logger para QR con hora de Perú
export const qrLog = (event: string, sessionId: string, details?: any) => {
  logger.info({
    type: 'QR_EVENT',
    event,
    sessionId,
    timestamp: new Date(),
    localTimestamp: peruTimestamp(),
    timezone: 'America/Lima',
    ...details,
  });
};

// Logger para asistencia con hora de Perú
export const attendanceLog = (event: string, userId: string, sessionId: string, details?: any) => {
  logger.info({
    type: 'ATTENDANCE',
    event,
    userId,
    sessionId,
    timestamp: new Date(),
    localTimestamp: peruTimestamp(),
    timezone: 'America/Lima',
    ...details,
  });
};