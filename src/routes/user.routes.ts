// src/routes/user.routes.ts
import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  toggleUserStatus,
  resetUserPassword,
  getUserStats
} from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import {
  updateUserSchema,
  resetPasswordSchema,
  userIdSchema,
  userQuerySchema
} from '../validations/user.validation';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ==================== RUTAS DE CONSULTA ====================

// Obtener estadísticas de usuarios (solo admin)
router.get(
  '/stats',
  authorize('ADMIN'),
  getUserStats
);

// Obtener todos los usuarios (admin y jefe de lab pueden ver)
router.get(
  '/',
  authorize('ADMIN', 'JEFE_LAB'),
  validateRequest(userQuerySchema),
  getAllUsers
);

// Obtener usuario por ID
router.get(
  '/:id',
  authorize('ADMIN', 'JEFE_LAB'),
  validateRequest(userIdSchema),
  getUserById
);

// ==================== RUTAS DE MODIFICACIÓN (SOLO ADMIN) ====================

// Actualizar usuario
router.put(
  '/:id',
  authorize('ADMIN'),
  validateRequest(updateUserSchema),
  updateUser
);

// Cambiar estado de usuario (activar/desactivar)
router.patch(
  '/:id/toggle-status',
  authorize('ADMIN'),
  validateRequest(userIdSchema),
  toggleUserStatus
);

// Resetear contraseña de usuario
router.post(
  '/:id/reset-password',
  authorize('ADMIN'),
  validateRequest(resetPasswordSchema),
  resetUserPassword
);

// Eliminar usuario
router.delete(
  '/:id',
  authorize('ADMIN'),
  validateRequest(userIdSchema),
  deleteUser
);

export default router;