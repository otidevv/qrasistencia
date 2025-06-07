// src/controllers/attendance.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { attendanceLog } from '../utils/logger';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';

const prisma = new PrismaClient();

// ==================== MARCAR ASISTENCIA ====================
export const markAttendance = async (req: Request, res: Response): Promise<void> => {
  const { qrCode, location } = req.body;
  const userId = req.user?.userId;

  try {
    // Buscar el código QR en el historial
    const qr = await prisma.qRCode.findUnique({
      where: { code: qrCode },
      include: {
        session: {
          include: {
            environment: true
          }
        }
      }
    });

    if (!qr) {
      res.status(400).json({
        success: false,
        message: 'Código QR inválido'
      });
      return;
    }

    const session = qr.session;
    const now = new Date();

    // Verificar que la sesión está activa
    if (!session.isActive) {
      res.status(400).json({
        success: false,
        message: 'La sesión no está activa'
      });
      return;
    }

    // Verificar que el QR está vigente
    if (now < qr.validFrom || now > qr.validUntil) {
      res.status(400).json({
        success: false,
        message: 'El código QR ha expirado'
      });
      return;
    }

    // Verificar que es el QR actual de la sesión
    if (session.currentQRCode !== qrCode) {
      res.status(400).json({
        success: false,
        message: 'El código QR ya no es válido'
      });
      return;
    }

    // Verificar horario de la sesión
    if (now < session.startTime || now > session.endTime) {
      res.status(400).json({
        success: false,
        message: 'Fuera del horario de la sesión'
      });
      return;
    }

    // Verificar si ya marcó asistencia
    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        sessionId_userId: {
          sessionId: session.id,
          userId: userId!
        }
      }
    });

    if (existingAttendance) {
      // Si ya marcó entrada pero no salida, marcar salida
      if (!existingAttendance.checkOutTime) {
        const updated = await prisma.attendance.update({
          where: { id: existingAttendance.id },
          data: { checkOutTime: now }
        });

        attendanceLog('CHECK_OUT', userId!, session.id, {
          environment: session.environment.name
        });

        res.json({
          success: true,
          message: 'Salida registrada exitosamente',
          data: {
            type: 'checkout',
            attendance: updated
          }
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: 'Ya has registrado entrada y salida para esta sesión'
      });
      return;
    }

    // Detectar posibles anomalías
    let isSuspicious = false;
    let suspiciousReason = null;

    // Verificar múltiples registros desde la misma IP en poco tiempo
    const recentFromIP = await prisma.attendance.count({
      where: {
        sessionId: session.id,
        ipAddress: req.ip,
        checkInTime: {
          gte: new Date(now.getTime() - 60000) // Último minuto
        }
      }
    });

    if (recentFromIP > 2) {
      isSuspicious = true;
      suspiciousReason = 'Múltiples registros desde la misma IP';
    }

    // Incrementar contador de escaneos del QR
    await prisma.qRCode.update({
      where: { id: qr.id },
      data: { scanCount: { increment: 1 } }
    });

    // Crear registro de asistencia
    const attendance = await prisma.attendance.create({
      data: {
        sessionId: session.id,
        userId,
        checkInTime: now,
        isSuspicious,
        suspiciousReason,
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent']
      },
      include: {
        session: {
          include: {
            environment: true
          }
        }
      }
    });

    // Log de auditoría
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'ATTENDANCE_MARKED',
        entityType: 'ATTENDANCE',
        entityId: attendance.id,
        metadata: {
          sessionId: session.id,
          sessionName: session.name,
          environment: session.environment.name,
          isSuspicious
        }
      }
    });

    attendanceLog('CHECK_IN', userId!, session.id, {
      environment: session.environment.name,
      suspicious: isSuspicious
    });

    // Si es sospechoso, crear notificación para el docente
    if (isSuspicious && session.hostId) {
      await prisma.notification.create({
        data: {
          userId: session.hostId,
          type: 'SUSPICIOUS_ATTENDANCE',
          title: 'Asistencia sospechosa detectada',
          message: `Se detectó un registro sospechoso en ${session.name}: ${suspiciousReason}`,
          data: {
            sessionId: session.id,
            attendanceId: attendance.id,
            studentName: req.user?.username
          }
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Asistencia registrada exitosamente',
      data: {
        type: 'checkin',
        attendance,
        warning: isSuspicious ? suspiciousReason : null
      }
    });

  } catch (error) {
    console.error('Error al marcar asistencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar la asistencia'
    });
  }
};

