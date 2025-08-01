export default {
  dbConfig: {
    sql: false,
    uri: "mongodb://localhost:27017/cat",
    username: "your_db_username",
    password: "your_db_password"
  },
  dataSheetsDirectory: "DataSheets",
  collectionConfig: [
    {
      collectionName: "hulu.scope",
      compositeUniqueKeys: ["ManufacturerName", "ScopeModel", "ScopeType", "ScopeFamily"],
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
              defaultValue: 0
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
      compositeUniqueKeys: ["ManufacturerName", "ScopeModel", "ScopeType", "ScopeFamilyId", "ScopePerBasin", "HookupName", "MachineFamilyID"], // Fields to create composite key for deduplication
      mapping: [
        {
          filename: "20601-814 Master HU DB Rev. AM.xlsx", ///RapidAER Hookup
          sheetName: "All Scopes Merged",
          headerIndex: 5,
          columnConfig: [
            {
              columnName: "MachineFamilyID",
              defaultValue: 3
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
              columnName: "ScopeFamilyId",
              headerName: "Strict Scope Family ID"
            },
            {
              columnName: "ScopePerBasin",
              headerName: "Number of Scopes per Basin",
              defaultValue: 0
            },
            {
              columnName: "HookupName",
              headerName: "Hookup",
              columnIndex: 11,
              defaultValue: 0
            },

          ]
        },
        {
          filename: "20601-814 Master HU DB Rev. AM.xlsx",
          sheetName: "All Scopes Merged",
          headerIndex: 5,
          columnConfig: [
            {
              columnName: "MachineFamilyID", //ISA Hookup
              defaultValue: 5
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
              columnName: "ScopeFamilyId",
              headerName: "Strict Scope Family ID"
            },
            {
              columnName: "ScopePerBasin",
              headerName: "Number of Scopes per Basin",
              defaultValue: 0
            },
            {
              columnName: "HookupName",
              headerName: "Hookup",
              columnIndex: 16,
              defaultValue: 0
            }
          ]
        },
        {
          filename: "20601-814 Master HU DB Rev. AM.xlsx",
          sheetName: "All Scopes Merged",
          headerIndex: 5,
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
              columnName: "ScopeFamilyId",
              headerName: "Strict Scope Family ID"
            },
            {
              columnName: "ScopePerBasin",
              headerName: "Number of Scopes per Basin",
              defaultValue: 0
            },
            {
              columnName: "HookupName",
              headerName: "Hookup",
              columnIndex: 17,
              defaultValue: 0
            }
          ]
        }
      ]
    }
  ]
};
