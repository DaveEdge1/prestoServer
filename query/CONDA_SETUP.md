# Conda Environment Setup for LiPDverse Database Tools

## Create the Conda Environment

```bash
cd /home/user/prestoServer/query

# Create the environment from the YAML file
conda env create -f environment.yml

# Or if you prefer to create it manually:
conda create -n lipdverse-db python=3.10 -y
conda activate lipdverse-db
pip install mysql-connector-python
```

## Activate the Environment

```bash
conda activate lipdverse-db
```

## Run the Scripts

### Check Database Sync Status

```bash
conda activate lipdverse-db
python check_mysql_sync.py
```

### Update Database from CSV

```bash
conda activate lipdverse-db
python update_lipdverse_db.py
```

## Deactivate When Done

```bash
conda deactivate
```

## Update the Environment

If you need to add more packages later:

```bash
conda activate lipdverse-db
pip install <package-name>
```

Or update the environment.yml and recreate:

```bash
conda env update -f environment.yml --prune
```

## Remove the Environment

If you need to start over:

```bash
conda env remove -n lipdverse-db
```

## Troubleshooting

### Error: conda: command not found

Make sure conda is installed and in your PATH:

```bash
# Check if conda is installed
which conda

# If not found, you may need to initialize conda for your shell
conda init bash
# Then restart your shell or run:
source ~/.bashrc
```

### Error: Environment already exists

If the environment already exists, remove it first:

```bash
conda env remove -n lipdverse-db
conda env create -f environment.yml
```

### Alternative: Use system pip

If you don't want to use conda, you can install with pip in a virtual environment:

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
