// src/config/environment.ts
import dotenv from 'dotenv';
import { z } from 'zod';

// Cargar variables de entorno
dotenv.config();

// Schema de validación para las variables de entorno
const envSchema = z.object({
  // Servidor
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().default('0.0.0.0'),
  
  // Base de datos
  DATABASE_URL: z.string().url(),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // CORS
  CORS_ORIGINS: z.string().optional(),
  
  // QR
  QR_ROTATION_MINUTES: z.string().transform(Number).default('3'),
  QR_CODE_LENGTH: z.string().transform(Number).default('10'),
  
  // Email (opcional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  
  // Logs
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  
  // Frontend
  FRONTEND_URL: z.string().url().optional(),
});

// Validar y parsear variables de entorno
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Error en variables de entorno:');
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        console.error(`   - ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
};

// Exportar configuración validada
const env = parseEnv();

export const config = {
  // Entorno
  env: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  
  // Servidor
  server: {
    port: env.PORT,
    host: env.HOST,
  },
  
  // Base de datos
  database: {
    url: env.DATABASE_URL,
  },
  
  // Autenticación
  auth: {
    jwt: {
      secret: env.JWT_SECRET,
      expiresIn: env.JWT_EXPIRES_IN,
      refreshSecret: env.JWT_REFRESH_SECRET || env.JWT_SECRET,
      refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    },
    bcrypt: {
      rounds: 10,
    },
  },
  
  // CORS
  cors: {
    origins: env.CORS_ORIGINS?.split(',').map(origin => origin.trim()) || [],
  },
  
  // Sistema QR
  qr: {
    rotationMinutes: env.QR_ROTATION_MINUTES,
    codeLength: env.QR_CODE_LENGTH,
  },
  
  // Email
  email: {
    enabled: !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT || 587,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    },
    from: env.EMAIL_FROM || 'QR System <noreply@qrsystem.com>',
  },
  
  // Logging
  logging: {
    level: env.LOG_LEVEL,
  },
  
  // URLs
  urls: {
    frontend: env.FRONTEND_URL || 'http://localhost:3000',
  },
  
  // Límites
  limits: {
    maxLoginAttempts: 5,
    loginWindowMinutes: 15,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxRequestSize: '10mb',
  },
  
  // Paginación
  pagination: {
    defaultPage: 1,
    defaultLimit: 20,
    maxLimit: 100,
  },
};

// Función helper para obtener configuración
export const getConfig = <K extends keyof typeof config>(key: K): typeof config[K] => {
  return config[key];
};

// Validar configuración crítica en producción
if (config.isProduction) {
  const criticalConfigs = [
    { name: 'JWT_SECRET', condition: config.auth.jwt.secret.length < 32 },
    { name: 'DATABASE_URL', condition: !config.database.url },
    { name: 'CORS_ORIGINS', condition: config.cors.origins.length === 0 },
  ];
  
  const missingConfigs = criticalConfigs.filter(c => c.condition);
  
  if (missingConfigs.length > 0) {
    console.error('❌ Configuración crítica faltante en producción:');
    missingConfigs.forEach(c => console.error(`   - ${c.name}`));
    process.exit(1);
  }
}

// Exportar tipo de configuración
export type Config = typeof config;