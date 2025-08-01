import { parseFile } from './excelReader.js'; 
import logger from './logger.js'; 
import config from './config.js';

logger.init();
const main = async () => {
  try {
    logger.info('Starting Excel data extraction process...');
    const dataSheetsDirectory = config.dataSheetsDirectory || 'DataSheets';

    for (const collectionConfig of config.collectionConfig) {
      const { collectionName } = collectionConfig;
      logger.info(`Processing collection: ${collectionName}`);
      const result = await parseFile(collectionConfig, dataSheetsDirectory);
      
      if (!result.success) {
        logger.error({ err: result.error }, `Failed to process collection ${collectionName}: ${result.error}`);
        continue; // Skip this collection and continue with the next one
      }

      logger.info(`Successfully processed collection ${collectionName} with ${result.data.length} unique records and ${result.duplicates?.length || 0} duplicate records. Output saved to: ${result.filePath}`);
    }
    
    logger.info('Excel data extraction process completed successfully.');
  } catch (err) {
    logger.error({ err }, `An error occurred while processing the Excel files: ${err.message}`);
  }
};

main();
