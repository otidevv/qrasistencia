// src/middlewares/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

/**
 * Middleware para validar requests usando esquemas Joi
 * @param schema - Esquema Joi para validación
 */
export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(
      {
        body: req.body,
        query: req.query,
        params: req.params
      },
      {
        abortEarly: false, // Mostrar todos los errores
        allowUnknown: false, // No permitir campos desconocidos
        stripUnknown: true // Eliminar campos desconocidos
      }
    );

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type
      }));

      res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors
      });
      return;
    }

    next();
  };
};