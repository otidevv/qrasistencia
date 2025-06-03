// src/routes/some-protected.routes.ts
import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();

// Solo usuarios con token válido
router.get('/perfil', authenticateToken, (req, res) => {
  res.json({ message: 'Perfil de usuario autenticado' });
});

// Solo admin o operador
router.post('/generar-qr', authenticateToken, authorizeRole('admin', 'operador'), (req, res) => {
  res.json({ message: 'QR generado' });
});

export default router;
