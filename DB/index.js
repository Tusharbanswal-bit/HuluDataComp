// DB/index.js - Database Adapter
import SQLAdapter from './SQL/index.js';
import MongoDBAdapter from './MongoDB/index.js';
import logger from '../utils/logger.js';
import config from '../config.js';

class DatabaseAdapter {
  constructor() {
    this.sqlAdapter = null;
    this.mongoAdapter = null;
    this.activeAdapter = null;
  }

  /**
   * Initialize the appropriate database adapter based on configuration
   */
  async init() {
    try {
      if (config.dbConfig.sql) {
        logger.info('Initializing SQL Database Adapter');
        this.sqlAdapter = new SQLAdapter();
        await this.sqlAdapter.init();
        this.activeAdapter = this.sqlAdapter;
      } else {
        logger.info('Initializing MongoDB Database Adapter');
        this.mongoAdapter = new MongoDBAdapter();
        await this.mongoAdapter.init();
        this.activeAdapter = this.mongoAdapter;
      }
      
      logger.info('Database adapter initialized successfully');
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
