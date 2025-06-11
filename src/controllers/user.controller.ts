// src/controllers/user.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ==================== OBTENER TODOS LOS USUARIOS ====================
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      role, 
      isActive, 
      search, 
      page = 1, 
      limit = 20,
      includeProfile = 'false' 
    } = req.query;

    // Configurar paginación
    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    // Configurar filtros
    const where: any = {};
    
    if (role) {
      where.role = { name: role };
    }
    
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    
    if (search) {
      where.OR = [
        { username: { contains: search as string, mode: 'insensitive' } },
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    // Obtener usuarios con paginación
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          role: true,
          studentProfile: includeProfile === 'true' ? {
            include: { career: true }
          } : false
        },
        skip,
        take: limitNumber,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    // Formatear respuesta
    const formattedUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role.name,
      roleLevel: user.role.level,
      isActive: user.isActive,
      createdAt: user.createdAt,
      studentInfo: user.studentProfile ? {
        codigoEstudiante: user.studentProfile.codigoEstudiante,
        dni: user.studentProfile.dni,
        career: (user.studentProfile as any).career?.name || 'Sin carrera',
        careerId: user.studentProfile.careerId
      } : undefined
    }));

    res.json({
      success: true,
      data: formattedUsers,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber)
      }
    });

  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los usuarios'
    });
  }
};

// ==================== OBTENER USUARIO POR ID ====================
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const user: any = await prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        studentProfile: {
          include: { career: true }
        }
      }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    const userData = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role.name,
      roleLevel: user.role.level,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      studentInfo: user.studentProfile ? {
        id: user.studentProfile.id,
        codigoEstudiante: user.studentProfile.codigoEstudiante,
        dni: user.studentProfile.dni,
        fullName: user.studentProfile.fullName,
        phoneNumber: user.studentProfile.phoneNumber,
        career: user.studentProfile.career?.name || 'Sin carrera',
        careerId: user.studentProfile.career?.id || user.studentProfile.careerId
      } : undefined
    };

    res.json({
      success: true,
      data: userData
    });

  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el usuario'
    });
  }
};

// ==================== ACTUALIZAR USUARIO ====================
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { 
    name, 
    email, 
    isActive, 
    roleId,
    // Campos específicos de estudiante
    fullName,
    phoneNumber,
    careerId 
  } = req.body;

  try {
    // Verificar que existe el usuario
    const user = await prisma.user.findUnique({
      where: { id },
      include: { studentProfile: true }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    // Preparar datos de actualización
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (roleId !== undefined) updateData.roleId = roleId;

    // Actualizar usuario
    const updatedUser: any = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        role: true,
        studentProfile: {
          include: { career: true }
        }
      }
    });

    // Si es estudiante y hay datos de perfil para actualizar
    if (user.studentProfile && (fullName || phoneNumber || careerId)) {
      const profileUpdateData: any = {};
      if (fullName) profileUpdateData.fullName = fullName;
      if (phoneNumber !== undefined) profileUpdateData.phoneNumber = phoneNumber;
      if (careerId) profileUpdateData.careerId = careerId;

      await prisma.studentProfile.update({
        where: { id: user.studentProfile.id },
        data: profileUpdateData
      });
    }

    // Log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'UPDATE_USER',
        entityType: 'USER',
        entityId: id,
        metadata: {
          updatedFields: Object.keys(updateData),
          timestamp: new Date()
        }
      }
    });

    res.json({
      success: true,
      message: 'Usuario actualizado correctamente',
      data: {
        id: updatedUser.id,
        username: updatedUser.username,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role.name,
        isActive: updatedUser.isActive
      }
    });

  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el usuario'
    });
  }
};

