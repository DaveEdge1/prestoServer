# getLipds

This repository provides tools to download and convert LiPD (Linked Paleo Data) files from the LiPDverse into various formats suitable for different analysis frameworks.

## Components

### downloadLipds.js
Main script that downloads LiPD data and converts it to the requested format.

**Usage:**
```bash
node downloadLipds.js <uniqueID> <language>
```

**Parameters:**
- `uniqueID`: Unique identifier for the data request
- `language`: Output language (`R` or `Python`)

**Examples:**
```bash
# Python format (creates both cfr and legacy pickles)
node downloadLipds.js myRequest123 Python

# R format
node downloadLipds.js myRequest123 R
```

### getLipd.R
R script that queries the LiPDverse and extracts time series data.

### lipdPickler/
Python scripts and Docker container for converting LiPD files to pickle format.

## Output Files

Depending on the parameters, the following files are generated in `/root/presto/userRecons/<uniqueID>/`:

### For Python (`language=Python`):
- `lipd.pkl` - pandas DataFrame compatible with [cfr](https://github.com/fzhu2e/cfr) library (primary format)
- `lipd_legacy.pkl` - Dictionary with structure `{'D': D}` (backward compatibility)
- `lipd_files.zip` - Archive of all .lpd files
- `lipd.rds` - R serialized data
- `lipd_tts.rds` - R time series table

### For R (`language=R`):
- `lipd.RData` - R data file
- `lipd.rds` - R serialized data
- `lipd_tts.rds` - R time series table

## Pickle File Formats

### Primary Format: `lipd.pkl` (CFR-compatible)
Designed for use with the [cfr (Climate Field Reconstruction)](https://github.com/fzhu2e/cfr) Python package.

**Structure:** pandas DataFrame with the following columns:
- `paleoData_TSid` - Time series unique identifier
- `dataSetName` - Dataset/site name
- `archiveType` - Archive type (marine sediment, tree, ice core, etc.)
- `geo_meanLat` - Latitude
- `geo_meanLon` - Longitude
- `geo_meanElev` - Elevation
- `year` or `age` - Time axis values
- `yearUnits` - Time units
- `paleoData_variableName` - Variable name
- `paleoData_units` - Measurement units
- `paleoData_values` - Actual proxy values
- `paleoData_proxy` - Proxy type

**Loading in cfr:**
```python
import cfr
import pandas as pd

# Load the pickle file
df = pd.read_pickle('lipd.pkl')

# Create ProxyDatabase from DataFrame
pdb = cfr.ProxyDatabase.from_df(
    df,
    pid_column='paleoData_TSid',
    lat_column='geo_meanLat',
    lon_column='geo_meanLon'
)

print(f"Loaded {len(pdb)} proxy records")
```

### Legacy Format: `lipd_legacy.pkl`
For backward compatibility with existing code.

**Structure:** Dictionary with `{'D': D}` where D is from `lipd.readLipd()`

**Loading:**
```python
import pickle

with open('lipd_legacy.pkl', 'rb') as f:
    data = pickle.load(f)
    D = data['D']
```

## Requirements

- Node.js
- R with lipdR and jsonlite packages
- Docker (for pickle conversion)
- Docker image: `davidedge/lipd_webapps:lipdPickler`

## Related Projects

- [pylipd](https://github.com/LinkedEarth/pylipd) - Modern Python library for LiPD data (RDF-based)
- [cfr](https://github.com/fzhu2e/cfr) - Climate Field Reconstruction toolkit
- [LiPDverse](https://lipdverse.org/) - LiPD data repository
