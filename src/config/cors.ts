// src/config/cors.ts
import { CorsOptions } from 'cors';

// Obtener orígenes permitidos del entorno
const getAllowedOrigins = (): string[] => {
  const origins = process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()) || [];
  
  // Agregar orígenes por defecto para desarrollo
  if (process.env.NODE_ENV === 'development') {
    return [
      ...origins,
      'http://localhost:3000',    // React
      'http://localhost:5173',    // Vite
      'http://localhost:4200',    // Angular
      'http://localhost:8080',    // Vue
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://192.168.1.42:5173',
    ];
  }
  
  return origins;
};

// Configuración de CORS
export const corsOptions: CorsOptions = {
  // Función para verificar el origen
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    
    // Permitir requests sin origin (Postman, aplicaciones móviles, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Verificar si el origen está permitido
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (process.env.NODE_ENV === 'development') {
      // En desarrollo, ser más permisivo
      console.warn(`⚠️  Origen no permitido por CORS: ${origin}`);
      callback(null, true);
    } else {
      // En producción, rechazar
      callback(new Error(`Origen no permitido por CORS: ${origin}`));
    }
  },
  
  // Permitir credenciales (cookies, authorization headers)
  credentials: true,
  
  // Métodos HTTP permitidos
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  
  // Headers permitidos en las requests
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-CSRF-Token',
    'X-Api-Key',
  ],
  
  // Headers expuestos al cliente
  exposedHeaders: [
    'X-Total-Count',      // Para paginación
    'X-Page',             // Página actual
    'X-Page-Size',        // Tamaño de página
    'X-Total-Pages',      // Total de páginas
    'X-Request-Id',       // ID de la request para debugging
    'X-RateLimit-Limit',  // Límite de rate limit
    'X-RateLimit-Remaining', // Requests restantes
    'X-RateLimit-Reset',  // Cuando se resetea el límite
  ],
  
  // Tiempo máximo para cachear la respuesta preflight (24 horas)
  maxAge: 86400,
  
  // Pasar el preflight al siguiente handler
  preflightContinue: false,
  
  // Proveer status 204 en requests OPTIONS exitosas
  optionsSuccessStatus: 204,
};

// Configuración específica para desarrollo
export const devCorsOptions: CorsOptions = {
  origin: true, // Permitir cualquier origen
  credentials: true,
  methods: '*',
  allowedHeaders: '*',
};

// Configuración específica para producción
export const prodCorsOptions: CorsOptions = {
  ...corsOptions,
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || [];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
};

// Helper para obtener la configuración según el entorno
export const getCorsConfig = (): CorsOptions => {
  switch (process.env.NODE_ENV) {
    case 'development':
      return devCorsOptions;
    case 'production':
      return prodCorsOptions;
    default:
      return corsOptions;
  }
};

// Lista de rutas que no requieren CORS (rutas internas, health checks, etc.)
export const corsWhitelist = [
  '/api/health',
  '/api/metrics',
  '/api/internal/*',
];

// Función para verificar si una ruta está en whitelist
export const isWhitelisted = (path: string): boolean => {
  return corsWhitelist.some(pattern => {
    if (pattern.endsWith('*')) {
      return path.startsWith(pattern.slice(0, -1));
    }
    return path === pattern;
  });
};