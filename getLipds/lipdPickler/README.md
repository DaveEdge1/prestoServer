# lipdPickler

* This repo underlies the lipdPickler container (docker pull davidedge/lipd_webapps:lipdPickler)

* The container requires a directory mounted with .lpd files to pickle

* The output requires a volume mount to receive the pickle file(s)

## Output Files

The container always creates both formats for maximum compatibility:

### Primary Format: `lipd.pkl`
- **Structure**: pandas DataFrame compatible with [cfr](https://github.com/fzhu2e/cfr) library
- **Protocol**: pickle protocol 4 (Python 3.4+)
- **Columns**: paleoData_TSid, dataSetName, archiveType, geo_meanLat, geo_meanLon, geo_meanElev, year/age, yearUnits, paleoData_variableName, paleoData_units, paleoData_values, paleoData_proxy

### Legacy Format: `lipd_legacy.pkl`
- **Structure**: Dictionary with `{'D': D}` where D is from `lipd.readLipd()`
- **Protocol**: pickle protocol 2 (Python 2.x compatible)
- **Purpose**: Backward compatibility with existing code

### Archive: `lipd_files.zip`
- Compressed archive of all .lpd files
- Created before pickle processing (preserved even if processing fails)

## Usage

```bash
docker run -v /path/to/output:/output davidedge/lipd_webapps:lipdPickler
```

This will create:
- `/path/to/output/lipd.pkl` - CFR-compatible pandas DataFrame
- `/path/to/output/lipd_legacy.pkl` - Legacy dictionary format
- `/path/to/output/lipd_files.zip` - Archive of .lpd files
