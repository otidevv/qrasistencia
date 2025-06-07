// src/controllers/environment.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { auditLog } from '../utils/logger';

const prisma = new PrismaClient();

// ==================== CREAR AMBIENTE ====================
export const createEnvironment = async (req: Request, res: Response): Promise<void> => {
  const { name, type, capacity, managerId } = req.body;

  try {
    // Verificar si ya existe un ambiente con el mismo nombre
    const existingEnvironment = await prisma.environment.findUnique({
      where: { name }
    });

    if (existingEnvironment) {
      res.status(400).json({
        success: false,
        message: 'Ya existe un ambiente con ese nombre'
      });
      return;
    }

    // Si se especifica un managerId, verificar que existe y tiene permisos
    if (managerId) {
      const manager = await prisma.user.findUnique({
        where: { id: managerId },
        include: { role: true }
      });

      if (!manager) {
        res.status(400).json({
          success: false,
          message: 'El usuario responsable no existe'
        });
        return;
      }

      // Verificar que el usuario sea JEFE_LAB o ADMIN
      if (!['JEFE_LAB', 'ADMIN'].includes(manager.role.name)) {
        res.status(400).json({
          success: false,
          message: 'El responsable debe tener rol de JEFE_LAB o ADMIN'
        });
        return;
      }
    }

    // Crear el ambiente
    const environment = await prisma.environment.create({
      data: {
        name: name.toUpperCase(),
        type,
        capacity,
        managerId,
        isActive: true
      },
      include: {
        manager: {
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
        action: 'CREATE_ENVIRONMENT',
        entityType: 'ENVIRONMENT',
        entityId: environment.id,
        metadata: {
          environmentName: environment.name,
          environmentType: environment.type,
          capacity: environment.capacity
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Ambiente creado exitosamente',
      data: environment
    });

  } catch (error) {
    console.error('Error al crear ambiente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear el ambiente',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// ==================== OBTENER TODOS LOS AMBIENTES ====================
export const getAllEnvironments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, isActive, managerId, page = 1, limit = 20, search } = req.query;

    // Configurar filtros
    const where: any = {};
    
    if (type) {
      where.type = type;
    }
    
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    
    if (managerId) {
      where.managerId = managerId;
    }
    
    if (search) {
      where.name = {
        contains: search as string,
        mode: 'insensitive'
      };
    }

    // Paginación
    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    // Obtener ambientes con paginación
    const [environments, total] = await Promise.all([
      prisma.environment.findMany({
        where,
        include: {
          manager: {
            select: {
              id: true,
              name: true,
              username: true
            }
          },
          _count: {
            select: {
              sessions: true
            }
          }
        },
        skip,
        take: limitNumber,
        orderBy: { name: 'asc' }
      }),
      prisma.environment.count({ where })
    ]);

    res.json({
      success: true,
      data: environments,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber)
      }
    });

  } catch (error) {
    console.error('Error al obtener ambientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los ambientes'
    });
  }
};

// ==================== OBTENER AMBIENTE POR ID ====================
export const getEnvironmentById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const environment = await prisma.environment.findUnique({
      where: { id },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true
          }
        },
        sessions: {
          where: {
            isActive: true,
            endTime: {
              gte: new Date()
            }
          },
          select: {
            id: true,
            name: true,
            type: true,
            startTime: true,
            endTime: true,
            host: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { startTime: 'asc' },
          take: 10
        },
        _count: {
          select: {
            sessions: true
          }
        }
      }
    });

    if (!environment) {
      res.status(404).json({
        success: false,
        message: 'Ambiente no encontrado'
      });
      return;
    }

    res.json({
      success: true,
      data: environment
    });

  } catch (error) {
    console.error('Error al obtener ambiente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el ambiente'
    });
  }
};

// ==================== ACTUALIZAR AMBIENTE ====================
export const updateEnvironment = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, type, capacity, managerId, isActive } = req.body;

  try {
    // Verificar que existe el ambiente
    const existingEnvironment = await prisma.environment.findUnique({
      where: { id }
    });

    if (!existingEnvironment) {
      res.status(404).json({
        success: false,
        message: 'Ambiente no encontrado'
      });
      return;
    }

    // Si se está cambiando el nombre, verificar que no exista otro con ese nombre
    if (name && name !== existingEnvironment.name) {
      const duplicateName = await prisma.environment.findUnique({
        where: { name }
      });

      if (duplicateName) {
        res.status(400).json({
          success: false,
          message: 'Ya existe otro ambiente con ese nombre'
        });
        return;
      }
    }

    // Si se especifica un nuevo managerId, verificar que existe y tiene permisos
    if (managerId !== undefined && managerId !== existingEnvironment.managerId) {
      if (managerId) {
        const manager = await prisma.user.findUnique({
          where: { id: managerId },
          include: { role: true }
        });

        if (!manager) {
          res.status(400).json({
            success: false,
            message: 'El usuario responsable no existe'
          });
          return;
        }

        if (!['JEFE_LAB', 'ADMIN'].includes(manager.role.name)) {
          res.status(400).json({
            success: false,
            message: 'El responsable debe tener rol de JEFE_LAB o ADMIN'
          });
          return;
        }
      }
    }

    // Actualizar el ambiente
    const updatedEnvironment = await prisma.environment.update({
      where: { id },
      data: {
        name: name ? name.toUpperCase() : undefined,
        type,
        capacity,
        managerId,
        isActive
      },
      include: {
        manager: {
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
        action: 'UPDATE_ENVIRONMENT',
        entityType: 'ENVIRONMENT',
        entityId: id,
        metadata: {
          oldData: existingEnvironment,
          newData: updatedEnvironment
        }
      }
    });

    res.json({
      success: true,
      message: 'Ambiente actualizado exitosamente',
      data: updatedEnvironment
    });

  } catch (error) {
    console.error('Error al actualizar ambiente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el ambiente'
    });
  }
};

