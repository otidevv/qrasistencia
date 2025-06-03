// src/routes/qr.routes.ts
import { Router } from 'express';
import { generarQR, getQRActivo } from '../controllers/qr.controller';
import { authenticateToken, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();

// Generar QR manual (admin / operador)
router.post(
  '/:environmentId',
  authenticateToken,
  authorizeRole('admin', 'operador'),
  generarQR
);

// Obtener QR activo (operador) - RUTA CORREGIDA
router.get(
  '/:environmentId',
  authenticateToken,
  authorizeRole('admin', 'operador'),
  getQRActivo
);

export default router;