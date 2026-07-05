import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { ApiError } from './utils/ApiError.js';

// Routers
import authRoutes from './features/auth/auth.routes.js';
import usersRoutes from './features/users/users.routes.js';
import exercisesRoutes from './features/exercises/exercises.routes.js';
import workoutsRoutes from './features/workouts/workouts.routes.js';
import progressRoutes from './features/progress/progress.routes.js';
import coachRoutes from './features/coach/coach.routes.js';

const app = express();

// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow any origin in development to avoid local hostname (localhost vs 127.0.0.1) or port mismatches, and to allow LAN testing on mobile devices
    if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:') || origin.startsWith('http://192.168.')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Request Parsers & Loggers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health Check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'healthy', env: env.NODE_ENV });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/exercises', exercisesRoutes);
app.use('/api/workouts', workoutsRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/coach', coachRoutes);

// Fallback 404 Route
app.use((_req, _res, next) => {
  next(ApiError.notFound('Route not found'));
});

// Global Error Handler
app.use(errorMiddleware);

export default app;
