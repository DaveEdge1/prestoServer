# Modifying lipdverseR to Update Both MySQL Tables

## The Problem

The `updateSqlQuery()` function in lipdverseR currently only updates the `dataSetQuery` table (dataset-level aggregation) but not the `query` table (time-series level data). This causes the query form to return empty results for newer compilations like Pages2kTemperature-2_1_4 and Pages2kTemperature-2_2_0.

## The Solution

Modify the `updateSqlQuery()` function in the lipdverseR package to write to **both** tables:
- `dataSetQuery` - Dataset-level aggregation (existing functionality)
- `query` - Time-series level data (NEW functionality)

## Where to Make the Change

**File**: `lipdverseR/R/queryCsv.R`
**Function**: `updateSqlQuery()`
**Repository**: https://github.com/nickmckay/lipdverseR

## Changes Required

### 1. Add time-series table preparation (after line ~50)

```r
# ========== NEW CODE: Prepare time-series level table ==========
print(paste("Preparing to update MySQL tables..."))
print(paste("  dataSetQuery will have", nrow(df1), "rows (dataset level)"))
print(paste("  query will have", nrow(queryTable), "rows (time series level)"))

# Clean up the time-series table
queryTable_clean <- queryTable
queryTable_clean[queryTable_clean == "NA"] <- NA
```

### 2. Add query table write (after the dataSetQuery write)

```r
# Update query table (time-series level)
print("Writing to query table...")
RMySQL::dbWriteTable(mysqlconnection, "query", queryTable_clean, overwrite=TRUE)
print("  ✓ query updated")
```

### 3. Add verification queries (optional but recommended)

```r
# Verify the updates
print("Verifying updates...")

# Check query count
query_count <- RMySQL::dbGetQuery(mysqlconnection, "SELECT COUNT(*) as count FROM query")
print(paste("  query now has", query_count$count, "rows"))

# Check Pages2kTemperature versions in query table
pages2k_check <- RMySQL::dbGetQuery(mysqlconnection,
  "SELECT paleoData_mostRecentCompilations, COUNT(*) as count
   FROM query
   WHERE paleoData_mostRecentCompilations LIKE '%Pages2kTemperature%'
   GROUP BY paleoData_mostRecentCompilations
   ORDER BY paleoData_mostRecentCompilations")

if(nrow(pages2k_check) > 0) {
  print("  Pages2kTemperature versions in query table:")
  for(i in 1:nrow(pages2k_check)) {
    print(paste("    ", pages2k_check$paleoData_mostRecentCompilations[i], ":",
                pages2k_check$count[i], "records"))
  }
}
```

## Complete Modified Function

See `updateSqlQuery_modified.R` for the complete modified function.

## How to Apply

### Option 1: Modify the Package Source

1. Clone the lipdverseR repository:
   ```bash
   git clone https://github.com/nickmckay/lipdverseR.git
   cd lipdverseR
   ```

2. Edit `R/queryCsv.R` and replace the `updateSqlQuery()` function with the modified version

3. Rebuild and reinstall the package:
   ```r
   devtools::install()
   ```

### Option 2: Source the Modified Function Directly

In your R script that calls `updateSqlQuery()`:

```r
# Load the package
library(lipdverseR)

# Override with modified function
source("/home/user/prestoServer/updateSqlQuery_modified.R")

# Now call it (will use the modified version)
updateSqlQuery(queryTable = up)
```

### Option 3: Create Pull Request

Submit a pull request to the lipdverseR repository with these changes so everyone benefits from the fix.

## Testing

After running the modified function, verify both tables are updated:

```r
# In R
library(RMySQL)

conInf <- readr::read_tsv("sql.secret",col_names = FALSE,col_types = "c")
mysqlconnection = RMySQL::dbConnect(RMySQL::MySQL(),
                                    dbname='lipdverse',
                                    host='143.198.98.66',
                                    port=3306,
                                    user=conInf$X1[[1]],
                                    password=conInf$X1[[2]])

# Check row counts
RMySQL::dbGetQuery(mysqlconnection, "SELECT COUNT(*) FROM dataSetQuery")
RMySQL::dbGetQuery(mysqlconnection, "SELECT COUNT(*) FROM query")

# Check Pages2kTemperature versions
RMySQL::dbGetQuery(mysqlconnection,
  "SELECT paleoData_mostRecentCompilations, COUNT(*) as count
   FROM query
   WHERE paleoData_mostRecentCompilations LIKE '%Pages2kTemperature%'
   GROUP BY paleoData_mostRecentCompilations")

RMySQL::dbDisconnect(mysqlconnection)
```

Expected output for query table:
```
Pages2kTemperature-2_1_2    15
Pages2kTemperature-2_1_4    2179
Pages2kTemperature-2_2_0    691
```

## Key Points

1. **Input**: The `queryTable` parameter is already at the time-series level with all columns needed for the `query` table

2. **Two Tables**:
   - `dataSetQuery`: Aggregated by `datasetId` (one row per dataset)
   - `query`: Full time-series data (one row per time series)

3. **Backward Compatible**: The modification doesn't change the existing `dataSetQuery` functionality, it just adds the `query` table update

4. **Performance**: Writing ~140K rows might take 30-60 seconds depending on the database connection

## Related Files

- Modified function: `/home/user/prestoServer/updateSqlQuery_modified.R`
- Original source: https://github.com/nickmckay/lipdverseR/blob/master/R/queryCsv.R
- Python alternative: `/home/user/prestoServer/query/update_lipdverse_db.py`
