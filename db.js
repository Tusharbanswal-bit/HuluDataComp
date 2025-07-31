// db.js
import mongoose from 'mongoose';
import logger from './logger.js';  // Import logger for logging
import config from './config.js';  // Use require for JSON import
const mongoDBConfig = config.mongoDBConfig;

// Function to connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(mongoDBConfig.uri, { useNewUrlParser: true, useUnifiedTopology: true });
    logger.info('MongoDB connected successfully');
  } catch (err) {
    logger.error({ err }, `Error connecting to MongoDB`);
    process.exit(1);  // Exit if connection fails
  }
};

async function init() {
  await connectDB();
}

const insertIntoTempCollection = async (collectionName, data) => {
  const tempCollectionName = `${collectionName}.temp.camp`;
  try {
    // Create a dynamic schema (allowing any field, no strict schema)
    const schema = new mongoose.Schema({}, { strict: false });
    const tempModel = mongoose.model(tempCollectionName, schema, tempCollectionName);

    // Truncate the collection by deleting all existing documents
    await tempModel.deleteMany({});

    // Prepare bulk operations
    const bulkOps = data.map(doc => ({
      insertOne: {
        document: doc
      }
    }));

    // Perform bulk insert
    const result = await tempModel.bulkWrite(bulkOps);
    logger.info(`Inserted ${result.insertedCount} documents into temporary collection "${tempCollectionName}".`);
  } catch (err) {
    logger.error({ err }, `Error inserting data into temp collection ${tempCollectionName}`);
  }
};


export default {
  init,
  insertIntoTempCollection,
  connectDB
};

