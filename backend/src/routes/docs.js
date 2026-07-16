import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireProject, requireDocEntry, requireTask } from '../lib/ownership.js';

const router = Router();

const DOC_CATEGORY_SELECT = { category: { select: { id: true, name: true } } };

// --- DocEntry ---

router.post('/projects/:id/docs', async (req, res, next) => {
  try {
    const project = await requireProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const title = req.body.title?.trim();
    const body = req.body.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });
    if (typeof body !== 'string' || !body.trim()) return res.status(400).json({ message: 'Body is required' });

    let categoryId = null;
    if (req.body.category_id) {
      const category = await prisma.docCategory.findFirst({ where: { id: req.body.category_id, projectId: project.id, deletedAt: null } });
      if (!category) return res.status(400).json({ message: 'category_id does not belong to this project' });
      categoryId = category.id;
    }

    const status = req.body.status === 'RETIRED' ? 'RETIRED' : 'ACTIVE';

    const doc = await prisma.docEntry.create({
      data: { projectId: project.id, title, body, categoryId, status },
      include: DOC_CATEGORY_SELECT
    });
    res.status(201).json(doc);
  } catch (error) {
    next(error);
  }
});

// Never included: task/gate progress calculations. DocEntry rows have no
// relation to Status/Gate/countsAsDone anywhere in this file or elsewhere
// in the codebase -- docs deliberately never factor into completion math.
router.get('/projects/:id/docs', async (req, res, next) => {
  try {
    const project = await requireProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const where = { projectId: project.id, deletedAt: null };
    if (req.query.categoryId === 'none') where.categoryId = null;
    else if (req.query.categoryId) where.categoryId = req.query.categoryId;
    if (req.query.status) where.status = req.query.status;
    const docs = await prisma.docEntry.findMany({ where, include: DOC_CATEGORY_SELECT, orderBy: { updatedAt: 'desc' } });
    res.json(docs);
  } catch (error) {
    next(error);
  }
});

router.get('/projects/:id/docs/:docId', async (req, res, next) => {
  try {
    const doc = await requireDocEntry(req.params.docId, req.auth.sub);
    if (!doc || doc.projectId !== req.params.id) return res.status(404).json({ message: 'Doc not found' });
    const full = await prisma.docEntry.findUnique({ where: { id: doc.id }, include: DOC_CATEGORY_SELECT });
    res.json(full);
  } catch (error) {
    next(error);
  }
});

