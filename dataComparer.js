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
        return compositeKeys.map(key => [undefined, null].includes(record[key]) ? '' : record[key]).join('|').toLowerCase();
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
                if(duplicateSet.has(compositeKey)) {
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
                logger.info(`Duplicate record found: ${compositeKey}`);
            }
        }

        return {
            totalRecords: data.length,
            uniqueRecords: uniqueData,
            uniqueCount: uniqueData.length,
            duplicateRecords: duplicates,
            duplicateCount: duplicates.length
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

        if(processedFiles.length) {
            processedFiles.forEach(file => {
                const duplicateResult = this.getDuplicateStats(file.fileData, compositeKeys);
                delete file.fileData;
                file.duplicateRecords = duplicateResult.duplicateRecords;
                file.duplicateCount = duplicateResult.duplicateRecords.length;
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
                uniqueCount: duplicateResult.uniqueRecords.length,
                duplicates: duplicateResult.duplicateRecords,
                duplicateCount: duplicateResult.duplicateRecords.length,
                compositeKeys: compositeKeys
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
        const { collectionName, mapping, compositeUniqueKeys } = collectionConfig;
        let allExtractedData = [];
        const processedFiles = [];

        try {
            for (const fileMapping of mapping) {
                const result = await this.excelReader.readExcel(fileMapping, dataSheetsDirectory);

                if (!result.success) {
                    logger.error({ error: result.error }, `Failed to read file: ${fileMapping.filename}`);
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
                logger.error({ err: result.error }, `Failed to generate duplicate report for collection ${collectionName}`);
                return { success: false, error: result.error };
            }

            const comparisonResult = await this.generateComparisonReport(result.uniqueRecords, collectionName, compositeUniqueKeys);

            if(!comparisonResult.success) {
                logger.error({ err: comparisonResult.error }, `Failed to generate comparison report for collection ${collectionName}`);
                return { success: false, error: comparisonResult.error };
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
                logger.error({ error: initResult.error }, 'Failed to initialize database adapter');
                return { success: false, error: 'Database initialization failed' };
            }

            const adapter = dbAdapter.getAdapter();
            const dbResult = await adapter.fetchRecords(collectionName);
            
            if (!dbResult.success) {
                logger.error({ error: dbResult.error }, `Failed to fetch records from collection: ${collectionName}`);
                return { success: false, error: dbResult.error };
            }

            const dbRecords = dbResult.data;
            const comparisonResult = this.compareData(uniqueRecords, dbRecords, compositeKeys);

            if(!comparisonResult.success) {
                logger.error({ err: comparisonResult.error }, `Failed to compare data for collection: ${collectionName}`);
                return { success: false, error: comparisonResult.error };
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
                comparison: comparisonResult
            };
            await fse.outputFile(outputFilePath, JSON.stringify(reportData, null, 2));
            logger.info(`Comparison report generated successfully: ${outputFilePath}`);
            return { success: true };
        } catch (err) {
            logger.error({ err }, `Error generating comparison report for collection ${collectionName}: ${err.message}`);
            return { success: false, error: err.message };
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
            
            excelData.forEach(record => {
                const key = compositeKeys.length > 0 
                    ? this.createCompositeKey(record, compositeKeys)
                    : JSON.stringify(record);
                excelMap.set(key, record);
            });
            
            dbData.forEach(record => {
                const key = compositeKeys.length > 0 
                    ? this.createCompositeKey(record, compositeKeys)
                    : JSON.stringify(record);
                dbMap.set(key, record);
            });
            
            const recordsToAdd = [];
            excelMap.forEach((record, key) => {
                if (!dbMap.has(key)) {
                    recordsToAdd.push({
                        record: record,
                        compositeKey: key,
                        action: 'ADD'
                    });
                }
            });

            const recordsToDelete = [];
            dbMap.forEach((record, key) => {
                if (!excelMap.has(key)) {
                    recordsToDelete.push({
                        record: record,
                        compositeKey: key,
                        action: 'DELETE'
                    });
                }
            });

            const recordsToUpdate = [];
            const exactMatches = [];
            
            excelMap.forEach((excelRecord, key) => {
                if (dbMap.has(key)) {
                    const dbRecord = dbMap.get(key);
                    delete dbRecord._id
                    const differences = this.findRecordDifferences(excelRecord, dbRecord);
                    
                    if (differences.length > 0) {
                        recordsToUpdate.push({
                            compositeKey: key,
                            excelRecord: excelRecord,
                            dbRecord: dbRecord,
                            differences: differences,
                            action: 'UPDATE'
                        });
                    } else {
                        exactMatches.push({
                            compositeKey: key,
                            excelRecord: excelRecord,
                            dbRecord: dbRecord,
                            action: 'NO_CHANGE'
                        });
                    }
                }
            });
            
            const summary = {
                totalExcelRecords: excelData.length,
                totalDatabaseRecords: dbData.length,
                recordsToAdd: recordsToAdd.length,
                recordsToDelete: recordsToDelete.length,
                recordsToUpdate: recordsToUpdate.length,
                exactMatches: exactMatches.length,
                totalChangesRequired: recordsToAdd.length + recordsToDelete.length + recordsToUpdate.length
            };
            
            return {
                summary: summary,
                changes: {
                    add: recordsToAdd,
                    delete: recordsToDelete,
                    update: recordsToUpdate,
                    exactMatches: exactMatches
                },
                matching: exactMatches,
                matchingCount: exactMatches.length,
                missingInDatabase: recordsToAdd,
                missingInDatabaseCount: recordsToAdd.length,
                missingInExcel: recordsToDelete,
                missingInExcelCount: recordsToDelete.length,
                totalExcelRecords: excelData.length,
                totalDatabaseRecords: dbData.length,
                success: true
            };
            
        } catch (err) {
            logger.error({ err }, `Error comparing data: ${err.message}`);
            return { success: false, error: err.message }
        }
    }

    /**
     * Find differences between two records
     * @param {Object} excelRecord - Record from Excel
     * @param {Object} dbRecord - Record from Database
     * @returns {Array} - Array of field differences
     */
    findRecordDifferences(excelRecord, dbRecord) {
        const differences = [];
        
        // Get all unique field names from both records
        const allFields = new Set([
            ...Object.keys(excelRecord),
            ...Object.keys(dbRecord)
        ]);
        
        allFields.forEach(field => {
            const excelValue = excelRecord[field];
            const dbValue = dbRecord[field];
            
            // Normalize values for comparison (handle null, undefined, empty strings)
            const normalizedExcelValue = this.normalizeValue(excelValue);
            const normalizedDbValue = this.normalizeValue(dbValue);
            
            if (normalizedExcelValue !== normalizedDbValue) {
                differences.push({
                    field: field,
                    excelValue: excelValue,
                    dbValue: dbValue,
                    changeType: this.getChangeType(excelValue, dbValue)
                });
            }
        });
        
        return differences;
    }

    /**
     * Normalize values for comparison
     * @param {*} value - Value to normalize
     * @returns {string} - Normalized value
     */
    normalizeValue(value) {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return value.trim().toLowerCase();
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'boolean') return value.toString();
        return JSON.stringify(value);
    }

    /**
     * Determine the type of change for a field
     * @param {*} excelValue - Value from Excel
     * @param {*} dbValue - Value from Database
     * @returns {string} - Change type
     */
    getChangeType(excelValue, dbValue) {
        const hasExcelValue = excelValue !== null && excelValue !== undefined && excelValue !== '';
        const hasDbValue = dbValue !== null && dbValue !== undefined && dbValue !== '';
        
        if (!hasExcelValue && !hasDbValue) return 'NO_CHANGE';
        if (!hasDbValue && hasExcelValue) return 'FIELD_ADDED';
        if (hasDbValue && !hasExcelValue) return 'FIELD_REMOVED';
        return 'FIELD_MODIFIED';
    }
}

export default DataComparer;
