import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../config/database';

const router = Router();

// Get all topology neighbors
router.get('/neighbors', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.query;
    
    let queryText = `
      SELECT tn.*, nd.name as local_device_name
      FROM topology_neighbors tn
      LEFT JOIN network_devices nd ON tn.local_device_id = nd.id
    `;
    const params: any[] = [];
    
    if (deviceId) {
      queryText += ' WHERE tn.local_device_id = $1';
      params.push(deviceId);
    }
    
    queryText += ' ORDER BY tn.last_updated DESC';
    
    const neighbors = await query(queryText, params);
    res.json(neighbors);
    
  } catch (error) {
    console.error('Error fetching neighbors:', error);
    res.status(500).json({ error: 'Failed to fetch topology neighbors' });
  }
});

// Get all topology links
router.get('/links', async (req: Request, res: Response) => {
  try {
    const links = await query(`
      SELECT tl.*,
             src.name as source_device_name,
             tgt.name as target_device_name
      FROM topology_links tl
      LEFT JOIN network_devices src ON tl.source_device_id = src.id
      LEFT JOIN network_devices tgt ON tl.target_device_id = tgt.id
      ORDER BY tl.created_at DESC
    `);
    
    res.json(links);
  } catch (error) {
    console.error('Error fetching links:', error);
    res.status(500).json({ error: 'Failed to fetch topology links' });
  }
});

// Create manual link
router.post('/links', async (req: Request, res: Response) => {
  try {
    const {
      source_device_id,
      target_device_id,
      source_interface,
      target_interface,
      link_type = 'physical',
      bandwidth_mbps,
    } = req.body;

    if (!source_device_id || !target_device_id) {
      return res.status(400).json({ 
        error: 'source_device_id and target_device_id are required' 
      });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const result = await query(
      `INSERT INTO topology_links 
        (id, source_device_id, target_device_id, source_interface, 
         target_interface, link_type, bandwidth_mbps, status, 
         metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'up', $8, $9, $9)
       RETURNING *`,
      [
        id, source_device_id, target_device_id, source_interface,
        target_interface, link_type, bandwidth_mbps,
        JSON.stringify({}), now
      ]
    );

    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error creating link:', error);
    res.status(500).json({ error: 'Failed to create link' });
  }
});

// Delete link
router.delete('/links/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM topology_links WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    res.json({ message: 'Link deleted successfully', id: req.params.id });
  } catch (error) {
    console.error('Error deleting link:', error);
    res.status(500).json({ error: 'Failed to delete link' });
  }
});

// Get topology data (combined for visualization)
router.get('/data', async (req: Request, res: Response) => {
  try {
    // Get all devices as nodes
    const devices = await query(`
      SELECT id, name, hostname, ip_address, vendor, model, 
             status, location, description
      FROM network_devices
    `);

    // Get all links as edges
    const links = await query(`
      SELECT id, source_device_id, target_device_id, 
             source_interface, target_interface, 
             link_type, bandwidth_mbps, status
      FROM topology_links
    `);

    // Also generate links from neighbors
    const neighbors = await query(`
      SELECT DISTINCT ON (local_device_id, remote_device_name)
             local_device_id, local_interface, 
             remote_device_id, remote_device_name, remote_interface
      FROM topology_neighbors
      WHERE remote_device_id IS NOT NULL
    `);

    // Transform to graph format
    const nodes = devices.map((device: any) => ({
      id: device.id,
      label: device.name,
      device: device,
    }));

    const edges = links.map((link: any) => ({
      id: link.id,
      source: link.source_device_id,
      target: link.target_device_id,
      sourceInterface: link.source_interface,
      targetInterface: link.target_interface,
      bandwidth: link.bandwidth_mbps,
      status: link.status,
      type: 'link',
    }));

    // Add neighbor-based edges (if not already in links)
    const existingEdges = new Set(
      edges.map((e: any) => `${e.source}-${e.target}`)
    );
    
    for (const neighbor of neighbors) {
      const key1 = `${neighbor.local_device_id}-${neighbor.remote_device_id}`;
      const key2 = `${neighbor.remote_device_id}-${neighbor.local_device_id}`;
      
      if (!existingEdges.has(key1) && !existingEdges.has(key2)) {
        edges.push({
          id: `neighbor-${neighbor.local_device_id}-${neighbor.remote_device_id}`,
          source: neighbor.local_device_id,
          target: neighbor.remote_device_id,
          sourceInterface: neighbor.local_interface,
          targetInterface: neighbor.remote_interface,
          status: 'discovered',
          type: 'neighbor',
        });
        existingEdges.add(key1);
      }
    }

    res.json({
      nodes,
      edges,
      metadata: {
        generatedAt: new Date().toISOString(),
        deviceCount: nodes.length,
        linkCount: edges.length,
      },
    });

  } catch (error) {
    console.error('Error fetching topology data:', error);
    res.status(500).json({ error: 'Failed to fetch topology data' });
  }
});

