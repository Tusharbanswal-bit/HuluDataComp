import readExcelFile from './excelReader.js';
import db from './db.js';
import logger from './logger.js';
import config from './config.js';

logger.init(); // Initialize the logger
const main = async () => {
  try {
    // Read the Excel file and store the extract data in the json file format
    const res = await readExcelFile(config.excelConfig.excelFilePath);

    if(!res.success) {
      logger.info(`Failed to read Excel file: ${res.error}`);
      return;
    }

    db.init();
    // Loop through each collection in the extracted data and insert it into the temp collection
    for (const collectionData of res.data) {
      const { collectionName, data } = collectionData;
      // Insert the extracted data into the temporary collection
      await db.insertIntoTempCollection(collectionName, data);
    }
  } catch (err) {
      logger.error({ err }, `An error occurred while processing the Excel file`);
  }
  return;
};

main();
