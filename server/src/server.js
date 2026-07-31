'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');
const { connectDB, disconnectDB } = require('./config/db');
const { verifyTransport } = require('./services/email.service');
const { ensureDefaultStages } = require('./services/stage.service');
const { startScheduler, stopScheduler } = require('./jobs/reminderScheduler');
const { startMailSync, stopMailSync } = require('./jobs/mailSyncScheduler');

const server = http.createServer(app);

async function start() {
  await connectDB();
  await ensureDefaultStages(); // first boot only; never touches an existing board
  await verifyTransport(); // logs a warning but never blocks startup
  startScheduler();
  await startMailSync();

  server.listen(config.PORT, () => {
    logger.info(`CRM API listening on port ${config.PORT} (${config.NODE_ENV})`);
    logger.info(`Allowed client origins: ${config.clientOrigins.join(', ') || '(none)'}`);
  });
}

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received — shutting down gracefully`);

  stopScheduler();
  stopMailSync();
  server.close(async () => {
    try {
      await disconnectDB();
    } catch (err) {
      logger.error('Error closing DB connection:', err.message);
    }
    process.exit(0);
  });

  // Do not hang forever on lingering keep-alive connections.
  setTimeout(() => process.exit(1), 10_000).unref();
}

['SIGTERM', 'SIGINT'].forEach((sig) => process.on(sig, () => shutdown(sig)));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason instanceof Error ? reason.stack : reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err.stack || err.message);
  shutdown('uncaughtException');
});

start().catch((err) => {
  logger.error('Failed to start server:', err.stack || err.message);
  process.exit(1);
});
