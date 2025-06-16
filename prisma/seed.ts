import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();

// Definir todas las carreras
const CARRERAS_DATA = [
  { name: 'INGENIERÍA DE SISTEMAS E INFORMÁTICA', code: 'IS' },
  { name: 'CONTABILIDAD Y FINANZAS', code: 'CF' },
  { name: 'DERECHO Y CIENCIAS POLÍTICAS', code: 'DCP' },
  { name: 'INGENIERÍA AGROINDUSTRIAL', code: 'IAI' },
  { name: 'ENFERMERÍA', code: 'ENF' },
  { name: 'PROGRAMA DE MOVILIDAD ESTUDIANTIL', code: 'PME' },
  { name: 'EDUCACIÓN ESPECIALIDAD INICIAL Y ESPECIAL', code: 'EEIE' },
  { name: 'EDUCACIÓN ESPECIALIDAD PRIMARIA E INFORMÁTICA', code: 'EEPI' },
  { name: 'EDUCACIÓN ESPECIALIDAD MATEMÁTICA Y COMPUTACIÓN', code: 'EEMC' },
  { name: 'MEDICINA VETERINARIA - ZOOTECNIA', code: 'MVZ' },
  { name: 'ECOTURISMO', code: 'ECT' },
  { name: 'ADMINISTRACIÓN Y NEGOCIOS INTERNACIONALES', code: 'ANI' },
  { name: 'INGENIERÍA FORESTAL Y MEDIO AMBIENTE', code: 'IFMA' }
];

interface StudentRow {
  CodigoEstudiante: string;
  CorreoInstitucional: string;
  FullName: string;
  Name: string;
  PaternalSurname: string;
  MaternalSurname: string;
  Dni: string;
  PhoneNumber?: string;
  Address?: string;
  BirthDate?: string;
  PersonalEmail?: string;
  CreatedAt?: string;
  CareerName: string;
}

// Función helper para generar QR
function generateQRCode(): string {
  return `QR-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

// Función para limpiar y validar datos
function cleanAndValidateData(student: StudentRow): StudentRow | null {
  try {
    if (!student.CodigoEstudiante || !student.Dni || !student.CareerName) {
      return null;
    }

    return {
      ...student,
      CodigoEstudiante: student.CodigoEstudiante.toString().trim(),
      Dni: student.Dni.toString().trim(),
      FullName: (student.FullName || '').toString().trim(),
      Name: (student.Name || student.FullName || '').toString().trim().split(',')[0],
      CareerName: (student.CareerName || '').toString().trim().toUpperCase(),
      CorreoInstitucional: (student.CorreoInstitucional || '').toString().trim(),
      PhoneNumber: student.PhoneNumber ? student.PhoneNumber.toString().trim() : undefined
    };
  } catch (error) {
    return null;
  }
}

async function importStudentsFromExcel(roleEstudianteId: string, careerMapping: Record<string, string>) {
  try {
    console.log('\n📚 Importando estudiantes desde Excel...');
    
    // Intentar leer el archivo Excel
    let workbook;
    try {
      workbook = XLSX.readFile('users.xlsx');
    } catch (error) {
      console.log('⚠️  No se encontró users.xlsx, saltando importación masiva');
      return { processed: 0, skipped: 0, errors: 0 };
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData: StudentRow[] = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📊 Total de registros en Excel: ${rawData.length}`);

    const validStudents = rawData
      .map(cleanAndValidateData)
      .filter((student): student is StudentRow => student !== null);

    console.log(`📊 Estudiantes válidos para procesar: ${validStudents.length}`);

    const BATCH_SIZE = 50;
    let processed = 0;
    let errors = 0;
    let skipped = 0;
    const errorDetails: string[] = [];

    for (let i = 0; i < validStudents.length; i += BATCH_SIZE) {
      const batch = validStudents.slice(i, i + BATCH_SIZE);
      
      for (const student of batch) {
        try {
          const codigoEstudiante = student.CodigoEstudiante;
          const dni = student.Dni;
          
          // Verificar si el usuario ya existe
          const existingUser = await prisma.user.findUnique({
            where: { username: codigoEstudiante }
          });
          
          if (existingUser) {
            const existingProfile = await prisma.studentProfile.findFirst({
              where: { 
                OR: [
                  { codigoEstudiante: codigoEstudiante },
                  { dni: dni },
                  { userId: existingUser.id }
                ]
              }
            });
            
            if (existingProfile) {
              skipped++;
              continue;
            }
          }
          
          // Obtener el ID de la carrera
          const careerId = careerMapping[student.CareerName];
          if (!careerId) {
            errorDetails.push(`Carrera no mapeada: "${student.CareerName}" (Estudiante: ${codigoEstudiante})`);
            errors++;
            continue;
          }
          
          // Crear el usuario y el perfil
          await prisma.$transaction(async (tx) => {
            let userId: string;
            
            if (!existingUser) {
              const newUser = await tx.user.create({
                data: {
                  username: codigoEstudiante,
                  name: student.Name || student.FullName,
                  email: student.CorreoInstitucional || null,
                  password: await bcrypt.hash(dni, 10),
                  roleId: roleEstudianteId,
                  isActive: true
                }
              });
              userId = newUser.id;
            } else {
              userId = existingUser.id;
            }
            
            await tx.studentProfile.create({
              data: {
                userId: userId,
                codigoEstudiante: codigoEstudiante,
                dni: dni,
                fullName: student.FullName,
                phoneNumber: student.PhoneNumber || null,
                careerId: careerId
              }
            });
          });
          
          processed++;
        } catch (error: any) {
          const errorMsg = `Error procesando estudiante ${student.CodigoEstudiante}: ${error.message || error}`;
          errorDetails.push(errorMsg);
          errors++;
        }
      }
      
      if (i % (BATCH_SIZE * 10) === 0) {
        console.log(`  📈 Progreso: ${Math.min(i + BATCH_SIZE, validStudents.length)}/${validStudents.length} revisados`);
      }
    }

    console.log('\n📊 Resumen de importación desde Excel:');
    console.log(`  ✅ Procesados exitosamente: ${processed}`);
    console.log(`  ⏭️  Omitidos (ya existían): ${skipped}`);
    console.log(`  ❌ Errores: ${errors}`);

    if (errorDetails.length > 0 && errorDetails.length <= 10) {
      console.log('\n❌ Detalles de errores:');
      errorDetails.forEach(error => console.log(`  - ${error}`));
    }

    return { processed, skipped, errors };
  } catch (error) {
    console.error('❌ Error en importación desde Excel:', error);
    return { processed: 0, skipped: 0, errors: 0 };
  }
}

