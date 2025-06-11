// src/validations/user.validation.ts
import Joi from 'joi';

// Validación personalizada para CUIDs
// Los CUIDs tienen 25 caracteres y usan letras minúsculas y números
const cuidSchema = Joi.string().pattern(/^c[a-z0-9]{24}$/);

// Validación para ID de usuario en params
export const userIdSchema = Joi.object({
  params: Joi.object({
    id: cuidSchema.required()
  })
});

// Validación para query params de listado
export const userQuerySchema = Joi.object({
  query: Joi.object({
    role: Joi.string().valid('ADMIN', 'DOCENTE', 'JEFE_LAB', 'ESTUDIANTE').optional(),
    isActive: Joi.string().valid('true', 'false').optional(),
    search: Joi.string().optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    includeProfile: Joi.string().valid('true', 'false').optional()
  })
});

// Validación para actualizar usuario
export const updateUserSchema = Joi.object({
  params: Joi.object({
    id: cuidSchema.required()
  }),
  body: Joi.object({
    name: Joi.string().min(3).max(100).optional(),
    email: Joi.string().email().optional(),
    isActive: Joi.boolean().optional(),
    roleId: cuidSchema.optional(), // También cambiar aquí si roleId es CUID
    // Campos específicos de estudiante
    fullName: Joi.string().min(3).max(100).optional(),
    phoneNumber: Joi.string().pattern(/^[0-9+\-\s()]+$/).allow('').optional(),
    careerId: cuidSchema.optional() // También cambiar aquí si careerId es CUID
  })
});

// Validación para resetear contraseña
export const resetPasswordSchema = Joi.object({
  params: Joi.object({
    id: cuidSchema.required()
  }),
  body: Joi.object({
    newPassword: Joi.string()
      .min(6)
      .max(50)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({
        'string.pattern.base': 'La contraseña debe contener al menos una mayúscula, una minúscula y un número'
      })
  })
});