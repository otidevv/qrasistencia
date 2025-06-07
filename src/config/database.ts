// src/config/database.ts
import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

// Configuración de logging para Prisma
const logLevels: Record<string, Prisma.LogLevel[]> = {
  development: ['query', 'error', 'info', 'warn'],
  production: ['error', 'warn'],
  test: ['error'],
};

// Crear instancia de Prisma con configuración
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: logLevels[process.env.NODE_ENV || 'development'] || ['error', 'warn'],
    errorFormat: process.env.NODE_ENV === 'production' ? 'minimal' : 'pretty',
  });
};

// Type para el cliente Prisma
type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

// Objeto global para mantener la instancia en desarrollo
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

// Exportar la instancia (singleton)
export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

// En desarrollo, guardar en global para evitar múltiples instancias
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Middleware para logging de queries
prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();

  if (process.env.NODE_ENV === 'development') {
    logger.debug(`Query ${params.model}.${params.action} took ${after - before}ms`);
  }

  return result;
});

// Función para verificar conexión
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Database connection successful');
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    return false;
  }
};

// Función para cerrar conexión (para graceful shutdown)
export const closeDatabaseConnection = async (): Promise<void> => {
  await prisma.$disconnect();
  logger.info('Database connection closed');
};

// Configuración de timeouts y pool
export const databaseConfig = {
  // Tiempo máximo de espera para una query
  queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '5000'),
  
  // Configuración del pool de conexiones
  pool: {
    min: parseInt(process.env.DB_POOL_MIN || '2'),
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    acquire: parseInt(process.env.DB_POOL_ACQUIRE || '30000'),
    idle: parseInt(process.env.DB_POOL_IDLE || '10000'),
  },
  
  // Reintentos en caso de fallo
  retry: {
    limit: parseInt(process.env.DB_RETRY_LIMIT || '3'),
    delay: parseInt(process.env.DB_RETRY_DELAY || '1000'),
  },
};