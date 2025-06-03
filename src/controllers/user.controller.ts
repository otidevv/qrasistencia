// src/controllers/user.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ✅ Crear nuevo usuario (admin)
export const crearUsuario = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, roleName } = req.body;

  try {
    const existe = await prisma.user.findUnique({ where: { email } });
    if (existe) {
      res.status(400).json({ message: 'Correo ya registrado' });
      return;
    }

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      res.status(400).json({ message: 'Rol no válido' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        roleId: role.id,
      },
      include: { role: true }
    });

    res.status(201).json({ message: 'Usuario creado', user });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor', error });
  }
};

// ✅ Listar todos los usuarios
export const listarUsuarios = async (_req: Request, res: Response): Promise<void> => {
  try {
    const usuarios = await prisma.user.findMany({
      include: { role: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ message: 'Error al listar usuarios', error });
  }
};

// ✅ Obtener usuario por ID
export const obtenerUsuario = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { role: true }
    });
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuario', error });
  }
};

// ✅ Actualizar usuario
export const actualizarUsuario = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, email, roleName } = req.body;

  try {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      res.status(400).json({ message: 'Rol no válido' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { name, email, roleId: role.id },
      include: { role: true }
    });

    res.json({ message: 'Usuario actualizado', user: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar usuario', error });
  }
};

// ✅ Eliminar usuario
export const eliminarUsuario = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar usuario', error });
  }
};