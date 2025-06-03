// src/routes/stats.routes.ts
import { Router } from 'express';
import { getAdminStats, getOperatorStats } from '../controllers/stats.controller';
import { authenticateToken, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();

// Estadísticas para admin
router.get(
  '/admin',
  authenticateToken,
  authorizeRole('admin'),
  getAdminStats
);

// Estadísticas para operador
router.get(
  '/operator',
  authenticateToken,
  authorizeRole('operador'),
  getOperatorStats
);

export default router;