import dotenv from 'dotenv';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import groupRoutes from './routes/groups.js';
import taskRoutes from './routes/tasks.js';
import shareRoutes from './routes/share.js';
import adminRoutes from './routes/admin.js';
import statusRoutes from './routes/statuses.js';
import roadmapRoutes from './routes/roadmap.js';
import gateRoutes from './routes/gates.js';
import boardRoutes from './routes/board.js';
import tagRoutes from './routes/tags.js';
import searchRoutes from './routes/search.js';
import meRoutes from './routes/me.js';
import tokenRoutes from './routes/tokens.js';
import syncRoutes from './routes/sync.js';
import trashRoutes from './routes/trash.js';
import docRoutes from './routes/docs.js';
import docCategoryRoutes from './routes/docCategories.js';
import promptRoutes from './routes/prompts.js';
import { requireAuth } from './middleware/auth.js';
import { adminOnly } from './middleware/adminOnly.js';

dotenv.config({ path: fs.existsSync('.env.local') ? '.env.local' : '.env' });

const app = express();
const port = process.env.PORT || 4000;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = frontendUrl.split(',').map((url) => url.trim()).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (/^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(origin)) return callback(null, true);
    if (/^http:\/\/localhost:\d+$/i.test(origin)) return callback(null, true);
    if (/^http:\/\/127\.0\.0\.1:\d+$/i.test(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true, name: 'Taskflow API' }));
app.use('/api/auth', authRoutes);
app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/groups', requireAuth, groupRoutes);
app.use('/api/tasks', requireAuth, taskRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/admin', requireAuth, adminOnly, adminRoutes);

// New roadmap/kanban API, built alongside the routes above -- those keep
// serving the still-live old frontend against Group/task.status/order
// untouched. statuses/roadmap/gates/board/tags all define their own
// sub-paths (/projects/:id/..., plus flat resource paths like
// /statuses/:id) with no overlap, so they share one prefix.
app.use('/api', requireAuth, statusRoutes);
app.use('/api', requireAuth, roadmapRoutes);
app.use('/api', requireAuth, gateRoutes);
app.use('/api', requireAuth, boardRoutes);
app.use('/api', requireAuth, tagRoutes);
app.use('/api', requireAuth, docRoutes);
app.use('/api', requireAuth, docCategoryRoutes);
app.use('/api', requireAuth, promptRoutes);
app.use('/api/search', requireAuth, searchRoutes);
app.use('/api/me', requireAuth, meRoutes);
app.use('/api/tokens', requireAuth, tokenRoutes);
app.use('/api/sync', requireAuth, syncRoutes);
app.use('/api/trash', requireAuth, trashRoutes);

app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ message: error.message || 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Taskflow API listening on http://localhost:${port}`);
});
