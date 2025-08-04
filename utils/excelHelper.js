import ExcelJS from 'exceljs';
import logger from './logger.js';
import fse from 'fs-extra';
import path from 'path';

class ExcelHelper {

  /**
   * Read Excel file and extract data based on the provided configuration
   * @param {Object} fileMapping - File mapping configuration
   * @param {string} dataSheetsDirectory - Directory containing Excel files
   * @returns {Promise<Object>} - Extracted data result
   */
  async readExcel({ fileMapping, dataSheetsDirectory, excludeRecord }) {
    const { filename, sheetName, headerIndex = 1, columnConfig, recordHeader } = fileMapping;
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

  /**
   * Convert data based on the specified data type
   * @param {*} value - The value to convert
   * @param {string} dataType - The data type to convert to
   * @returns {*} - Converted value
   */
  convertData(value, dataType) {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    switch (dataType.toLowerCase()) {
      case 'string':
        return value.toString();
      case 'number':
        const num = Number(value);
        return isNaN(num) ? 0 : num;
      case 'boolean':
        return Boolean(value);
      case 'date':
        if (value instanceof Date) return value;
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
      default:
        return value.toString();
    }
  }

  /**
   * Write data to Excel file
   * @param {Array} data - Array of objects to write
   * @param {string} filePath - Full path where to save the Excel file
   * @param {string} sheetName - Name of the sheet
   * @param {Array} columns - Column configuration [{ header: 'Name', key: 'name', width: 20 }]
   * @returns {Promise<Object>} - Result object
   */
  async writeExcel(data, filePath, sheetName = 'Sheet1', columns = null) {
    try {
      await fse.ensureDir(path.dirname(filePath));

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(sheetName);

      if (data.length === 0) {
        logger.info(`No data to write to ${filePath}`);
        return { success: true, message: 'No data to write' };
      }

      // Auto-generate columns if not provided
      if (!columns) {
        const sampleRow = data[0];
        columns = Object.keys(sampleRow).map(key => ({
          header: key,
          key: key,
          width: 20
        }));
      }

      // Set up columns
      worksheet.columns = columns;

      // Add header styling
      worksheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      // Add data rows
      data.forEach(row => {
        const addedRow = worksheet.addRow(row);
        addedRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      // Save the file
      await workbook.xlsx.writeFile(filePath);
      logger.info(`Excel file written successfully: ${filePath}`);

      return {
        success: true,
        filePath: filePath,
        recordCount: data.length
      };

    } catch (err) {
      logger.error({ err }, `Error writing Excel file ${filePath}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Write multiple sheets to a single Excel file
   * @param {Array} sheets - Array of sheet objects [{ name: 'Sheet1', data: [], columns: [] }]
   * @param {string} filePath - Full path where to save the Excel file
   * @returns {Promise<Object>} - Result object
   */
  async writeMultiSheetExcel(sheets, filePath) {
    try {
      await fse.ensureDir(path.dirname(filePath));

      const workbook = new ExcelJS.Workbook();

      for (const sheetConfig of sheets) {
        const { name, data, columns } = sheetConfig;
        const worksheet = workbook.addWorksheet(name);

        if (data.length === 0) {
          logger.info(`No data for sheet ${name}`);
          continue;
        }

        // Auto-generate columns if not provided
        let sheetColumns = columns;
        if (!sheetColumns) {
          const sampleRow = data[0];
          sheetColumns = Object.keys(sampleRow).map(key => ({
            header: key,
            key: key,
            width: 20
          }));
        }

        // Set up columns
        worksheet.columns = sheetColumns;

        // Add header styling
        worksheet.getRow(1).eachCell((cell) => {
          cell.font = { bold: true };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
          };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });

        // Add data rows
        data.forEach(row => {
          const addedRow = worksheet.addRow(row);
          addedRow.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
          });
        });
      }

      // Save the file
      await workbook.xlsx.writeFile(filePath);
      logger.info(`Multi-sheet Excel file written successfully: ${filePath}`);

      return {
        success: true,
        filePath: filePath,
        sheetsCount: sheets.length
      };

    } catch (err) {
      logger.error({ err }, `Error writing multi-sheet Excel file ${filePath}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}

export default ExcelHelper;