async function main() {
  console.log('🌱 Iniciando seed completo...\n');

  // 1. Crear Roles
  console.log('📋 Creando roles...');
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: 'ESTUDIANTE' },
      update: {},
      create: { name: 'ESTUDIANTE', level: 1 }
    }),
    prisma.role.upsert({
      where: { name: 'DOCENTE' },
      update: {},
      create: { name: 'DOCENTE', level: 2 }
    }),
    prisma.role.upsert({
      where: { name: 'JEFE_LAB' },
      update: {},
      create: { name: 'JEFE_LAB', level: 3 }
    }),
    prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN', level: 4 }
    })
  ]);

  const [roleEstudiante, roleDocente, roleJefeLab, roleAdmin] = roles;
  console.log(`✅ ${roles.length} roles verificados`);

  // 2. Crear todas las Carreras
  console.log('\n🎓 Creando carreras...');
  const careerMapping: Record<string, string> = {};
  
  for (const careerData of CARRERAS_DATA) {
    const career = await prisma.career.upsert({
      where: { name: careerData.name },
      update: { code: careerData.code },
      create: {
        name: careerData.name,
        code: careerData.code
      }
    });
    careerMapping[career.name.toUpperCase()] = career.id;
    console.log(`  ✅ ${career.name} - ${career.code}`);
  }

  console.log(`✅ ${CARRERAS_DATA.length} carreras verificadas`);

  // 3. Crear Usuario Admin
  console.log('\n👤 Creando usuarios del sistema...');
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      name: 'Administrador del Sistema',
      email: 'admin@universidad.edu',
      password: await bcrypt.hash('admin123', 10),
      roleId: roleAdmin.id,
      isActive: true
    }
  });

  // 4. Crear Jefe de Laboratorio
  const jefeLabUser = await prisma.user.upsert({
    where: { username: '12345678' },
    update: {},
    create: {
      username: '12345678',
      name: 'Ing. Carlos Mendoza',
      email: 'cmendoza@universidad.edu',
      password: await bcrypt.hash('jefe123', 10),
      roleId: roleJefeLab.id,
      isActive: true
    }
  });

  // 5. Crear Docentes
  const docentes = await Promise.all([
    prisma.user.upsert({
      where: { username: '23456789' },
      update: {},
      create: {
        username: '23456789',
        name: 'Dr. María García',
        email: 'mgarcia@universidad.edu',
        password: await bcrypt.hash('docente123', 10),
        roleId: roleDocente.id,
        isActive: true
      }
    }),
    prisma.user.upsert({
      where: { username: '34567890' },
      update: {},
      create: {
        username: '34567890',
        name: 'Ing. Juan Pérez',
        email: 'jperez@universidad.edu',
        password: await bcrypt.hash('docente123', 10),
        roleId: roleDocente.id,
        isActive: true
      }
    })
  ]);

  console.log('✅ Usuarios del sistema creados');

  // 6. Crear algunos Estudiantes de ejemplo
  console.log('\n🎒 Creando estudiantes de ejemplo...');
  const ingSistemasId = careerMapping['INGENIERÍA DE SISTEMAS E INFORMÁTICA'];
  const ingForestalId = careerMapping['INGENIERÍA FORESTAL Y MEDIO AMBIENTE'];
  
  await prisma.user.upsert({
    where: { username: '13120016' },
    update: {},
    create: {
      username: '13120016',
      name: 'SAAVEDRA RIOS, ZEUS',
      email: '16crismo@gmail.com',
      password: await bcrypt.hash('71821111', 10),
      roleId: roleEstudiante.id,
      isActive: true,
      studentProfile: {
        create: {
          codigoEstudiante: '13120016',
          dni: '71821111',
          fullName: 'SAAVEDRA RIOS, ZEUS',
          phoneNumber: '982574372',
          careerId: ingSistemasId
        }
      }
    }
  });

  console.log('✅ Estudiantes de ejemplo creados');

  // 7. Importar estudiantes desde Excel
  const importResult = await importStudentsFromExcel(roleEstudiante.id, careerMapping);

  // 8. Crear Ambientes
  console.log('\n🏢 Creando ambientes...');
  const ambientes = await Promise.all([
    prisma.environment.upsert({
      where: { name: 'LAB CÓMPUTO 01' },
      update: {},
      create: {
        name: 'LAB CÓMPUTO 01',
        type: 'LAB',
        capacity: 30,
        managerId: jefeLabUser.id,
        isActive: true
      }
    }),
    prisma.environment.upsert({
      where: { name: 'LAB CÓMPUTO 02' },
      update: {},
      create: {
        name: 'LAB CÓMPUTO 02',
        type: 'LAB',
        capacity: 25,
        managerId: jefeLabUser.id,
        isActive: true
      }
    }),
    prisma.environment.upsert({
      where: { name: 'AULA 101' },
      update: {},
      create: {
        name: 'AULA 101',
        type: 'AULA',
        capacity: 40,
        isActive: true
      }
    }),
    prisma.environment.upsert({
      where: { name: 'AULA 202' },
      update: {},
      create: {
        name: 'AULA 202',
        type: 'AULA',
        capacity: 35,
        isActive: true
      }
    }),
    prisma.environment.upsert({
      where: { name: 'AUDITORIO PRINCIPAL' },
      update: {},
      create: {
        name: 'AUDITORIO PRINCIPAL',
        type: 'AUDITORIO',
        capacity: 200,
        isActive: true
      }
    })
  ]);

  const [lab01, lab02, aula101, aula202, auditorio] = ambientes;
  console.log(`✅ ${ambientes.length} ambientes verificados`);

  // 9. Crear Sesiones de Ejemplo
  console.log('\n📅 Creando sesiones de ejemplo...');
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Sesión de mañana
  await prisma.session.create({
    data: {
      environmentId: lab01.id,
      name: 'Programación I - Práctica',
      type: 'CLASE',
      allowExternals: false,
      hostId: docentes[0].id,
      startTime: new Date(hoy.getTime() + 7 * 60 * 60 * 1000),
      endTime: new Date(hoy.getTime() + 13 * 60 * 60 * 1000),
      qrRotationMinutes: 3,
      currentQRCode: generateQRCode(),
      lastQRRotation: new Date(),
      isActive: true
    }
  });

  // Sesión de tarde
  await prisma.session.create({
    data: {
      environmentId: lab01.id,
      name: 'Base de Datos - Laboratorio',
      type: 'CLASE',
      allowExternals: false,
      hostId: docentes[1].id,
      startTime: new Date(hoy.getTime() + 14 * 60 * 60 * 1000),
      endTime: new Date(hoy.getTime() + 20 * 60 * 60 * 1000),
      qrRotationMinutes: 3,
      currentQRCode: generateQRCode(),
      lastQRRotation: new Date(),
      isActive: true
    }
  });

  // Conferencia
  await prisma.session.create({
    data: {
      environmentId: auditorio.id,
      name: 'Conferencia: Inteligencia Artificial en la Educación',
      type: 'CONFERENCIA',
      allowExternals: true,
      hostName: 'Dr. Roberto Sánchez - MIT',
      startTime: new Date(hoy.getTime() + 16 * 60 * 60 * 1000),
      endTime: new Date(hoy.getTime() + 18 * 60 * 60 * 1000),
      qrRotationMinutes: 5,
      currentQRCode: generateQRCode(),
      lastQRRotation: new Date(),
      isActive: true
    }
  });

  console.log('✅ Sesiones de ejemplo creadas');

  // Resumen final
  console.log('\n✅ Seed completado exitosamente!');
  console.log('\n📊 Resumen:');
  console.log(`- Roles creados: ${roles.length}`);
  console.log(`- Carreras creadas: ${CARRERAS_DATA.length}`);
  console.log(`- Usuarios del sistema: ${4 + docentes.length}`);
  console.log(`- Estudiantes desde Excel: ${importResult.processed}`);
  console.log(`- Ambientes creados: ${ambientes.length}`);
  console.log(`- Sesiones de ejemplo: 3`);
  
  console.log('\n🔐 Credenciales de prueba:');
  console.log('Admin: username="admin", password="admin123"');
  console.log('Jefe Lab: username="12345678", password="jefe123"');
  console.log('Docente: username="23456789", password="docente123"');
  console.log('Estudiante: username="13120016", password="71821111"');
  console.log('\n📝 Nota: Las contraseñas de los estudiantes importados son sus DNIs');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error en seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });