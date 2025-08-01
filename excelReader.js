import ExcelJS from 'exceljs';
import logger from './logger.js';
import fse from 'fs-extra';
import path from 'path';

const createCompositeKey = (record, compositeKeys) => {
  return compositeKeys.map(key => [undefined, null].includes(record[key]) ? '' : record[key]).join('|').toLowerCase();
};

const removeDuplicates = (data, compositeKeys) => {
  if (!compositeKeys || compositeKeys.length === 0) {
    return { uniqueData: data, duplicates: [] };
  }

  const uniqueKeys = new Set();
  const uniqueData = [];
  const duplicates = [];

  for (const record of data) {
    const compositeKey = createCompositeKey(record, compositeKeys);

    if (!uniqueKeys.has(compositeKey)) {
      uniqueKeys.add(compositeKey);
      uniqueData.push(record);
    } else {
      duplicates.push({
        record: record,
        compositeKey: compositeKey
      });
      logger.info(`Duplicate record found and removed: ${compositeKey}`);
    }
  }

  logger.info(`Removed ${duplicates.length} duplicate records. Final count: ${uniqueData.length}`);
  return { uniqueData, duplicates };
};

const parseFile = async (collectionConfig, dataSheetsDirectory) => {
  const { collectionName, mapping, compositeUniqueKeys } = collectionConfig;
  let allExtractedData = [];
  try {
    for (const fileMapping of mapping) {
      const { filename, sheetName, headerIndex = 1, columnConfig } = fileMapping;
      const filePath = path.join(process.cwd(), dataSheetsDirectory, filename);

      if (!await fse.pathExists(filePath)) {
        logger.info(`File not found: ${filePath}`);
        continue;
      }

      logger.info(`Processing file: ${filename}, sheet: ${sheetName}`);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const sheet = workbook.getWorksheet(sheetName);

      if (!sheet) {
        logger.info(`The specified sheet "${sheetName}" does not exist in the Excel file at ${filePath}.`);
        continue;
      }

      const headers = sheet.getRow(headerIndex).values;
      const columnIndices = new Map();

      for (const column of columnConfig) {
        const columnHeader = column.headerName; // Excel header name
        if (!column.headerName) {
          continue;
        }
        const columnIndex = typeof column.columnIndex === 'number' ? column.columnIndex : headers.findIndex(header => {
          const headerName = typeof header === "string" ? header.trim().toLowerCase() : '';
          return headerName === columnHeader.toLowerCase();
        });

        if (columnIndex === -1) {
          logger.info(`Invalid column: ${columnHeader} in sheet "${sheetName}"`);
          continue;
        }

        columnIndices.set(columnHeader, columnIndex);
      }

      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= headerIndex) return;

        const rowData = {};
        for (const column of columnConfig) {

          if (!column.headerName && column.columnName) { //adding default value for column without headerName
            rowData[column.columnName] = column.defaultValue;
            allExtractedData.push(rowData);
            continue;
          }

          const columnHeader = column.headerName; // Excel header name
          const columnIndex = columnIndices.get(columnHeader);

          if (columnIndex === undefined) continue;

          let columnValue = row.getCell(columnIndex).value;
          columnValue = columnValue ? columnValue.toString().trim() : '';

          if (!columnValue && column.defaultValue !== undefined) {
            columnValue = column.defaultValue;
          }

          rowData[column.columnName] = columnValue; // Store using collection field name
        }
        allExtractedData.push(rowData);
      });

      logger.info(`Extracted ${allExtractedData.length} total records so far from ${filename}`);
    }

    // Remove duplicates based on composite unique keys
    const deduplicationResult = removeDuplicates(allExtractedData, compositeUniqueKeys);
    const uniqueData = deduplicationResult.uniqueData;
    const duplicates = deduplicationResult.duplicates;

    // Save consolidated and deduplicated data to JSON file
    const extractedFolder = path.join(process.cwd(), 'Extracted');
    await fse.ensureDir(extractedFolder);

    // Append the current timestamp to the filename
    const timestamp = new Date().toISOString().replace(/[-:.]/g, ''); // Remove special characters for filename
    const outputFilePath = path.join(extractedFolder, `extractedData_${collectionName.replace(/\./g, '_')}_${timestamp}.json`);

    // Save extracted data to the file
    const fileData = {
      collectionName: collectionName,
      collectionData: uniqueData,
      recordCount: uniqueData.length,
      duplicateRecords: duplicates,
      duplicateCount: duplicates.length,
      totalRecordsProcessed: allExtractedData.length,
      compositeUniqueKeys: compositeUniqueKeys,
      processedFiles: mapping.map(m => m.filename),
      timestamp: new Date().toISOString()
    };

    await fse.outputFile(outputFilePath, JSON.stringify(fileData, null, 2));
    logger.info(`Collection data extracted successfully and saved to ${outputFilePath} with ${uniqueData.length} unique records and ${duplicates.length} duplicate records.`);

    return { success: true, data: uniqueData, duplicates: duplicates, filePath: outputFilePath };

  } catch (err) {
    logger.error({ err }, `Error processing collection ${collectionName}: ${err.message}`);
    return { success: false, error: err.message };
  }
};

export { parseFile };
