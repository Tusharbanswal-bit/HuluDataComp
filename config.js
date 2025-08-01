export default {
  dbConfig: {
    sql: true,
    uri: "mongodb://localhost:27017/cat",
    username: "your_db_username",
    password: "your_db_password"
  },
  dataSheetsDirectory: "DataSheets",
  collectionConfig: [
    {
      collectionName: "hulu.scope",
      compositeUniqueKeys: ["ManufacturerName", "ScopeModel", "ScopeType", "ScopeFamilyId", "ScopePerBasin"], // Fields to create composite key for deduplication
      mapping: [
        {
          filename: "20601-814 Master HU DB Rev. AM.xlsx",
          sheetName: "All Scopes Merged",
          headerIndex: 5,
          columnConfig: [
            {
              columnName: "Endoscope Manufacturer",
              headerName: "ManufacturerName"
            },
            {
              columnName: "Endoscope Type",
              headerName: "ScopeType"
            },
            {
              columnName: "Scope Model",
              headerName: "ScopeModel"
            },
            {
              columnName: "Strict Scope Family ID",
              headerName: "ScopeFamilyId"
            },
            {
              columnName: "Number of Scopes per Basin",
              headerName: "ScopePerBasin",
              defaultValue: 0
            }
          ]
        },
        {
          filename: "ENSPIRE.xlsx",
          sheetName: "ENSPIRE",
          columnConfig: [
            {
              columnName: "MODELNUMBER",
              headerName: "ScopeModel"
            },
            {
              columnName: "MANUFACTURER",
              headerName: "ManufacturerName"
            },
            {
              columnName: "DEVICENAME",
              headerName: "ScopeType"
            }
          ]
        },
        {
          filename: "ENSPIRE3000.xlsx",
          sheetName: "ENSPIRE3000",
          columnConfig: [
            {
              columnName: "MODELNUMBER",
              headerName: "ScopeModel"
            },
            {
              columnName: "MANUFACTURER",
              headerName: "ManufacturerName"
            },
            {
              columnName: "DEVICENAME",
              headerName: "ScopeType"
            }
          ]
        },
        {
          filename: "ENSPIRE3000_US.xlsx",
          sheetName: "ENSPIRE3000_US",
          columnConfig: [
            {
              columnName: "MODELNUMBER",
              headerName: "ScopeModel"
            },
            {
              columnName: "MANUFACTURER",
              headerName: "ManufacturerName"
            },
            {
              columnName: "DEVICENAME",
              headerName: "ScopeType"
            }
          ]
        }
      ]
    }
  ]
};
