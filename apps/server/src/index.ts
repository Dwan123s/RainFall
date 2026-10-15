import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import { env } from './config/env';
import { logger } from './utils/logger';
import { testPrismaConnection } from './db/prisma';
import { seedInitialData } from './db/seed';
import { initSocketIO } from './socket/io';
import { initMqttClient } from './mqtt/client';
import { stationSimulator } from './mqtt/simulator';
import { apiRouter } from './routes/api';
import { alertService } from './services/alert.service';

const app = express();
const server = http.createServer(app);

// CORS configuration
const allowedOrigins = env.CORS_ORIGIN.split(',').map((s) => s.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, or same-origin)
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev mode
    },
    credentials: true
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    logger.debug({ method: req.method, url: req.url }, 'Incoming HTTP Request');
    next();
  });
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    service: 'RainSense Server',
    mode: env.DEMO_MODE ? 'DEMO' : 'LIVE',
    timestamp: new Date().toISOString()
  });
});

// Mount API routes
app.use('/api', apiRouter);

// Centralized error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err: err.message, stack: err.stack }, 'Unhandled error in API route');
  res.status(500).json({
    success: false,
    error: env.NODE_ENV === 'production' ? 'Đã xảy ra lỗi máy chủ nội bộ' : err.message
  });
});

// Start Server
async function startServer() {
  try {
    logger.info('Bootstrapping RainSense IoT Server...');

    // Initialize Socket.IO
    initSocketIO(server, env.CORS_ORIGIN);
    logger.info('Socket.IO real-time engine initialized.');

    // Database Connection and Seed
    await testPrismaConnection();
    await seedInitialData();

    // MQTT Client
    initMqttClient();

    // Start Simulator if in DEMO MODE
    if (env.DEMO_MODE) {
      stationSimulator.start(4000);
    }

    // Periodic Device Offline Checker (every 30 seconds)
    setInterval(async () => {
      try {
        await alertService.checkDeviceOffline(env.DEFAULT_STATION_ID);
      } catch (e) {
        // silent
      }
    }, 30000);

    server.listen(env.PORT, env.HOST, () => {
      logger.info(`RainSense Backend Server listening on http://${env.HOST}:${env.PORT}`);
      logger.info(`Operating Mode: [${env.DEMO_MODE ? 'DEMO MODE (Simulated Hardware)' : 'LIVE MODE (HiveMQ Cloud Ingestion)'}]`);
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to bootstrap RainSense Server');
    process.exit(1);
  }
}

startServer();
