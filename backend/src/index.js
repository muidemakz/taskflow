import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import groupRoutes from './routes/groups.js';
import taskRoutes from './routes/tasks.js';
import shareRoutes from './routes/share.js';
import adminRoutes from './routes/admin.js';
import { requireAuth } from './middleware/auth.js';
import { adminOnly } from './middleware/adminOnly.js';

const app = express();
const port = process.env.PORT || 4000;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({ origin: frontendUrl.split(',').map((url) => url.trim()), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true, name: 'Taskflow API' }));
app.use('/api/auth', authRoutes);
app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/groups', requireAuth, groupRoutes);
app.use('/api/tasks', requireAuth, taskRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/admin', requireAuth, adminOnly, adminRoutes);

app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ message: error.message || 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Taskflow API listening on http://localhost:${port}`);
});
