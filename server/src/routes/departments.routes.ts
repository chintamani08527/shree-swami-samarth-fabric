import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { listDepartments, createDepartment, updateDepartment } from '../services/department.service.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roles.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(authenticate);

// List departments (all authenticated users can read for registration/filters)
router.get('/', async (req: Request, res: Response) => {
  try {
    const list = await listDepartments();
    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const createDeptSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Department name must be at least 2 characters'),
    description: z.string().optional(),
  }),
});

router.post('/', requireAdmin, validate(createDeptSchema), async (req: Request, res: Response) => {
  try {
    const dept = await createDepartment(req.body, {
      id: req.user!.id,
      name: req.user!.name,
    });
    res.status(201).json({
      success: true,
      message: `Department ${dept.name} created successfully`,
      data: dept,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const updated = await updateDepartment(req.params.id, req.body, {
      id: req.user!.id,
      name: req.user!.name,
    });
    res.json({
      success: true,
      message: 'Department updated successfully',
      data: updated,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
