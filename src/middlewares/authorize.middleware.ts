// src/middlewares/authorize.middleware.ts
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para verificar roles específicos
 * @param allowedRoles - Array de roles permitidos
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Verificar que el usuario está autenticado
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    // Verificar que el usuario tiene uno de los roles permitidos
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'No tienes permisos para acceder a este recurso',
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
      return;
    }

    next();
  };
};

/**
 * Middleware para verificar nivel de rol mínimo
 * @param minLevel - Nivel mínimo requerido
 */
export const authorizeLevel = (minLevel: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Verificar que el usuario está autenticado
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    // Verificar que el usuario tiene el nivel de rol suficiente
    if (req.user.roleLevel < minLevel) {
      res.status(403).json({
        success: false,
        message: 'No tienes suficientes permisos para acceder a este recurso',
        requiredLevel: minLevel,
        userLevel: req.user.roleLevel
      });
      return;
    }

    next();
  };
};