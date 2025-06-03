// src/utils/jwt.ts
import jwt, { Secret } from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET: Secret = process.env.JWT_SECRET || 'fallback-secret'; // tipo correcto

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export const generateToken = (
  payload: JwtPayload,
  expiresIn: string | number = '1h'
): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn }); // ahora ya no da error
};

export const verifyToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    return null;
  }
};
