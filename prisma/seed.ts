import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🔁 Insertando roles...');
  const roles = ['admin', 'operador', 'estudiante'];
  const roleMap: Record<string, string> = {};

  for (const name of roles) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    roleMap[name] = role.id;
  }

  console.log('🔁 Insertando usuarios...');
  const password = await bcrypt.hash('123456', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      name: 'Admin Usuario',
      email: 'admin@test.com',
      password,
      roleId: roleMap['admin'],
    },
  });

  const operador = await prisma.user.upsert({
    where: { email: 'operador@test.com' },
    update: {},
    create: {
      name: 'Operador Juan',
      email: 'operador@test.com',
      password,
      roleId: roleMap['operador'],
    },
  });

  const estudiante = await prisma.user.upsert({
    where: { email: 'estudiante@test.com' },
    update: {},
    create: {
      name: 'Estudiante Ana',
      email: 'estudiante@test.com',
      password,
      roleId: roleMap['estudiante'],
    },
  });

  console.log('🏫 Insertando ambientes...');
  const lab1 = await prisma.environment.upsert({
    where: { name: 'Laboratorio de Redes' },
    update: {},
    create: {
      name: 'Laboratorio de Redes',
      type: 'LAB',
      location: '2do piso - Bloque A',
    },
  });

  const aula1 = await prisma.environment.upsert({
    where: { name: 'Aula de Matemáticas' },
    update: {},
    create: {
      name: 'Aula de Matemáticas',
      type: 'AULA',
      location: '1er piso - Bloque B',
    },
  });

  console.log('🔗 Asignando ambientes al operador...');
  await prisma.userEnvironment.upsert({
    where: {
      userId_environmentId: {
        userId: operador.id,
        environmentId: lab1.id,
      },
    },
    update: {},
    create: {
      userId: operador.id,
      environmentId: lab1.id,
    },
  });

  await prisma.userEnvironment.upsert({
    where: {
      userId_environmentId: {
        userId: operador.id,
        environmentId: aula1.id,
      },
    },
    update: {},
    create: {
      userId: operador.id,
      environmentId: aula1.id,
    },
  });

  console.log('✅ Datos de prueba insertados correctamente');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
