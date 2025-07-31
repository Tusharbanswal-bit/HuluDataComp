// index.js
const readExcelFile = require('./excelReader');
const config = require('./config.json');  // Directly read from config.json

(async () => {
  try {
    // Read the Excel file and extract data from columns A to G
    const excelData = await readExcelFile(config.excelConfig.excelFilePath);

    // Perform the comparison after reading the Excel data
    // const comparisonResult = await compareData(excelData);

    // // Log the comparison result (missing, updated, duplicate records)
    // console.log('Comparison Result:', comparisonResult);
  } catch (error) {
    console.error('An error occurred:', error.message);
  }
})();
