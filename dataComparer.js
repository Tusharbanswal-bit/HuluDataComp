// dataComparer.js
import ExcelReader from './utils/excelReader.js';
import logger from './utils/logger.js';
import fse from 'fs-extra';
import path from 'path';
import DatabaseAdapter from './DB/index.js';

class DataComparer {
    constructor() {
        this.excelReader = new ExcelReader();
    }

    /**
     * Create a composite key for deduplication
     * @param {Object} record - Data record
     * @param {Array} compositeKeys - Array of field names to create composite key
     * @returns {string} - Composite key string
     */
    createCompositeKey(record, compositeKeys) {
        return compositeKeys.map(key => [undefined, null].includes(record[key]) ? '' : record[key]).join('|').toLowerCase().trim();
    }

    getDuplicateStats(data, compositeKeys) {
        const uniqueKeys = new Set();
        const uniqueData = [];
        const duplicates = [];
        const duplicateSet = new Set();
        for (const record of data) {
            const compositeKey = this.createCompositeKey(record, compositeKeys);

            if (!uniqueKeys.has(compositeKey)) {
                uniqueKeys.add(compositeKey);
                uniqueData.push(record);
            } else {
                // if exists in duplicateSet, increment count
                if (duplicateSet.has(compositeKey)) {
                    const duplicateRecord = duplicates.find(d => d.compositeKey === compositeKey);
                    duplicateRecord.duplicateCount += 1;
                    continue;
                }
                duplicates.push({
                    record: record,
                    compositeKey: compositeKey,
                    duplicateCount: 1
                });
                duplicateSet.add(compositeKey);
            }
        }

        return {
            totalRecords: data.length,
            uniqueRecords: uniqueData,
            uniqueCount: uniqueData.length,
            duplicateRecords: duplicates,
            duplicateCount: duplicates.reduce((count, d) => count + d.duplicateCount, 0)
        };
    }

