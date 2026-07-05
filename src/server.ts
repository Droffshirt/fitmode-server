import app from './app.js';
import { env } from './config/env.js';
import prisma from './config/database.js';

async function bootstrap() {
  try {
    // Test database connection
    console.log('Connecting to PostgreSQL database via Prisma...');
    await prisma.$connect();
    console.log('Database connection established successfully.');

    // Start server
    app.listen(env.PORT, '0.0.0.0', () => {
      console.log(`Fitmode Backend is running on port ${env.PORT} in ${env.NODE_ENV} mode.`);
      console.log(`API URL: http://0.0.0.0:${env.PORT}`);
    });
  } catch (error) {
    console.error('Fatal error during bootstrap:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Handle unhandled rejections and exceptions
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection! Shutting down...', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception! Shutting down...', err);
  process.exit(1);
});

bootstrap();

