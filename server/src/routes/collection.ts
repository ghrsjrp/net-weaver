import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../config/database';
import SSHService from '../services/ssh.service';
import { getVendorParser } from '../parsers';
import {
  NetworkDevice,
  CollectionResult,
  CollectionHistory,
  ParsedLLDPNeighbor,
  ParsedOSPFNeighbor,
  ParsedInterface,
  ParsedSystemInfo,
} from '../types';

const router = Router();

// Collect data from a single device
router.post('/:deviceId', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const { collectionTypes = ['lldp', 'ospf', 'interfaces', 'system'] } = req.body;

  console.log(`Starting collection for device ${deviceId}`, collectionTypes);

  // Create collection history record
  const historyId = uuidv4();
  const startedAt = new Date().toISOString();

  try {
    // Fetch device details
    const device = await queryOne<NetworkDevice>(
      'SELECT * FROM network_devices WHERE id = $1',
      [deviceId]
    );

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Insert pending collection record
    await query(
      `INSERT INTO collection_history 
        (id, device_id, collection_type, status, started_at, created_at)
       VALUES ($1, $2, $3, 'running', $4, $4)`,
      [historyId, deviceId, collectionTypes.join(','), startedAt]
    );

    // Get vendor parser
    const parser = getVendorParser(device.vendor);
    
    // Initialize SSH connection
    const ssh = new SSHService();
    
    let rawOutput = '';
    const result: CollectionResult = {
      success: false,
      deviceId,
      collectedAt: startedAt,
    };

    try {
      // Connect to device
      await ssh.connect({
        host: String(device.ip_address),
        port: device.ssh_port || 22,
        username: device.ssh_username || 'admin',
        password: device.ssh_password_encrypted || '',
      });

      // Execute commands based on collection types
      if (collectionTypes.includes('lldp')) {
        const lldpResult = await ssh.executeCommand(parser.commands.getLLDPNeighbors);
        rawOutput += `\n=== LLDP NEIGHBORS ===\n${lldpResult.output}\n`;
        if (lldpResult.success) {
          result.lldpNeighbors = parser.parseLLDPNeighbors(lldpResult.output);
        }
      }

      if (collectionTypes.includes('ospf')) {
        const ospfResult = await ssh.executeCommand(parser.commands.getOSPFNeighbors);
        rawOutput += `\n=== OSPF NEIGHBORS ===\n${ospfResult.output}\n`;
        if (ospfResult.success) {
          result.ospfNeighbors = parser.parseOSPFNeighbors(ospfResult.output);
        }
      }

      if (collectionTypes.includes('interfaces')) {
        const intfResult = await ssh.executeCommand(parser.commands.getInterfaces);
        rawOutput += `\n=== INTERFACES ===\n${intfResult.output}\n`;
        if (intfResult.success) {
          result.interfaces = parser.parseInterfaces(intfResult.output);
        }
      }

      if (collectionTypes.includes('system')) {
        const sysResult = await ssh.executeCommand(parser.commands.getSystemInfo);
        rawOutput += `\n=== SYSTEM INFO ===\n${sysResult.output}\n`;
        if (sysResult.success) {
          result.systemInfo = parser.parseSystemInfo(sysResult.output);
        }
      }

      result.success = true;
      result.rawOutput = rawOutput;

      // Disconnect SSH
      ssh.disconnect();

      // Save neighbors to topology_neighbors table
      if (result.lldpNeighbors && result.lldpNeighbors.length > 0) {
        for (const neighbor of result.lldpNeighbors) {
          await query(
            `INSERT INTO topology_neighbors 
              (id, local_device_id, local_interface, remote_device_name, 
               remote_interface, remote_ip, discovery_protocol, raw_data, 
               discovered_at, last_updated)
             VALUES ($1, $2, $3, $4, $5, $6, 'lldp', $7, $8, $8)
             ON CONFLICT (local_device_id, local_interface, discovery_protocol) 
             DO UPDATE SET 
               remote_device_name = EXCLUDED.remote_device_name,
               remote_interface = EXCLUDED.remote_interface,
               remote_ip = EXCLUDED.remote_ip,
               raw_data = EXCLUDED.raw_data,
               last_updated = EXCLUDED.last_updated`,
            [
              uuidv4(),
              deviceId,
              neighbor.localInterface,
              neighbor.remoteDeviceName,
              neighbor.remoteInterface,
              neighbor.remoteIP || null,
              JSON.stringify(neighbor.rawData),
              new Date().toISOString(),
            ]
          );
        }
      }

      // Save OSPF neighbors
      if (result.ospfNeighbors && result.ospfNeighbors.length > 0) {
        for (const neighbor of result.ospfNeighbors) {
          await query(
            `INSERT INTO topology_neighbors 
              (id, local_device_id, local_interface, remote_device_name, 
               remote_interface, remote_ip, discovery_protocol, raw_data, 
               discovered_at, last_updated)
             VALUES ($1, $2, $3, $4, $5, $6, 'ospf', $7, $8, $8)
             ON CONFLICT (local_device_id, local_interface, discovery_protocol) 
             DO UPDATE SET 
               remote_device_name = EXCLUDED.remote_device_name,
               remote_interface = EXCLUDED.remote_interface,
               remote_ip = EXCLUDED.remote_ip,
               raw_data = EXCLUDED.raw_data,
               last_updated = EXCLUDED.last_updated`,
            [
              uuidv4(),
              deviceId,
              neighbor.interface,
              neighbor.neighborId,
              '',
              neighbor.neighborIP,
              JSON.stringify(neighbor.rawData),
              new Date().toISOString(),
            ]
          );
        }
      }

      // Update device interfaces
      if (result.interfaces && result.interfaces.length > 0) {
        for (const iface of result.interfaces) {
          await query(
            `INSERT INTO device_interfaces 
              (id, device_id, name, description, mac_address, speed_mbps, 
               admin_status, oper_status, vlan_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
             ON CONFLICT (device_id, name) 
             DO UPDATE SET 
               description = EXCLUDED.description,
               speed_mbps = EXCLUDED.speed_mbps,
               admin_status = EXCLUDED.admin_status,
               oper_status = EXCLUDED.oper_status,
               vlan_id = EXCLUDED.vlan_id,
               updated_at = EXCLUDED.updated_at`,
            [
              uuidv4(),
              deviceId,
              iface.name,
              iface.description || null,
              iface.macAddress || null,
              iface.speedMbps || null,
              iface.adminStatus,
              iface.operStatus,
              iface.vlanId || null,
              new Date().toISOString(),
            ]
          );
        }
      }

      // Update device with system info
      if (result.systemInfo) {
        await query(
          `UPDATE network_devices 
           SET model = COALESCE($1, model),
               serial_number = COALESCE($2, serial_number),
               os_version = COALESCE($3, os_version),
               status = 'online',
               last_seen = $4,
               updated_at = $4
           WHERE id = $5`,
          [
            result.systemInfo.model,
            result.systemInfo.serialNumber,
            result.systemInfo.osVersion,
            new Date().toISOString(),
            deviceId,
          ]
        );
      } else {
        // Just update status and last_seen
        await query(
          `UPDATE network_devices 
           SET status = 'online', last_seen = $1, updated_at = $1
           WHERE id = $2`,
          [new Date().toISOString(), deviceId]
        );
      }

      // Update collection history to completed
      await query(
        `UPDATE collection_history 
         SET status = 'completed', 
             completed_at = $1,
             raw_output = $2,
             parsed_data = $3
         WHERE id = $4`,
        [
          new Date().toISOString(),
          rawOutput,
          JSON.stringify({
            lldpNeighbors: result.lldpNeighbors,
            ospfNeighbors: result.ospfNeighbors,
            interfaces: result.interfaces,
            systemInfo: result.systemInfo,
          }),
          historyId,
        ]
      );

      res.json(result);

    } catch (sshError: any) {
      ssh.disconnect();

      result.success = false;
      result.error = sshError.message;

      // Update collection history to failed
      await query(
        `UPDATE collection_history 
         SET status = 'failed', 
             completed_at = $1,
             error_message = $2
         WHERE id = $3`,
        [new Date().toISOString(), sshError.message, historyId]
      );

      // Update device status to error
      await query(
        `UPDATE network_devices 
         SET status = 'error', updated_at = $1
         WHERE id = $2`,
        [new Date().toISOString(), deviceId]
      );

      res.status(500).json(result);
    }

  } catch (error: any) {
    console.error('Collection error:', error);

    // Update collection history to failed
    await query(
      `UPDATE collection_history 
       SET status = 'failed', 
           completed_at = $1,
           error_message = $2
       WHERE id = $3`,
      [new Date().toISOString(), error.message, historyId]
    ).catch(console.error);

    res.status(500).json({
      success: false,
      deviceId,
      error: error.message,
      collectedAt: startedAt,
    });
  }
});

