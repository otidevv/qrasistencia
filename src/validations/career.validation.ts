// src/validations/career.validation.ts
import Joi from 'joi';

// Schema para crear carrera
export const createCareerSchema = Joi.object({
  body: Joi.object({
    name: Joi.string()
      .min(3)
      .max(100)
      .required()
      .messages({
        'string.min': 'El nombre de la carrera debe tener al menos 3 caracteres',
        'string.max': 'El nombre de la carrera no puede exceder 100 caracteres',
        'any.required': 'El nombre de la carrera es requerido'
      }),
    code: Joi.string()
      .alphanum()
      .min(2)
      .max(10)
      .optional()
      .messages({
        'string.alphanum': 'El código debe contener solo letras y números',
        'string.min': 'El código debe tener al menos 2 caracteres',
        'string.max': 'El código no puede exceder 10 caracteres'
      })
  })
});

// Schema para actualizar carrera
export const updateCareerSchema = Joi.object({
  params: Joi.object({
    id: Joi.string()
      .required()
      .messages({
        'any.required': 'El ID de la carrera es requerido'
      })
  }),
  body: Joi.object({
    name: Joi.string()
      .min(3)
      .max(100)
      .optional()
      .messages({
        'string.min': 'El nombre de la carrera debe tener al menos 3 caracteres',
        'string.max': 'El nombre de la carrera no puede exceder 100 caracteres'
      }),
    code: Joi.string()
      .alphanum()
      .min(2)
      .max(10)
      .optional()
      .allow('')
      .messages({
        'string.alphanum': 'El código debe contener solo letras y números',
        'string.min': 'El código debe tener al menos 2 caracteres',
        'string.max': 'El código no puede exceder 10 caracteres'
      })
  }).min(1).messages({
    'object.min': 'Debe proporcionar al menos un campo para actualizar'
  })
});

// Schema para ID de carrera en parámetros
export const careerIdSchema = Joi.object({
  params: Joi.object({
    id: Joi.string()
      .required()
      .messages({
        'any.required': 'El ID de la carrera es requerido'
      })
  })
});

// Schema para query parameters
export const careerQuerySchema = Joi.object({
  query: Joi.object({
    includeStudentCount: Joi.boolean()
      .optional(),
    page: Joi.number()
      .integer()
      .min(1)
      .optional()
      .messages({
        'number.min': 'El número de página debe ser mayor a 0'
      }),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .optional()
      .messages({
        'number.min': 'El límite debe ser mayor a 0',
        'number.max': 'El límite no puede exceder 100'
      }),
    search: Joi.string()
      .optional()
      .allow('')
  })
});