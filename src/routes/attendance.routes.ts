// src/routes/attendance.routes.ts
import { Router } from 'express';
import {
  markAttendance,
  verifyQRCode,
  getMyAttendance,
  getAttendanceBySession,
  getAttendanceByStudent,
  updateAttendanceStatus,
  getAttendanceStats,
  exportAttendanceReport
} from '../controllers/attendance.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import {
  markAttendanceSchema,
  verifyQRSchema,
  attendanceQuerySchema,
  updateAttendanceSchema,
  attendanceStatsSchema,
  attendanceIdSchema,
  exportAttendanceSchema
} from '../validations/attendance.validation';

const router = Router();

// ==================== RUTAS PROTEGIDAS ====================

// Rutas sin parámetros primero

// Marcar asistencia con código QR (estudiantes)
router.post(
  '/mark',
  authenticate,
  authorize('ESTUDIANTE'),
  validateRequest(markAttendanceSchema),
  markAttendance
);

// Verificar código QR antes de marcar asistencia
router.post(
  '/verify-qr',
  authenticate,
  authorize('ESTUDIANTE'),
  validateRequest(verifyQRSchema),
  verifyQRCode
);

// Obtener mi historial de asistencia (estudiantes)
router.get(
  '/my-attendance',
  authenticate,
  authorize('ESTUDIANTE'),
  validateRequest(attendanceQuerySchema),
  getMyAttendance
);

// Obtener estadísticas de asistencia
router.get(
  '/stats',
  authenticate,
  validateRequest(attendanceStatsSchema),
  getAttendanceStats
);

// Rutas con prefijos específicos antes de rutas con parámetros

// Obtener asistencia por sesión (docentes y admin)
router.get(
  '/session/:sessionId',
  authenticate,
  authorize('DOCENTE', 'ADMIN'),
  validateRequest(attendanceIdSchema),
  getAttendanceBySession
);

// Obtener asistencia de un estudiante específico
router.get(
  '/student/:studentId',
  authenticate,
  validateRequest(attendanceIdSchema),
  getAttendanceByStudent
);

// Exportar reporte de asistencia
router.get(
  '/export/:format',
  authenticate,
  authorize('DOCENTE', 'ADMIN'),
  validateRequest(exportAttendanceSchema),
  exportAttendanceReport
);

// Rutas con parámetros al final

// Actualizar estado de asistencia (docentes y admin)
router.put(
  '/:attendanceId',
  authenticate,
  authorize('DOCENTE', 'ADMIN'),
  validateRequest(updateAttendanceSchema),
  updateAttendanceStatus
);

export default router;