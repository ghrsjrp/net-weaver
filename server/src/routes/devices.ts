import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../config/database';
import { NetworkDevice, DeviceStatus, VendorType } from '../types';

const router = Router();

// List all devices
router.get('/', async (req: Request, res: Response) => {
  try {
    const devices = await query<NetworkDevice>(
      'SELECT * FROM network_devices ORDER BY name ASC'
    );
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Get device by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const device = await queryOne<NetworkDevice>(
      'SELECT * FROM network_devices WHERE id = $1',
      [req.params.id]
    );
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    res.json(device);
  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

// Create new device
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      hostname,
      ip_address,
      vendor = 'huawei',
      model,
      location,
      description,
      ssh_port = 22,
      ssh_username,
      ssh_password,
    } = req.body;

    // Validate required fields
    if (!name || !hostname || !ip_address) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, hostname, ip_address' 
      });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const result = await query<NetworkDevice>(
      `INSERT INTO network_devices 
        (id, name, hostname, ip_address, vendor, model, location, description, 
         ssh_port, ssh_username, ssh_password_encrypted, status, 
         management_ip, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4::inet, $5, $6, $7, $8, $9, $10, $11, $12, $13::inet, $14::jsonb, $15, $16)
       RETURNING *`,
      [
        id, name, hostname, ip_address, vendor, model, location, description,
        ssh_port, ssh_username, ssh_password, 'unknown', ip_address,
        JSON.stringify({}), now, now
      ]
    );

    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error creating device:', error);
    res.status(500).json({ error: 'Failed to create device' });
  }
});

// Update device
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Build dynamic update query
    const allowedFields = [
      'name', 'hostname', 'ip_address', 'vendor', 'model', 'location',
      'description', 'ssh_port', 'ssh_username', 'ssh_password_encrypted',
      'status', 'management_ip', 'serial_number', 'os_version'
    ];
    
    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    setClause.push(`updated_at = $${paramIndex}`);
    values.push(new Date().toISOString());
    paramIndex++;

    values.push(id);

    const result = await query<NetworkDevice>(
      `UPDATE network_devices 
       SET ${setClause.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(result[0]);
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({ error: 'Failed to update device' });
  }
});

// Delete device
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM network_devices WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({ message: 'Device deleted successfully', id: req.params.id });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

// Get device statistics
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const [totalResult, statusResult, vendorResult] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*) as count FROM network_devices'),
      query<{ status: DeviceStatus; count: string }>(
        'SELECT status, COUNT(*) as count FROM network_devices GROUP BY status'
      ),
      query<{ vendor: VendorType; count: string }>(
        'SELECT vendor, COUNT(*) as count FROM network_devices GROUP BY vendor'
      ),
    ]);

    const total = parseInt(totalResult[0]?.count || '0', 10);
    
    const byStatus: Record<string, number> = {};
    for (const row of statusResult) {
      byStatus[row.status] = parseInt(row.count, 10);
    }

    const byVendor: Record<string, number> = {};
    for (const row of vendorResult) {
      byVendor[row.vendor] = parseInt(row.count, 10);
    }

    res.json({
      total,
      online: byStatus.online || 0,
      offline: byStatus.offline || 0,
      unknown: byStatus.unknown || 0,
      error: byStatus.error || 0,
      byVendor,
    });
  } catch (error) {
    console.error('Error fetching device stats:', error);
    res.status(500).json({ error: 'Failed to fetch device statistics' });
  }
});

export default router;
