import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../config/database';

const router = Router();

// Get all settings
router.get('/', async (req: Request, res: Response) => {
  try {
    const settings = await query('SELECT * FROM system_settings ORDER BY key');
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get setting by key
router.get('/:key', async (req: Request, res: Response) => {
  try {
    const setting = await queryOne(
      'SELECT * FROM system_settings WHERE key = $1',
      [req.params.key]
    );
    
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    
    res.json(setting);
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

// Create or update setting
router.put('/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'value is required' });
    }

    const now = new Date().toISOString();

    const result = await query(
      `INSERT INTO system_settings (id, key, value, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         description = COALESCE(EXCLUDED.description, system_settings.description),
         updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [uuidv4(), key, JSON.stringify(value), description, now]
    );

    res.json(result[0]);
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// Delete setting
router.delete('/:key', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM system_settings WHERE key = $1 RETURNING key',
      [req.params.key]
    );

    if (result.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({ message: 'Setting deleted successfully' });
  } catch (error) {
    console.error('Error deleting setting:', error);
    res.status(500).json({ error: 'Failed to delete setting' });
  }
});

// Get device interfaces
router.get('/device/:deviceId/interfaces', async (req: Request, res: Response) => {
  try {
    const interfaces = await query(
      `SELECT * FROM device_interfaces 
       WHERE device_id = $1 
       ORDER BY name`,
      [req.params.deviceId]
    );
    res.json(interfaces);
  } catch (error) {
    console.error('Error fetching interfaces:', error);
    res.status(500).json({ error: 'Failed to fetch interfaces' });
  }
});

export default router;