// Get topology snapshots
router.get('/snapshots', async (req: Request, res: Response) => {
  try {
    const snapshots = await query(
      'SELECT id, name, description, created_at FROM topology_snapshots ORDER BY created_at DESC'
    );
    res.json(snapshots);
  } catch (error) {
    console.error('Error fetching snapshots:', error);
    res.status(500).json({ error: 'Failed to fetch snapshots' });
  }
});

// Save topology snapshot
router.post('/snapshots', async (req: Request, res: Response) => {
  try {
    const { name, description, topology_data, drawio_xml } = req.body;

    if (!name || !topology_data) {
      return res.status(400).json({ error: 'name and topology_data are required' });
    }

    const id = uuidv4();
    const result = await query(
      `INSERT INTO topology_snapshots 
        (id, name, description, topology_data, drawio_xml, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        id, name, description || null,
        JSON.stringify(topology_data), drawio_xml || null,
        new Date().toISOString()
      ]
    );

    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error saving snapshot:', error);
    res.status(500).json({ error: 'Failed to save snapshot' });
  }
});

// Get single snapshot
router.get('/snapshots/:id', async (req: Request, res: Response) => {
  try {
    const snapshot = await queryOne(
      'SELECT * FROM topology_snapshots WHERE id = $1',
      [req.params.id]
    );

    if (!snapshot) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    res.json(snapshot);
  } catch (error) {
    console.error('Error fetching snapshot:', error);
    res.status(500).json({ error: 'Failed to fetch snapshot' });
  }
});

// Delete snapshot
router.delete('/snapshots/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM topology_snapshots WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.length === 0) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    res.json({ message: 'Snapshot deleted successfully' });
  } catch (error) {
    console.error('Error deleting snapshot:', error);
    res.status(500).json({ error: 'Failed to delete snapshot' });
  }
});

// Auto-create links from neighbors
router.post('/auto-links', async (req: Request, res: Response) => {
  try {
    // Find neighbors that have matching remote_device_id
    const neighbors = await query(`
      SELECT DISTINCT ON (
        LEAST(local_device_id::text, remote_device_id::text),
        GREATEST(local_device_id::text, remote_device_id::text)
      )
        local_device_id, local_interface, 
        remote_device_id, remote_interface
      FROM topology_neighbors
      WHERE remote_device_id IS NOT NULL
    `);

    let created = 0;
    let skipped = 0;

    for (const neighbor of neighbors) {
      // Check if link already exists
      const existing = await query(
        `SELECT id FROM topology_links 
         WHERE (source_device_id = $1 AND target_device_id = $2)
            OR (source_device_id = $2 AND target_device_id = $1)`,
        [neighbor.local_device_id, neighbor.remote_device_id]
      );

      if (existing.length === 0) {
        await query(
          `INSERT INTO topology_links 
            (id, source_device_id, target_device_id, source_interface, 
             target_interface, link_type, status, metadata, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'discovered', 'up', $6, $7, $7)`,
          [
            uuidv4(),
            neighbor.local_device_id,
            neighbor.remote_device_id,
            neighbor.local_interface,
            neighbor.remote_interface,
            JSON.stringify({ auto_created: true }),
            new Date().toISOString(),
          ]
        );
        created++;
      } else {
        skipped++;
      }
    }

    res.json({
      message: `Auto-link creation complete: ${created} created, ${skipped} already existed`,
      created,
      skipped,
    });

  } catch (error) {
    console.error('Error auto-creating links:', error);
    res.status(500).json({ error: 'Failed to auto-create links' });
  }
});

export default router;