// ==================== VERIFICAR CÓDIGO QR ====================
export const verifyQRCode = async (req: Request, res: Response): Promise<void> => {
  const { qrCode } = req.body;

  try {
    // Buscar el código QR
    const qr = await prisma.qRCode.findUnique({
      where: { code: qrCode },
      include: {
        session: {
          include: {
            environment: true,
            host: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    if (!qr) {
      res.status(400).json({
        success: false,
        message: 'Código QR inválido',
        valid: false
      });
      return;
    }

    const session = qr.session;
    const now = new Date();

    // Verificaciones
    const isActive = session.isActive;
    const isCurrentQR = session.currentQRCode === qrCode;
    const isInTime = now >= session.startTime && now <= session.endTime;
    const isQRValid = now >= qr.validFrom && now <= qr.validUntil;

    const valid = isActive && isCurrentQR && isInTime && isQRValid;

    res.json({
      success: true,
      valid,
      data: {
        session: {
          id: session.id,
          name: session.name,
          type: session.type,
          environment: session.environment.name,
          host: session.host?.name || session.hostName,
          startTime: session.startTime,
          endTime: session.endTime
        },
        validations: {
          isActive,
          isCurrentQR,
          isInTime,
          isQRValid
        },
        message: !valid ? 
          !isActive ? 'La sesión no está activa' :
          !isCurrentQR ? 'El código QR ha sido rotado' :
          !isInTime ? 'Fuera del horario de la sesión' :
          !isQRValid ? 'El código QR ha expirado' :
          'Código válido' : 'Código válido'
      }
    });

  } catch (error) {
    console.error('Error al verificar QR:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar el código QR'
    });
  }
};

// ==================== OBTENER MI ASISTENCIA ====================
export const getMyAttendance = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const { startDate, endDate, page = 1, limit = 20 } = req.query;

  try {
    const where: any = { userId };

    if (startDate || endDate) {
      where.checkInTime = {};
      if (startDate) {
        where.checkInTime.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.checkInTime.lte = new Date(endDate as string);
      }
    }

    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    const [attendances, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          session: {
            include: {
              environment: true,
              host: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        skip,
        take: limitNumber,
        orderBy: { checkInTime: 'desc' }
      }),
      prisma.attendance.count({ where })
    ]);

    // Calcular estadísticas
    const stats = {
      totalSessions: total,
      onTime: attendances.filter(a => {
        const lateThreshold = new Date(a.session.startTime.getTime() + 15 * 60000); // 15 min
        return a.checkInTime <= lateThreshold;
      }).length,
      late: attendances.filter(a => {
        const lateThreshold = new Date(a.session.startTime.getTime() + 15 * 60000);
        return a.checkInTime > lateThreshold;
      }).length,
      averageDuration: attendances
        .filter(a => a.checkOutTime)
        .reduce((acc, a) => {
          const duration = a.checkOutTime!.getTime() - a.checkInTime.getTime();
          return acc + duration;
        }, 0) / attendances.filter(a => a.checkOutTime).length / 60000 || 0
    };

    res.json({
      success: true,
      data: attendances.map(a => ({
        id: a.id,
        session: {
          id: a.session.id,
          name: a.session.name,
          type: a.session.type,
          environment: a.session.environment.name,
          host: a.session.host?.name || a.session.hostName,
          date: a.session.startTime
        },
        checkIn: a.checkInTime,
        checkOut: a.checkOutTime,
        duration: a.checkOutTime ? 
          Math.floor((a.checkOutTime.getTime() - a.checkInTime.getTime()) / 60000) : null,
        status: a.checkInTime <= new Date(a.session.startTime.getTime() + 15 * 60000) ? 
          'on-time' : 'late',
        isSuspicious: a.isSuspicious
      })),
      stats,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber)
      }
    });

  } catch (error) {
    console.error('Error al obtener asistencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tu asistencia'
    });
  }
};

// ==================== OBTENER ASISTENCIA POR SESIÓN ====================
export const getAttendanceBySession = async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;

  try {
    // Verificar que la sesión existe
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        environment: true,
        host: true
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
    const isAdmin = ['ADMIN', 'JEFE_LAB'].includes(req.user?.role || '');

    if (!isHost && !isAdmin) {
      res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver la asistencia de esta sesión'
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

    // Agrupar por estado
    const summary = {
      total: attendances.length,
      onTime: 0,
      late: 0,
      suspicious: 0,
      byCareer: {} as Record<string, number>,
      byType: {
        students: 0,
        externals: 0
      }
    };

    const lateThreshold = new Date(session.startTime.getTime() + 15 * 60000);

    attendances.forEach(a => {
      if (a.checkInTime <= lateThreshold) {
        summary.onTime++;
      } else {
        summary.late++;
      }

      if (a.isSuspicious) {
        summary.suspicious++;
      }

      if (a.user) {
        summary.byType.students++;
        const career = a.user.studentProfile?.career.name || 'Sin carrera';
        summary.byCareer[career] = (summary.byCareer[career] || 0) + 1;
      } else {
        summary.byType.externals++;
      }
    });

    res.json({
      success: true,
      data: {
        session: {
          id: session.id,
          name: session.name,
          environment: session.environment.name,
          startTime: session.startTime,
          endTime: session.endTime
        },
        attendances: attendances.map(a => ({
          id: a.id,
          attendee: a.user ? {
            type: 'student',
            id: a.user.id,
            code: a.user.username,
            name: a.user.name,
            career: a.user.studentProfile?.career.name
          } : {
            type: 'external',
            dni: a.externalPerson!.dni,
            name: a.externalPerson!.fullName,
            institution: a.externalPerson!.institution
          },
          checkIn: a.checkInTime,
          checkOut: a.checkOutTime,
          duration: a.checkOutTime ? 
            Math.floor((a.checkOutTime.getTime() - a.checkInTime.getTime()) / 60000) : null,
          status: a.checkInTime <= lateThreshold ? 'on-time' : 'late',
          isSuspicious: a.isSuspicious,
          suspiciousReason: a.suspiciousReason
        })),
        summary
      }
    });

  } catch (error) {
    console.error('Error al obtener asistencia por sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la asistencia'
    });
  }
};

// ==================== OBTENER ASISTENCIA POR ESTUDIANTE ====================
export const getAttendanceByStudent = async (req: Request, res: Response): Promise<void> => {
  const { studentId } = req.params;
  const { startDate, endDate, page = 1, limit = 20 } = req.query;

  try {
    // Verificar permisos
    const isOwnProfile = studentId === req.user?.userId;
    const hasPermission = isOwnProfile || ['DOCENTE', 'ADMIN', 'JEFE_LAB'].includes(req.user?.role || '');

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver esta información'
      });
      return;
    }

    // Verificar que el estudiante existe
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      include: {
        studentProfile: {
          include: {
            career: true
          }
        }
      }
    });

    if (!student || !student.studentProfile) {
      res.status(404).json({
        success: false,
        message: 'Estudiante no encontrado'
      });
      return;
    }

    // Construir filtros
    const where: any = { userId: studentId };

    if (startDate || endDate) {
      where.checkInTime = {};
      if (startDate) {
        where.checkInTime.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.checkInTime.lte = new Date(endDate as string);
      }
    }

    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    const [attendances, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          session: {
            include: {
              environment: true,
              host: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        skip,
        take: limitNumber,
        orderBy: { checkInTime: 'desc' }
      }),
      prisma.attendance.count({ where })
    ]);

    // Calcular estadísticas detalladas
    const stats = {
      totalSessions: total,
      onTime: 0,
      late: 0,
      absences: 0, // Se calcularía comparando con sesiones programadas
      attendanceRate: 0,
      averageDuration: 0,
      totalHours: 0
    };

    let totalDuration = 0;
    let sessionsWithCheckout = 0;

    attendances.forEach(a => {
      const lateThreshold = new Date(a.session.startTime.getTime() + 15 * 60000);
      
      if (a.checkInTime <= lateThreshold) {
        stats.onTime++;
      } else {
        stats.late++;
      }

      if (a.checkOutTime) {
        const duration = a.checkOutTime.getTime() - a.checkInTime.getTime();
        totalDuration += duration;
        sessionsWithCheckout++;
      }
    });

    stats.averageDuration = sessionsWithCheckout > 0 ? 
      Math.floor(totalDuration / sessionsWithCheckout / 60000) : 0;
    stats.totalHours = Math.floor(totalDuration / 3600000);

    res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          code: student.username,
          name: student.name,
          career: student.studentProfile.career.name
        },
        attendances: attendances.map(a => ({
          id: a.id,
          session: {
            id: a.session.id,
            name: a.session.name,
            type: a.session.type,
            environment: a.session.environment.name,
            host: a.session.host?.name || a.session.hostName,
            date: a.session.startTime
          },
          checkIn: a.checkInTime,
          checkOut: a.checkOutTime,
          duration: a.checkOutTime ? 
            Math.floor((a.checkOutTime.getTime() - a.checkInTime.getTime()) / 60000) : null,
          status: a.checkInTime <= new Date(a.session.startTime.getTime() + 15 * 60000) ? 
            'on-time' : 'late'
        })),
        stats,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          totalPages: Math.ceil(total / limitNumber)
        }
      }
    });

  } catch (error) {
    console.error('Error al obtener asistencia del estudiante:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la asistencia'
    });
  }
};

