#!/usr/bin/env python3
"""
Update the lipdverse MySQL database with the latest data from lipdverse.org

This script downloads the latest lipdverseQuery.csv, compares it with the current
database, and updates the MySQL query table if changes are detected.

Usage:
    python3 update_lipdverse_db.py [--force]

Options:
    --force     Force update even if MD5 hasn't changed
"""

import csv
import hashlib
import os
import sys
import urllib.request
import zipfile
from datetime import datetime

try:
    import mysql.connector
except ImportError:
    print("ERROR: mysql-connector-python not installed")
    print("Install with: pip3 install mysql-connector-python")
    sys.exit(1)

# Configuration
LIPDVERSE_URL = "https://lipdverse.org/lipdverse/lipdverseQuery.zip"
WORK_DIR = "/tmp/lipdverse_update"
ZIP_FILE = os.path.join(WORK_DIR, "lipdverseQuery.zip")
CSV_FILE = os.path.join(WORK_DIR, "lipdverseQuery.csv")
MD5_FILE = "/home/user/prestoServer/query/lipdverseQuery.md5"

# MySQL Configuration
DB_CONFIG = {
    'host': 'localhost',
    'user': 'dave',
    'password': 'peb0pk0q',
    'database': 'lipdverse',
    'allow_local_infile': True
}

def calculate_md5(filepath):
    """Calculate MD5 hash of a file"""
    hash_md5 = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def download_file(url, dest):
    """Download a file with progress indicator"""
    print(f"Downloading {url}...")
    try:
        urllib.request.urlretrieve(url, dest)
        print(f"✓ Downloaded to {dest}")
        return True
    except Exception as e:
        print(f"✗ Download failed: {e}")
        return False

def extract_zip(zip_path, extract_to):
    """Extract ZIP file"""
    print(f"Extracting {zip_path}...")
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_to)
        print(f"✓ Extracted to {extract_to}")
        return True
    except Exception as e:
        print(f"✗ Extraction failed: {e}")
        return False

def get_stored_md5():
    """Get the previously stored MD5 hash"""
    if os.path.exists(MD5_FILE):
        with open(MD5_FILE, 'r') as f:
            return f.read().strip()
    return None

def save_md5(md5_hash):
    """Save MD5 hash to file"""
    with open(MD5_FILE, 'w') as f:
        f.write(md5_hash)

def count_csv_rows(csv_path):
    """Count rows in CSV file"""
    with open(csv_path, 'r', encoding='utf-8') as f:
        return sum(1 for line in f) - 1  # Subtract header

def update_database(csv_path):
    """Update MySQL database from CSV file"""
    print("\nConnecting to MySQL database...")

    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Get current row count
        cursor.execute("SELECT COUNT(*) FROM query")
        old_count = cursor.fetchone()[0]
        print(f"Current database has {old_count} rows")

        # Count new CSV rows
        new_count = count_csv_rows(csv_path)
        print(f"New CSV file has {new_count} rows")

        if new_count == 0:
            print("✗ CSV file is empty, aborting update")
            return False

        # Backup approach: Truncate and reload
        print("\nTruncating query table...")
        cursor.execute("TRUNCATE TABLE query")
        conn.commit()
        print("✓ Table truncated")

        # Load new data
        print(f"Loading data from {csv_path}...")

        # Use LOAD DATA LOCAL INFILE for fast bulk insert
        load_query = f"""
        LOAD DATA LOCAL INFILE '{csv_path}'
        INTO TABLE query
        FIELDS TERMINATED BY ','
        ENCLOSED BY '"'
        LINES TERMINATED BY '\\n'
        IGNORE 1 ROWS
        """

        try:
            cursor.execute(load_query)
            conn.commit()

            # Verify the load
            cursor.execute("SELECT COUNT(*) FROM query")
            final_count = cursor.fetchone()[0]

            print(f"✓ Data loaded successfully")
            print(f"  Old count: {old_count}")
            print(f"  New count: {final_count}")
            print(f"  Difference: {final_count - old_count:+d}")

            # Show sample of compilations
            cursor.execute("""
                SELECT paleoData_mostRecentCompilations, COUNT(*) as count
                FROM query
                WHERE paleoData_mostRecentCompilations LIKE '%Pages2kTemperature%'
                GROUP BY paleoData_mostRecentCompilations
                ORDER BY paleoData_mostRecentCompilations
            """)

            print("\nPages2kTemperature versions in database:")
            for row in cursor.fetchall():
                print(f"  {row[0]}: {row[1]} records")

            return True

        except mysql.connector.Error as err:
            print(f"✗ LOAD DATA failed: {err}")
            print("\nTrying alternative insert method...")

            # Fallback: Row-by-row insert (slower but more compatible)
            return insert_csv_rows(cursor, conn, csv_path)

    except mysql.connector.Error as err:
        print(f"✗ Database error: {err}")
        return False
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

def insert_csv_rows(cursor, conn, csv_path):
    """Insert CSV rows one by one (fallback method)"""
    print("Using row-by-row insert (this may take a while)...")

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        columns = reader.fieldnames

        # Build INSERT query
        placeholders = ', '.join(['%s'] * len(columns))
        insert_query = f"INSERT INTO query ({', '.join(columns)}) VALUES ({placeholders})"

        batch = []
        batch_size = 1000
        total_inserted = 0

        for row in reader:
            values = [row[col] for col in columns]
            batch.append(values)

            if len(batch) >= batch_size:
                cursor.executemany(insert_query, batch)
                conn.commit()
                total_inserted += len(batch)
                print(f"  Inserted {total_inserted} rows...", end='\r')
                batch = []

        # Insert remaining rows
        if batch:
            cursor.executemany(insert_query, batch)
            conn.commit()
            total_inserted += len(batch)

        print(f"\n✓ Inserted {total_inserted} rows total")
        return True

def main():
    """Main execution function"""
    force_update = '--force' in sys.argv

    print("=" * 60)
    print("LiPDverse Database Update Script")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Create work directory
    os.makedirs(WORK_DIR, exist_ok=True)

    # Download ZIP file
    if not download_file(LIPDVERSE_URL, ZIP_FILE):
        sys.exit(1)

    # Extract CSV
    if not extract_zip(ZIP_FILE, WORK_DIR):
        sys.exit(1)

    # Check if CSV exists
    if not os.path.exists(CSV_FILE):
        print(f"✗ CSV file not found at {CSV_FILE}")
        sys.exit(1)

    # Calculate MD5
    new_md5 = calculate_md5(CSV_FILE)
    old_md5 = get_stored_md5()

    print(f"\nMD5 Comparison:")
    print(f"  Previous: {old_md5 or 'None'}")
    print(f"  Current:  {new_md5}")

    if new_md5 == old_md5 and not force_update:
        print("\n✓ Database is already up to date (MD5 match)")
        print("  Use --force to update anyway")
        sys.exit(0)

    if force_update:
        print("\n⚠ Force update requested")
    else:
        print("\n→ MD5 changed, updating database...")

    # Update database
    if update_database(CSV_FILE):
        # Save new MD5
        save_md5(new_md5)
        print(f"\n✓ MD5 hash saved to {MD5_FILE}")
        print("\n" + "=" * 60)
        print("✓ Update completed successfully!")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("✗ Update failed")
        print("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    main()
