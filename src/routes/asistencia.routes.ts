// src/routes/asistencia.routes.ts
import { Router } from 'express';
import { registrarAsistencia } from '../controllers/asistencia.controller';
import { authenticateToken, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();

// Solo estudiantes pueden registrar asistencia
// Ruta: POST /api/asistencia (sin /scan)
router.post(
  '/',
  authenticateToken,
  authorizeRole('estudiante'),
  registrarAsistencia
);

export default router;