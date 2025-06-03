import { Router } from 'express';
import {
  crearUsuario,
  listarUsuarios,
  obtenerUsuario,
  actualizarUsuario,
  eliminarUsuario,
} from '../controllers/user.controller';
import { authenticateToken, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();

router.post('/', authenticateToken, authorizeRole('admin'), crearUsuario);
router.get('/', authenticateToken, authorizeRole('admin'), listarUsuarios);
router.get('/:id', authenticateToken, authorizeRole('admin'), obtenerUsuario);
router.put('/:id', authenticateToken, authorizeRole('admin'), actualizarUsuario);
router.delete('/:id', authenticateToken, authorizeRole('admin'), eliminarUsuario);

export default router;