    /**
     * Get duplicate statistics, remove duplicates from data, and generate duplicate report
     * @param {Array} data - Array of data records
     * @param {Array} compositeKeys - Array of field names for composite key
     * @param {string} collectionName - Name of the collection
     * @param {Array} processedFiles - Array of processed file information
     * @returns {Object} - Object containing unique data and success status
     */
    async generateDuplicateReport({ data, compositeKeys, collectionName, processedFiles = [] }) {
        if (!compositeKeys || compositeKeys.length === 0) {
            logger.info('No composite keys defined, skipping deduplication');
            return { success: false };
        }

        if (processedFiles.length) {
            processedFiles.forEach(file => {
                const duplicateResult = this.getDuplicateStats(file.fileData, compositeKeys);
                delete file.fileData;
                file.duplicateRecords = duplicateResult.duplicateRecords;
                file.duplicateCount = duplicateResult.duplicateCount;
            });
        }

        const duplicateResult = this.getDuplicateStats(data, compositeKeys);
        try {
            const reportFolder = path.join(process.cwd(), 'Reports');
            await fse.ensureDir(reportFolder);
            const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
            const outputFilePath = path.join(reportFolder, `Duplicates_${collectionName.replace(/\./g, '_')}_${timestamp}.json`);
            const reportData = {
                collectionName: collectionName,
                processedFiles: processedFiles,
                uniqueRecords: duplicateResult.uniqueRecords,
                uniqueCount: duplicateResult.uniqueCount,
                duplicates: duplicateResult.duplicateRecords,
                duplicateCount: duplicateResult.duplicateCount,
                compositeKeys: compositeKeys,
                totalRecords: duplicateResult.totalRecords
            };
            await fse.outputFile(outputFilePath, JSON.stringify(reportData, null, 2));
            logger.info(`Duplicate report generated successfully: ${outputFilePath}`);
            return { success: true, uniqueRecords: duplicateResult.uniqueRecords };
        } catch (err) {
            logger.error({ err }, `Error generating duplicate report for collection ${collectionName}: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    /**
     * Generate report for a collection by processing all mapped files
     * @param {Object} collectionConfig - Collection configuration
     * @param {string} dataSheetsDirectory - Directory containing Excel files
     * @returns {Promise<Object>} - Generated report
     */
    async generateReport(collectionConfig, dataSheetsDirectory) {
        const { collectionName, mapping, compositeUniqueKeys, dataCompareKey } = collectionConfig;
        let allExtractedData = [];
        const processedFiles = [];

        try {
            for (const fileMapping of mapping) {
                const result = await this.excelReader.readExcel(fileMapping, dataSheetsDirectory);

                if (!result.success) {
                    logger.info(`Failed to read file: ${fileMapping.filename}`);
                    continue;
                }

                // Combine data from all files
                allExtractedData = allExtractedData.concat(result.data);
                processedFiles.push({
                    filename: result.filename,
                    sheetName: result.sheetName,
                    recordCount: result.recordCount,
                    fileData: result.data
                });
            }

            logger.info(`Total records extracted from all files: ${allExtractedData.length}`);
            const result = await this.generateDuplicateReport({ data: allExtractedData, compositeKeys: compositeUniqueKeys, collectionName, processedFiles });

            if (!result.success) {
                logger.info(`Failed to generate duplicate report for collection ${collectionName}`);
                return { success: false };
            }

            const comparisonResult = await this.generateComparisonReport(result.uniqueRecords, collectionName, dataCompareKey);

            if (!comparisonResult.success) {
                logger.info(`Failed to generate comparison report for collection ${collectionName}`);
                return { success: false };
            }

            return { success: true };

        } catch (err) {
            logger.error({ err }, `Error generating report for collection ${collectionName}: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    /**
     * Generate comparison report between Excel data and database data
     * @param {Array} uniqueRecords - Unique records from Excel files
     * @param {string} collectionName - Name of the collection/table to compare with
     * @param {Array} compositeKeys - Array of field names for composite key comparison
     * @returns {Promise<Object>} - Comparison report result
     */
    async generateComparisonReport(uniqueRecords, collectionName, compositeKeys = []) {
        const dbAdapter = new DatabaseAdapter();
        try {
            const initResult = await dbAdapter.init();
            if (!initResult.success) {
                logger.info('Failed to initialize database adapter');
                return { success: false };
            }

            const adapter = dbAdapter.getAdapter();
            const dbResult = await adapter.fetchRecords(collectionName);

            if (!dbResult.success) {
                logger.info(`Failed to fetch records from collection: ${collectionName}`);
                return { success: false };
            }

            const dbRecords = dbResult.data;
            const comparisonResult = this.compareData(uniqueRecords, dbRecords, compositeKeys);

            if (!comparisonResult.success) {
                logger.info(`Failed to compare data for collection: ${collectionName}`);
                return { success: false };
            }

            const reportFolder = path.join(process.cwd(), 'Reports');
            await fse.ensureDir(reportFolder);
            const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
            const outputFilePath = path.join(reportFolder, `Comparison_${collectionName.replace(/\./g, '_')}_${timestamp}.json`);
            const reportData = {
                collectionName: collectionName,
                excelRecordsCount: uniqueRecords.length,
                databaseRecordsCount: dbRecords.length,
                compositeKeys: compositeKeys,
                comparisonReport: comparisonResult.reportData
            };
            await fse.outputFile(outputFilePath, JSON.stringify(reportData, null, 2));
            logger.info(`Comparison report generated successfully: ${outputFilePath}`);
            return { success: true };
        } catch (err) {
            await dbAdapter.close();
            logger.error({ err }, `Error generating comparison report for collection ${collectionName}: ${err.message}`);
            return { success: false, error: err.message };
        } finally {
            await dbAdapter.close();
        }
    }

    /**
     * Compare Excel data with database data
     * @param {Array} excelData - Array of records from Excel
     * @param {Array} dbData - Array of records from database
     * @param {Array} compositeKeys - Array of field names for composite key comparison
     * @returns {Object} - Comparison result with detailed differences
     */
    compareData(excelData, dbData, compositeKeys = []) {
        try {
            const excelMap = new Map();
            const dbMap = new Map();
            const reportData = {};

            excelData.forEach(record => {
                const key = this.createCompositeKey(record, compositeKeys);
                if (excelMap.has(key)) {
                    excelMap.get(key).push(record);
                } else {
                    excelMap.set(key, [record]);
                }
            });

            dbData.forEach(record => {
                const key = this.createCompositeKey(record, compositeKeys)
                if (dbMap.has(key)) {
                    dbMap.get(key).push(record);
                } else {
                    dbMap.set(key, [record]);
                }
            });

            let isUniqueConstraintBroken = false; // flag to indicate if unique constraint is broken for database records
            for (const [, records] of dbMap.entries()) {
                if (records.length > 1) {
                    isUniqueConstraintBroken = true;
                    break;
                }
            }
            if (isUniqueConstraintBroken) {
                logger.info(`Unique constraint is broken for DB data with composite keys: ${compositeKeys.join(', ')}`);
                return { success: false };
            }

            reportData.recordsToAddInDB = [];
            excelMap.forEach((records, key) => {
                if (!dbMap.has(key)) {
                    reportData.recordsToAddInDB.push({
                        records: records,
                        action: 'ADD'
                    });
                }
            });
            reportData.numberOfRecordsToAddInDB = reportData.recordsToAddInDB.reduce((count, item) => count + item.records.length, 0);
            reportData.recordsToDeleteFromDB = [];
            dbMap.forEach((record, key) => {
                if (!excelMap.has(key)) {
                    reportData.recordsToDeleteFromDB.push({
                        record: record,
                        action: 'DELETE'
                    });
                }
            });
            reportData.numberOfRecordsToDeleteFromDB = reportData.recordsToDeleteFromDB.length;

            reportData.changesRquiredInDB = [];
            reportData.exactMatches = [];
            excelMap.forEach((excelRecords, key) => {
                if (dbMap.has(key)) {
                    const dbRecords = dbMap.get(key);
                    const isEqual = this.isEqual(excelRecords, dbRecords);
                    if(!isEqual) {
                        reportData.changesRquiredInDB.push({
                            excelRecords: excelRecords,
                            dbRecords: dbRecords
                        });
                    } else {
                        reportData.exactMatches.push({
                            excelRecords: excelRecords,
                            dbRecords: dbRecords
                        });
                    }
                }
            });
            reportData.noOfChangesRquiredInDB = reportData.changesRquiredInDB.length;
            reportData.noOfExactMatches = reportData.exactMatches.length;
            return {
                reportData: reportData,
                success: true
            };

        } catch (err) {
            logger.error({ err }, `Error comparing data: ${err.message}`);
            return { success: false, error: err.message }
        }
    }

    isEqual(excelRecords, dbRecords) {
        if (excelRecords.length !== dbRecords.length) {
            return false;
        }
        // dbRecords will only have one record as per the current logic
        const excelRecord = excelRecords[0];
        const dbRecord = dbRecords[0];
        delete dbRecord._id; // Remove _id for comparison
        const keys = Object.keys(excelRecord);
        if (keys.length !== Object.keys(dbRecord).length) {
            return false;
        }
        for (const key of keys) {
            const excelValue = typeof excelRecord[key] === 'string' ? excelRecord[key].toLowerCase() : excelRecord[key];
            const dbValue = typeof dbRecord[key] === 'string' ? dbRecord[key].toLowerCase() : dbRecord[key];

            if (excelValue !== dbValue) {
                return false;
            }
        }
        return true;
    }
}

export default DataComparer;
