// src/validations/session.validation.ts
import Joi from 'joi';

// Schema para crear sesión
export const createSessionSchema = Joi.object({
  body: Joi.object({
    environmentId: Joi.string()
      .required()
      .messages({
        'any.required': 'El ID del ambiente es requerido'
      }),
    name: Joi.string()
      .min(3)
      .max(200)
      .required()
      .messages({
        'string.min': 'El nombre de la sesión debe tener al menos 3 caracteres',
        'string.max': 'El nombre de la sesión no puede exceder 200 caracteres',
        'any.required': 'El nombre de la sesión es requerido'
      }),
    type: Joi.string()
      .valid('CLASE', 'CONFERENCIA', 'CAPACITACION', 'EVENTO')
      .required()
      .messages({
        'any.only': 'El tipo debe ser CLASE, CONFERENCIA, CAPACITACION o EVENTO',
        'any.required': 'El tipo de sesión es requerido'
      }),
    allowExternals: Joi.boolean()
      .optional()
      .default(false),
    hostName: Joi.string()
      .when('allowExternals', {
        is: true,
        then: Joi.optional(),
        otherwise: Joi.forbidden()
      })
      .messages({
        'any.unknown': 'hostName solo se permite cuando allowExternals es true'
      }),
    startTime: Joi.date()
      .iso()
      .required()
      .messages({
        'date.base': 'La fecha de inicio debe ser válida',
        'any.required': 'La fecha de inicio es requerida'
      }),
    endTime: Joi.date()
      .iso()
      .greater(Joi.ref('startTime'))
      .required()
      .messages({
        'date.greater': 'La fecha de fin debe ser posterior a la de inicio',
        'any.required': 'La fecha de fin es requerida'
      }),
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

// Schema para actualizar sesión
export const updateSessionSchema = Joi.object({
  params: Joi.object({
    sessionId: Joi.string()
      .required()
      .messages({
        'any.required': 'El ID de la sesión es requerido'
      })
  }),
  body: Joi.object({
    name: Joi.string()
      .min(3)
      .max(200)
      .optional()
      .messages({
        'string.min': 'El nombre de la sesión debe tener al menos 3 caracteres',
        'string.max': 'El nombre de la sesión no puede exceder 200 caracteres'
      }),
    type: Joi.string()
      .valid('CLASE', 'CONFERENCIA', 'CAPACITACION', 'EVENTO')
      .optional()
      .messages({
        'any.only': 'El tipo debe ser CLASE, CONFERENCIA, CAPACITACION o EVENTO'
      }),
    allowExternals: Joi.boolean()
      .optional(),
    hostName: Joi.string()
      .optional()
      .allow(null),
    startTime: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.base': 'La fecha de inicio debe ser válida'
      }),
    endTime: Joi.date()
      .iso()
      .when('startTime', {
        is: Joi.exist(),
        then: Joi.required(),
        otherwise: Joi.optional()
      })
      .messages({
        'date.base': 'La fecha de fin debe ser válida',
        'any.required': 'Si cambia la fecha de inicio, también debe especificar la fecha de fin'
      }),
    qrRotationMinutes: Joi.number()
      .integer()
      .min(1)
      .max(30)
      .optional()
      .messages({
        'number.min': 'La rotación del QR debe ser al menos 1 minuto',
        'number.max': 'La rotación del QR no puede exceder 30 minutos'
      }),
    isActive: Joi.boolean()
      .optional()
  }).min(1).messages({
    'object.min': 'Debe proporcionar al menos un campo para actualizar'
  })
});

// Schema para ID de sesión en parámetros
export const sessionIdSchema = Joi.object({
  params: Joi.object({
    sessionId: Joi.string()
      .required()
      .messages({
        'any.required': 'El ID de la sesión es requerido'
      })
  })
});

// Schema para generar QR
export const generateQRSchema = Joi.object({
  params: Joi.object({
    sessionId: Joi.string()
      .required()
      .messages({
        'any.required': 'El ID de la sesión es requerido'
      })
  }),
  body: Joi.object({
    forceNew: Joi.boolean()
      .optional()
      .default(false)
      .messages({
        'boolean.base': 'forceNew debe ser verdadero o falso'
      })
  })
});

// Schema para query parameters de sesiones
export const sessionQuerySchema = Joi.object({
  query: Joi.object({
    environmentId: Joi.string()
      .optional(),
    type: Joi.string()
      .valid('CLASE', 'CONFERENCIA', 'CAPACITACION', 'EVENTO')
      .optional(),
    isActive: Joi.boolean()
      .optional(),
    hostId: Joi.string()
      .optional(),
    date: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.format': 'La fecha debe estar en formato ISO'
      }),
    startDate: Joi.date()
      .iso()
      .optional(),
    endDate: Joi.date()
      .iso()
      .when('startDate', {
        is: Joi.exist(),
        then: Joi.date().greater(Joi.ref('startDate')),
        otherwise: Joi.optional()
      }),
    page: Joi.number()
      .integer()
      .min(1)
      .optional()
      .default(1),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .optional()
      .default(20),
    search: Joi.string()
      .optional()
      .allow('')
  })
});