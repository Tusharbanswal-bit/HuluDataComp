// utils/excelReader.js
import ExcelJS from 'exceljs';
import logger from './logger.js';
import fse from 'fs-extra';
import path from 'path';

const nullValues = [null, undefined, ''];
class ExcelReader {

  /**
   * Read Excel file and extract data based on the provided configuration
   * @param {Object} fileMapping - File mapping configuration
   * @param {string} dataSheetsDirectory - Directory containing Excel files
   * @returns {Promise<Object>} - Extracted data result
   */
  async readExcel(fileMapping, dataSheetsDirectory) {
    const { filename, sheetName, headerIndex = 1, columnConfig, excludeRecord, recordHeader } = fileMapping;
    const filePath = path.join(process.cwd(), dataSheetsDirectory, filename);
    const extractedData = [];

    try {
      // Check if file exists
      if (!await fse.pathExists(filePath)) {
        logger.error({ filePath }, `File not found: ${filePath}`);
        return { success: false, error: `File not found: ${filePath}`, data: [] };
      }

      logger.info(`Processing file: ${filename}, sheet: ${sheetName}`);

      // Initialize Excel workbook
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const sheet = workbook.getWorksheet(sheetName);

      if (!sheet) {
        logger.error({ sheetName, filePath }, `The specified sheet "${sheetName}" does not exist in the Excel file at ${filePath}.`);
        return { success: false, error: `Sheet "${sheetName}" not found`, data: [] };
      }

      // Get headers from the row defined by headerIndex
      const headers = sheet.getRow(headerIndex).values;
      const columnIndices = new Map();

      // Create a map of the columns to extract based on columnConfig
      for (const column of columnConfig) {
        if (!column.headerName) {
          continue;
        }
        const columnHeader = column.headerName; // Excel header name
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

      // Process the data for the current sheet
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= headerIndex) return; // Skip header row

        let rowData = {};
        for (const column of columnConfig) {

          if (!column.headerName && column.columnName) { //adding default value for column without headerName
            rowData[column.columnName] = column.defaultValue;
            extractedData.push(rowData);
            continue;
          }
          const columnHeader = column.headerName; // Excel header name
          const columnIndex = columnIndices.get(columnHeader);
          let shouldExclude = false;

          // Handle excludeValues as array of objects: [{ columnName, values }]
          if (Array.isArray(excludeRecord)) {
            for (const excludeObj of excludeRecord) {
              if (column.columnName === excludeObj.columnName) {
                const cellValue = row.getCell(columnIndex).value;
                if (excludeObj.values.includes(cellValue)) {
                  shouldExclude = true;
                  rowData = {};
                  break;
                }
              }
            }

          }

          if (shouldExclude) {
            // Skip this row entirely
            continue;
          }
          if (columnIndex === undefined) continue;

          let columnValue = row.getCell(columnIndex).value;
          columnValue = columnValue ? columnValue.toString().trim() : '';

          if (!columnValue && column.defaultValue !== undefined) {
            columnValue = column.defaultValue;
          }

          // Store using collection field name
          rowData[column.columnName] = columnValue;
        }

        if (Object.keys(rowData).length > 0) {
          extractedData.push(rowData);
        }
      });

      logger.info(`Extracted ${extractedData.length} records from ${filename} `);

      return {
        success: true,
        data: extractedData,
        filename: filename,
        sheetName: sheetName,
        recordCount: extractedData.length,
        recordHeader: recordHeader || ''
      };

    } catch (err) {
      logger.error({ err }, `Error reading Excel file ${filename}: ${err.message} `);
      return { success: false, error: err.message, data: [] };
    }
  }
}

export default ExcelReader;