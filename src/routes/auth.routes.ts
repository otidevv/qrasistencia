// src/routes/auth.routes.ts
import { Router } from 'express';
import { 
  registerStudent, 
  registerUser, 
  login, 
  changePassword,
  getProfile 
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import { 
  registerStudentSchema, 
  registerUserSchema, 
  loginSchema,
  changePasswordSchema 
} from '../validations/auth.validation';

const router = Router();

// ==================== RUTAS PÚBLICAS ====================

// Registro de estudiante
router.post(
  '/register/student', 
  validateRequest(registerStudentSchema), 
  registerStudent
);

// Registro de otros usuarios (docente, admin, etc)
router.post(
  '/register/user', 
  validateRequest(registerUserSchema), 
  registerUser
);

// Login universal
router.post(
  '/login', 
  validateRequest(loginSchema), 
  login
);

// ==================== RUTAS PROTEGIDAS ====================

// Obtener perfil del usuario autenticado
router.get(
  '/profile', 
  authenticate, 
  getProfile
);

// Cambiar contraseña
router.post(
  '/change-password', 
  authenticate, 
  validateRequest(changePasswordSchema), 
  changePassword
);

export default router;