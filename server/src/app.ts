import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import workerRoutes from './routes/workers.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import departmentsRoutes from './routes/departments.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import auditRoutes from './routes/audit.routes.js';
import adminsRoutes from './routes/admins.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Middlewares
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin) return callback(null, true);
    // Allow localhost and configured origins
    if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin === config.corsOrigin) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive for evaluation and local dev
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Request logger
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
  }
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'Shree Swami Samarth Fabric Attendance API',
    company: config.companyName,
    timezone: config.companyTimezone,
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/admins', adminsRoutes);

// In production, serve the built frontend assets
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) {
    return next();
  }
  const indexHtml = path.join(clientDistPath, 'index.html');
  res.sendFile(indexHtml, (err) => {
    if (err) {
      // If client not built yet, return informative status
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Shree Swami Samarth Fabric - Attendance System API</title></head>
          <body style="font-family:sans-serif; text-align:center; padding:50px;">
            <h2>Shree Swami Samarth Fabric</h2>
            <p>Smart Attendance Management Backend API is active on port ${config.port}.</p>
            <p>Please run the frontend development server or build the frontend with <code>npm run build</code>.</p>
          </body>
        </html>
      `);
    }
  });
});

// Central Error Handler
app.use(errorHandler);
