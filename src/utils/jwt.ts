// src/utils/jwt.ts
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';

// Interfaz para el payload del token
interface TokenPayload {
  userId: string;
  username: string;
  role: string;
  roleLevel: number;
  email?: string;
}

// Interfaz para el refresh token
interface RefreshTokenPayload {
  userId: string;
  tokenFamily?: string;
}

// Tipo para las opciones de sign que soporta jsonwebtoken
interface JWTSignOptions {
  expiresIn?: string | number;
  issuer?: string;
  audience?: string | string[];
  subject?: string;
  jwtid?: string;
  noTimestamp?: boolean;
  header?: object;
  encoding?: string;
}

// Validar y obtener el secret
const getSecret = (): string => {
  const secret = config.auth.jwt.secret;
  if (!secret || typeof secret !== 'string') {
    throw new Error('JWT_SECRET no está configurado correctamente');
  }
  return secret;
};

// Validar y obtener el refresh secret
const getRefreshSecret = (): string => {
  const secret = config.auth.jwt.refreshSecret;
  if (!secret || typeof secret !== 'string') {
    throw new Error('JWT_REFRESH_SECRET no está configurado correctamente');
  }
  return secret;
};

// Generar Access Token
export const generateToken = (payload: TokenPayload): string => {
  const secret = getSecret();
  
  // Construir opciones manualmente para evitar problemas de tipos
  const options: JWTSignOptions = {
    expiresIn: config.auth.jwt.expiresIn || '24h',
    issuer: 'qr-attendance-system',
    audience: 'qr-attendance-users'
  };

  return jwt.sign(payload, secret, options as jwt.SignOptions);
};

// Generar Refresh Token
export const generateRefreshToken = (userId: string, tokenFamily?: string): string => {
  const secret = getRefreshSecret();

  const payload: RefreshTokenPayload = {
    userId,
    tokenFamily: tokenFamily || generateTokenFamily()
  };

  const options: JWTSignOptions = {
    expiresIn: config.auth.jwt.refreshExpiresIn || '7d',
    issuer: 'qr-attendance-system',
    audience: 'qr-attendance-refresh'
  };

  return jwt.sign(payload, secret, options as jwt.SignOptions);
};

// Verificar Access Token
export const verifyToken = (token: string): TokenPayload => {
  const secret = getSecret();

  try {
    const decoded = jwt.verify(token, secret, {
      issuer: 'qr-attendance-system',
      audience: 'qr-attendance-users'
    });

    // Validar que el decoded tiene la estructura esperada
    if (!decoded || typeof decoded !== 'object') {
      throw new Error('Token inválido');
    }

    return decoded as TokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expirado');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Token inválido');
    }
    throw error;
  }
};

// Verificar Refresh Token
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const secret = getRefreshSecret();

  try {
    const decoded = jwt.verify(token, secret, {
      issuer: 'qr-attendance-system',
      audience: 'qr-attendance-refresh'
    });

    if (!decoded || typeof decoded !== 'object') {
      throw new Error('Refresh token inválido');
    }

    return decoded as RefreshTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expirado');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Refresh token inválido');
    }
    throw error;
  }
};

// Decodificar token sin verificar
export const decodeToken = (token: string): any => {
  return jwt.decode(token);
};

// Generar un ID único para familia de tokens
const generateTokenFamily = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

// Extraer token del header Authorization
export const extractTokenFromHeader = (authHeader?: string): string | null => {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
};

// Generar tokens para respuesta
export const generateAuthTokens = (user: {
  id: string;
  username: string;
  role: { name: string; level: number };
  email?: string | null;
}) => {
  const accessToken = generateToken({
    userId: user.id,
    username: user.username,
    role: user.role.name,
    roleLevel: user.role.level,
    email: user.email || undefined
  });

  const refreshToken = generateRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    expiresIn: config.auth.jwt.expiresIn || '24h'
  };
};

// Calcular tiempo de expiración en segundos
export const getExpirationTime = (token: string): number => {
  const decoded = decodeToken(token);
  
  if (!decoded || typeof decoded !== 'object') {
    throw new Error('Token inválido');
  }

  // Type guard para verificar que exp existe
  if (!('exp' in decoded) || typeof decoded.exp !== 'number') {
    throw new Error('Token sin tiempo de expiración');
  }
  
  const now = Math.floor(Date.now() / 1000);
  return decoded.exp - now;
};

// Verificar si el token está próximo a expirar
export const isTokenExpiringSoon = (token: string, thresholdSeconds = 300): boolean => {
  try {
    const timeLeft = getExpirationTime(token);
    return timeLeft <= thresholdSeconds;
  } catch {
    return true;
  }
};