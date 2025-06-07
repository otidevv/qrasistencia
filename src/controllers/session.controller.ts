// src/controllers/session.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { qrLog, auditLog } from '../utils/logger';
import QRCode from 'qrcode';

const prisma = new PrismaClient();

// Helper para generar código QR único
const generateUniqueQRCode = (): string => {
  return `QR-${Date.now()}-${Math.random().toString(36).substring(7)}`;
};

// ==================== CREAR SESIÓN ====================
export const createSession = async (req: Request, res: Response): Promise<void> => {
  const { environmentId, name, type, allowExternals, hostName, startTime, endTime, qrRotationMinutes } = req.body;

  try {
    // Verificar que el ambiente existe y está activo
    const environment = await prisma.environment.findUnique({
      where: { id: environmentId }
    });

    if (!environment || !environment.isActive) {
      res.status(400).json({
        success: false,
        message: 'Ambiente no válido o inactivo'
      });
      return;
    }

    // Verificar disponibilidad del ambiente
    const conflictingSessions = await prisma.session.count({
      where: {
        environmentId,
        isActive: true,
        OR: [
          {
            startTime: {
              gte: new Date(startTime),
              lt: new Date(endTime)
            }
          },
          {
            endTime: {
              gt: new Date(startTime),
              lte: new Date(endTime)
            }
          },
          {
            AND: [
              { startTime: { lte: new Date(startTime) } },
              { endTime: { gte: new Date(endTime) } }
            ]
          }
        ]
      }
    });

    if (conflictingSessions > 0) {
      res.status(400).json({
        success: false,
        message: 'El ambiente no está disponible en el horario especificado'
      });
      return;
    }

    // Generar código QR inicial
    const initialQRCode = generateUniqueQRCode();

    // Crear la sesión
    const session = await prisma.session.create({
      data: {
        environmentId,
        name,
        type,
        allowExternals: allowExternals || false,
        hostId: req.user?.userId,
        hostName: allowExternals ? hostName : undefined,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        qrRotationMinutes: qrRotationMinutes || 3,
        currentQRCode: initialQRCode,
        lastQRRotation: new Date(),
        isActive: true
      },
      include: {
        environment: true,
        host: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      }
    });

    // Crear el primer código QR en el historial
    await prisma.qRCode.create({
      data: {
        sessionId: session.id,
        code: initialQRCode,
        validFrom: new Date(),
        validUntil: new Date(endTime)
      }
    });

    // Log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'CREATE_SESSION',
        entityType: 'SESSION',
        entityId: session.id,
        metadata: {
          sessionName: name,
          environmentName: environment.name,
          sessionType: type
        }
      }
    });

    qrLog('SESSION_CREATED', session.id, {
      environment: environment.name,
      host: req.user?.username
    });

    res.status(201).json({
      success: true,
      message: 'Sesión creada exitosamente',
      data: session
    });

  } catch (error) {
    console.error('Error al crear sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear la sesión'
    });
  }
};

// ==================== ACTUALIZAR SESIÓN ====================
export const updateSession = async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;
  const updates = req.body;

  try {
    // Verificar que existe la sesión
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { host: true }
    });

    if (!session) {
      res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
      return;
    }

    // Verificar permisos (solo el host o admin)
    const isHost = session.hostId === req.user?.userId;
    const isAdmin = req.user?.role === 'ADMIN';

    if (!isHost && !isAdmin) {
      res.status(403).json({
        success: false,
        message: 'No tienes permisos para actualizar esta sesión'
      });
      return;
    }

    // Si se están actualizando las fechas, verificar disponibilidad
    if (updates.startTime || updates.endTime) {
      const newStartTime = updates.startTime ? new Date(updates.startTime) : session.startTime;
      const newEndTime = updates.endTime ? new Date(updates.endTime) : session.endTime;

      const conflicts = await prisma.session.count({
        where: {
          id: { not: sessionId },
          environmentId: session.environmentId,
          isActive: true,
          OR: [
            {
              startTime: {
                gte: newStartTime,
                lt: newEndTime
              }
            },
            {
              endTime: {
                gt: newStartTime,
                lte: newEndTime
              }
            }
          ]
        }
      });

      if (conflicts > 0) {
        res.status(400).json({
          success: false,
          message: 'El nuevo horario entra en conflicto con otras sesiones'
        });
        return;
      }
    }

    // Actualizar la sesión
    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        ...updates,
        startTime: updates.startTime ? new Date(updates.startTime) : undefined,
        endTime: updates.endTime ? new Date(updates.endTime) : undefined
      },
      include: {
        environment: true,
        host: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      }
    });

    // Log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'UPDATE_SESSION',
        entityType: 'SESSION',
        entityId: sessionId,
        metadata: {
          changes: updates
        }
      }
    });

    res.json({
      success: true,
      message: 'Sesión actualizada exitosamente',
      data: updatedSession
    });

  } catch (error) {
    console.error('Error al actualizar sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la sesión'
    });
  }
};

