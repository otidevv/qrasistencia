import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import qrRoutes from './routes/qr.routes';
import environmentRoutes from './routes/environment.routes';
import userRoutes from './routes/user.routes';
import userEnvironmentRoutes from './routes/userEnvironment.routes';
import asistenciaRoutes from './routes/asistencia.routes'; // ✅ NUEVA IMPORTACIÓN
import statsRoutes from './routes/stats.routes'; // ✅ Agregar

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/users', userRoutes);
app.use('/api/environments', environmentRoutes);
app.use('/api/asignaciones', userEnvironmentRoutes);
app.use('/api/asistencia', asistenciaRoutes); // ✅ NUEVA RUTA
app.use('/api/stats', statsRoutes); // ✅ Agregar esta línea
// Rutas protegidas
export default app;