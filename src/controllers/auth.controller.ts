// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { generateToken } from '../utils/jwt';

const prisma = new PrismaClient();

// Interfaces para tipos de registro
interface RegisterStudentDTO {
  codigoEstudiante: string;
  dni: string;
  fullName: string;
  password: string;
  email?: string;
  phoneNumber?: string;
  careerId: string;
}

interface RegisterUserDTO {
  username: string;
  name: string;
  password: string;
  email?: string;
  roleName: string;
}

// Interfaz para respuestas estandarizadas
interface StandardResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: any;
}

// ==================== REGISTRO DE ESTUDIANTE ====================
export const registerStudent = async (req: Request, res: Response): Promise<void> => {
  const data: RegisterStudentDTO = req.body;

  try {
    // 1. Verificar que no existe el código de estudiante
    const existingUser = await prisma.user.findUnique({ 
      where: { username: data.codigoEstudiante } 
    });
    if (existingUser) {
      res.status(400).json({ 
        success: false,
        message: 'El código de estudiante ya está registrado' 
      });
      return;
    }

    // 2. Verificar que no existe el DNI
    const existingDNI = await prisma.studentProfile.findUnique({ 
      where: { dni: data.dni } 
    });
    if (existingDNI) {
      res.status(400).json({ 
        success: false,
        message: 'El DNI ya está registrado' 
      });
      return;
    }

    // 3. Verificar que existe la carrera
    const career = await prisma.career.findUnique({ 
      where: { id: data.careerId } 
    });
    if (!career) {
      res.status(400).json({ 
        success: false,
        message: 'Carrera no válida' 
      });
      return;
    }

    // 4. Obtener rol de estudiante
    const roleEstudiante = await prisma.role.findUnique({ 
      where: { name: 'ESTUDIANTE' } 
    });
    if (!roleEstudiante) {
      res.status(500).json({ 
        success: false,
        message: 'Error de configuración: Rol ESTUDIANTE no existe' 
      });
      return;
    }

    // 5. Hash de contraseña
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 6. Crear usuario con perfil de estudiante (transacción)
    const user = await prisma.user.create({
      data: {
        username: data.codigoEstudiante,
        name: data.fullName,
        email: data.email,
        password: hashedPassword,
        roleId: roleEstudiante.id,
        isActive: true,
        studentProfile: {
          create: {
            codigoEstudiante: data.codigoEstudiante,
            dni: data.dni,
            fullName: data.fullName,
            phoneNumber: data.phoneNumber,
            careerId: data.careerId
          }
        }
      },
      include: {
        role: true,
        studentProfile: {
          include: { career: true }
        }
      }
    });

    // 7. Log de auditoría
    await prisma.auditLog.create({
      data: {
        action: 'STUDENT_REGISTRATION',
        entityType: 'USER',
        entityId: user.id,
        metadata: {
          codigoEstudiante: data.codigoEstudiante,
          carrera: career.name,
          timestamp: new Date()
        }
      }
    });

    // 8. Generar token para auto-login después del registro
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role.name,
      roleLevel: user.role.level,
      email: user.email || undefined
    };

    const token = generateToken(tokenPayload);

    // Preparar datos del usuario
    const userData = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role.name,
      roleLevel: user.role.level,
      studentInfo: {
        codigoEstudiante: user.studentProfile!.codigoEstudiante,
        dni: user.studentProfile!.dni,
        career: user.studentProfile!.career.name,
        careerId: user.studentProfile!.career.id
      }
    };

    res.status(201).json({ 
      success: true,
      message: 'Estudiante registrado correctamente',
      data: {
        user: userData,
        token: token
      }
    });

  } catch (error) {
    console.error('Error en registro de estudiante:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor', 
      error: process.env.NODE_ENV === 'development' ? error : undefined 
    });
  }
};

