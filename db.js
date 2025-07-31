// db.js
const mongoose = require('mongoose');
const logger = require('./logger');
const { mongoDBConfig } = require('./config.json');  // MongoDB connection details

// Function to connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(mongoDBConfig.uri, { useNewUrlParser: true, useUnifiedTopology: true });
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);  // Exit if connection fails
  }
};

// Function to get the schema of the original collection
const getCollectionSchema = async (collectionName) => {
  try {
    const collection = mongoose.connection.db.collection(collectionName);
    // Get the schema of the original collection (or use predefined schema if needed)
    const schema = await collection.findOne();
    return schema;
  } catch (error) {
    logger.error(`Error fetching schema for collection ${collectionName}: ${error.message}`);
    return null;
  }
};

// Function to create a Mongoose model for the temporary collection using the original collection's schema
const createTempModel = (collectionName, originalSchema) => {
  // We can use the same schema for the temporary collection, or you could modify it as needed
  const tempCollectionName = `${collectionName}_temp`;  // Temporary collection name
  const tempSchema = new mongoose.Schema(originalSchema);
  const tempModel = mongoose.model(tempCollectionName, tempSchema);

  return tempModel;
};

// Function to insert data into the temporary collection
const insertIntoTempCollection = async (collectionName, data) => {
  try {
    const schema = await getCollectionSchema(collectionName);
    if (schema) {
      const tempModel = createTempModel(collectionName, schema);
      const result = await tempModel.insertMany(data);
      logger.info(`Inserted ${result.insertedCount} documents into temporary collection ${collectionName}_temp.`);
    }
  } catch (error) {
    logger.error(`Error inserting data into temp collection: ${error.message}`);
  }
};

module.exports = { connectDB, insertIntoTempCollection };
