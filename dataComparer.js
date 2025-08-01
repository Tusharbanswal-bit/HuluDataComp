// dataComparer.js
import ExcelReader from './utils/excelReader.js';
import logger from './utils/logger.js';
import fse from 'fs-extra';
import path from 'path';

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
            return { success: true };
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
            await this.generateDuplicateReport({ data: allExtractedData, compositeKeys: compositeUniqueKeys, collectionName, processedFiles });

            return { success: true };

        } catch (err) {
            logger.error({ err }, `Error generating report for collection ${collectionName}: ${err.message}`);
            return { success: false, error: err.message };
        }
    }
}

export default DataComparer;
