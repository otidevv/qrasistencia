// src/routes/environment.routes.ts
import { Router } from 'express';
import {
  crearAmbiente,
  listarAmbientes,
  listarAmbientesUsuarioAutenticado, // ✅ NUEVA IMPORTACIÓN
  obtenerAmbiente,
  actualizarAmbiente,
  eliminarAmbiente
} from '../controllers/environment.controller';
import { authenticateToken, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();

router.post('/', authenticateToken, authorizeRole('admin'), crearAmbiente);
router.get('/', authenticateToken, listarAmbientes); // público autenticado
router.get('/user', authenticateToken, listarAmbientesUsuarioAutenticado); // ✅ NUEVA RUTA
router.get('/:id', authenticateToken, obtenerAmbiente);
router.put('/:id', authenticateToken, authorizeRole('admin'), actualizarAmbiente);
router.delete('/:id', authenticateToken, authorizeRole('admin'), eliminarAmbiente);

export default router;