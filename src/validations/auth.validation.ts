// src/validations/auth.validation.ts
import Joi from 'joi';

// Schema para registro de estudiante
export const registerStudentSchema = Joi.object({
  body: Joi.object({
    codigoEstudiante: Joi.string()
      .pattern(/^[0-9]{8}$/)
      .required()
      .messages({
        'string.pattern.base': 'El código de estudiante debe tener 8 dígitos',
        'any.required': 'El código de estudiante es requerido'
      }),
    dni: Joi.string()
      .pattern(/^[0-9]{8}$/)
      .required()
      .messages({
        'string.pattern.base': 'El DNI debe tener 8 dígitos',
        'any.required': 'El DNI es requerido'
      }),
    fullName: Joi.string()
      .min(3)
      .max(100)
      .required()
      .messages({
        'string.min': 'El nombre completo debe tener al menos 3 caracteres',
        'string.max': 'El nombre completo no puede exceder 100 caracteres',
        'any.required': 'El nombre completo es requerido'
      }),
    password: Joi.string()
      .min(6)
      .max(50)
      .required()
      .messages({
        'string.min': 'La contraseña debe tener al menos 6 caracteres',
        'string.max': 'La contraseña no puede exceder 50 caracteres',
        'any.required': 'La contraseña es requerida'
      }),
    email: Joi.string()
      .email()
      .optional()
      .messages({
        'string.email': 'El email debe ser válido'
      }),
    phoneNumber: Joi.string()
      .pattern(/^[0-9]{9}$/)
      .optional()
      .messages({
        'string.pattern.base': 'El número de teléfono debe tener 9 dígitos'
      }),
    careerId: Joi.string()
      .required()
      .messages({
        'any.required': 'El ID de la carrera es requerido'
      })
  })
});

// Schema para registro de usuario general
export const registerUserSchema = Joi.object({
  body: Joi.object({
    username: Joi.string()
      .min(3)
      .max(50)
      .required()
      .messages({
        'string.min': 'El nombre de usuario debe tener al menos 3 caracteres',
        'string.max': 'El nombre de usuario no puede exceder 50 caracteres',
        'any.required': 'El nombre de usuario es requerido'
      }),
    name: Joi.string()
      .min(3)
      .max(100)
      .required()
      .messages({
        'string.min': 'El nombre debe tener al menos 3 caracteres',
        'string.max': 'El nombre no puede exceder 100 caracteres',
        'any.required': 'El nombre es requerido'
      }),
    password: Joi.string()
      .min(6)
      .max(50)
      .required()
      .messages({
        'string.min': 'La contraseña debe tener al menos 6 caracteres',
        'string.max': 'La contraseña no puede exceder 50 caracteres',
        'any.required': 'La contraseña es requerida'
      }),
    // email: Joi.string()
    //   .email()
    //   .optional()
    //   .messages({
    //     'string.email': 'El email debe ser válido'
    //   }),
    roleName: Joi.string()
      .valid('DOCENTE', 'ADMIN', 'JEFE_LAB')
      .required()
      .messages({
        'any.only': 'El rol debe ser DOCENTE, ADMIN o JEFE_LAB',
        'any.required': 'El rol es requerido'
      })
  })
});

// Schema para login
export const loginSchema = Joi.object({
  body: Joi.object({
    username: Joi.string()
      .required()
      .messages({
        'any.required': 'El nombre de usuario es requerido'
      }),
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'La contraseña es requerida'
      })
  })
});

// Schema para cambio de contraseña
export const changePasswordSchema = Joi.object({
  body: Joi.object({
    currentPassword: Joi.string()
      .required()
      .messages({
        'any.required': 'La contraseña actual es requerida'
      }),
    newPassword: Joi.string()
      .min(6)
      .max(50)
      .required()
      .messages({
        'string.min': 'La nueva contraseña debe tener al menos 6 caracteres',
        'string.max': 'La nueva contraseña no puede exceder 50 caracteres',
        'any.required': 'La nueva contraseña es requerida'
      })
  })
});