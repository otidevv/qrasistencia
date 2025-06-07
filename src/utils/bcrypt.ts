// src/utils/bcrypt.ts
import bcrypt from 'bcrypt';

// Número de rondas de salt (10 es un buen balance entre seguridad y velocidad)
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

// Hashear contraseña
export const hashPassword = async (password: string): Promise<string> => {
  if (!password || password.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres');
  }
  
  return bcrypt.hash(password, SALT_ROUNDS);
};

// Comparar contraseña con hash
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  if (!password || !hash) {
    return false;
  }
  
  return bcrypt.compare(password, hash);
};

// Generar una contraseña aleatoria
export const generateRandomPassword = (length: number = 12): string => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  return password;
};

// Validar fortaleza de contraseña
export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
} => {
  const errors: string[] = [];
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  let score = 0;
  
  // Longitud mínima
  if (password.length < 6) {
    errors.push('La contraseña debe tener al menos 6 caracteres');
  } else if (password.length >= 8) {
    score++;
  }
  
  if (password.length >= 12) {
    score++;
  }
  
  // Contiene mayúsculas
  if (!/[A-Z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una mayúscula');
  } else {
    score++;
  }
  
  // Contiene minúsculas
  if (!/[a-z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una minúscula');
  } else {
    score++;
  }
  
  // Contiene números
  if (!/[0-9]/.test(password)) {
    errors.push('La contraseña debe contener al menos un número');
  } else {
    score++;
  }
  
  // Contiene caracteres especiales
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('La contraseña debe contener al menos un caracter especial');
  } else {
    score++;
  }
  
  // Determinar fortaleza
  if (score <= 2) {
    strength = 'weak';
  } else if (score <= 4) {
    strength = 'medium';
  } else {
    strength = 'strong';
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    strength
  };
};

// Generar salt (útil para otros propósitos)
export const generateSalt = async (rounds: number = SALT_ROUNDS): Promise<string> => {
  return bcrypt.genSalt(rounds);
};

// Hash con salt personalizado
export const hashWithSalt = async (data: string, salt: string): Promise<string> => {
  return bcrypt.hash(data, salt);
};