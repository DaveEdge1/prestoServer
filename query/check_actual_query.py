#!/usr/bin/env python3
"""
Check what the MySQL query actually returns vs what the CSV has

This will query MySQL with the exact same query as the web form
"""

import os
import sys

try:
    import mysql.connector
except ImportError:
    print("ERROR: mysql-connector-python not installed")
    print("Run: conda activate lipdverse-db")
    sys.exit(1)

# MySQL Configuration
DB_CONFIG = {
    'host': os.environ.get('MYSQL_HOST', 'localhost'),
    'user': os.environ.get('MYSQL_USER', 'dave'),
    'password': os.environ['MYSQL_PASSWORD'],
    'database': os.environ.get('MYSQL_DATABASE', 'lipdverse')
}

TARGET_COMPILATIONS = ['Pages2kTemperature-2_2_0', 'CoralHydro2k-1_0_0', 'iso2k-1_1_2']

print("=" * 70)
print("Checking actual MySQL query results")
print("=" * 70)

try:
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)

    # Build the exact query the web form uses
    conditions = []
    for comp in TARGET_COMPILATIONS:
        conditions.append(f"paleoData_mostRecentCompilations LIKE '%{comp}%'")

    where_clause = " OR ".join(conditions)

    # Query dataSetQuery table (what the web form queries)
    query = f"""
        SELECT datasetId, dataSetName, geo_latitude, geo_longitude,
               paleoData_mostRecentCompilations
        FROM dataSetQuery
        WHERE ({where_clause})
    """

    print(f"\nExecuting query:\n{query}\n")

    cursor.execute(query)
    results = cursor.fetchall()

    print(f"✓ MySQL returned {len(results)} datasets\n")

    # Analyze the coordinates
    valid_coords = 0
    invalid_coords = 0
    at_boundary = 0
    strictly_inside = 0

    boundary_examples = []
    invalid_examples = []

    for row in results:
        try:
            lat = float(row['geo_latitude'])
            lon = float(row['geo_longitude'])
            valid_coords += 1

            # Check using the STRICT inequality from chooseOpacity
            # if (+pointLat > +rect1.South && +pointLat < +rect1.North &&
            #     +pointLon > +rect1.West && +pointLon < +rect1.East)
            if lat > -90 and lat < 90 and lon > -180 and lon < 180:
                strictly_inside += 1
            else:
                at_boundary += 1
                if len(boundary_examples) < 5:
                    boundary_examples.append({
                        'id': row['datasetId'],
                        'name': row['dataSetName'],
                        'lat': lat,
                        'lon': lon
                    })

        except (ValueError, TypeError) as e:
            invalid_coords += 1
            if len(invalid_examples) < 5:
                invalid_examples.append({
                    'id': row['datasetId'],
                    'name': row['dataSetName'],
                    'lat': row['geo_latitude'],
                    'lon': row['geo_longitude'],
                    'error': str(e)
                })

    print("=" * 70)
    print("COORDINATE ANALYSIS")
    print("=" * 70)
    print(f"Total datasets:           {len(results)}")
    print(f"Valid coordinates:        {valid_coords}")
    print(f"Invalid coordinates:      {invalid_coords}")
    print(f"Strictly inside rect:     {strictly_inside}")
    print(f"At/outside boundary:      {at_boundary}")
    print()

    if strictly_inside == 1062:
        print(f"✓ Strictly inside count ({strictly_inside}) matches UI count (1062)!")
        print(f"\nThe issue: {at_boundary} datasets are at or outside the strict boundaries")
        print(f"  (lat > -90 AND lat < 90 AND lon > -180 AND lon < 180)")
    else:
        print(f"? Strictly inside count ({strictly_inside}) doesn't match UI (1062)")

    if boundary_examples:
        print(f"\n--- Examples of datasets at/outside boundary ---")
        for ex in boundary_examples:
            print(f"  {ex['id']}: {ex['name']}")
            print(f"    Coordinates: ({ex['lat']}, {ex['lon']})")

    if invalid_examples:
        print(f"\n--- Examples of datasets with invalid coordinates ---")
        for ex in invalid_examples:
            print(f"  {ex['id']}: {ex['name']}")
            print(f"    Coordinates: ({ex['lat']}, {ex['lon']})")
            print(f"    Error: {ex['error']}")

    cursor.close()
    conn.close()

except mysql.connector.Error as err:
    print(f"Database error: {err}")
    sys.exit(1)

print("\n" + "=" * 70)