// ==================== REGISTRO DE USUARIO GENERAL (Docente, Admin, etc) ====================
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  const data: RegisterUserDTO = req.body;

  try {
    // 1. Verificar que no existe el username
    const existing = await prisma.user.findUnique({ 
      where: { username: data.username } 
    });
    if (existing) {
      res.status(400).json({ 
        success: false,
        message: 'El nombre de usuario ya está registrado' 
      });
      return;
    }

    // 2. Verificar rol válido
    const role = await prisma.role.findUnique({ 
      where: { name: data.roleName } 
    });
    if (!role) {
      res.status(400).json({ 
        success: false,
        message: 'Rol no válido' 
      });
      return;
    }

    // 3. No permitir crear estudiantes por esta ruta
    if (role.name === 'ESTUDIANTE') {
      res.status(400).json({ 
        success: false,
        message: 'Use el endpoint /register/student para registrar estudiantes' 
      });
      return;
    }

    // 4. Hash de contraseña
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 5. Crear usuario
    const user = await prisma.user.create({
      data: {
        username: data.username,
        name: data.name,
        email: data.email,
        password: hashedPassword,
        roleId: role.id,
        isActive: true
      },
      include: { role: true }
    });

    // 6. Log de auditoría
    await prisma.auditLog.create({
      data: {
        action: 'USER_REGISTRATION',
        entityType: 'USER',
        entityId: user.id,
        metadata: {
          role: role.name,
          timestamp: new Date()
        }
      }
    });

    // 7. Generar token para auto-login
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role.name,
      roleLevel: user.role.level,
      email: user.email || undefined
    };

    const token = generateToken(tokenPayload);

    res.status(201).json({ 
      success: true,
      message: 'Usuario creado correctamente',
      data: {
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role.name,
          roleLevel: user.role.level
        },
        token: token
      }
    });

  } catch (error) {
    console.error('Error en registro de usuario:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor', 
      error: process.env.NODE_ENV === 'development' ? error : undefined 
    });
  }
};

// ==================== LOGIN ====================
export const login = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  try {
    // 1. Buscar usuario por username
    const user = await prisma.user.findUnique({ 
      where: { username }, 
      include: { 
        role: true,
        studentProfile: {
          include: { career: true }
        }
      } 
    });

    if (!user || !user.isActive) {
      res.status(401).json({ 
        success: false,
        message: 'Credenciales inválidas' 
      });
      return;
    }

    // 2. Verificar contraseña
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ 
        success: false,
        message: 'Credenciales inválidas' 
      });
      return;
    }

    // 3. Generar token con información relevante
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role.name,
      roleLevel: user.role.level,
      email: user.email || undefined
    };

    const token = generateToken(tokenPayload);

    // 4. Log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entityType: 'USER',
        entityId: user.id,
        metadata: {
          timestamp: new Date(),
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }
      }
    });

    // 5. Preparar respuesta según tipo de usuario
    const responseUser: any = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role.name,
      roleLevel: user.role.level
    };

    // Si es estudiante, incluir información adicional
    if (user.studentProfile) {
      responseUser.studentInfo = {
        codigoEstudiante: user.studentProfile.codigoEstudiante,
        dni: user.studentProfile.dni,
        career: user.studentProfile.career.name,
        careerId: user.studentProfile.career.id
      };
    }

    res.json({ 
      success: true,
      message: 'Login exitoso',
      data: {
        token: token,
        user: responseUser
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor', 
      error: process.env.NODE_ENV === 'development' ? error : undefined 
    });
  }
};

// ==================== CAMBIO DE CONTRASEÑA ====================
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  // Verificar autenticación
  if (!req.user) {
    res.status(401).json({ 
      success: false,
      message: 'Usuario no autenticado' 
    });
    return;
  }

  const { userId } = req.user;
  const { currentPassword, newPassword } = req.body;

  try {
    // 1. Buscar usuario
    const user = await prisma.user.findUnique({ 
      where: { id: userId } 
    });

    if (!user) {
      res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado' 
      });
      return;
    }

    // 2. Verificar contraseña actual
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      res.status(401).json({ 
        success: false,
        message: 'Contraseña actual incorrecta' 
      });
      return;
    }

    // 3. Hash de nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 4. Actualizar contraseña
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    // 5. Log de auditoría
    await prisma.auditLog.create({
      data: {
        userId: userId,
        action: 'PASSWORD_CHANGE',
        entityType: 'USER',
        entityId: userId,
        metadata: { timestamp: new Date() }
      }
    });

    res.json({ 
      success: true,
      message: 'Contraseña actualizada correctamente' 
    });

  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor' 
    });
  }
};

// ==================== OBTENER PERFIL ====================
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  // Verificar autenticación
  if (!req.user) {
    res.status(401).json({ 
      success: false,
      message: 'Usuario no autenticado' 
    });
    return;
  }

  const { userId } = req.user;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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

    const profile: any = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role.name,
      roleLevel: user.role.level,
      isActive: user.isActive
    };

    if (user.studentProfile) {
      profile.studentInfo = {
        codigoEstudiante: user.studentProfile.codigoEstudiante,
        dni: user.studentProfile.dni,
        fullName: user.studentProfile.fullName,
        phoneNumber: user.studentProfile.phoneNumber,
        career: user.studentProfile.career.name,
        careerId: user.studentProfile.career.id
      };
    }

    res.json({
      success: true,
      data: profile
    });

  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor' 
    });
  }
};