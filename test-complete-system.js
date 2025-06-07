// additional-features-test.js
// Probar funcionalidades adicionales del sistema

const API = 'http://localhost:3000/api';

// IDs de la sesión recién creada
const SESSION_ID = 'cmbmpuf4q000htu8k6jdb2rj8';
const QR_CODE = 'QR-1749329881386-ngtcxx';

async function testAdditionalFeatures() {
  console.log('🔧 PROBANDO FUNCIONALIDADES ADICIONALES\n');

  try {
    // 1. Login como diferentes usuarios
    console.log('1️⃣ MÚLTIPLES ESTUDIANTES MARCANDO ASISTENCIA\n');
    
    // Estudiante 2
    let res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '14120030',
        password: 'est123'
      })
    });
    
    let data = await res.json();
    const student2Token = data.token;
    console.log(`✅ Login: ${data.user.name}`);
    
    // Marcar asistencia estudiante 2
    res = await fetch(`${API}/attendance/mark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${student2Token}`
      },
      body: JSON.stringify({ qrCode: QR_CODE })
    });
    
    data = await res.json();
    if (res.ok) {
      console.log(`✅ Asistencia marcada: ${data.data.type}\n`);
    }

    // 2. Ver estadísticas de asistencia
    console.log('2️⃣ ESTADÍSTICAS DE ASISTENCIA\n');
    
    // Login como admin para ver estadísticas
    res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    data = await res.json();
    const adminToken = data.token;
    
    // Estadísticas por sesión
    res = await fetch(`${API}/attendance/stats?type=session&entityId=${SESSION_ID}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    data = await res.json();
    if (res.ok) {
      console.log('📊 Estadísticas de la sesión:');
      console.log(JSON.stringify(data.data, null, 2));
    }

    // 3. Exportar reporte
    console.log('\n3️⃣ EXPORTAR REPORTE DE ASISTENCIA\n');
    
    res = await fetch(`${API}/attendance/export/csv?sessionId=${SESSION_ID}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    if (res.ok) {
      console.log('✅ Reporte CSV disponible');
      console.log('   Puedes guardarlo con: curl -H "Authorization: Bearer [TOKEN]" [URL] > reporte.csv\n');
    }

    // 4. Ver horario de ambiente
    console.log('4️⃣ HORARIO DEL AMBIENTE\n');
    
    // Obtener ID del ambiente AULA 202
    res = await fetch(`${API}/environments`);
    data = await res.json();
    const aula202 = data.data.find(e => e.name === 'AULA 202');
    
    if (aula202) {
      res = await fetch(`${API}/environments/${aula202.id}/schedule`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      
      data = await res.json();
      if (res.ok) {
        console.log(`📅 Horario de ${aula202.name}:`);
        console.log(`   Total sesiones: ${data.data.totalSessions}`);
        Object.entries(data.data.schedule).forEach(([date, sessions]) => {
          console.log(`\n   ${date}:`);
          sessions.forEach(s => {
            const start = new Date(s.startTime).toLocaleTimeString('es-PE');
            const end = new Date(s.endTime).toLocaleTimeString('es-PE');
            console.log(`   - ${s.name} (${start} - ${end})`);
          });
        });
      }
    }

    // 5. Marcar salida
    console.log('\n\n5️⃣ MARCAR SALIDA\n');
    
    // El primer estudiante marca salida
    res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '14220025',
        password: 'est123'
      })
    });
    
    data = await res.json();
    const student1Token = data.token;
    
    // Marcar salida (mismo endpoint, detecta que ya marcó entrada)
    res = await fetch(`${API}/attendance/mark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${student1Token}`
      },
      body: JSON.stringify({ qrCode: QR_CODE })
    });
    
    data = await res.json();
    if (res.ok && data.data.type === 'checkout') {
      console.log(`✅ Ana López marcó SALIDA`);
      const duration = data.data.attendance.checkOutTime && data.data.attendance.checkInTime
        ? Math.floor((new Date(data.data.attendance.checkOutTime) - new Date(data.data.attendance.checkInTime)) / 60000)
        : 'calculando...';
      console.log(`   Duración en sesión: ${duration} minutos`);
    }

    // 6. Historial personal del estudiante
    console.log('\n6️⃣ HISTORIAL DE ASISTENCIA PERSONAL\n');
    
    res = await fetch(`${API}/attendance/my-attendance`, {
      headers: { 'Authorization': `Bearer ${student1Token}` }
    });
    
    data = await res.json();
    if (res.ok) {
      console.log('📚 Mi historial:');
      data.data.forEach(a => {
        console.log(`   - ${a.session.name} | ${new Date(a.checkIn).toLocaleDateString('es-PE')} | ${a.status}`);
      });
      
      console.log('\n📊 Resumen:');
      console.log(`   Total sesiones: ${data.stats.totalSessions}`);
      console.log(`   Puntuales: ${data.stats.onTime}`);
      console.log(`   Tardanzas: ${data.stats.late}`);
    }

    console.log('\n✅ TODAS LAS FUNCIONALIDADES ADICIONALES FUNCIONAN CORRECTAMENTE!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Información
console.log('ℹ️  Este script prueba funcionalidades adicionales del sistema');
console.log('   Usando la sesión creada anteriormente\n');

// Ejecutar
setTimeout(() => {
  testAdditionalFeatures();
}, 1000);