// ==================== ACTUALIZAR ESTADO DE ASISTENCIA ====================
export const updateAttendanceStatus = async (req: Request, res: Response): Promise<void> => {
  const { attendanceId } = req.params;
  const updates = req.body;

  try {
    // Verificar que existe la asistencia
    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      include: {
        session: true
      }
    });

    if (!attendance) {
      res.status(404).json({
        success: false,
        message: 'Registro de asistencia no encontrado'
      });
      return;
    }

    // Verificar permisos
    const isHost = attendance.session.hostId === req.user?.userId;
    const isAdmin = ['ADMIN', 'JEFE_LAB'].includes(req.user?.role || '');

    if (!isHost && !isAdmin) {
      res.status(403).json({
        success: false,
        message: 'No tienes permisos para modificar esta asistencia'
      });
      return;
    }

    // Actualizar asistencia
    const updated = await prisma.attendance.update({
      where: { id: attendanceId },
      data: updates,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true
          }
        },
        session: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'UPDATE_ATTENDANCE',
        entityType: 'ATTENDANCE',
        entityId: attendanceId,
        metadata: {
          changes: updates,
          sessionName: attendance.session.name,
          studentName: updated.user?.name
        }
      }
    });

    res.json({
      success: true,
      message: 'Asistencia actualizada exitosamente',
      data: updated
    });

  } catch (error) {
    console.error('Error al actualizar asistencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la asistencia'
    });
  }
};

// ==================== OBTENER ESTADÍSTICAS DE ASISTENCIA ====================
export const getAttendanceStats = async (req: Request, res: Response): Promise<void> => {
  const { type, entityId, startDate, endDate, groupBy = 'day' } = req.query;

  try {
    let stats: any = {};

    switch (type) {
      case 'student':
        stats = await getStudentStats(entityId as string, startDate as string, endDate as string);
        break;
      
      case 'session':
        stats = await getSessionStats(entityId as string);
        break;
      
      case 'career':
        stats = await getCareerStats(entityId as string, startDate as string, endDate as string);
        break;
      
      case 'general':
        stats = await getGeneralStats(startDate as string, endDate as string, groupBy as string);
        break;
      
      default:
        res.status(400).json({
          success: false,
          message: 'Tipo de estadística no válido'
        });
        return;
    }

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las estadísticas'
    });
  }
};

// Funciones auxiliares para estadísticas
async function getStudentStats(studentId: string, startDate?: string, endDate?: string) {
  const where: any = { userId: studentId };
  
  if (startDate || endDate) {
    where.checkInTime = {};
    if (startDate) where.checkInTime.gte = new Date(startDate);
    if (endDate) where.checkInTime.lte = new Date(endDate);
  }

  const attendances = await prisma.attendance.findMany({
    where,
    include: {
      session: true
    }
  });

  const stats = {
    totalSessions: attendances.length,
    onTime: 0,
    late: 0,
    totalHours: 0,
    averageCheckInTime: null as Date | null,
    attendanceByDay: {} as Record<string, number>,
    attendanceByType: {} as Record<string, number>
  };

  let totalCheckInDelay = 0;

  attendances.forEach(a => {
    // On time vs late
    const lateThreshold = new Date(a.session.startTime.getTime() + 15 * 60000);
    if (a.checkInTime <= lateThreshold) {
      stats.onTime++;
    } else {
      stats.late++;
    }

    // Total hours
    if (a.checkOutTime) {
      stats.totalHours += (a.checkOutTime.getTime() - a.checkInTime.getTime()) / 3600000;
    }

    // Check-in delay
    totalCheckInDelay += a.checkInTime.getTime() - a.session.startTime.getTime();

    // By day
    const day = a.checkInTime.toISOString().split('T')[0];
    stats.attendanceByDay[day] = (stats.attendanceByDay[day] || 0) + 1;

    // By type
    stats.attendanceByType[a.session.type] = (stats.attendanceByType[a.session.type] || 0) + 1;
  });

  if (attendances.length > 0) {
    stats.averageCheckInTime = new Date(
      attendances[0].session.startTime.getTime() + (totalCheckInDelay / attendances.length)
    );
  }

  return stats;
}

