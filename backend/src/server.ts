import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { config, ensureLocalDirectoriesExist } from './config/env.js';
import { getDb, closeDb } from './database/connection/db.js';
import { runMigrations } from './database/migrations/migrator.js';
import { runSeeds } from './database/seeds/seeder.js';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

export async function bootstrapApp(): Promise<express.Application> {
  ensureLocalDirectoriesExist();
  console.log(`[Jewel Suite] Initializing backend in ${config.env} mode...`);
  console.log(`[Jewel Suite] Database path: ${config.dbPath}`);

  // 1. Initialize DB and run migrations
  const db = getDb();
  const migrationResult = runMigrations(db);
  if (migrationResult.appliedCount > 0) {
    console.log(`[Jewel Suite] Applied ${migrationResult.appliedCount} migration(s).`);
  } else {
    console.log(`[Jewel Suite] Schema is up to date.`);
  }

  // 2. Run seeders
  await runSeeds();

  // 3. Setup Express
  const app = express();

  app.use(cors({
    origin: true,
    credentials: true,
  }));

  app.use(express.json());

  // Request logging
  app.use((req, _res, next) => {
    if (config.isDev) {
      console.log(`[HTTP] ${req.method} ${req.url}`);
    }
    next();
  });

  // Health check endpoint for Render / cloud monitoring
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'jewel-suite-backend',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  });

  // Mount API Router
  app.use('/api', apiRouter);

  // Serve Frontend static assets if available (Unified full-stack hosting on Render)
  const candidateFrontendDirs = [
    path.resolve(process.cwd(), '../frontend/dist'),
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(process.cwd(), 'dist/public'),
  ];

  let frontendDist: string | null = null;
  for (const candidate of candidateFrontendDirs) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      frontendDist = candidate;
      break;
    }
  }

  if (frontendDist) {
    console.log(`[Jewel Suite] Serving frontend static assets from: ${frontendDist}`);
    app.use(express.static(frontendDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/health') {
        return next();
      }
      res.sendFile(path.join(frontendDist!, 'index.html'));
    });
  }

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

// Start server if executed directly
if (process.env.NODE_ENV !== 'test') {
  bootstrapApp()
    .then((app) => {
      const server = app.listen(config.port, config.host, () => {
        console.log(`=======================================================`);
        console.log(`   💎 Jewel Suite Server running at http://${config.host}:${config.port}`);
        console.log(`   💎 Offline ERP/POS Ready`);
        console.log(`=======================================================`);
      });

      const handleShutdown = (signal: string) => {
        console.log(`\n[Jewel Suite] Received ${signal}. Shutting down gracefully...`);
        server.close(() => {
          closeDb();
          console.log(`[Jewel Suite] Closed database and HTTP server. Exiting.`);
          process.exit(0);
        });
      };

      process.on('SIGINT', () => handleShutdown('SIGINT'));
      process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    })
    .catch((err) => {
      console.error('[Jewel Suite Fatal Error on Startup]', err);
      process.exit(1);
    });
}