// Collect from all devices
router.post('/', async (req: Request, res: Response) => {
  const { collectionTypes = ['lldp', 'ospf', 'interfaces', 'system'] } = req.body;

  try {
    const devices = await query<NetworkDevice>('SELECT id FROM network_devices');
    
    const results: CollectionResult[] = [];
    
    for (const device of devices) {
      try {
        // Make internal request to single device collection
        // In production, you might want to use a queue system
        const response = await fetch(
          `http://localhost:${process.env.PORT || 3001}/api/collect/${device.id}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ collectionTypes }),
          }
        );
        
        const result = await response.json();
        results.push(result);
      } catch (error: any) {
        results.push({
          success: false,
          deviceId: device.id,
          error: error.message,
          collectedAt: new Date().toISOString(),
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      message: `Collection completed: ${successful} successful, ${failed} failed`,
      results,
    });

  } catch (error: any) {
    console.error('Collect all error:', error);
    res.status(500).json({ error: 'Failed to start collection' });
  }
});

// Get collection history
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { deviceId, limit = 50 } = req.query;
    
    let queryText = `
      SELECT ch.*, nd.name as device_name 
      FROM collection_history ch
      LEFT JOIN network_devices nd ON ch.device_id = nd.id
    `;
    const params: any[] = [];
    
    if (deviceId) {
      queryText += ' WHERE ch.device_id = $1';
      params.push(deviceId);
    }
    
    queryText += ` ORDER BY ch.started_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const history = await query(queryText, params);
    res.json(history);
    
  } catch (error) {
    console.error('Error fetching collection history:', error);
    res.status(500).json({ error: 'Failed to fetch collection history' });
  }
});

// Test SSH connection
router.post('/test/:deviceId', async (req: Request, res: Response) => {
  const { deviceId } = req.params;

  try {
    const device = await queryOne<NetworkDevice>(
      'SELECT * FROM network_devices WHERE id = $1',
      [deviceId]
    );

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const ssh = new SSHService();
    const parser = getVendorParser(device.vendor);

    try {
      await ssh.connect({
        host: String(device.ip_address),
        port: device.ssh_port || 22,
        username: device.ssh_username || 'admin',
        password: device.ssh_password_encrypted || '',
      });

      const result = await ssh.executeCommand(parser.commands.testConnection);
      ssh.disconnect();

      // Update device status to online
      await query(
        `UPDATE network_devices 
         SET status = 'online', last_seen = $1, updated_at = $1
         WHERE id = $2`,
        [new Date().toISOString(), deviceId]
      );

      res.json({
        success: true,
        message: 'SSH connection successful',
        output: result.output,
      });

    } catch (sshError: any) {
      ssh.disconnect();

      // Update device status to error
      await query(
        `UPDATE network_devices 
         SET status = 'error', updated_at = $1
         WHERE id = $2`,
        [new Date().toISOString(), deviceId]
      );

      res.status(500).json({
        success: false,
        message: 'SSH connection failed',
        error: sshError.message,
      });
    }

  } catch (error: any) {
    console.error('Test connection error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
