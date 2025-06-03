// src/controllers/stats.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAdminStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Contar usuarios totales
    const totalUsers = await prisma.user.count();
    
    // Contar ambientes totales
    const totalEnvironments = await prisma.environment.count();
    
    // Contar asistencias de hoy
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    
    const finDia = new Date();
    finDia.setHours(23, 59, 59, 999);
    
    const todayAttendances = await prisma.attendance.count({
      where: {
        timestamp: {
          gte: inicioDia,
          lte: finDia
        }
      }
    });
    
    // Contar QRs activos (no expirados)
    const activeQRs = await prisma.environmentQR.count({
      where: {
        isActive: true,
        expiresAt: {
          gt: new Date()
        }
      }
    });
    
    res.json({
      totalUsers,
      totalEnvironments,
      todayAttendances,
      activeQRs
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ message: 'Error al obtener estadísticas' });
  }
};

// Estadísticas para el operador
export const getOperatorStats = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.userId;
  
  try {
    // Obtener ambientes asignados al operador
    const userEnvironments = await prisma.userEnvironment.findMany({
      where: { userId },
      select: { environmentId: true }
    });
    
    const environmentIds = userEnvironments.map(ue => ue.environmentId);
    
    // Contar asistencias de hoy en los ambientes del operador
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    
    const finDia = new Date();
    finDia.setHours(23, 59, 59, 999);
    
    const todayAttendances = await prisma.attendance.count({
      where: {
        environmentId: {
          in: environmentIds
        },
        timestamp: {
          gte: inicioDia,
          lte: finDia
        }
      }
    });
    
    // Contar QRs activos de los ambientes del operador
    const activeQRs = await prisma.environmentQR.count({
      where: {
        environmentId: {
          in: environmentIds
        },
        isActive: true,
        expiresAt: {
          gt: new Date()
        }
      }
    });
    
    res.json({
      todayAttendances,
      activeQRs,
      totalEnvironments: environmentIds.length
    });
  } catch (error) {
    console.error('Error al obtener estadísticas del operador:', error);
    res.status(500).json({ message: 'Error al obtener estadísticas' });
  }
};