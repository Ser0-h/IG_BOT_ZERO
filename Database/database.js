const mongoose = require('mongoose');
const logger = require('../utils/logger');

let isConnected = false;

async function connect() {
  if (isConnected) return mongoose.connection;

  mongoose.set('strictQuery', true);

  await mongoose.connect(process.env.DATABASE_URL, {
    serverSelectionTimeoutMS: 8000,
  });

  isConnected = true;

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('⚠️  Database disconnected.');
  });
  mongoose.connection.on('error', (err) => {
    logger.error('Database error:', err.message);
  });

  return mongoose.connection;
}

async function disconnect() {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
}

module.exports = { connect, disconnect };