// ==================== ELIMINAR (DESACTIVAR) USUARIO ====================
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    // Verificar que existe el usuario
    const user = await prisma.user.findUnique({
      where: { id },
      include: { role: true }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    // No permitir eliminar el propio usuario
    if (user.id === req.user?.userId) {
      res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propio usuario'
      });
      return;
    }

    // No permitir eliminar el último admin
    if (user.role.name === 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: {
          role: { name: 'ADMIN' },
          isActive: true
        }
      });

      if (adminCount <= 1) {
        res.status(400).json({
          success: false,
          message: 'No se puede eliminar el último administrador del sistema'
        });
        return;
      }
    }

    // Eliminar usuario (soft delete - desactivar)
    // Para mantener integridad referencial, solo desactivamos
    await prisma.user.update({
      where: { id },
      data: { isActive: false }
    });

    // Log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'DEACTIVATE_USER',
        entityType: 'USER',
        entityId: id,
        metadata: {
          deletedUser: user.username,
          deletedRole: user.role.name,
          timestamp: new Date()
        }
      }
    });

    res.json({
      success: true,
      message: 'Usuario desactivado correctamente'
    });

  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el usuario'
    });
  }
};

// ==================== CAMBIAR ESTADO DE USUARIO ====================
export const toggleUserStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { role: true }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    // No permitir desactivar el propio usuario
    if (user.id === req.user?.userId) {
      res.status(400).json({
        success: false,
        message: 'No puedes desactivar tu propio usuario'
      });
      return;
    }

    // No permitir desactivar el último admin activo
    if (user.role.name === 'ADMIN' && user.isActive) {
      const activeAdminCount = await prisma.user.count({
        where: {
          role: { name: 'ADMIN' },
          isActive: true
        }
      });

      if (activeAdminCount <= 1) {
        res.status(400).json({
          success: false,
          message: 'No se puede desactivar el último administrador activo'
        });
        return;
      }
    }

    // Cambiar estado
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive }
    });

    // Log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: user.isActive ? 'DEACTIVATE_USER' : 'ACTIVATE_USER',
        entityType: 'USER',
        entityId: id,
        metadata: {
          username: user.username,
          newStatus: updatedUser.isActive,
          timestamp: new Date()
        }
      }
    });

    res.json({
      success: true,
      message: `Usuario ${updatedUser.isActive ? 'activado' : 'desactivado'} correctamente`,
      data: {
        id: updatedUser.id,
        isActive: updatedUser.isActive
      }
    });

  } catch (error) {
    console.error('Error al cambiar estado del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar el estado del usuario'
    });
  }
};

// ==================== RESETEAR CONTRASEÑA ====================
export const resetUserPassword = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { newPassword } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });

    // Log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'RESET_USER_PASSWORD',
        entityType: 'USER',
        entityId: id,
        metadata: {
          targetUser: user.username,
          resetBy: req.user?.username,
          timestamp: new Date()
        }
      }
    });

    res.json({
      success: true,
      message: 'Contraseña restablecida correctamente'
    });

  } catch (error) {
    console.error('Error al resetear contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error al restablecer la contraseña'
    });
  }
};

// ==================== ESTADÍSTICAS DE USUARIOS ====================
export const getUserStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const [
      totalUsers,
      activeUsers,
      usersByRole,
      recentUsers,
      studentCount,
      roles
    ] = await Promise.all([
      // Total de usuarios
      prisma.user.count(),
      
      // Usuarios activos
      prisma.user.count({ where: { isActive: true } }),
      
      // Usuarios por rol
      prisma.user.groupBy({
        by: ['roleId'],
        _count: true
      }),
      
      // Usuarios registrados en los últimos 30 días
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Total de estudiantes
      prisma.studentProfile.count(),
      
      // Obtener todos los roles
      prisma.role.findMany()
    ]);

    // Crear mapa de roles
    const roleMap = Object.fromEntries(roles.map(r => [r.id, r.name]));

    const usersByRoleWithNames = usersByRole.map(group => ({
      role: roleMap[group.roleId],
      count: group._count
    }));

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        totalStudents: studentCount,
        usersByRole: usersByRoleWithNames,
        recentRegistrations: recentUsers,
        roles: roles.map(r => ({
          id: r.id,
          name: r.name,
          level: r.level
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