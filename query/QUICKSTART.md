# Quick Start Guide - LiPDverse Database Tools

## Problem Summary

Your MySQL database is missing 272 datasets (20% of the data) compared to the source CSV file, causing discrepancies between your R analysis (1,334 datasets) and the Express app (1,062 datasets).

## Solution: Set Up and Run

### Step 1: Create Conda Environment

```bash
cd /home/user/prestoServer/query
./setup_env.sh
```

This will create a conda environment called `lipdverse-db` with all required dependencies.

### Step 2: Check Database Status

```bash
# Option A: Use wrapper script (easiest)
./run_check.sh

# Option B: Activate conda and run manually
conda activate lipdverse-db
python check_mysql_sync.py
conda deactivate
```

This will show you exactly which datasets are missing from MySQL.

### Step 3: Update Database

```bash
# Option A: Use wrapper script (easiest)
./run_update.sh

# Option B: Activate conda and run manually
conda activate lipdverse-db
python update_lipdverse_db.py
conda deactivate
```

This will download the latest CSV and sync your MySQL database.

### Step 4: Verify Fix

After updating, check the database again:

```bash
./run_check.sh
```

You should see: "✓ MySQL database is perfectly in sync with CSV file!"

Now test your Express app with:
```
http://143.198.98.66:88/?paleoData_mostRecentCompilations=Pages2kTemperature-2_2_0,CoralHydro2k-1_0_0,iso2k-1_1_2
```

It should return **1,334 datasets** (matching your R analysis).

## Alternative: Without Conda

If you don't have conda, use a Python virtual environment:

```bash
cd /home/user/prestoServer/query

# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate

# Install dependencies
pip install mysql-connector-python

# Run scripts
python check_mysql_sync.py
python update_lipdverse_db.py

# Deactivate when done
deactivate
```

## Files Overview

| File | Purpose |
|------|---------|
| `environment.yml` | Conda environment definition |
| `setup_env.sh` | Creates the conda environment |
| `run_check.sh` | Runs database sync check |
| `run_update.sh` | Runs database update |
| `check_mysql_sync.py` | Diagnostic script |
| `update_lipdverse_db.py` | Database update script |
| `CONDA_SETUP.md` | Detailed conda instructions |
| `UPDATE_DATABASE_README.md` | Database update documentation |

## Troubleshooting

### conda: command not found

You need to install Miniconda or Anaconda:
```bash
# Download and install Miniconda
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh
source ~/.bashrc
```

### Environment already exists

Remove and recreate:
```bash
conda env remove -n lipdverse-db
./setup_env.sh
```

### Database connection errors

Check that MySQL is running and credentials are correct:
- Host: localhost
- User: dave
- Database: lipdverse
- Password: (as specified in scripts)

## Next Steps

After fixing the database sync issue, you can set up automatic updates:

1. **Option 1**: Modify lipdverseR (see `MODIFY_LIPDVERSER.md`)
2. **Option 2**: Set up cron job for Python script (see `UPDATE_DATABASE_README.md`)

## Need Help?

- Conda setup issues: See `CONDA_SETUP.md`
- Database update details: See `UPDATE_DATABASE_README.md`
- lipdverseR integration: See `MODIFY_LIPDVERSER.md`
