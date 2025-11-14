# LiPDverse Database Update Guide

## Quick Start

### 1. Install Dependencies

```bash
pip3 install mysql-connector-python
```

### 2. Run the Update Script

```bash
# Run from the query directory
cd /home/user/prestoServer/query
python3 update_lipdverse_db.py
```

The script will:
- Download the latest CSV from lipdverse.org
- Check if it's changed (using MD5 hash)
- Update the MySQL database if needed
- Show before/after statistics

### 3. Force Update (Skip MD5 Check)

```bash
python3 update_lipdverse_db.py --force
```

## How It Works

1. **Downloads** `https://lipdverse.org/lipdverse/lipdverseQuery.zip`
2. **Extracts** `lipdverseQuery.csv`
3. **Compares** MD5 hash with previous version (stored in `lipdverseQuery.md5`)
4. **Updates** MySQL `query` table if changed
5. **Saves** new MD5 hash for future comparisons

## Automatic Updates with Cron

### Option 1: Daily at 2 AM

```bash
# Edit crontab
crontab -e

# Add this line:
0 2 * * * /usr/bin/python3 /home/user/prestoServer/query/update_lipdverse_db.py >> /var/log/lipdverse_update.log 2>&1
```

### Option 2: Weekly on Sundays at 3 AM

```bash
0 3 * * 0 /usr/bin/python3 /home/user/prestoServer/query/update_lipdverse_db.py >> /var/log/lipdverse_update.log 2>&1
```

## Troubleshooting

### Error: mysql-connector-python not installed

```bash
pip3 install mysql-connector-python
```

### Error: Access denied for user 'dave'

Check MySQL credentials in the script (lines 24-29):
```python
DB_CONFIG = {
    'host': 'localhost',
    'user': 'dave',
    'password': 'peb0pk0q',
    'database': 'lipdverse',
    'allow_local_infile': True
}
```

### Error: LOAD DATA LOCAL INFILE failed

The script will automatically fall back to row-by-row insert (slower but works).

To enable LOAD DATA LOCAL INFILE in MySQL:

```sql
-- Check current setting
SHOW GLOBAL VARIABLES LIKE 'local_infile';

-- Enable if needed
SET GLOBAL local_infile = 1;
```

### Check the last update time

```sql
USE lipdverse;
SELECT MAX(last_updated) as last_update FROM query;
```

## Manual Database Update

If you need to manually update the database:

```bash
# Download and extract
cd /tmp
wget https://lipdverse.org/lipdverse/lipdverseQuery.zip
unzip lipdverseQuery.zip

# Import to MySQL
mysql -u dave -p --local-infile=1 lipdverse << 'EOF'
TRUNCATE TABLE query;
LOAD DATA LOCAL INFILE '/tmp/lipdverseQuery.csv'
INTO TABLE query
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;
EOF
```

## Verify the Update

After running the script, check that all Pages2kTemperature versions are present:

```sql
SELECT paleoData_mostRecentCompilations, COUNT(*) as count
FROM query
WHERE paleoData_mostRecentCompilations LIKE '%Pages2kTemperature%'
GROUP BY paleoData_mostRecentCompilations
ORDER BY paleoData_mostRecentCompilations;
```

Expected output:
```
Pages2kTemperature-2_1_2    15
Pages2kTemperature-2_1_4    2179
Pages2kTemperature-2_2_0    691
```

## Files Created

- `update_lipdverse_db.py` - Main update script
- `lipdverseQuery.md5` - MD5 hash of last CSV file (auto-created)
- `/tmp/lipdverse_update/` - Temporary download directory (auto-created)

## Integration with R Script

The existing R script at `/home/user/prestoServer/getLipds/renew_lipdverse.R` can be updated to call this Python script, or you can replace it entirely with this Python version.
