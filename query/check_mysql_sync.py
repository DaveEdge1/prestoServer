#!/usr/bin/env python3
"""
Compare MySQL dataSetQuery table with the CSV file to find missing datasets

Usage:
    python3 check_mysql_sync.py
"""

import csv
import sys

try:
    import mysql.connector
except ImportError:
    print("ERROR: mysql-connector-python not installed")
    print("Install with: pip3 install mysql-connector-python")
    sys.exit(1)

# MySQL Configuration
DB_CONFIG = {
    'host': 'localhost',
    'user': 'dave',
    'password': 'peb0pk0q',
    'database': 'lipdverse'
}

CSV_FILE = '/tmp/lipdverseQuery.csv'
TARGET_COMPILATIONS = ['Pages2kTemperature-2_2_0', 'CoralHydro2k-1_0_0', 'iso2k-1_1_2']

def get_csv_datasets():
    """Get dataset IDs from CSV file for target compilations"""
    datasets = set()

    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            comp_field = row.get('paleoData_mostRecentCompilations', '')

            # Check if any target compilation is in this record
            if any(target in comp_field for target in TARGET_COMPILATIONS):
                dataset_id = row.get('datasetId', '')
                if dataset_id:
                    datasets.add(dataset_id)

    return datasets

def get_mysql_datasets():
    """Get dataset IDs from MySQL dataSetQuery table for target compilations"""
    datasets = set()

    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Build WHERE clause matching the Express app logic
        conditions = []
        for comp in TARGET_COMPILATIONS:
            conditions.append(f"paleoData_mostRecentCompilations LIKE '%{comp}%'")

        where_clause = " OR ".join(conditions)
        query = f"SELECT datasetId FROM dataSetQuery WHERE ({where_clause})"

        print(f"Executing query:\n{query}\n")

        cursor.execute(query)
        for (dataset_id,) in cursor:
            if dataset_id:
                datasets.add(dataset_id)

        cursor.close()
        conn.close()

    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        sys.exit(1)

    return datasets

def check_table_exists():
    """Check if dataSetQuery table exists and has data"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Check if table exists
        cursor.execute("SHOW TABLES LIKE 'dataSetQuery'")
        if not cursor.fetchone():
            print("ERROR: dataSetQuery table does not exist!")
            return False

        # Check row count
        cursor.execute("SELECT COUNT(*) FROM dataSetQuery")
        count = cursor.fetchone()[0]
        print(f"dataSetQuery table has {count} rows\n")

        cursor.close()
        conn.close()
        return True

    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        return False

def main():
    print("=" * 70)
    print("MySQL Database Sync Check")
    print("=" * 70)

    # Check if table exists
    if not check_table_exists():
        sys.exit(1)

    # Get datasets from CSV
    print("Reading CSV file...")
    csv_datasets = get_csv_datasets()
    print(f"✓ Found {len(csv_datasets)} unique datasets in CSV\n")

    # Get datasets from MySQL
    print("Querying MySQL database...")
    mysql_datasets = get_mysql_datasets()
    print(f"✓ Found {len(mysql_datasets)} unique datasets in MySQL\n")

    # Compare
    print("=" * 70)
    print("COMPARISON RESULTS")
    print("=" * 70)

    missing_in_mysql = csv_datasets - mysql_datasets
    extra_in_mysql = mysql_datasets - csv_datasets

    print(f"Datasets in CSV:   {len(csv_datasets)}")
    print(f"Datasets in MySQL: {len(mysql_datasets)}")
    print(f"Missing in MySQL:  {len(missing_in_mysql)}")
    print(f"Extra in MySQL:    {len(extra_in_mysql)}")

    if len(missing_in_mysql) > 0:
        print(f"\n⚠ WARNING: {len(missing_in_mysql)} datasets are missing from MySQL!")
        print("\nFirst 10 missing datasets:")
        for i, dataset_id in enumerate(list(missing_in_mysql)[:10], 1):
            # Get dataset name from CSV
            with open(CSV_FILE, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get('datasetId') == dataset_id:
                        print(f"  {i}. {dataset_id} - {row.get('dataSetName', 'Unknown')}")
                        break

        if len(missing_in_mysql) > 10:
            print(f"  ... and {len(missing_in_mysql) - 10} more")

        print(f"\n→ SOLUTION: Run the database update script to sync MySQL with CSV:")
        print(f"   python3 /home/user/prestoServer/query/update_lipdverse_db.py")
        print(f"\n   OR modify lipdverseR's updateSqlQuery() function as documented in:")
        print(f"   /home/user/prestoServer/MODIFY_LIPDVERSER.md")

    elif len(extra_in_mysql) > 0:
        print(f"\n⚠ MySQL has {len(extra_in_mysql)} extra datasets not in CSV")
        print("   This might indicate the CSV is outdated")

    else:
        print("\n✓ MySQL database is perfectly in sync with CSV file!")

    print("\n" + "=" * 70)

if __name__ == "__main__":
    main()
