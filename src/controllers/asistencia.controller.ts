// src/controllers/asistencia.controller.ts
import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';

const prisma = new PrismaClient();

export const registrarAsistencia = async (req: AuthRequest, res: Response): Promise<void> => {
  const { qrCode } = req.body;
  
  if (!req.user) {
    res.status(401).json({ message: 'Usuario no autenticado' });
    return;
  }
  
  // 👇 AQUÍ ESTÁ LA CORRECCIÓN: usar userId en lugar de id
  const userId = req.user.userId;

  try {
    // Buscar QR válido
    const qr = await prisma.environmentQR.findFirst({
      where: {
        code: qrCode,
        isActive: true,
        expiresAt: { gt: new Date() }
      },
      include: { environment: true }
    });

    if (!qr) {
      res.status(400).json({ message: 'QR inválido o expirado' });
      return;
    }

    // Validar si ya registró asistencia hoy
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    const finDia = new Date();
    finDia.setHours(23, 59, 59, 999);

    const yaRegistrado = await prisma.attendance.findFirst({
      where: {
        userId,
        environmentId: qr.environmentId,
        timestamp: {
          gte: inicioDia,
          lte: finDia
        }
      }
    });

    if (yaRegistrado) {
      res.status(400).json({ message: 'Ya registraste tu asistencia hoy en este ambiente' });
      return;
    }

    // Registrar asistencia
    const attendance = await prisma.attendance.create({
      data: {
        userId,
        environmentId: qr.environmentId,
        qrCodeUsed: qrCode
      },
      include: {
        environment: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Asistencia registrada correctamente',
      environment: attendance.environment,
      timestamp: attendance.timestamp,
      user: attendance.user
    });

  } catch (error) {
    console.error('Error al registrar asistencia:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};