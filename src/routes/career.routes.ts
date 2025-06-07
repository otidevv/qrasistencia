// src/routes/career.routes.ts
import { Router } from 'express';
import {
  createCareer,
  getAllCareers,
  getCareerById,
  updateCareer,
  deleteCareer,
  getCareerStudents,
  getCareerStats
} from '../controllers/career.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import {
  createCareerSchema,
  updateCareerSchema,
  careerIdSchema,
  careerQuerySchema
} from '../validations/career.validation';

const router = Router();

// ==================== RUTAS PÚBLICAS ====================

// Obtener todas las carreras (público para formularios de registro)
router.get(
  '/',
  validateRequest(careerQuerySchema),
  getAllCareers
);

// Obtener estadísticas de carreras (debe ir antes de /:id)
router.get(
  '/stats/overview',
  authenticate,
  authorize('ADMIN', 'JEFE_LAB'),
  getCareerStats
);

// Obtener carrera por ID (público)
router.get(
  '/:id',
  validateRequest(careerIdSchema),
  getCareerById
);

// Obtener estudiantes de una carrera (autenticado)
router.get(
  '/:id/students',
  authenticate,
  validateRequest(careerIdSchema),
  getCareerStudents
);

// ==================== RUTAS PROTEGIDAS ====================

// Crear nueva carrera (solo admin)
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validateRequest(createCareerSchema),
  createCareer
);

// Actualizar carrera (solo admin)
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validateRequest(updateCareerSchema),
  updateCareer
);

// Eliminar carrera (solo admin)
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validateRequest(careerIdSchema),
  deleteCareer
);

export default router;