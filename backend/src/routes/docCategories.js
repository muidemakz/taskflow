import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireProject, requireDocCategory } from '../lib/ownership.js';
import { resolveCategoryDeletion } from '../lib/docCategoryDeletion.js';

const router = Router();

export const STARTER_CATEGORIES = ['moat', 'decision', 'principle', 'reference', 'prd'];

router.get('/projects/:id/categories', async (req, res, next) => {
  try {
    const project = await requireProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const categories = await prisma.docCategory.findMany({ where: { projectId: project.id, deletedAt: null }, orderBy: { name: 'asc' } });
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

router.post('/projects/:id/categories', async (req, res, next) => {
  try {
    const project = await requireProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ message: 'Category name is required' });
    const category = await prisma.docCategory.upsert({
      where: { projectId_name: { projectId: project.id, name } },
      update: { deletedAt: null },
      create: { projectId: project.id, name }
    });
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

// Rename is a label-only change -- category is an FK on DocEntry, not a
// copied text value, so existing DocEntry.categoryId rows are untouched.
router.patch('/categories/:catId', async (req, res, next) => {
  try {
    const category = await requireDocCategory(req.params.catId, req.auth.sub);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ message: 'Category name is required' });
    const updated = await prisma.docCategory.update({ where: { id: category.id }, data: { name } });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Mode-based resolution, same shape as gate deletion: the frontend already
// knows (from the categories list + doc counts) whether resolution is
// needed and can send the mode on the first call; if it doesn't and the
// category still has docs, this returns a 200 preview (not an error) with
// the affected docs so the frontend can show the three-path prompt.
router.delete('/categories/:catId', async (req, res, next) => {
  try {
    const category = await requireDocCategory(req.params.catId, req.auth.sub);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    const affectedDocs = await prisma.docEntry.findMany({
      where: { categoryId: category.id, deletedAt: null },
      select: { id: true, title: true }
    });

    const decision = resolveCategoryDeletion({
      affectedDocs,
      mode: req.body.mode,
      targetCategoryId: req.body.targetCategoryId,
      newCategoryName: req.body.newCategoryName
    });

    if (decision.needsResolution) {
      return res.json({ needsResolution: true, categoryId: category.id, affectedDocs });
    }
    if (decision.error) {
      return res.status(400).json({ message: decision.error });
    }

    let targetCategoryId = null;
    let createdCategory = null;

    if (decision.action === 'reassign') {
      targetCategoryId = decision.targetCategoryId;
      const target = await requireDocCategory(targetCategoryId, req.auth.sub);
      if (!target || target.projectId !== category.projectId) {
        return res.status(400).json({ message: 'targetCategoryId must be a category in the same project' });
      }
    } else if (decision.action === 'create-and-move') {
      createdCategory = await prisma.docCategory.upsert({
        where: { projectId_name: { projectId: category.projectId, name: decision.newCategoryName } },
        update: { deletedAt: null },
        create: { projectId: category.projectId, name: decision.newCategoryName }
      });
      targetCategoryId = createdCategory.id;
    }
    // decision.action === 'uncategorize' -> targetCategoryId stays null

    const result = await prisma.$transaction(async (tx) => {
      const moved = await tx.docEntry.updateMany({ where: { categoryId: category.id, deletedAt: null }, data: { categoryId: targetCategoryId } });
      await tx.docCategory.update({ where: { id: category.id }, data: { deletedAt: new Date() } });
      return { movedCount: moved.count };
    });

    res.json({ deletedCategoryId: category.id, mode: decision.action, targetCategoryId, createdCategory, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