// ==================== ELIMINAR SESIÓN ====================
export const deleteSession = async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;

  try {
    // Verificar que existe la sesión
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        _count: {
          select: { attendances: true }
        }
      }
    });

    if (!session) {
      res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
      return;
    }

    // Verificar permisos
    const isHost = session.hostId === req.user?.userId;
    const isAdmin = req.user?.role === 'ADMIN';

    if (!isHost && !isAdmin) {
      res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar esta sesión'
      });
      return;
    }

    // Si tiene asistencias, solo desactivar
    if (session._count.attendances > 0) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { isActive: false }
      });

      res.json({
        success: true,
        message: 'Sesión desactivada (tiene registros de asistencia)'
      });
      return;
    }

    // Si no tiene asistencias, eliminar completamente
    await prisma.session.delete({
      where: { id: sessionId }
    });

    // Log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'DELETE_SESSION',
        entityType: 'SESSION',
        entityId: sessionId,
        metadata: {
          sessionName: session.name
        }
      }
    });

    res.json({
      success: true,
      message: 'Sesión eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la sesión'
    });
  }
};

// ==================== OBTENER SESIÓN POR ID ====================
export const getSessionById = async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        environment: true,
        host: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true
          }
        },
        attendances: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true
              }
            },
            externalPerson: true
          },
          orderBy: { checkInTime: 'desc' }
        },
        _count: {
          select: {
            attendances: true,
            qrHistory: true
          }
        }
      }
    });

    if (!session) {
      res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
      return;
    }

    res.json({
      success: true,
      data: session
    });

  } catch (error) {
    console.error('Error al obtener sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la sesión'
    });
  }
};

// ==================== OBTENER SESIONES DEL DOCENTE ====================
export const getSessionsByTeacher = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20, isActive, startDate, endDate } = req.query;

    const where: any = {
      hostId: req.user?.userId
    };

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (startDate) {
      where.startTime = {
        ...where.startTime,
        gte: new Date(startDate as string)
      };
    }

    if (endDate) {
      where.endTime = {
        ...where.endTime,
        lte: new Date(endDate as string)
      };
    }

    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        include: {
          environment: true,
          _count: {
            select: { attendances: true }
          }
        },
        skip,
        take: limitNumber,
        orderBy: { startTime: 'desc' }
      }),
      prisma.session.count({ where })
    ]);

    res.json({
      success: true,
      data: sessions,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber)
      }
    });

  } catch (error) {
    console.error('Error al obtener sesiones del docente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las sesiones'
    });
  }
};

// ==================== OBTENER SESIONES DEL ESTUDIANTE ====================
export const getSessionsByStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20, attended } = req.query;

    // Obtener sesiones donde el estudiante tiene asistencia registrada
    const attendanceWhere: any = {
      userId: req.user?.userId
    };

    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    const attendances = await prisma.attendance.findMany({
      where: attendanceWhere,
      include: {
        session: {
          include: {
            environment: true,
            host: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      skip,
      take: limitNumber,
      orderBy: { checkInTime: 'desc' }
    });

    const total = await prisma.attendance.count({ where: attendanceWhere });

    res.json({
      success: true,
      data: attendances.map(a => ({
        ...a.session,
        attendance: {
          checkInTime: a.checkInTime,
          checkOutTime: a.checkOutTime
        }
      })),
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber)
      }
    });

  } catch (error) {
    console.error('Error al obtener sesiones del estudiante:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las sesiones'
    });
  }
};

// ==================== OBTENER SESIÓN ACTIVA ====================
export const getActiveSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { environmentId } = req.query;

    const where: any = {
      isActive: true,
      startTime: { lte: new Date() },
      endTime: { gte: new Date() }
    };

    if (environmentId) {
      where.environmentId = environmentId;
    }

    const sessions = await prisma.session.findMany({
      where,
      include: {
        environment: true,
        host: {
          select: {
            id: true,
            name: true,
            username: true
          }
        },
        _count: {
          select: { attendances: true }
        }
      }
    });

    res.json({
      success: true,
      data: sessions
    });

  } catch (error) {
    console.error('Error al obtener sesiones activas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las sesiones activas'
    });
  }
};

