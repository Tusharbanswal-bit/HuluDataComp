// DB/MongoDB/index.js - MongoDB Database Adapter
import mongoose from 'mongoose';
import logger from '../../utils/logger.js';
import config from '../../config.js';

class MongoDBAdapter {
  constructor() {
    this.connection = null;
  }

  /**
   * Initialize MongoDB database connection
   */
  async init() {
    try {
      logger.info(`Connecting to MongoDB: ${config.dbConfig.uri}`);
      
      await mongoose.connect(config.dbConfig.uri, { 
        useNewUrlParser: true, 
        useUnifiedTopology: true 
      });
      
      this.connection = mongoose.connection;
      logger.info('MongoDB connected successfully');
      return { success: true };
    } catch (err) {
      logger.error({ err }, `Error connecting to MongoDB: ${err.message}`);
      throw err;
    }
  }

  /**
   * Insert data into MongoDB collection
   */
  async insertIntoCollection(collectionName, data) {
    try {
      // Create a dynamic schema (allowing any field, no strict schema)
      const schema = new mongoose.Schema({}, { strict: false });
      const Model = mongoose.models[collectionName] || mongoose.model(collectionName, schema, collectionName);

      // Prepare bulk operations
      const bulkOps = data.map(doc => ({
        insertOne: {
          document: doc
        }
      }));

      // Perform bulk insert
      const result = await Model.bulkWrite(bulkOps);
      logger.info(`Inserted ${result.insertedCount} documents into collection "${collectionName}".`);
      
      return { success: true, insertedCount: result.insertedCount };
    } catch (err) {
      logger.error({ err }, `Error inserting data into MongoDB collection ${collectionName}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Truncate MongoDB collection
   */
  async truncateCollection(collectionName) {
    try {
      const schema = new mongoose.Schema({}, { strict: false });
      const Model = mongoose.models[collectionName] || mongoose.model(collectionName, schema, collectionName);
      
      await Model.deleteMany({});
      logger.info(`Collection "${collectionName}" truncated successfully`);
      
      return { success: true };
    } catch (err) {
      logger.error({ err }, `Error truncating MongoDB collection ${collectionName}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Find documents in MongoDB collection
   */
  async findInCollection(collectionName, query = {}) {
    try {
      const schema = new mongoose.Schema({}, { strict: false });
      const Model = mongoose.models[collectionName] || mongoose.model(collectionName, schema, collectionName);
      
      const documents = await Model.find(query);
      logger.info(`Found ${documents.length} documents in collection "${collectionName}"`);
      
      return { success: true, data: documents };
    } catch (err) {
      logger.error({ err }, `Error finding documents in MongoDB collection ${collectionName}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Close MongoDB database connection
   */
  async close() {
    try {
      if (this.connection) {
        await mongoose.connection.close();
        this.connection = null;
      }
      logger.info('MongoDB connection closed');
    } catch (err) {
      logger.error({ err }, `Error closing MongoDB connection: ${err.message}`);
    }
  }
}

export default MongoDBAdapter;
