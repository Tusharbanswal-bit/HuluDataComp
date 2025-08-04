export default {
  dbConfig: {
    sql: false,
    uri: "mongodb://localhost:27017/cat5_3",
    username: "your_db_username",
    password: "your_db_password"
  },
  dataSheetsDirectory: "DataSheets",
  collectionConfig: [
    {
      collectionName: "hulu.scope",
      excelCompositeUniqueKeys: ["ManufacturerName", "ScopeModel", "ScopeType", "ScopeFamily", "ScopePerBasin"],
      exactFieldMatch: ["ScopeModel", "ManufacturerName", "ScopeType"], // key to check for exact matches
      dataCompareKey: ["ScopeModel"],
      mapping: [
        {
          filename: "20601-814 Master HU DB Rev. AM.xlsx",
          sheetName: "All Scopes Merged",
          headerIndex: 5,
          columnConfig: [
            {
              columnName: "ManufacturerName",
              headerName: "Endoscope Manufacturer"
            },
            {
              columnName: "ScopeType",
              headerName: "Endoscope Type"
            },
            {
              columnName: "ScopeModel",
              headerName: "Scope Model"
            },
            {
              columnName: "ScopeFamily",
              headerName: "Strict Scope Family ID"
            },
            {
              columnName: "ScopePerBasin",
              headerName: "Number of Scopes per Basin",
              defaultValue: 0,
              dataType: "number"
            }
          ]
        },
        {
          filename: "ENSPIRE.xlsx",
          sheetName: "ENSPIRE",
          columnConfig: [
            {
              columnName: "ScopeModel",
              headerName: "MODELNUMBER"
            },
            {
              columnName: "ManufacturerName",
              headerName: "MANUFACTURER"
            },
            {
              columnName: "ScopeType",
              headerName: "DEVICENAME"
            }
          ]
        },
        {
          filename: "ENSPIRE3000.xlsx",
          sheetName: "ENSPIRE3000",
          columnConfig: [
            {
              columnName: "ScopeModel",
              headerName: "MODELNUMBER"
            },
            {
              columnName: "ManufacturerName",
              headerName: "MANUFACTURER"
            },
            {
              columnName: "ScopeType",
              headerName: "DEVICENAME"
            }
          ]
        },
        {
          filename: "ENSPIRE3000_US.xlsx",
          sheetName: "ENSPIRE3000_US",
          columnConfig: [
            {
              columnName: "ScopeModel",
              headerName: "MODELNUMBER"
            },
            {
              columnName: "ManufacturerName",
              headerName: "MANUFACTURER"
            },
            {
              columnName: "ScopeType",
              headerName: "DEVICENAME"
            }
          ]
        }
      ]
    },
    {
      collectionName: "hulu.hookup",
      excelCompositeUniqueKeys: ["HookupName", "ScopeFamily", "ScopePerBasin"], // Fields to create composite key for deduplication
      dataCompareKey: ["HookupName", "ScopeFamily"], // unique key for data base records
      exactFieldMatch: ["HookupName", "ScopeFamily"], // key to check for exact matches
      excludeRecord: [{ columnName: "HookupName", values: ["", null, undefined, 0, "0"] }],
      mapping: [
        {
          filename: "20601-814 Master HU DB Rev. AM.xlsx",
          sheetName: "All Scopes Merged",
          headerIndex: 5,
          recordHeader: "Adv",
          columnConfig: [
            {
              columnName: "MachineFamilyID", //ADV Hookup
              defaultValue: 2
            },
            {
              columnName: "ManufacturerName",
              headerName: "Endoscope Manufacturer"
            },
            {
              columnName: "ScopeType",
              headerName: "Endoscope Type"
            },
            {
              columnName: "ScopeModel",
              headerName: "Scope Model"
            },
            {
              columnName: "ScopePerBasin",
              headerName: "Number of Scopes per Basin",
              defaultValue: 0
            },
            {
              columnName: "ScopeFamily",
              headerName: "Strict Scope Family ID"
            },
            {
              columnName: "HookupName",
              headerName: "Hookup, Handle version"
            }
          ]
        }
      ]
    }
  ]
};
