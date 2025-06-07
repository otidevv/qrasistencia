// src/routes/index.ts
import { Router } from 'express';
import authRoutes from './auth.routes';
import sessionRoutes from './session.routes';
import attendanceRoutes from './attendance.routes';
import environmentRoutes from './environment.routes';
// import userRoutes from './user.routes';
import careerRoutes from './career.routes';
// import reportRoutes from './report.routes';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API version
router.get('/version', (req, res) => {
  res.json({
    version: process.env.API_VERSION || '1.0.0',
    name: 'QR Attendance System API'
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/sessions', sessionRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/environments', environmentRoutes);
// router.use('/users', userRoutes);
router.use('/careers', careerRoutes);
// router.use('/reports', reportRoutes);

// 404 handler for API routes
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'API endpoint not found',
      path: req.originalUrl
    }
  });
});

export default router;