// ==================== ELIMINAR AMBIENTE ====================
export const deleteEnvironment = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    // Verificar que existe el ambiente
    const environment = await prisma.environment.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            sessions: true
          }
        }
      }
    });

    if (!environment) {
      res.status(404).json({
        success: false,
        message: 'Ambiente no encontrado'
      });
      return;
    }

    // Verificar si tiene sesiones asociadas
    if (environment._count.sessions > 0) {
      // Verificar si hay sesiones activas futuras
      const activeSessions = await prisma.session.count({
        where: {
          environmentId: id,
          isActive: true,
          endTime: {
            gte: new Date()
          }
        }
      });

      if (activeSessions > 0) {
        res.status(400).json({
          success: false,
          message: `No se puede eliminar el ambiente porque tiene ${activeSessions} sesiones activas programadas`
        });
        return;
      }

      // Si solo hay sesiones pasadas, desactivar en lugar de eliminar
      await prisma.environment.update({
        where: { id },
        data: { isActive: false }
      });

      res.json({
        success: true,
        message: 'Ambiente desactivado (tiene historial de sesiones)'
      });
      return;
    }

    // Si no tiene sesiones, eliminar completamente
    await prisma.environment.delete({
      where: { id }
    });

    // Log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'DELETE_ENVIRONMENT',
        entityType: 'ENVIRONMENT',
        entityId: id,
        metadata: {
          environmentName: environment.name,
          environmentType: environment.type
        }
      }
    });

    res.json({
      success: true,
      message: 'Ambiente eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar ambiente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el ambiente'
    });
  }
};

// ==================== OBTENER AMBIENTES DISPONIBLES ====================
export const getAvailableEnvironments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, startTime, endTime, type, capacity } = req.query;

    // Validar que se proporcionen fecha y horas
    if (!date || !startTime || !endTime) {
      res.status(400).json({
        success: false,
        message: 'Debe proporcionar fecha, hora de inicio y hora de fin'
      });
      return;
    }

    // Construir fechas completas
    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);

    // Filtros base para ambientes
    const environmentWhere: any = {
      isActive: true
    };

    if (type) {
      environmentWhere.type = type;
    }

    if (capacity) {
      environmentWhere.capacity = {
        gte: parseInt(capacity as string)
      };
    }

    // Obtener todos los ambientes activos
    const allEnvironments = await prisma.environment.findMany({
      where: environmentWhere,
      include: {
        manager: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Obtener ambientes ocupados en el horario solicitado
    const occupiedEnvironments = await prisma.session.findMany({
      where: {
        isActive: true,
        OR: [
          {
            // Sesiones que empiezan durante el rango solicitado
            startTime: {
              gte: startDateTime,
              lt: endDateTime
            }
          },
          {
            // Sesiones que terminan durante el rango solicitado
            endTime: {
              gt: startDateTime,
              lte: endDateTime
            }
          },
          {
            // Sesiones que abarcan todo el rango solicitado
            AND: [
              { startTime: { lte: startDateTime } },
              { endTime: { gte: endDateTime } }
            ]
          }
        ]
      },
      select: {
        environmentId: true,
        name: true,
        startTime: true,
        endTime: true
      }
    });

    // Crear un Set de IDs de ambientes ocupados
    const occupiedIds = new Set(occupiedEnvironments.map(s => s.environmentId));

    // Filtrar ambientes disponibles
    const availableEnvironments = allEnvironments.filter(env => !occupiedIds.has(env.id));

    res.json({
      success: true,
      data: {
        available: availableEnvironments,
        occupied: allEnvironments.filter(env => occupiedIds.has(env.id)).map(env => ({
          ...env,
          occupiedBy: occupiedEnvironments.find(s => s.environmentId === env.id)
        })),
        query: {
          date,
          startTime,
          endTime,
          type,
          capacity
        }
      }
    });

  } catch (error) {
    console.error('Error al obtener ambientes disponibles:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ambientes disponibles'
    });
  }
};

