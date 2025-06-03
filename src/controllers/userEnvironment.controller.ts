// src/controllers/userEnvironment.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Listar ambientes de un usuario específico (para admin)
export const listarAmbientesDeUsuario = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;

  try {
    const asignaciones = await prisma.userEnvironment.findMany({
      where: { userId },
      include: {
        environment: true,
        user: { select: { name: true, email: true } }
      }
    });

    res.json(asignaciones.map(a => ({
      ambiente: a.environment,
      asignadoA: a.user
    })));
  } catch (error) {
    res.status(500).json({ message: 'Error al listar ambientes del usuario', error });
  }
};

// Asignar ambiente a usuario
export const asignarAmbienteUsuario = async (req: Request, res: Response): Promise<void> => {
  const { userId, environmentId } = req.body;

  try {
    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    // Verificar que el ambiente existe
    const environment = await prisma.environment.findUnique({ where: { id: environmentId } });
    if (!environment) {
      res.status(404).json({ message: 'Ambiente no encontrado' });
      return;
    }

    // Crear la relación
    const userEnvironment = await prisma.userEnvironment.create({
      data: {
        userId,
        environmentId
      },
      include: {
        environment: true,
        user: true
      }
    });

    res.status(201).json({ 
      message: 'Ambiente asignado correctamente',
      userEnvironment 
    });
  } catch (error: any) {
    // Si ya existe la asignación
    if (error.code === 'P2002') {
      res.status(400).json({ message: 'El usuario ya tiene asignado este ambiente' });
      return;
    }
    res.status(500).json({ message: 'Error al asignar ambiente', error });
  }
};

// Remover asignación de ambiente
export const removerAmbienteUsuario = async (req: Request, res: Response): Promise<void> => {
  const { userId, environmentId } = req.params;

  try {
    await prisma.userEnvironment.delete({
      where: {
        userId_environmentId: {
          userId,
          environmentId
        }
      }
    });

    res.json({ message: 'Asignación removida correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al remover asignación', error });
  }
};

// Obtener todos los usuarios con sus ambientes asignados (para admin)
export const listarTodasLasAsignaciones = async (_req: Request, res: Response): Promise<void> => {
  try {
    const asignaciones = await prisma.userEnvironment.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        environment: true
      }
    });

    res.json(asignaciones);
  } catch (error) {
    res.status(500).json({ message: 'Error al listar asignaciones', error });
  }
};