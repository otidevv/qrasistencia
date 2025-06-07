import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';


const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // 1. Crear Roles
  console.log('📋 Creando roles...')
  const roles = await Promise.all([
    prisma.role.create({
      data: { name: 'ESTUDIANTE', level: 1 }
    }),
    prisma.role.create({
      data: { name: 'DOCENTE', level: 2 }
    }),
    prisma.role.create({
      data: { name: 'JEFE_LAB', level: 3 }
    }),
    prisma.role.create({
      data: { name: 'ADMIN', level: 4 }
    })
  ])

  const [roleEstudiante, roleDocente, roleJefeLab, roleAdmin] = roles

  // 2. Crear Carreras
  console.log('🎓 Creando carreras...')
  const carreras = await Promise.all([
    prisma.career.create({
      data: {
        name: 'INGENIERÍA DE SISTEMAS',
        code: 'IS'
      }
    }),
    prisma.career.create({
      data: {
        name: 'INGENIERÍA FORESTAL Y MEDIO AMBIENTE',
        code: 'IFMA'
      }
    }),
    prisma.career.create({
      data: {
        name: 'ADMINISTRACIÓN Y NEGOCIOS INTERNACIONALES',
        code: 'ANI'
      }
    })
  ])

  const [ingSistemas, ingForestal, administracion] = carreras

  // 3. Crear Usuario Admin
  console.log('👤 Creando usuario admin...')
  const adminUser = await prisma.user.create({
    data: {
      username: 'admin',
      name: 'Administrador del Sistema',
      email: 'admin@universidad.edu',
      password: await bcrypt.hash('admin123', 10),
      roleId: roleAdmin.id,
      isActive: true
    }
  })

  // 4. Crear Jefe de Laboratorio
  console.log('👤 Creando jefe de laboratorio...')
  const jefeLabUser = await prisma.user.create({
    data: {
      username: '12345678', // DNI
      name: 'Ing. Carlos Mendoza',
      email: 'cmendoza@universidad.edu',
      password: await bcrypt.hash('jefe123', 10),
      roleId: roleJefeLab.id,
      isActive: true
    }
  })

  // 5. Crear Docentes
  console.log('👥 Creando docentes...')
  const docentes = await Promise.all([
    prisma.user.create({
      data: {
        username: '23456789',
        name: 'Dr. María García',
        email: 'mgarcia@universidad.edu',
        password: await bcrypt.hash('docente123', 10),
        roleId: roleDocente.id,
        isActive: true
      }
    }),
    prisma.user.create({
      data: {
        username: '34567890',
        name: 'Ing. Juan Pérez',
        email: 'jperez@universidad.edu',
        password: await bcrypt.hash('docente123', 10),
        roleId: roleDocente.id,
        isActive: true
      }
    })
  ])

  // 6. Crear Estudiantes con Perfiles
  console.log('🎒 Creando estudiantes...')
  const estudiantes = await Promise.all([
    prisma.user.create({
      data: {
        username: '13120016',
        name: 'SAAVEDRA RIOS, ZEUS',
        email: '16crismo@gmail.com',
        password: await bcrypt.hash('est123', 10),
        roleId: roleEstudiante.id,
        isActive: true,
        studentProfile: {
          create: {
            codigoEstudiante: '13120016',
            dni: '71821111',
            fullName: 'SAAVEDRA RIOS, ZEUS',
            phoneNumber: '982574372',
            careerId: ingSistemas.id
          }
        }
      }
    }),
    prisma.user.create({
      data: {
        username: '14220025',
        name: 'LOPEZ MARTINEZ, ANA',
        email: 'alopez@gmail.com',
        password: await bcrypt.hash('est123', 10),
        roleId: roleEstudiante.id,
        isActive: true,
        studentProfile: {
          create: {
            codigoEstudiante: '14220025',
            dni: '72345678',
            fullName: 'LOPEZ MARTINEZ, ANA',
            phoneNumber: '987654321',
            careerId: ingSistemas.id
          }
        }
      }
    }),
    prisma.user.create({
      data: {
        username: '14120030',
        name: 'RODRIGUEZ SILVA, PEDRO',
        email: 'prodriguez@gmail.com',
        password: await bcrypt.hash('est123', 10),
        roleId: roleEstudiante.id,
        isActive: true,
        studentProfile: {
          create: {
            codigoEstudiante: '14120030',
            dni: '73456789',
            fullName: 'RODRIGUEZ SILVA, PEDRO',
            phoneNumber: '976543210',
            careerId: ingForestal.id
          }
        }
      }
    })
  ])

  // 7. Crear Ambientes
  console.log('🏢 Creando ambientes...')
  const ambientes = await Promise.all([
    prisma.environment.create({
      data: {
        name: 'LAB CÓMPUTO 01',
        type: 'LAB',
        capacity: 30,
        managerId: jefeLabUser.id,
        isActive: true
      }
    }),
    prisma.environment.create({
      data: {
        name: 'LAB CÓMPUTO 02',
        type: 'LAB',
        capacity: 25,
        managerId: jefeLabUser.id,
        isActive: true
      }
    }),
    prisma.environment.create({
      data: {
        name: 'AULA 101',
        type: 'AULA',
        capacity: 40,
        isActive: true
      }
    }),
    prisma.environment.create({
      data: {
        name: 'AULA 202',
        type: 'AULA',
        capacity: 35,
        isActive: true
      }
    }),
    prisma.environment.create({
      data: {
        name: 'AUDITORIO PRINCIPAL',
        type: 'AUDITORIO',
        capacity: 200,
        isActive: true
      }
    })
  ])

  const [lab01, lab02, aula101, aula202, auditorio] = ambientes

  // 8. Crear Sesiones de Ejemplo (Clases de hoy)
  console.log('📅 Creando sesiones de ejemplo...')
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  // Función helper para generar QR
  function generateQRCode(): string {
    return `QR-${Date.now()}-${Math.random().toString(36).substring(7)}`
  }

  // Sesión de mañana (7:00 - 13:00)
  const sesionManana = await prisma.session.create({
    data: {
      environmentId: lab01.id,
      name: 'Programación I - Práctica',
      type: 'CLASE',
      allowExternals: false,
      hostId: docentes[0].id,
      startTime: new Date(hoy.getTime() + 7 * 60 * 60 * 1000), // 7:00 AM
      endTime: new Date(hoy.getTime() + 13 * 60 * 60 * 1000), // 1:00 PM
      qrRotationMinutes: 3,
      currentQRCode: generateQRCode(),
      lastQRRotation: new Date(),
      isActive: true
    }
  })

  // Sesión de tarde (14:00 - 20:00)
  const sesionTarde = await prisma.session.create({
    data: {
      environmentId: lab01.id,
      name: 'Base de Datos - Laboratorio',
      type: 'CLASE',
      allowExternals: false,
      hostId: docentes[1].id,
      startTime: new Date(hoy.getTime() + 14 * 60 * 60 * 1000), // 2:00 PM
      endTime: new Date(hoy.getTime() + 20 * 60 * 60 * 1000), // 8:00 PM
      qrRotationMinutes: 3,
      currentQRCode: generateQRCode(),
      lastQRRotation: new Date(),
      isActive: true
    }
  })

  // Conferencia en auditorio (permite externos)
  const conferencia = await prisma.session.create({
    data: {
      environmentId: auditorio.id,
      name: 'Conferencia: Inteligencia Artificial en la Educación',
      type: 'CONFERENCIA',
      allowExternals: true,
      hostName: 'Dr. Roberto Sánchez - MIT',
      startTime: new Date(hoy.getTime() + 16 * 60 * 60 * 1000), // 4:00 PM
      endTime: new Date(hoy.getTime() + 18 * 60 * 60 * 1000), // 6:00 PM
      qrRotationMinutes: 5, // Rotación más lenta para eventos
      currentQRCode: generateQRCode(),
      lastQRRotation: new Date(),
      isActive: true
    }
  })

  console.log('✅ Seed completado exitosamente!')
  console.log('\n📊 Resumen:')
  console.log(`- Roles creados: ${roles.length}`)
  console.log(`- Carreras creadas: ${carreras.length}`)
  console.log(`- Usuarios creados: ${4 + docentes.length + estudiantes.length}`)
  console.log(`- Ambientes creados: ${ambientes.length}`)
  console.log(`- Sesiones creadas: 3`)
  
  console.log('\n🔐 Credenciales de prueba:')
  console.log('Admin: username="admin", password="admin123"')
  console.log('Jefe Lab: username="12345678", password="jefe123"')
  console.log('Docente: username="23456789", password="docente123"')
  console.log('Estudiante: username="13120016", password="est123"')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error en seed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })