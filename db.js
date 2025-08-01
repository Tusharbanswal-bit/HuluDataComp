import mongoose from 'mongoose';
import logger from './logger.js';
import config from './config.js';
const dbConfig = config.dbConfig;

const connectDB = async () => {
  try {
    await mongoose.connect(dbConfig.uri, { useNewUrlParser: true, useUnifiedTopology: true });
    logger.info('MongoDB connected successfully');
  } catch (err) {
    logger.error({ err }, `Error connecting to MongoDB`);
  }
};

async function init() {
  await connectDB();
}

export default {
  init,
  connectDB
};

