// src/validations/attendance.validation.ts
import Joi from 'joi';

// Schema para marcar asistencia
export const markAttendanceSchema = Joi.object({
  body: Joi.object({
    qrCode: Joi.string()
      .required()
      .messages({
        'any.required': 'El código QR es requerido'
      }),
    location: Joi.object({
      latitude: Joi.number()
        .min(-90)
        .max(90)
        .optional()
        .messages({
          'number.min': 'La latitud debe estar entre -90 y 90',
          'number.max': 'La latitud debe estar entre -90 y 90'
        }),
      longitude: Joi.number()
        .min(-180)
        .max(180)
        .optional()
        .messages({
          'number.min': 'La longitud debe estar entre -180 y 180',
          'number.max': 'La longitud debe estar entre -180 y 180'
        })
    }).optional()
  })
});

// Schema para verificar QR
export const verifyQRSchema = Joi.object({
  body: Joi.object({
    qrCode: Joi.string()
      .required()
      .messages({
        'any.required': 'El código QR es requerido'
      })
  })
});

// Schema para consultas de asistencia
export const attendanceQuerySchema = Joi.object({
  query: Joi.object({
    sessionId: Joi.string()
      .optional(),
    studentId: Joi.string()
      .optional(),
    startDate: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.format': 'La fecha de inicio debe estar en formato ISO'
      }),
    endDate: Joi.date()
      .iso()
      .when('startDate', {
        is: Joi.exist(),
        then: Joi.date().greater(Joi.ref('startDate')),
        otherwise: Joi.optional()
      })
      .messages({
        'date.format': 'La fecha de fin debe estar en formato ISO',
        'date.greater': 'La fecha de fin debe ser posterior a la fecha de inicio'
      }),
    page: Joi.number()
      .integer()
      .min(1)
      .optional()
      .default(1)
      .messages({
        'number.min': 'El número de página debe ser mayor a 0'
      }),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .messages({
        'number.min': 'El límite debe ser mayor a 0',
        'number.max': 'El límite no puede exceder 100'
      }),
    status: Joi.string()
      .valid('present', 'late', 'absent')
      .optional(),
    includeExternals: Joi.boolean()
      .optional()
      .default(false)
  })
});

// Schema para actualizar asistencia
export const updateAttendanceSchema = Joi.object({
  params: Joi.object({
    attendanceId: Joi.string()
      .required()
      .messages({
        'any.required': 'El ID de asistencia es requerido'
      })
  }),
  body: Joi.object({
    checkOutTime: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.format': 'La fecha de salida debe estar en formato ISO'
      }),
    isSuspicious: Joi.boolean()
      .optional(),
    suspiciousReason: Joi.string()
      .when('isSuspicious', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional().allow(null)
      })
      .messages({
        'any.required': 'Debe especificar la razón si marca como sospechoso'
      })
  }).min(1).messages({
    'object.min': 'Debe proporcionar al menos un campo para actualizar'
  })
});

// Schema para estadísticas de asistencia
export const attendanceStatsSchema = Joi.object({
  query: Joi.object({
    type: Joi.string()
      .valid('student', 'session', 'career', 'general')
      .required()
      .messages({
        'any.only': 'El tipo debe ser student, session, career o general',
        'any.required': 'El tipo de estadística es requerido'
      }),
    entityId: Joi.string()
      .when('type', {
        is: Joi.valid('student', 'session', 'career'),
        then: Joi.required(),
        otherwise: Joi.optional()
      })
      .messages({
        'any.required': 'El ID de la entidad es requerido para este tipo de estadística'
      }),
    startDate: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.format': 'La fecha de inicio debe estar en formato ISO'
      }),
    endDate: Joi.date()
      .iso()
      .when('startDate', {
        is: Joi.exist(),
        then: Joi.date().greater(Joi.ref('startDate')),
        otherwise: Joi.optional()
      })
      .messages({
        'date.format': 'La fecha de fin debe estar en formato ISO',
        'date.greater': 'La fecha de fin debe ser posterior a la fecha de inicio'
      }),
    groupBy: Joi.string()
      .valid('day', 'week', 'month', 'session', 'career')
      .optional()
      .default('day')
  })
});

// Schema para parámetros de ID en rutas
export const attendanceIdSchema = Joi.object({
  params: Joi.object({
    sessionId: Joi.string()
      .optional(),
    studentId: Joi.string()
      .optional(),
    attendanceId: Joi.string()
      .optional()
  }).or('sessionId', 'studentId', 'attendanceId')
});

// Schema para exportar reporte
export const exportAttendanceSchema = Joi.object({
  params: Joi.object({
    format: Joi.string()
      .valid('csv', 'pdf', 'excel')
      .required()
      .messages({
        'any.only': 'El formato debe ser csv, pdf o excel',
        'any.required': 'El formato de exportación es requerido'
      })
  }),
  query: Joi.object({
    sessionId: Joi.string()
      .optional(),
    careerId: Joi.string()
      .optional(),
    startDate: Joi.date()
      .iso()
      .optional(),
    endDate: Joi.date()
      .iso()
      .optional(),
    includeDetails: Joi.boolean()
      .optional()
      .default(true)
  }).or('sessionId', 'careerId')
});