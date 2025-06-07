// src/validations/environment.validation.ts
import Joi from 'joi';

// Schema para crear ambiente
export const createEnvironmentSchema = Joi.object({
  body: Joi.object({
    name: Joi.string()
      .min(3)
      .max(100)
      .required()
      .messages({
        'string.min': 'El nombre del ambiente debe tener al menos 3 caracteres',
        'string.max': 'El nombre del ambiente no puede exceder 100 caracteres',
        'any.required': 'El nombre del ambiente es requerido'
      }),
    type: Joi.string()
      .valid('LAB', 'AULA', 'AUDITORIO')
      .required()
      .messages({
        'any.only': 'El tipo debe ser LAB, AULA o AUDITORIO',
        'any.required': 'El tipo de ambiente es requerido'
      }),
    capacity: Joi.number()
      .integer()
      .min(1)
      .max(500)
      .optional()
      .messages({
        'number.min': 'La capacidad debe ser al menos 1',
        'number.max': 'La capacidad no puede exceder 500'
      }),
    managerId: Joi.string()
      .optional()
      .allow(null)
      .messages({
        'string.base': 'El ID del responsable debe ser válido'
      })
  })
});

// Schema para actualizar ambiente
export const updateEnvironmentSchema = Joi.object({
  params: Joi.object({
    id: Joi.string()
      .required()
      .messages({
        'any.required': 'El ID del ambiente es requerido'
      })
  }),
  body: Joi.object({
    name: Joi.string()
      .min(3)
      .max(100)
      .optional()
      .messages({
        'string.min': 'El nombre del ambiente debe tener al menos 3 caracteres',
        'string.max': 'El nombre del ambiente no puede exceder 100 caracteres'
      }),
    type: Joi.string()
      .valid('LAB', 'AULA', 'AUDITORIO')
      .optional()
      .messages({
        'any.only': 'El tipo debe ser LAB, AULA o AUDITORIO'
      }),
    capacity: Joi.number()
      .integer()
      .min(1)
      .max(500)
      .optional()
      .messages({
        'number.min': 'La capacidad debe ser al menos 1',
        'number.max': 'La capacidad no puede exceder 500'
      }),
    managerId: Joi.string()
      .optional()
      .allow(null)
      .messages({
        'string.base': 'El ID del responsable debe ser válido'
      }),
    isActive: Joi.boolean()
      .optional()
  }).min(1).messages({
    'object.min': 'Debe proporcionar al menos un campo para actualizar'
  })
});

// Schema para ID de ambiente en parámetros
export const environmentIdSchema = Joi.object({
  params: Joi.object({
    id: Joi.string()
      .required()
      .messages({
        'any.required': 'El ID del ambiente es requerido'
      })
  })
});

// Schema para query parameters
export const environmentQuerySchema = Joi.object({
  query: Joi.object({
    type: Joi.string()
      .valid('LAB', 'AULA', 'AUDITORIO')
      .optional()
      .messages({
        'any.only': 'El tipo debe ser LAB, AULA o AUDITORIO'
      }),
    isActive: Joi.boolean()
      .optional(),
    managerId: Joi.string()
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
      .allow(''),
    date: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.format': 'La fecha debe estar en formato ISO'
      }),
    startTime: Joi.string()
      .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .optional()
      .messages({
        'string.pattern.base': 'La hora de inicio debe estar en formato HH:MM'
      }),
    endTime: Joi.string()
      .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .optional()
      .messages({
        'string.pattern.base': 'La hora de fin debe estar en formato HH:MM'
      })
  })
});

// Schema para reservar ambiente
export const bookEnvironmentSchema = Joi.object({
  params: Joi.object({
    id: Joi.string()
      .required()
      .messages({
        'any.required': 'El ID del ambiente es requerido'
      })
  }),
  body: Joi.object({
    sessionName: Joi.string()
      .min(3)
      .max(200)
      .required()
      .messages({
        'string.min': 'El nombre de la sesión debe tener al menos 3 caracteres',
        'string.max': 'El nombre de la sesión no puede exceder 200 caracteres',
        'any.required': 'El nombre de la sesión es requerido'
      }),
    sessionType: Joi.string()
      .valid('CLASE', 'CONFERENCIA', 'CAPACITACION', 'EVENTO')
      .required()
      .messages({
        'any.only': 'El tipo de sesión debe ser CLASE, CONFERENCIA, CAPACITACION o EVENTO',
        'any.required': 'El tipo de sesión es requerido'
      }),
    startTime: Joi.date()
      .iso()
      .greater('now')
      .required()
      .messages({
        'date.greater': 'La hora de inicio debe ser en el futuro',
        'any.required': 'La hora de inicio es requerida'
      }),
    endTime: Joi.date()
      .iso()
      .greater(Joi.ref('startTime'))
      .required()
      .messages({
        'date.greater': 'La hora de fin debe ser posterior a la hora de inicio',
        'any.required': 'La hora de fin es requerida'
      }),
    allowExternals: Joi.boolean()
      .optional()
      .default(false),
    qrRotationMinutes: Joi.number()
      .integer()
      .min(1)
      .max(30)
      .optional()
      .default(3)
      .messages({
        'number.min': 'La rotación del QR debe ser al menos 1 minuto',
        'number.max': 'La rotación del QR no puede exceder 30 minutos'
      })
  })
});