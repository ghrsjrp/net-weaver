import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/database';
import { validateSchema } from './config/schema';
import devicesRouter from './routes/devices';
import collectionRouter from './routes/collection';
import topologyRouter from './routes/topology';
import settingsRouter from './routes/settings';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check (used by Docker healthcheck and frontend self-hosted detection)
const getHealthPayload = () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: '1.0.0',
});

app.get(['/health', '/api/health'], (req, res) => {
  res.json(getHealthPayload());
});

// API Routes
app.use('/api/devices', devicesRouter);
app.use('/api/collect', collectionRouter);
app.use('/api/topology', topologyRouter);
app.use('/api/settings', settingsRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
async function start() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║           NetTopo Self-Hosted Backend Server              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Failed to connect to database. Exiting...');
    process.exit(1);
  }

  // Validate schema (fail fast with a clear error)
  try {
    await validateSchema();
    console.log('✓ Database schema validation successful');
  } catch (err: any) {
    console.error('✗ Database schema validation failed:', err?.message || err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log('');
    console.log('Available endpoints:');
    console.log('  GET    /health                   - Health check');
    console.log('  GET    /api/devices              - List all devices');
    console.log('  POST   /api/devices              - Create device');
    console.log('  GET    /api/devices/:id          - Get device by ID');
    console.log('  PUT    /api/devices/:id          - Update device');
    console.log('  DELETE /api/devices/:id          - Delete device');
    console.log('  POST   /api/collect/:deviceId    - Collect from device');
    console.log('  POST   /api/collect              - Collect from all devices');
    console.log('  GET    /api/collect/history      - Get collection history');
    console.log('  POST   /api/collect/test/:id     - Test SSH connection');
    console.log('  GET    /api/topology/data        - Get topology data');
    console.log('  GET    /api/topology/neighbors   - Get neighbors');
    console.log('  GET    /api/topology/links       - Get links');
    console.log('  POST   /api/topology/links       - Create manual link');
    console.log('  POST   /api/topology/auto-links  - Auto-create links');
    console.log('  GET    /api/topology/snapshots   - Get snapshots');
    console.log('  POST   /api/topology/snapshots   - Save snapshot');
    console.log('  GET    /api/settings             - Get all settings');
    console.log('  PUT    /api/settings/:key        - Update setting');
    console.log('');
  });
}

start();
