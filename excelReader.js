// excelReader.js
const ExcelJS = require('exceljs');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');  // Directly read from config.json
const HEADER_ROW = 5; // Assuming the first row contains headers

// Function to read the Excel file and extract specified columns for each collection
const readExcelFile = async (filePath) => {
  const workbook = new ExcelJS.Workbook();
  let extractedData = [];

  try {
    // Read the Excel file
    await workbook.xlsx.readFile(filePath);

    // Get the sheet by its name from the config
    const sheetName = config.excelConfig.sheetName || 'Sheet1'; // Default to 'Sheet1' if not provided
    const sheet = workbook.getWorksheet(sheetName); // Retrieve the sheet by name

    // Check if the sheet exists
    if (!sheet) {
      throw new Error(`The specified sheet "${sheetName}" does not exist in the Excel file.`);
    }

    // Get headers from the row defined by HEADER_ROW (5 in this case)
    const headers = sheet.getRow(HEADER_ROW).values;
    const columnIndices = new Map();

    // Iterate through each collection in config.excelConfig.collectionData
    for (const collectionConfig of config.excelConfig.collectionData) {
      const { collectionName, collectionExtractConfig } = collectionConfig;
      const collectionData = [];

      // Create a map of the columns to extract for this collection, based on collectionExtractConfig
      for (const column of collectionExtractConfig) {
        const columnHeader = column.excelColumn; // The header name to look for
        const columnIndex = headers.findIndex(header => {
          const headerName = typeof header === "string" && header.trim().toLowerCase();
          return headerName === columnHeader.toLowerCase();
        });

        // If column is not found in the sheet, return error
        if (columnIndex === -1) {
          logger.info(`Invalid column: ${columnHeader}`);
          return { success: false, info: `InvalidExcelFormat`, data: { columnName: columnHeader } };
        }

        // Add column index to map
        columnIndices.set(columnHeader, columnIndex);
      }

      // Extract the data for this collection
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= HEADER_ROW) return;  // Skip header row

        const rowData = {};

        // Extract the data based on the collectionExtractConfig
        for (const column of collectionExtractConfig) {
          const columnHeader = column.excelColumn;
          const columnIndex = columnIndices.get(columnHeader);
          let columnValue = row.getCell(columnIndex).value;

          // Convert column value to string if necessary
          columnValue = columnValue ? columnValue.toString().trim() : '';

          // Use default value if the column is empty and a default is provided
          if (!columnValue && column.defaultValue !== undefined) {
            columnValue = column.defaultValue;
          }

          // Map the value to MongoDB field as per mapping
          rowData[column.mongoField] = columnValue;
        }

        // Add the row data to the collectionData array
        collectionData.push(rowData);
      });

      // Add the collection data to the main extracted data
      extractedData.push({
        collectionName,
        data: collectionData,
        recordCount: collectionData.length // Add the count of records for the collection
      });

      // Log the extracted data for this collection
      logger.info(`Extracted ${collectionData.length} records for collection "${collectionName}".`);
    }

    // Create the extracted folder if it doesn't exist
    const extractedFolder = path.join(__dirname, 'extracted');
    if (!fs.existsSync(extractedFolder)) {
      fs.mkdirSync(extractedFolder);
    }

    // Append the current timestamp to the filename
    const timestamp = new Date().toISOString().replace(/[-:.]/g, ''); // Remove special characters for filename
    const outputFilePath = path.join(extractedFolder, `extractedData_${timestamp}.json`);

    // Save extracted data to the file
    fs.writeFileSync(outputFilePath, JSON.stringify(extractedData, null, 2));
    logger.info(`Excel data extracted successfully and saved to ${outputFilePath}.`);

  } catch (error) {
    logger.error(`Error reading Excel file: ${error.message}`);
  }

  return extractedData;
};

module.exports = readExcelFile;
