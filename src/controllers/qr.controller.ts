// src/controllers/qr.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export const generarQR = async (req: Request, res: Response): Promise<void> => {
  const { environmentId } = req.params;

  try {
    const ambiente = await prisma.environment.findUnique({ where: { id: environmentId } });
    if (!ambiente) {
      res.status(404).json({ message: 'Ambiente no encontrado' });
      return;
    }

    // Desactivar QRs anteriores
    await prisma.environmentQR.updateMany({
      where: {
        environmentId,
        isActive: true
      },
      data: {
        isActive: false
      }
    });

    const code = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 1000); // 60 segundos

    const nuevoQR = await prisma.environmentQR.create({
      data: {
        code,
        environmentId,
        expiresAt,
        isActive: true
      }
    });

    res.json({
      message: 'QR generado exitosamente',
      qr: {
        id: nuevoQR.id,
        code: nuevoQR.code,
        expiresAt: nuevoQR.expiresAt,
        isActive: nuevoQR.isActive,
        environmentId: nuevoQR.environmentId
      }
    });
  } catch (error) {
    console.error('Error al generar QR:', error);
    res.status(500).json({ message: 'Error del servidor', error });
  }
};

/**
 * Devuelve el QR activo del ambiente, o genera uno si no existe
 */
export const getQRActivo = async (req: Request, res: Response): Promise<void> => {
  const { environmentId } = req.params;

  try {
    const ahora = new Date();

    // 1. Buscar si hay QR activo y vigente
    let qr = await prisma.environmentQR.findFirst({
      where: {
        environmentId,
        isActive: true,
        expiresAt: { gt: ahora },
      },
    });

    // 2. Si no hay, generar uno nuevo
    if (!qr) {
      // Desactivar QRs anteriores
      await prisma.environmentQR.updateMany({
        where: {
          environmentId,
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      const nuevoCodigo = uuidv4();
      const duracionMinutos = 1;

      qr = await prisma.environmentQR.create({
        data: {
          code: nuevoCodigo,
          environmentId,
          expiresAt: new Date(ahora.getTime() + duracionMinutos * 60 * 1000),
          isActive: true,
        },
      });
    }

    res.json({
      message: 'QR activo',
      qr: {
        id: qr.id,
        code: qr.code,
        expiresAt: qr.expiresAt,
        isActive: qr.isActive,
        environmentId: qr.environmentId
      }
    });

  } catch (error) {
    console.error('Error al obtener QR activo:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};