// src/config/server.ts
import { Express } from 'express';
import { Server } from 'http';
import { logger } from '../utils/logger';

// Configuración del servidor
export const serverConfig = {
  // Puerto
  port: parseInt(process.env.PORT || '3000', 10),
  
  // Host
  host: process.env.HOST || '0.0.0.0',
  
  // Entorno
  env: process.env.NODE_ENV || 'development',
  
  // API
  api: {
    prefix: process.env.API_PREFIX || '/api',
    version: process.env.API_VERSION || 'v1',
  },
  
  // Timeouts
  timeout: {
    server: parseInt(process.env.SERVER_TIMEOUT || '120000'), // 2 minutos
    keepAlive: parseInt(process.env.KEEP_ALIVE_TIMEOUT || '65000'),
    headers: parseInt(process.env.HEADERS_TIMEOUT || '65000'),
  },
  
  // Límites
  limits: {
    bodySize: process.env.BODY_SIZE_LIMIT || '10mb',
    fileSize: process.env.FILE_SIZE_LIMIT || '5mb',
    parameterLimit: parseInt(process.env.PARAMETER_LIMIT || '1000'),
  },
  
  // Compresión
  compression: {
    enabled: process.env.COMPRESSION_ENABLED !== 'false',
    level: parseInt(process.env.COMPRESSION_LEVEL || '6'),
    threshold: process.env.COMPRESSION_THRESHOLD || '1kb',
  },
};

// Función para configurar timeouts del servidor
export const configureServerTimeouts = (server: Server): void => {
  server.timeout = serverConfig.timeout.server;
  server.keepAliveTimeout = serverConfig.timeout.keepAlive;
  server.headersTimeout = serverConfig.timeout.headers;
};

// Función para manejar señales de terminación
export const setupGracefulShutdown = (server: Server, cleanup: () => Promise<void>): void => {
  let isShuttingDown = false;

  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`${signal} received. Starting graceful shutdown...`);

    // Dejar de aceptar nuevas conexiones
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        // Ejecutar limpieza (cerrar DB, etc.)
        await cleanup();
        logger.info('Cleanup completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during cleanup:', error);
        process.exit(1);
      }
    });

    // Forzar cierre después de 30 segundos
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  // Escuchar señales
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

// Función para manejar errores no capturados
export const setupErrorHandlers = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
};

// Información del servidor para health checks
export const getServerInfo = () => ({
  name: process.env.APP_NAME || 'QR Attendance System',
  version: process.env.APP_VERSION || '1.0.0',
  environment: serverConfig.env,
  node: process.version,
  uptime: process.uptime(),
  memory: process.memoryUsage(),
  timestamp: new Date().toISOString(),
});

// Configuración de clustering (opcional)
export const clusterConfig = {
  enabled: process.env.CLUSTER_ENABLED === 'true',
  workers: parseInt(process.env.CLUSTER_WORKERS || '0') || require('os').cpus().length,
};