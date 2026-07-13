import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { projectInclude, taskCounts, toClientProject } from '../utils/project.js';

const router = Router();

router.get('/:shareToken', async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { shareToken: req.params.shareToken },
      include: projectInclude
    });
    if (!project || project.deletedAt || !project.shareEnabled) {
      return res.status(404).json({ message: 'This project is no longer shared' });
    }
    res.json({ ...toClientProject(project), stats: taskCounts(project) });
  } catch (error) {
    next(error);
  }
});

export default router;
