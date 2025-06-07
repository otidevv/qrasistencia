// src/controllers/career.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { auditLog } from '../utils/logger';

const prisma = new PrismaClient();

// ==================== CREAR CARRERA ====================
export const createCareer = async (req: Request, res: Response): Promise<void> => {
  const { name, code } = req.body;

  try {
    // Verificar si ya existe una carrera con el mismo nombre
    const existingName = await prisma.career.findUnique({
      where: { name }
    });

    if (existingName) {
      res.status(400).json({
        success: false,
        message: 'Ya existe una carrera con ese nombre'
      });
      return;
    }

    // Verificar si ya existe una carrera con el mismo código
    if (code) {
      const existingCode = await prisma.career.findUnique({
        where: { code }
      });

      if (existingCode) {
        res.status(400).json({
          success: false,
          message: 'Ya existe una carrera con ese código'
        });
        return;
      }
    }

    // Crear la carrera
    const career = await prisma.career.create({
      data: {
        name: name.toUpperCase(), // Normalizar a mayúsculas
        code: code ? code.toUpperCase() : undefined
      }
    });

    // Log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'CREATE_CAREER',
        entityType: 'CAREER',
        entityId: career.id,
        metadata: {
          careerName: career.name,
          careerCode: career.code
        }
      }
    });

    auditLog('CREATE_CAREER', req.user?.userId || 'system', {
      careerName: career.name,
      careerCode: career.code
    });

    res.status(201).json({
      success: true,
      message: 'Carrera creada exitosamente',
      data: career
    });

  } catch (error) {
    console.error('Error al crear carrera:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear la carrera',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// ==================== OBTENER TODAS LAS CARRERAS ====================
export const getAllCareers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { includeStudentCount } = req.query;

    const careers = await prisma.career.findMany({
      include: {
        _count: includeStudentCount === 'true' ? {
          select: { students: true }
        } : false
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      data: careers,
      total: careers.length
    });

  } catch (error) {
    console.error('Error al obtener carreras:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las carreras'
    });
  }
};

// ==================== OBTENER CARRERA POR ID ====================
export const getCareerById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const career = await prisma.career.findUnique({
      where: { id },
      include: {
        _count: {
          select: { students: true }
        }
      }
    });

    if (!career) {
      res.status(404).json({
        success: false,
        message: 'Carrera no encontrada'
      });
      return;
    }

    res.json({
      success: true,
      data: career
    });

  } catch (error) {
    console.error('Error al obtener carrera:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la carrera'
    });
  }
};

// ==================== ACTUALIZAR CARRERA ====================
export const updateCareer = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, code } = req.body;

  try {
    // Verificar que existe la carrera
    const existingCareer = await prisma.career.findUnique({
      where: { id }
    });

    if (!existingCareer) {
      res.status(404).json({
        success: false,
        message: 'Carrera no encontrada'
      });
      return;
    }

    // Verificar nombre único si se está actualizando
    if (name && name !== existingCareer.name) {
      const duplicateName = await prisma.career.findUnique({
        where: { name }
      });

      if (duplicateName) {
        res.status(400).json({
          success: false,
          message: 'Ya existe otra carrera con ese nombre'
        });
        return;
      }
    }

    // Verificar código único si se está actualizando
    if (code && code !== existingCareer.code) {
      const duplicateCode = await prisma.career.findUnique({
        where: { code }
      });

      if (duplicateCode) {
        res.status(400).json({
          success: false,
          message: 'Ya existe otra carrera con ese código'
        });
        return;
      }
    }

    // Actualizar la carrera
    const updatedCareer = await prisma.career.update({
      where: { id },
      data: {
        name: name ? name.toUpperCase() : undefined,
        code: code ? code.toUpperCase() : undefined
      }
    });

    // Log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'UPDATE_CAREER',
        entityType: 'CAREER',
        entityId: id,
        metadata: {
          oldData: existingCareer,
          newData: updatedCareer
        }
      }
    });

    res.json({
      success: true,
      message: 'Carrera actualizada exitosamente',
      data: updatedCareer
    });

  } catch (error) {
    console.error('Error al actualizar carrera:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar la carrera'
    });
  }
};

// ==================== ELIMINAR CARRERA ====================
export const deleteCareer = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    // Verificar que existe la carrera
    const career = await prisma.career.findUnique({
      where: { id },
      include: {
        _count: {
          select: { students: true }
        }
      }
    });

    if (!career) {
      res.status(404).json({
        success: false,
        message: 'Carrera no encontrada'
      });
      return;
    }

    // Verificar si tiene estudiantes asociados
    if (career._count.students > 0) {
      res.status(400).json({
        success: false,
        message: `No se puede eliminar la carrera porque tiene ${career._count.students} estudiantes asociados`
      });
      return;
    }

    // Eliminar la carrera
    await prisma.career.delete({
      where: { id }
    });

    // Log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'DELETE_CAREER',
        entityType: 'CAREER',
        entityId: id,
        metadata: {
          careerName: career.name,
          careerCode: career.code
        }
      }
    });

    res.json({
      success: true,
      message: 'Carrera eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar carrera:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la carrera'
    });
  }
};

// ==================== OBTENER ESTUDIANTES DE UNA CARRERA ====================
export const getCareerStudents = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { page = 1, limit = 20, search } = req.query;

  try {
    // Verificar que existe la carrera
    const career = await prisma.career.findUnique({
      where: { id }
    });

    if (!career) {
      res.status(404).json({
        success: false,
        message: 'Carrera no encontrada'
      });
      return;
    }

    // Configurar paginación
    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    // Configurar búsqueda
    const searchCondition = search ? {
      OR: [
        { fullName: { contains: search as string, mode: 'insensitive' as const } },
        { codigoEstudiante: { contains: search as string, mode: 'insensitive' as const } },
        { dni: { contains: search as string } }
      ]
    } : {};

    // Obtener estudiantes con paginación
    const [students, total] = await Promise.all([
      prisma.studentProfile.findMany({
        where: {
          careerId: id,
          ...searchCondition
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              email: true,
              isActive: true
            }
          }
        },
        skip,
        take: limitNumber,
        orderBy: { fullName: 'asc' }
      }),
      prisma.studentProfile.count({
        where: {
          careerId: id,
          ...searchCondition
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        career: {
          id: career.id,
          name: career.name,
          code: career.code
        },
        students: students.map(student => ({
          id: student.id,
          codigoEstudiante: student.codigoEstudiante,
          dni: student.dni,
          fullName: student.fullName,
          phoneNumber: student.phoneNumber,
          email: student.user.email,
          isActive: student.user.isActive,
          userId: student.user.id
        }))
      },
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber)
      }
    });

  } catch (error) {
    console.error('Error al obtener estudiantes de la carrera:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los estudiantes'
    });
  }
};

// ==================== ESTADÍSTICAS DE CARRERAS ====================
export const getCareerStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await prisma.career.findMany({
      include: {
        _count: {
          select: { students: true }
        }
      },
      orderBy: {
        students: {
          _count: 'desc'
        }
      }
    });

    const totalStudents = stats.reduce((sum, career) => sum + career._count.students, 0);

    res.json({
      success: true,
      data: {
        totalCareers: stats.length,
        totalStudents,
        careers: stats.map(career => ({
          id: career.id,
          name: career.name,
          code: career.code,
          studentCount: career._count.students,
          percentage: totalStudents > 0 
            ? Math.round((career._count.students / totalStudents) * 100) 
            : 0
        }))
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las estadísticas'
    });
  }
};