// dataComparer.js
import ExcelHelper from './utils/excelHelper.js';
import logger from './utils/logger.js';
import fse from 'fs-extra';
import path from 'path';
import DatabaseAdapter from './DB/index.js';
import { report } from 'process';

class DataComparer {
    constructor() {
        this.excelHelper = new ExcelHelper();
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
            const duplicatesFolder = path.join(process.cwd(), 'Reports', 'Duplicates', collectionName);
            await fse.ensureDir(duplicatesFolder);
            const timestamp = new Date().toISOString().replace(/[-:.]/g, '');

            for (const file of processedFiles) {
                if (file.duplicateRecords && file.duplicateRecords.length > 0) {
                    const duplicateData = file.duplicateRecords.map(dup => ({
                        ...dup.record,
                        CompositeKey: dup.compositeKey,
                        DuplicateCount: dup.duplicateCount
                    }));

                    const fileName = `${file.filename.replace('.xlsx', '')}_Duplicates_${collectionName}_${timestamp}.xlsx`;
                    const filePath = path.join(duplicatesFolder, fileName);

                    await this.excelHelper.writeExcel(
                        duplicateData,
                        filePath,
                        'Duplicates',
                        this.getColumns(duplicateData[0])
                    );

                    logger.info(`File-wise duplicate Excel report generated: ${filePath}`);
                }
            }

            // Generate combined duplicates Excel report
            if (duplicateResult.duplicateRecords.length > 0) {
                const combinedDuplicateData = duplicateResult.duplicateRecords.map(dup => ({
                    ...dup.record,
                    CompositeKey: dup.compositeKey,
                    DuplicateCount: dup.duplicateCount
                }));

                const combinedFileName = `Combined_Duplicates_${collectionName.replace(/\./g, '_')}_${timestamp}.xlsx`;
                const combinedFilePath = path.join(duplicatesFolder, combinedFileName);

                await this.excelHelper.writeExcel(
                    combinedDuplicateData,
                    combinedFilePath,
                    'Combined Duplicates',
                    this.getColumns(combinedDuplicateData[0])
                );
                const summary = {
                    collectionName: collectionName,
                    processedFiles: processedFiles.map(file => ({ fileName: file.filename, duplicateCount: file.duplicateCount })),
                    uniqueCount: duplicateResult.uniqueCount,
                    duplicateCount: duplicateResult.duplicateCount,
                    compositeKeys: compositeKeys,
                };
                fse.outputFile(path.join(duplicatesFolder, `Summary_${collectionName}_${timestamp}.json`), JSON.stringify(summary, null, 2));
                logger.info(`Combined duplicate Excel report generated: ${combinedFilePath}`);
            }

            logger.info(`Duplicate report generated successfully`);
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
        const { collectionName, mapping, compositeUniqueKeys, dataCompareKey, exactMatchKeys, excludeRecord } = collectionConfig;
        let allExtractedData = [];
        const processedFiles = [];

        try {
            for (const fileMapping of mapping) {
                const result = await this.excelHelper.readExcel({ fileMapping, dataSheetsDirectory, excludeRecord });

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

            const comparisonResult = await this.generateComparisonReport({ uniqueRecords: result.uniqueRecords, collectionName, compositeKeys: dataCompareKey, exactMatchKeys });

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
    async generateComparisonReport({ uniqueRecords, collectionName, compositeKeys = [], exactMatchKeys = [] }) {
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
            const comparisonResult = this.compareData({ uniqueRecords, dbRecords, compositeKeys, exactMatchKeys });

            if (!comparisonResult.success) {
                logger.info(`Failed to compare data for collection: ${collectionName}`);
                return { success: false };
            }

            // Create Reports/Comparison directory
            const comparisonFolder = path.join(process.cwd(), 'Reports', 'Comparison', collectionName);
            await fse.ensureDir(comparisonFolder);
            const timestamp = new Date().toISOString().replace(/[-:.]/g, '');

            // Generate Excel comparison report with multiple sheets
            const sheets = [];
            const reportData = comparisonResult.reportData;

            // Records to Add sheet
            if (reportData.recordsToAddInDB && reportData.numberOfRecordsToAddInDB) {
                const addData = [];
                reportData.recordsToAddInDB.forEach(item => {
                    for (const record of item.records) {
                        addData.push({
                            ...record,
                            Action: item.action
                        });
                    }
                });
                sheets.push({
                    name: 'Records to Add',
                    data: addData
                });
            }

            // Records to Delete sheet
            if (reportData.recordsToDeleteFromDB && reportData.numberOfRecordsToDeleteFromDB) {
                const deleteData = [];
                reportData.recordsToDeleteFromDB.forEach(item => {
                    for (const record of item.records) {
                        deleteData.push({
                            ...record,
                            Action: item.action
                        });
                    }
                });
                sheets.push({
                    name: 'Records to Delete',
                    data: deleteData
                });
            }

            // Records to Update sheet
            if (reportData.changesRequiredInDB && reportData.changesRequiredInDB.length > 0) {
                const updateData = reportData.changesRequiredInDB.map(item => {
                    const flatDiff = {
                        Action: 'UPDATE'
                    };

                    // Add Excel values with prefix
                    if (item.excelRecords) {
                        for (const record of item.excelRecords) {
                            Object.keys(record).forEach(key => {
                                flatDiff[`Excel_${key}`] = record[key];
                            });
                        }
                    }

                    // Add DB values with prefix
                    if (item.dbRecords) {
                        for (const record of item.dbRecords) {
                            Object.keys(record).forEach(key => {
                                flatDiff[`DB_${key}`] = record[key];
                            });
                        }
                    }

                    return flatDiff;
                });
                sheets.push({
                    name: 'Records to Update',
                    data: updateData
                });
            }

            // Summary sheet
            const summaryData = [
                { Metric: 'Total Excel Records', Count: uniqueRecords.length },
                { Metric: 'Total Database Records', Count: dbRecords.length },
                { Metric: 'Records to Add', Count: reportData.numberOfRecordsToAddInDB },
                { Metric: 'Records to Delete', Count: reportData.numberOfRecordsToDeleteFromDB },
                { Metric: 'Records to Update', Count: reportData.noOfChangesRequiredInDB },
                { Metric: 'Exact Matches (Composite)', Count: reportData.noOfExactMatches },
                { Metric: 'Exact Matches (Match Keys)', Count: reportData[`noOfexactMatchesWith${compositeKeys.join('And')}`] }
            ];
            sheets.push({
                name: 'Summary',
                data: summaryData,
                columns: [
                    { header: 'Metric', key: 'Metric', width: 30 },
                    { header: 'Count', key: 'Count', width: 15 }
                ]
            });

            // Generate multi-sheet Excel file
            const excelFileName = `Comparison_${collectionName.replace(/\./g, '_')}_${timestamp}.xlsx`;
            const excelFilePath = path.join(comparisonFolder, excelFileName);

            await this.excelHelper.writeMultiSheetExcel(sheets, excelFilePath);
            logger.info(`Comparison Excel report generated: ${excelFilePath}`);

            // Generate summary JSON report
            const summaryJsonPath = path.join(comparisonFolder, `Summary_${collectionName.replace(/\./g, '_')}_${timestamp}.json`);
            const summaryReport = {
                collectionName: collectionName,
                timestamp: new Date().toISOString(),
                summary: summaryData.reduce((acc, item) => {
                    acc[item.Metric.replace(/\s/g, '')] = item.Count;
                    return acc;
                }, {}),
                compositeKeys: compositeKeys,
                exactMatchKeys: exactMatchKeys
            };
            await fse.outputFile(summaryJsonPath, JSON.stringify(summaryReport, null, 2));
            logger.info(`Summary JSON report generated: ${summaryJsonPath}`);

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
    compareData({ uniqueRecords, dbRecords, compositeKeys = [], exactMatchKeys = [] }) {
        try {
            const excelMap = new Map();
            const dbMap = new Map();
            const reportData = {};

            //excel records
            uniqueRecords.forEach(record => {
                const key = this.createCompositeKey(record, compositeKeys);
                if (excelMap.has(key)) {
                    excelMap.get(key).push(record);
                } else {
                    excelMap.set(key, [record]);
                }
            });

            dbRecords.forEach(record => {
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
            dbMap.forEach((records, key) => {
                if (!excelMap.has(key)) {
                    reportData.recordsToDeleteFromDB.push({
                        records: records,
                        action: 'DELETE'
                    });
                }
            });
            reportData.numberOfRecordsToDeleteFromDB = reportData.recordsToDeleteFromDB.length;
            reportData.changesRequiredInDB = [];
            const exactMatchWithKeysField = `exactMatchesWith${compositeKeys.join('And')}`
            reportData[exactMatchWithKeysField] = [];
            reportData.exactMatches = [];
            excelMap.forEach((excelRecords, key) => {
                if (dbMap.has(key)) {
                    reportData[exactMatchWithKeysField].push(key);
                    const dbRecords = dbMap.get(key);
                    const isEqual = this.isEqual(excelRecords, dbRecords, exactMatchKeys);
                    if (!isEqual) {
                        reportData.changesRequiredInDB.push({
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
            reportData[`noOf${exactMatchWithKeysField}`] = reportData[exactMatchWithKeysField].length;
            reportData.noOfChangesRequiredInDB = reportData.changesRequiredInDB.length;
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

    isEqual(excelRecords, dbRecords, exactMatchKeys = []) {
        if (excelRecords.length !== dbRecords.length) {
            return false;
        }
        // dbRecords will only have one record as per the current logic
        const excelRecord = excelRecords[0];
        const dbRecord = dbRecords[0];
        for (const key of exactMatchKeys) {
            const excelValue = typeof excelRecord[key] === 'string' ? excelRecord[key].toLowerCase() : excelRecord[key];
            const dbValue = typeof dbRecord[key] === 'string' ? dbRecord[key].toLowerCase() : dbRecord[key];

            if (excelValue !== dbValue) {
                return false;
            }
        }
        return true;
    }


    /**
     * Generate columns for comparison Excel reports
     * @param {Object} sampleRow - Sample row to generate columns from
     * @returns {Array} - Array of column configurations
     */
    getColumns(rowData) {
        if (!rowData) return [];

        return Object.keys(rowData).map(key => ({
            header: key,
            key: key,
            width: 20
        }));
    }
}

export default DataComparer;
