import { Router, Request, Response } from 'express';
import {
  getCompanySettings,
  updateCompanySettings,
  createShift,
  updateShift,
  deleteShift,
  resetAllShifts,
} from '../services/settings.service.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roles.js';

const router = Router();

router.use(authenticate);

// Get current settings
router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await getCompanySettings();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update company settings (Admin only)
router.patch('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const updated = await updateCompanySettings(req.body, {
      id: req.user!.id,
      name: req.user!.name,
    });
    res.json({
      success: true,
      message: 'Company settings updated successfully',
      data: updated,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Create shift (Admin only)
router.post('/shifts', requireAdmin, async (req: Request, res: Response) => {
  try {
    const shift = await createShift(req.body, {
      id: req.user!.id,
      name: req.user!.name,
    });
    res.status(201).json({
      success: true,
      message: 'Shift created successfully',
      data: shift,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update shift (Admin only)
router.patch('/shifts/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const updated = await updateShift(req.params.id, req.body, {
      id: req.user!.id,
      name: req.user!.name,
    });
    res.json({
      success: true,
      message: 'Shift updated successfully',
      data: updated,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete shift (Admin only)
router.delete('/shifts/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await deleteShift(req.params.id, {
      id: req.user!.id,
      name: req.user!.name,
    });
    res.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Reset all shifts (Admin only)
router.post('/shifts/reset', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await resetAllShifts({
      id: req.user!.id,
      name: req.user!.name,
    });
    res.json({
      success: true,
      message: result.message,
      count: result.count,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
