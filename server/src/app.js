import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { classesRouter } from './routes/classes.js';
import { dashboardRouter } from './routes/dashboard.js';
import { healthRouter } from './routes/health.js';
import { subjectsRouter } from './routes/subjects.js';
import { usersRouter } from './routes/users.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.clientOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/', (req, res) => {
  res.json({
    name: 'IntelliClass API',
    status: 'running',
  });
});

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/classes', classesRouter);
app.use('/api/subjects', subjectsRouter);
app.use('/api/users', usersRouter);

app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
  });
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode ?? 500;
  res.status(statusCode).json({
    message: error.message ?? 'Internal server error',
  });
});

export default app;
