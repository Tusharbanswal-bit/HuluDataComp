import ExcelJS from 'exceljs';
import logger from './logger.js';
import fse from 'fs-extra';
import path from 'path';
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
      if (!await fse.pathExists(filePath)) {
        logger.info(`File not found: ${filePath}`);
        return { success: false };
      }

      logger.info(`Processing file: ${filename}, sheet: ${sheetName}`);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const sheet = workbook.getWorksheet(sheetName);

      if (!sheet) {
        logger.info(`The specified sheet "${sheetName}" does not exist in the Excel file at ${filePath}.`);
        return { success: false };
      }

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

      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= headerIndex) return; // Skip header row

        let rowData = {};
        for (const column of columnConfig) {
          if (!column.headerName && column.columnName) { //adding default value for column without headerName
            rowData[column.columnName] = column.defaultValue;
          } else {
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
            rowData[column.columnName] = this.convertData(columnValue, column.dataType || 'string');
          }
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

  convertData(data, type) {
    if (type === 'string') {
      return data.toString();
    } else if (type === 'number') {
      return Number(data);
    } else if (type === 'boolean') {
      return Boolean(data);
    } else {
      return data;
    }
  }
}

export default ExcelReader;