async function getSessionStats(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      attendances: {
        include: {
          user: {
            include: {
              studentProfile: {
                include: {
                  career: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!session) {
    throw new Error('Sesión no encontrada');
  }

  const lateThreshold = new Date(session.startTime.getTime() + 15 * 60000);

  const stats = {
    sessionInfo: {
      name: session.name,
      date: session.startTime,
      duration: (session.endTime.getTime() - session.startTime.getTime()) / 3600000
    },
    attendance: {
      total: session.attendances.length,
      onTime: session.attendances.filter(a => a.checkInTime <= lateThreshold).length,
      late: session.attendances.filter(a => a.checkInTime > lateThreshold).length,
      suspicious: session.attendances.filter(a => a.isSuspicious).length
    },
    byCareer: {} as Record<string, number>,
    checkInDistribution: [] as { time: string; count: number }[]
  };

  // Por carrera
  session.attendances.forEach(a => {
    if (a.user?.studentProfile) {
      const career = a.user.studentProfile.career.name;
      stats.byCareer[career] = (stats.byCareer[career] || 0) + 1;
    }
  });

  // Distribución de check-in por intervalos de 5 minutos
  const intervals: Record<string, number> = {};
  session.attendances.forEach(a => {
    const minutesAfterStart = Math.floor(
      (a.checkInTime.getTime() - session.startTime.getTime()) / 60000
    );
    const interval = Math.floor(minutesAfterStart / 5) * 5;
    const key = `${interval}-${interval + 5} min`;
    intervals[key] = (intervals[key] || 0) + 1;
  });

  stats.checkInDistribution = Object.entries(intervals)
    .map(([time, count]) => ({ time, count }))
    .sort((a, b) => parseInt(a.time) - parseInt(b.time));

  return stats;
}

async function getCareerStats(careerId: string, startDate?: string, endDate?: string) {
  const where: any = {
    user: {
      studentProfile: {
        careerId
      }
    }
  };

  if (startDate || endDate) {
    where.checkInTime = {};
    if (startDate) where.checkInTime.gte = new Date(startDate);
    if (endDate) where.checkInTime.lte = new Date(endDate);
  }

  const attendances = await prisma.attendance.findMany({
    where,
    include: {
      user: {
        include: {
          studentProfile: true
        }
      },
      session: true
    }
  });

  // Obtener total de estudiantes de la carrera
  const totalStudents = await prisma.studentProfile.count({
    where: { careerId }
  });

  const uniqueStudents = new Set(attendances.map(a => a.userId));

  return {
    careerInfo: {
      totalStudents,
      activeStudents: uniqueStudents.size
    },
    attendance: {
      totalRecords: attendances.length,
      uniqueStudents: uniqueStudents.size,
      averageAttendanceRate: (uniqueStudents.size / totalStudents) * 100
    },
    bySessionType: attendances.reduce((acc, a) => {
      acc[a.session.type] = (acc[a.session.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };
}

async function getGeneralStats(startDate?: string, endDate?: string, groupBy: string = 'day') {
  const where: any = {};
  
  if (startDate || endDate) {
    where.checkInTime = {};
    if (startDate) where.checkInTime.gte = new Date(startDate);
    if (endDate) where.checkInTime.lte = new Date(endDate);
  }

  const attendances = await prisma.attendance.findMany({
    where,
    include: {
      session: true,
      user: {
        include: {
          studentProfile: {
            include: {
              career: true
            }
          }
        }
      }
    }
  });

  const stats = {
    summary: {
      totalAttendance: attendances.length,
      uniqueStudents: new Set(attendances.map(a => a.userId)).size,
      uniqueSessions: new Set(attendances.map(a => a.sessionId)).size,
      suspiciousRecords: attendances.filter(a => a.isSuspicious).length
    },
    trends: {} as Record<string, any>,
    topEnvironments: {} as Record<string, number>,
    peakHours: {} as Record<string, number>
  };

  // Tendencias según agrupación
  attendances.forEach(a => {
    let key: string;
    
    switch (groupBy) {
      case 'week':
        const weekStart = new Date(a.checkInTime);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
        key = a.checkInTime.toISOString().substring(0, 7);
        break;
      default: // day
        key = a.checkInTime.toISOString().split('T')[0];
    }

    if (!stats.trends[key]) {
      stats.trends[key] = {
        total: 0,
        onTime: 0,
        late: 0
      };
    }

    stats.trends[key].total++;
    
    const lateThreshold = new Date(a.session.startTime.getTime() + 15 * 60000);
    if (a.checkInTime <= lateThreshold) {
      stats.trends[key].onTime++;
    } else {
      stats.trends[key].late++;
    }

    // Peak hours
    const hour = a.checkInTime.getHours();
    stats.peakHours[`${hour}:00`] = (stats.peakHours[`${hour}:00`] || 0) + 1;
  });

  return stats;
}

// ==================== EXPORTAR REPORTE DE ASISTENCIA ====================
export const exportAttendanceReport = async (req: Request, res: Response): Promise<void> => {
  const { format } = req.params;
  const { sessionId, careerId, startDate, endDate, includeDetails } = req.query;

  try {
    // Construir filtros
    const where: any = {};
    
    if (sessionId) {
      where.sessionId = sessionId;
    }
    
    if (careerId) {
      where.user = {
        studentProfile: {
          careerId
        }
      };
    }

    if (startDate || endDate) {
      where.checkInTime = {};
      if (startDate) where.checkInTime.gte = new Date(startDate as string);
      if (endDate) where.checkInTime.lte = new Date(endDate as string);
    }

    // Obtener datos
    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        session: {
          include: {
            environment: true,
            host: true
          }
        },
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
      orderBy: [
        { session: { startTime: 'asc' } },
        { checkInTime: 'asc' }
      ]
    });

    if (attendances.length === 0) {
      res.status(404).json({
        success: false,
        message: 'No se encontraron registros de asistencia'
      });
      return;
    }

    // Generar reporte según formato
    switch (format) {
      case 'csv':
        await generateCSVReport(res, attendances);
        break;
      
      case 'excel':
        await generateExcelReport(res, attendances, includeDetails === 'true');
        break;
      
      case 'pdf':
        await generatePDFReport(res, attendances, includeDetails === 'true');
        break;
      
      default:
        res.status(400).json({
          success: false,
          message: 'Formato de exportación no válido'
        });
    }

  } catch (error) {
    console.error('Error al exportar reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error al exportar el reporte'
    });
  }
};

// Funciones auxiliares para exportación
async function generateCSVReport(res: Response, attendances: any[]) {
  const csv = [
    'Fecha,Hora Entrada,Hora Salida,Sesión,Ambiente,Estudiante,Código,Carrera,Estado,Duración (min)'
  ];

  attendances.forEach(a => {
    const date = a.checkInTime.toISOString().split('T')[0];
    const checkIn = a.checkInTime.toTimeString().substring(0, 5);
    const checkOut = a.checkOutTime ? a.checkOutTime.toTimeString().substring(0, 5) : 'N/A';
    const session = a.session.name;
    const environment = a.session.environment.name;
    const student = a.user?.name || a.externalPerson?.fullName || 'N/A';
    const code = a.user?.username || a.externalPerson?.dni || 'N/A';
    const career = a.user?.studentProfile?.career.name || 'Externo';
    const lateThreshold = new Date(a.session.startTime.getTime() + 15 * 60000);
    const status = a.checkInTime <= lateThreshold ? 'Puntual' : 'Tarde';
    const duration = a.checkOutTime ? 
      Math.floor((a.checkOutTime.getTime() - a.checkInTime.getTime()) / 60000) : 'N/A';

    csv.push(
      `${date},${checkIn},${checkOut},"${session}","${environment}","${student}",${code},"${career}",${status},${duration}`
    );
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=reporte-asistencia.csv');
  res.send(csv.join('\n'));
}

async function generateExcelReport(res: Response, attendances: any[], includeDetails: boolean) {
  const workbook = XLSX.utils.book_new();

  // Hoja principal de asistencia
  const mainData = attendances.map(a => ({
    'Fecha': a.checkInTime.toISOString().split('T')[0],
    'Hora Entrada': a.checkInTime.toTimeString().substring(0, 5),
    'Hora Salida': a.checkOutTime ? a.checkOutTime.toTimeString().substring(0, 5) : 'N/A',
    'Sesión': a.session.name,
    'Tipo': a.session.type,
    'Ambiente': a.session.environment.name,
    'Docente': a.session.host?.name || a.session.hostName || 'N/A',
    'Estudiante': a.user?.name || a.externalPerson?.fullName || 'N/A',
    'Código/DNI': a.user?.username || a.externalPerson?.dni || 'N/A',
    'Carrera': a.user?.studentProfile?.career.name || 'Externo',
    'Estado': a.checkInTime <= new Date(a.session.startTime.getTime() + 15 * 60000) ? 'Puntual' : 'Tarde',
    'Duración (min)': a.checkOutTime ? 
      Math.floor((a.checkOutTime.getTime() - a.checkInTime.getTime()) / 60000) : 'N/A',
    'Sospechoso': a.isSuspicious ? 'Sí' : 'No'
  }));

  const mainSheet = XLSX.utils.json_to_sheet(mainData);
  XLSX.utils.book_append_sheet(workbook, mainSheet, 'Asistencia');

  // Si se solicitan detalles, agregar hojas adicionales
  if (includeDetails) {
    // Resumen por sesión
    const sessionSummary: any[] = [];
    const sessions = new Map();

    attendances.forEach(a => {
      if (!sessions.has(a.sessionId)) {
        sessions.set(a.sessionId, {
          session: a.session,
          attendances: []
        });
      }
      sessions.get(a.sessionId).attendances.push(a);
    });

    sessions.forEach(({ session, attendances: sessionAttendances }) => {
      const lateThreshold = new Date(session.startTime.getTime() + 15 * 60000);
      sessionSummary.push({
        'Sesión': session.name,
        'Fecha': session.startTime.toISOString().split('T')[0],
        'Ambiente': session.environment.name,
        'Total Asistentes': sessionAttendances.length,
        'Puntuales': sessionAttendances.filter((a: any) => a.checkInTime <= lateThreshold).length,
        'Tardanzas': sessionAttendances.filter((a: any) => a.checkInTime > lateThreshold).length,
        'Sospechosos': sessionAttendances.filter((a: any) => a.isSuspicious).length
      });
    });

    const summarySheet = XLSX.utils.json_to_sheet(sessionSummary);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen por Sesión');
  }

  // Generar buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=reporte-asistencia.xlsx');
  res.send(buffer);
}

async function generatePDFReport(res: Response, attendances: any[], includeDetails: boolean) {
  const doc = new PDFDocument();
  const chunks: any[] = [];

  doc.on('data', chunks.push.bind(chunks));
  doc.on('end', () => {
    const pdfData = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte-asistencia.pdf');
    res.send(pdfData);
  });

  // Título
  doc.fontSize(20).text('Reporte de Asistencia', { align: 'center' });
  doc.moveDown();

  // Información del reporte
  doc.fontSize(12);
  doc.text(`Fecha de generación: ${new Date().toLocaleString('es-PE')}`, { align: 'right' });
  doc.text(`Total de registros: ${attendances.length}`, { align: 'right' });
  doc.moveDown();

  // Tabla de asistencia (simplificada para PDF)
  doc.fontSize(10);
  
  attendances.forEach((a, index) => {
    if (index > 0 && index % 20 === 0) {
      doc.addPage();
    }

    const date = a.checkInTime.toLocaleDateString('es-PE');
    const checkIn = a.checkInTime.toTimeString().substring(0, 5);
    const student = a.user?.name || a.externalPerson?.fullName || 'N/A';
    const session = a.session.name;

    doc.text(`${date} ${checkIn} - ${student} - ${session}`);
  });

  doc.end();
}