// ==================== GENERAR CÓDIGO QR ====================
export const generateQRCode = async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;
  const { forceNew = false } = req.body;

  try {
    // Verificar que existe la sesión
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
      return;
    }

    // Verificar permisos
    if (session.hostId !== req.user?.userId && req.user?.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'No tienes permisos para generar QR de esta sesión'
      });
      return;
    }

    // Verificar si la sesión está activa
    if (!session.isActive) {
      res.status(400).json({
        success: false,
        message: 'La sesión no está activa'
      });
      return;
    }

    // Verificar si necesita rotación o se fuerza nueva generación
    const now = new Date();
    const timeSinceLastRotation = now.getTime() - (session.lastQRRotation?.getTime() || 0);
    const rotationInterval = session.qrRotationMinutes * 60 * 1000;
    
    let newQRCode = session.currentQRCode;
    
    if (forceNew || !session.currentQRCode || timeSinceLastRotation >= rotationInterval) {
      // Generar nuevo código
      newQRCode = generateUniqueQRCode();
      
      // Actualizar sesión
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          currentQRCode: newQRCode,
          lastQRRotation: now
        }
      });

      // Guardar en historial
      await prisma.qRCode.create({
        data: {
          sessionId,
          code: newQRCode,
          validFrom: now,
          validUntil: new Date(now.getTime() + rotationInterval)
        }
      });

      qrLog('QR_GENERATED', sessionId, {
        code: newQRCode,
        forced: forceNew
      });
    }

    // Generar imagen QR
    const qrData = {
      sessionId,
      code: newQRCode,
      timestamp: now.toISOString()
    };

    const qrImage = await QRCode.toDataURL(JSON.stringify(qrData), {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    res.json({
      success: true,
      data: {
        code: newQRCode,
        qrImage,
        validUntil: new Date(now.getTime() + rotationInterval),
        sessionInfo: {
          id: session.id,
          name: session.name,
          environment: session.environmentId
        }
      }
    });

  } catch (error) {
    console.error('Error al generar QR:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar código QR'
    });
  }
};

// ==================== CERRAR SESIÓN ====================
export const closeSession = async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;

  try {
    // Verificar que existe la sesión
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
      return;
    }

    // Verificar permisos
    if (session.hostId !== req.user?.userId && req.user?.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: 'No tienes permisos para cerrar esta sesión'
      });
      return;
    }

    // Cerrar la sesión
    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        endTime: new Date() // Actualizar hora de fin a ahora
      }
    });

    // Marcar salida de todos los asistentes que no hayan salido
    await prisma.attendance.updateMany({
      where: {
        sessionId,
        checkOutTime: null
      },
      data: {
        checkOutTime: new Date()
      }
    });

    // Log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'CLOSE_SESSION',
        entityType: 'SESSION',
        entityId: sessionId,
        metadata: {
          sessionName: session.name,
          originalEndTime: session.endTime,
          closedAt: new Date()
        }
      }
    });

    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente',
      data: updatedSession
    });

  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cerrar la sesión'
    });
  }
};

// ==================== OBTENER ASISTENCIA DE LA SESIÓN ====================
export const getSessionAttendance = async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;

  try {
    // Verificar que existe la sesión
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        environment: true,
        host: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!session) {
      res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
      return;
    }

    // Obtener asistencias
    const attendances = await prisma.attendance.findMany({
      where: { sessionId },
      include: {
        user: {
          include: {
            studentProfile: {
              include: {
                career: true
              }
            }
          }
        },
        externalPerson: true
      },
      orderBy: { checkInTime: 'asc' }
    });

    // Calcular estadísticas
    const stats = {
      total: attendances.length,
      students: attendances.filter(a => a.userId).length,
      externals: attendances.filter(a => a.externalPersonId).length,
      suspicious: attendances.filter(a => a.isSuspicious).length,
      stillPresent: attendances.filter(a => !a.checkOutTime).length
    };

    res.json({
      success: true,
      data: {
        session: {
          id: session.id,
          name: session.name,
          environment: session.environment.name,
          host: session.host?.name || session.hostName,
          startTime: session.startTime,
          endTime: session.endTime,
          isActive: session.isActive
        },
        attendances: attendances.map(a => ({
          id: a.id,
          checkInTime: a.checkInTime,
          checkOutTime: a.checkOutTime,
          duration: a.checkOutTime 
            ? Math.floor((a.checkOutTime.getTime() - a.checkInTime.getTime()) / 60000)
            : null,
          isSuspicious: a.isSuspicious,
          suspiciousReason: a.suspiciousReason,
          attendee: a.user ? {
            type: 'student',
            id: a.user.id,
            name: a.user.name,
            code: a.user.username,
            career: a.user.studentProfile?.career.name
          } : {
            type: 'external',
            id: a.externalPerson!.id,
            name: a.externalPerson!.fullName,
            dni: a.externalPerson!.dni,
            institution: a.externalPerson!.institution
          }
        })),
        stats
      }
    });

  } catch (error) {
    console.error('Error al obtener asistencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la asistencia'
    });
  }
};  