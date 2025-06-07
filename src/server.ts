// src/server.ts
import { createServer } from 'http';
import app from './app';
import { config } from './config/environment';
import { logger } from './utils/logger';
import { checkDatabaseConnection, closeDatabaseConnection } from './config/database';
import { configureServerTimeouts, setupGracefulShutdown, setupErrorHandlers } from './config/server';

// Create HTTP server
const server = createServer(app);

// Configure server timeouts
configureServerTimeouts(server);

// Start server
async function startServer() {
  try {
    // Check database connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      throw new Error('Could not connect to database');
    }

    // Start listening
    server.listen(config.server.port, config.server.host, () => {
      logger.info(`🚀 Server started successfully`);
      logger.info(`📍 Listening on http://${config.server.host}:${config.server.port}`);
      logger.info(`🌍 Environment: ${config.env}`);
      logger.info(`📚 API Docs: http://${config.server.host}:${config.server.port}/api/docs`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Cleanup function
async function cleanup() {
  logger.info('Starting cleanup...');
  
  // Close database connections
  await closeDatabaseConnection();
  
  // Add other cleanup tasks here
  // - Close Redis connections
  // - Cancel running jobs
  // - Save state if needed
  
  logger.info('Cleanup completed');
}

// Setup error handlers
setupErrorHandlers();

// Setup graceful shutdown
setupGracefulShutdown(server, cleanup);

// Start the server
startServer();