router.patch('/projects/:id/docs/:docId', async (req, res, next) => {
  try {
    const doc = await requireDocEntry(req.params.docId, req.auth.sub);
    if (!doc || doc.projectId !== req.params.id) return res.status(404).json({ message: 'Doc not found' });

    const data = {};
    if (typeof req.body.title === 'string' && req.body.title.trim()) data.title = req.body.title.trim();
    if (typeof req.body.body === 'string' && req.body.body.trim()) data.body = req.body.body;
    if (req.body.status) {
      if (!['ACTIVE', 'RETIRED'].includes(req.body.status)) return res.status(400).json({ message: 'Invalid status' });
      data.status = req.body.status;
    }
    if ('category_id' in req.body) {
      if (req.body.category_id) {
        const category = await prisma.docCategory.findFirst({ where: { id: req.body.category_id, projectId: doc.projectId, deletedAt: null } });
        if (!category) return res.status(400).json({ message: 'category_id does not belong to this project' });
        data.categoryId = category.id;
      } else {
        data.categoryId = null;
      }
    }
    if (!Object.keys(data).length) return res.status(400).json({ message: 'Nothing to update' });

    const updated = await prisma.docEntry.update({ where: { id: doc.id }, data, include: DOC_CATEGORY_SELECT });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Soft-delete cascade: annotations soft-deleted alongside, stamped with the
// exact same deletedAt so restoring the doc can un-delete precisely the
// ones that came down with it (not any annotation independently deleted
// earlier). TaskDocLinks are hard-deleted ("severed") -- restoring the doc
// does not bring links back.
router.delete('/projects/:id/docs/:docId', async (req, res, next) => {
  try {
    const doc = await requireDocEntry(req.params.docId, req.auth.sub);
    if (!doc || doc.projectId !== req.params.id) return res.status(404).json({ message: 'Doc not found' });
    const now = new Date();
    await prisma.$transaction([
      prisma.docEntry.update({ where: { id: doc.id }, data: { deletedAt: now } }),
      prisma.docAnnotation.updateMany({ where: { docEntryId: doc.id, deletedAt: null }, data: { deletedAt: now } }),
      prisma.taskDocLink.deleteMany({ where: { docEntryId: doc.id } })
    ]);
    res.json({ deletedDocId: doc.id, deletedAt: now });
  } catch (error) {
    next(error);
  }
});

// --- TaskDocLink (bidirectional) ---

router.post('/projects/:id/tasks/:taskId/docs', async (req, res, next) => {
  try {
    const task = await requireTask(req.params.taskId, req.auth.sub);
    if (!task || task.projectId !== req.params.id) return res.status(404).json({ message: 'Task not found' });
    const doc = await requireDocEntry(req.body.docId, req.auth.sub);
    if (!doc || doc.projectId !== task.projectId) return res.status(400).json({ message: 'docId does not belong to this project' });
    const link = await prisma.taskDocLink.upsert({
      where: { taskId_docEntryId: { taskId: task.id, docEntryId: doc.id } },
      update: {},
      create: { taskId: task.id, docEntryId: doc.id }
    });
    res.status(201).json(link);
  } catch (error) {
    next(error);
  }
});

router.get('/projects/:id/tasks/:taskId/docs', async (req, res, next) => {
  try {
    const task = await requireTask(req.params.taskId, req.auth.sub);
    if (!task || task.projectId !== req.params.id) return res.status(404).json({ message: 'Task not found' });
    const links = await prisma.taskDocLink.findMany({
      where: { taskId: task.id, docEntry: { deletedAt: null } },
      include: { docEntry: { include: DOC_CATEGORY_SELECT } }
    });
    res.json(links.map((l) => l.docEntry));
  } catch (error) {
    next(error);
  }
});

router.delete('/projects/:id/tasks/:taskId/docs/:docId', async (req, res, next) => {
  try {
    const task = await requireTask(req.params.taskId, req.auth.sub);
    if (!task || task.projectId !== req.params.id) return res.status(404).json({ message: 'Task not found' });
    await prisma.taskDocLink.deleteMany({ where: { taskId: task.id, docEntryId: req.params.docId } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/projects/:id/docs/:docId/tasks', async (req, res, next) => {
  try {
    const doc = await requireDocEntry(req.params.docId, req.auth.sub);
    if (!doc || doc.projectId !== req.params.id) return res.status(404).json({ message: 'Doc not found' });
    const links = await prisma.taskDocLink.findMany({
      where: { docEntryId: doc.id, task: { deletedAt: null } },
      include: { task: { select: { id: true, title: true, projectId: true, gateId: true, statusId: true } } }
    });
    res.json(links.map((l) => l.task));
  } catch (error) {
    next(error);
  }
});

// --- DocAnnotation ---

router.post('/projects/:id/docs/:docId/annotations', async (req, res, next) => {
  try {
    const doc = await requireDocEntry(req.params.docId, req.auth.sub);
    if (!doc || doc.projectId !== req.params.id) return res.status(404).json({ message: 'Doc not found' });
    const anchor = req.body.anchor?.trim();
    const body = req.body.body?.trim();
    if (!anchor || !body) return res.status(400).json({ message: 'anchor and body are required' });
    const annotation = await prisma.docAnnotation.create({
      data: { docEntryId: doc.id, authorId: req.auth.sub, anchor, body },
      include: { author: { select: { id: true, name: true } } }
    });
    res.status(201).json(annotation);
  } catch (error) {
    next(error);
  }
});

router.get('/projects/:id/docs/:docId/annotations', async (req, res, next) => {
  try {
    const doc = await requireDocEntry(req.params.docId, req.auth.sub);
    if (!doc || doc.projectId !== req.params.id) return res.status(404).json({ message: 'Doc not found' });
    const annotations = await prisma.docAnnotation.findMany({
      where: { docEntryId: doc.id, deletedAt: null },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' }
    });
    res.json(annotations);
  } catch (error) {
    next(error);
  }
});

// v1: no update endpoint (delete + recreate to revise). Delete is
// restricted to the annotation's own author -- no moderation override yet.
router.delete('/projects/:id/docs/:docId/annotations/:annotationId', async (req, res, next) => {
  try {
    const doc = await requireDocEntry(req.params.docId, req.auth.sub);
    if (!doc || doc.projectId !== req.params.id) return res.status(404).json({ message: 'Doc not found' });
    const annotation = await prisma.docAnnotation.findFirst({ where: { id: req.params.annotationId, docEntryId: doc.id, deletedAt: null } });
    if (!annotation) return res.status(404).json({ message: 'Annotation not found' });
    if (annotation.authorId !== req.auth.sub) return res.status(403).json({ message: 'You can only delete your own annotations' });
    await prisma.docAnnotation.update({ where: { id: annotation.id }, data: { deletedAt: new Date() } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
