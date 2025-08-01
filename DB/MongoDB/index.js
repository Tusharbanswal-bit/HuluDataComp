import mongoose from 'mongoose';
import logger from '../../utils/logger.js';
import config from '../../config.js';
import dBHelper from './dBHelper/index.js';

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
     * Fetch all records from a collection
     */
    async fetchRecords(collectionName) {
        try {
            const schema = new mongoose.Schema({}, { strict: false });
            const Model = mongoose.models[collectionName] || mongoose.model(collectionName, schema, collectionName);
            const helperFunc = dBHelper[collectionName] || Model.find;
            const documents = await helperFunc.call(Model);
            return { success: true, data: documents, count: documents.length };
        } catch (err) {
            logger.error({ err }, `Error fetching records from MongoDB collection ${collectionName}: ${err.message}`);
            return { success: false, error: err.message, data: [] };
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
