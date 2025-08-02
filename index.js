import DataComparer from './dataComparer.js'; 
import logger from './utils/logger.js'; 
import config from './config.js';

const main = async () => {
  try {
    logger.info('Starting Excel data extraction and comparison process...');
    const dataComparer = new DataComparer();
    const dataSheetsDirectory = config.dataSheetsDirectory || 'DataSheets';

    for (const collectionConfig of config.collectionConfig) {
      const { collectionName } = collectionConfig;
      logger.info(`Processing collection: ${collectionName}`);
      const result = await dataComparer.generateReport(collectionConfig, dataSheetsDirectory);
      
      if (!result.success) {
        logger.error({ error: result.error }, `Failed to process collection ${collectionName}: ${result.error}`);
        continue; // Skip this collection and continue with the next one
      }

      logger.info(`Successfully processed collection ${collectionName}. Report generated.`);
    }
    
    logger.info('Excel data extraction and comparison process completed successfully.');
    process.exit(0); // Exit the process after completion
  } catch (err) {
    logger.error({ err }, `An error occurred while processing the Excel files: ${err.message}`);
  }
};

main();
