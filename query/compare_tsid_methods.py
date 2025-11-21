#!/usr/bin/env python3
"""
Compare TSIDs from /TS endpoint vs TSIDs from CSV for the same datasets.
This will help diagnose why we're seeing 1708 vs 2855 TSIDs.
"""

import sys
import json
import csv
import requests

# The compilations being queried
COMPILATIONS = "Pages2kTemperature-2_2_0,CoralHydro2k-1_0_0,iso2k-1_1_2"
TS_ENDPOINT = f"http://143.198.98.66:88/TS?paleoData_mostRecentCompilations={COMPILATIONS}"
CSV_PATH = "/home/user/prestoServer/query/csv_cache/lipdverseQuery.csv"

print("="*70)
print("COMPARING /TS ENDPOINT VS CSV ANALYSIS")
print("="*70)

# 1. Get TSIDs from /TS endpoint
print(f"\n1. Querying /TS endpoint...")
print(f"   URL: {TS_ENDPOINT}")
response = requests.get(TS_ENDPOINT)
ts_data = response.json()
tsids_from_endpoint = [row['paleoData_TSid'] for row in ts_data]
datasets_from_endpoint = list(set([row['datasetId'] for row in ts_data]))

print(f"   TSIDs from /TS endpoint: {len(tsids_from_endpoint)}")
print(f"   Unique datasets: {len(datasets_from_endpoint)}")
print(f"   First 5 TSIDs: {tsids_from_endpoint[:5]}")
print(f"   First 5 datasets: {datasets_from_endpoint[:5]}")

# 2. Extract TSIDs from CSV for those same datasets
print(f"\n2. Reading CSV and extracting TSIDs from those {len(datasets_from_endpoint)} datasets...")
tsids_from_csv = set()
csv_rows_for_datasets = []

with open(CSV_PATH, 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        if row['datasetId'] in datasets_from_endpoint:
            # Exclude age/year
            if row['paleoData_variableName'] not in ['age', 'year']:
                tsids_from_csv.add(row['paleoData_TSid'])
                csv_rows_for_datasets.append(row)

print(f"   TSIDs from CSV (all paleoData, no age/year): {len(tsids_from_csv)}")

# 3. Compare
print(f"\n3. COMPARISON:")
print(f"   TSIDs in /TS endpoint:     {len(tsids_from_endpoint)}")
print(f"   TSIDs in CSV (same datasets): {len(tsids_from_csv)}")
print(f"   Difference: {len(tsids_from_csv) - len(tsids_from_endpoint)}")

# 4. Find TSIDs that are in CSV but NOT in endpoint
extra_tsids = tsids_from_csv - set(tsids_from_endpoint)
print(f"\n4. TSIDs in CSV but NOT in /TS endpoint: {len(extra_tsids)}")

if extra_tsids:
    print(f"   First 10 extra TSIDs: {list(extra_tsids)[:10]}")

    # Analyze WHY these TSIDs aren't in the endpoint
    print("\n5. Analyzing extra TSIDs...")
    compilation_counts = {}
    for row in csv_rows_for_datasets:
        if row['paleoData_TSid'] in list(extra_tsids)[:10]:
            comp = row['paleoData_mostRecentCompilations']
            if comp not in compilation_counts:
                compilation_counts[comp] = []
            compilation_counts[comp].append(row['paleoData_TSid'])

    print("   Compilations for first 10 extra TSIDs:")
    for comp, tsids in compilation_counts.items():
        print(f"     {comp}: {len(tsids)} TSIDs")
        print(f"       Example TSIDs: {tsids[:3]}")

# 6. Find TSIDs in endpoint but NOT in CSV (shouldn't happen)
missing_tsids = set(tsids_from_endpoint) - tsids_from_csv
print(f"\n6. TSIDs in /TS endpoint but NOT in CSV: {len(missing_tsids)}")
if missing_tsids:
    print(f"   WARNING: This shouldn't happen! First 10: {list(missing_tsids)[:10]}")

print("\n" + "="*70)
print("CONCLUSION:")
print("="*70)
if len(tsids_from_csv) == len(tsids_from_endpoint):
    print("✓ Counts match! getLipdSmart.R logic should work correctly.")
else:
    print(f"✗ Discrepancy of {len(tsids_from_csv) - len(tsids_from_endpoint)} TSIDs")
    print("The extra TSIDs in CSV are from datasets that have TSIDs in")
    print("compilations OTHER than the 3 being queried.")
    print("\nFor SIMPLE path: We should use the /TS endpoint count (1708)")
    print("because downloading those datasets gives us all their TSIDs (2855),")
    print("which REQUIRES filtering to get just the 1708 we want.")
