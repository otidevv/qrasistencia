// src/routes/session.routes.ts
import { Router } from 'express';
import {
  createSession,
  updateSession,
  deleteSession,
  getSessionById,
  getSessionsByTeacher,
  getSessionsByStudent,
  getActiveSession,
  generateQRCode,
  closeSession,
  getSessionAttendance
} from '../controllers/session.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import {
  createSessionSchema,
  updateSessionSchema,
  sessionIdSchema,
  generateQRSchema,
  sessionQuerySchema
} from '../validations/session.validation';

const router = Router();

// ==================== RUTAS PROTEGIDAS ====================
// Todas las rutas de sesión requieren autenticación

// Rutas específicas primero (antes de /:sessionId)

// Obtener sesiones del docente actual
router.get(
  '/teacher/my-sessions',
  authenticate,
  authorize('DOCENTE', 'ADMIN'),
  validateRequest(sessionQuerySchema),
  getSessionsByTeacher
);

// Obtener sesiones del estudiante actual
router.get(
  '/student/my-sessions',
  authenticate,
  authorize('ESTUDIANTE'),
  validateRequest(sessionQuerySchema),
  getSessionsByStudent
);

// Obtener sesiones activas actuales
router.get(
  '/active/current',
  authenticate,
  validateRequest(sessionQuerySchema),
  getActiveSession
);

// Crear nueva sesión (solo docentes y admin)
router.post(
  '/',
  authenticate,
  authorize('DOCENTE', 'ADMIN'),
  validateRequest(createSessionSchema),
  createSession
);

// Rutas con parámetro :sessionId

// Obtener sesión por ID
router.get(
  '/:sessionId',
  authenticate,
  validateRequest(sessionIdSchema),
  getSessionById
);

// Actualizar sesión (solo el docente creador o admin)
router.put(
  '/:sessionId',
  authenticate,
  authorize('DOCENTE', 'ADMIN'),
  validateRequest(updateSessionSchema),
  updateSession
);

// Eliminar sesión (solo el docente creador o admin)
router.delete(
  '/:sessionId',
  authenticate,
  authorize('DOCENTE', 'ADMIN'),
  validateRequest(sessionIdSchema),
  deleteSession
);

// Generar código QR para una sesión (solo docente de la sesión)
router.post(
  '/:sessionId/generate-qr',
  authenticate,
  authorize('DOCENTE', 'ADMIN'),
  validateRequest(generateQRSchema),
  generateQRCode
);

// Cerrar sesión (solo docente de la sesión)
router.post(
  '/:sessionId/close',
  authenticate,
  authorize('DOCENTE', 'ADMIN'),
  validateRequest(sessionIdSchema),
  closeSession
);

// Obtener lista de asistencia de una sesión
router.get(
  '/:sessionId/attendance',
  authenticate,
  authorize('DOCENTE', 'ADMIN'),
  validateRequest(sessionIdSchema),
  getSessionAttendance
);

export default router;