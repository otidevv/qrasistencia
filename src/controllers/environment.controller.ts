// src/controllers/environment.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const crearAmbiente = async (req: Request, res: Response): Promise<void> => {
  const { name, type, location } = req.body;

  try {
    const nuevo = await prisma.environment.create({
      data: { name, type, location },
    });
    res.status(201).json({ message: 'Ambiente creado', ambiente: nuevo });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear ambiente', error });
  }
};

export const listarAmbientes = async (_req: Request, res: Response): Promise<void> => {
  try {
    const ambientes = await prisma.environment.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(ambientes);
  } catch (error) {
    res.status(500).json({ message: 'Error al listar ambientes', error });
  }
};

// ✅ NUEVO MÉTODO - Listar ambientes del usuario autenticado
export const listarAmbientesUsuarioAutenticado = async (req: Request, res: Response): Promise<void> => {
  try {
    // Obtener el userId del token (viene del middleware authenticateToken)
    const userId = (req as any).user.userId;  // 👈 CAMBIO AQUÍ
    const userRole = (req as any).user.role;

    let ambientes;

    // Si es admin, puede ver todos los ambientes
    if (userRole === 'admin') {
      ambientes = await prisma.environment.findMany({
        orderBy: { createdAt: 'desc' }
      });
    } else {
      // Si es operador o estudiante, solo ve los ambientes asignados
      const asignaciones = await prisma.userEnvironment.findMany({
        where: { userId },
        include: { environment: true }
      });
      
      // Extraer solo los ambientes
      ambientes = asignaciones.map(a => a.environment);
    }

    res.json(ambientes);
  } catch (error) {
    res.status(500).json({ message: 'Error al listar ambientes del usuario', error });
  }
};

export const obtenerAmbiente = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const ambiente = await prisma.environment.findUnique({ where: { id } });
    if (!ambiente) {
      res.status(404).json({ message: 'Ambiente no encontrado' });
      return;
    }
    res.json(ambiente);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener ambiente', error });
  }
};

export const actualizarAmbiente = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, type, location } = req.body;

  try {
    const actualizado = await prisma.environment.update({
      where: { id },
      data: { name, type, location },
    });
    res.json({ message: 'Ambiente actualizado', ambiente: actualizado });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar ambiente', error });
  }
};

export const eliminarAmbiente = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    await prisma.environment.delete({ where: { id } });
    res.json({ message: 'Ambiente eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar ambiente', error });
  }
};