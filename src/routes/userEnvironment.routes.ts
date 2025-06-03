// src/routes/userEnvironment.routes.ts
import { Router } from 'express';
import { 
  listarAmbientesDeUsuario,
  asignarAmbienteUsuario,
  removerAmbienteUsuario,
  listarTodasLasAsignaciones
} from '../controllers/userEnvironment.controller';
import { authenticateToken, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();

// Listar todas las asignaciones (admin)
router.get('/', authenticateToken, authorizeRole('admin'), listarTodasLasAsignaciones);

// Obtener ambientes de un usuario específico (admin)
router.get('/usuario/:userId', authenticateToken, authorizeRole('admin'), listarAmbientesDeUsuario);

// Asignar ambiente a usuario (admin)
router.post('/asignar', authenticateToken, authorizeRole('admin'), asignarAmbienteUsuario);

// Remover asignación (admin)
router.delete('/asignar/:userId/:environmentId', authenticateToken, authorizeRole('admin'), removerAmbienteUsuario);

export default router;