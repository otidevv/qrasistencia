// src/routes/environment.routes.ts
import { Router } from 'express';
import {
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  getEnvironmentById,
  getAllEnvironments,
  getAvailableEnvironments,
  getEnvironmentSchedule,
  bookEnvironment,
  releaseEnvironment
} from '../controllers/environment.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import {
  createEnvironmentSchema,
  updateEnvironmentSchema,
  environmentIdSchema,
  environmentQuerySchema,
  bookEnvironmentSchema
} from '../validations/environment.validation';

const router = Router();

// ==================== RUTAS PÚBLICAS ====================

// Obtener todos los ambientes
router.get(
  '/',
  validateRequest(environmentQuerySchema),
  getAllEnvironments
);

// Obtener ambientes disponibles (debe ir antes de /:id)
router.get(
  '/available/check',
  authenticate,
  validateRequest(environmentQuerySchema),
  getAvailableEnvironments
);

// Obtener ambiente por ID
router.get(
  '/:id',
  validateRequest(environmentIdSchema),
  getEnvironmentById
);

// Obtener horario de un ambiente
router.get(
  '/:id/schedule',
  authenticate,
  validateRequest(environmentIdSchema),
  getEnvironmentSchedule
);

// ==================== RUTAS PROTEGIDAS ====================

// Crear nuevo ambiente (admin o jefe de lab)
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'JEFE_LAB'),
  validateRequest(createEnvironmentSchema),
  createEnvironment
);

// Actualizar ambiente (admin o jefe de lab)
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'JEFE_LAB'),
  validateRequest(updateEnvironmentSchema),
  updateEnvironment
);

// Eliminar ambiente (solo admin)
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validateRequest(environmentIdSchema),
  deleteEnvironment
);

// Reservar ambiente (docentes)
router.post(
  '/:id/book',
  authenticate,
  authorize('DOCENTE', 'ADMIN'),
  validateRequest(bookEnvironmentSchema),
  bookEnvironment
);

// Liberar ambiente
router.post(
  '/:id/release',
  authenticate,
  authorize('DOCENTE', 'ADMIN', 'JEFE_LAB'),
  validateRequest(environmentIdSchema),
  releaseEnvironment
);

export default router;