// ==================== OBTENER HORARIO DE UN AMBIENTE ====================
export const getEnvironmentSchedule = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  
  try {
    const { startDate, endDate } = req.query;

    // Establecer rango de fechas (por defecto, próximos 7 días)
    const start = startDate ? new Date(startDate as string) : new Date();
    const end = endDate ? new Date(endDate as string) : new Date();
    
    if (!endDate) {
      end.setDate(end.getDate() + 7);
    }

    // Verificar que existe el ambiente
    const environment = await prisma.environment.findUnique({
      where: { id }
    });

    if (!environment) {
      res.status(404).json({
        success: false,
        message: 'Ambiente no encontrado'
      });
      return;
    }

    // Obtener sesiones del ambiente en el rango de fechas
    const sessions = await prisma.session.findMany({
      where: {
        environmentId: id,
        isActive: true,
        startTime: {
          gte: start
        },
        endTime: {
          lte: end
        }
      },
      include: {
        host: {
          select: {
            id: true,
            name: true,
            username: true
          }
        },
        _count: {
          select: {
            attendances: true
          }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    // Agrupar por día
    const schedule: { [key: string]: any[] } = {};
    
    sessions.forEach(session => {
      const dateKey = session.startTime.toISOString().split('T')[0];
      if (!schedule[dateKey]) {
        schedule[dateKey] = [];
      }
      schedule[dateKey].push({
        id: session.id,
        name: session.name,
        type: session.type,
        startTime: session.startTime,
        endTime: session.endTime,
        host: session.host?.name || session.hostName,
        attendanceCount: session._count.attendances
      });
    });

    res.json({
      success: true,
      data: {
        environment: {
          id: environment.id,
          name: environment.name,
          type: environment.type,
          capacity: environment.capacity
        },
        schedule,
        dateRange: {
          start,
          end
        },
        totalSessions: sessions.length
      }
    });

  } catch (error) {
    console.error('Error al obtener horario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el horario del ambiente'
    });
  }
};

// ==================== RESERVAR AMBIENTE ====================
export const bookEnvironment = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { sessionName, sessionType, startTime, endTime, allowExternals, qrRotationMinutes } = req.body;

  try {
    // Verificar que existe el ambiente
    const environment = await prisma.environment.findUnique({
      where: { id }
    });

    if (!environment) {
      res.status(404).json({
        success: false,
        message: 'Ambiente no encontrado'
      });
      return;
    }

    if (!environment.isActive) {
      res.status(400).json({
        success: false,
        message: 'El ambiente no está activo'
      });
      return;
    }

    // Verificar disponibilidad
    const conflictingSessions = await prisma.session.count({
      where: {
        environmentId: id,
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
        message: 'El ambiente no está disponible en el horario solicitado'
      });
      return;
    }

    // Generar código QR inicial
    const initialQRCode = `QR-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Crear la sesión
    const session = await prisma.session.create({
      data: {
        environmentId: id,
        name: sessionName,
        type: sessionType,
        allowExternals: allowExternals || false,
        hostId: req.user?.userId,
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
        action: 'BOOK_ENVIRONMENT',
        entityType: 'SESSION',
        entityId: session.id,
        metadata: {
          environmentId: id,
          environmentName: environment.name,
          sessionName,
          startTime,
          endTime
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Ambiente reservado exitosamente',
      data: session
    });

  } catch (error) {
    console.error('Error al reservar ambiente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reservar el ambiente'
    });
  }
};

// ==================== LIBERAR AMBIENTE ====================
export const releaseEnvironment = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    // Buscar sesión activa actual en el ambiente
    const activeSession = await prisma.session.findFirst({
      where: {
        environmentId: id,
        isActive: true,
        startTime: {
          lte: new Date()
        },
        endTime: {
          gte: new Date()
        }
      },
      include: {
        host: true
      }
    });

    if (!activeSession) {
      res.status(404).json({
        success: false,
        message: 'No hay sesión activa en este ambiente'
      });
      return;
    }

    // Verificar permisos (solo el host, jefe de lab o admin pueden liberar)
    const userRole = req.user?.role;
    const isHost = activeSession.hostId === req.user?.userId;
    const hasPermission = isHost || ['JEFE_LAB', 'ADMIN'].includes(userRole || '');

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: 'No tienes permisos para liberar este ambiente'
      });
      return;
    }

    // Cerrar la sesión
    const updatedSession = await prisma.session.update({
      where: { id: activeSession.id },
      data: {
        isActive: false,
        endTime: new Date() // Actualizar hora de fin a ahora
      }
    });

    // Log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'RELEASE_ENVIRONMENT',
        entityType: 'SESSION',
        entityId: activeSession.id,
        metadata: {
          environmentId: id,
          sessionName: activeSession.name,
          originalEndTime: activeSession.endTime,
          releasedAt: new Date()
        }
      }
    });

    res.json({
      success: true,
      message: 'Ambiente liberado exitosamente',
      data: {
        session: updatedSession,
        releasedBy: req.user?.username
      }
    });

  } catch (error) {
    console.error('Error al liberar ambiente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al liberar el ambiente'
    });
  }
};