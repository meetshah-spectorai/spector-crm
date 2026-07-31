'use strict';

const mongoose = require('mongoose');
const config = require('./env');
const logger = require('../utils/logger');

mongoose.set('strictQuery', true);

async function connectDB() {
  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB error', err.message));

  await mongoose.connect(config.MONGO_URI, {
    serverSelectionTimeoutMS: 15000,
    autoIndex: !config.isProd, // build indexes in dev; use a migration in prod
  });

  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.connection.close();
}

module.exports = { connectDB, disconnectDB };
