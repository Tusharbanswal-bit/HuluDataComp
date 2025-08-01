// DB/index.js - Database Adapter
import SQLAdapter from './SQL/index.js';
import MongoDBAdapter from './MongoDB/index.js';
import logger from '../utils/logger.js';
import config from '../config.js';

class DatabaseAdapter {
    constructor() {
        this.activeAdapter = null;
    }

    /**
     * Initialize the appropriate database adapter based on configuration
     */
    async init() {
        try {
            const Adapter = config.dbConfig.sql ? SQLAdapter : MongoDBAdapter;
            this.activeAdapter = new Adapter();
            await this.activeAdapter.init();
            return { success: true };
        } catch (err) {
            logger.error({ err }, `Error initializing database adapter: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    /**
     * Get the active database adapter
     */
    getAdapter() {
        return this.activeAdapter;
    }

    /**
     * Close database connections
     */
    async close() {
        try {
            if (this.activeAdapter && this.activeAdapter.close) {
                await this.activeAdapter.close();
            }
            logger.info('Database adapter closed successfully');
        } catch (err) {
            logger.error({ err }, `Error closing database adapter: ${err.message}`);
        }
    }
}

export default DatabaseAdapter;
