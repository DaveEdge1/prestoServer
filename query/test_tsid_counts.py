#!/usr/bin/env python3
"""
Test script to verify TSID counts from CSV file for specific compilations.
Compares expected TSIDs from lipdverseQuery.csv with what's being returned.
"""

import os
import sys
import csv
import hashlib
import zipfile
from collections import defaultdict
from urllib.request import urlretrieve

CSV_URL = "https://lipdverse.org/lipdverse/lipdverseQuery.zip"
CACHE_DIR = "/home/user/prestoServer/query/csv_cache"
ZIP_PATH = os.path.join(CACHE_DIR, "lipdverseQuery.zip")
CSV_PATH = os.path.join(CACHE_DIR, "lipdverseQuery.csv")
MD5_PATH = os.path.join(CACHE_DIR, "lipdverseQuery.md5")

# The compilations we're testing
TEST_COMPILATIONS = [
    "Pages2kTemperature-2_2_0",
    "CoralHydro2k-1_0_0",
    "iso2k-1_1_2"
]

def download_csv():
    """Download and extract the CSV if not already cached."""
    os.makedirs(CACHE_DIR, exist_ok=True)

    # Download ZIP
    print(f"Downloading {CSV_URL}...")
    urlretrieve(CSV_URL, ZIP_PATH)

    # Extract CSV
    print(f"Extracting CSV...")
    with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
        zip_ref.extractall(CACHE_DIR)

    print(f"CSV extracted to {CSV_PATH}")

def analyze_compilations():
    """Analyze TSID counts for the test compilations."""

    if not os.path.exists(CSV_PATH):
        download_csv()

    print("\n" + "="*70)
    print("ANALYZING TSID COUNTS FROM CSV FILE")
    print("="*70)

    # Data structures to track results
    compilation_datasets = defaultdict(set)  # compilation -> set of datasetIds
    compilation_tsids = defaultdict(set)     # compilation -> set of TSIDs
    dataset_tsids = defaultdict(set)         # datasetId -> set of TSIDs

    # Read CSV and collect data
    print(f"\nReading {CSV_PATH}...")
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for row in reader:
            compilations = row.get('paleoData_mostRecentCompilations', '')
            dataset_id = row.get('datasetId', '')
            tsid = row.get('paleoData_TSid', '')

            if not compilations or not dataset_id or not tsid:
                continue

            # Check if row matches any of our test compilations
            for comp in TEST_COMPILATIONS:
                if comp in compilations:
                    compilation_datasets[comp].add(dataset_id)
                    compilation_tsids[comp].add(tsid)
                    dataset_tsids[dataset_id].add(tsid)

    # Report results for each compilation
    print("\n" + "-"*70)
    print("RESULTS BY COMPILATION")
    print("-"*70)

    total_datasets = set()
    total_tsids = set()

    for comp in TEST_COMPILATIONS:
        num_datasets = len(compilation_datasets[comp])
        num_tsids = len(compilation_tsids[comp])
        avg_tsids = num_tsids / num_datasets if num_datasets > 0 else 0

        print(f"\n{comp}:")
        print(f"  Datasets: {num_datasets}")
        print(f"  TSIDs: {num_tsids}")
        print(f"  Avg TSIDs per dataset: {avg_tsids:.2f}")

        total_datasets.update(compilation_datasets[comp])
        total_tsids.update(compilation_tsids[comp])

    # Report combined totals
    print("\n" + "-"*70)
    print("COMBINED TOTALS (all 3 compilations)")
    print("-"*70)
    print(f"Unique datasets: {len(total_datasets)}")
    print(f"Total TSIDs: {len(total_tsids)}")
    print(f"Average TSIDs per dataset: {len(total_tsids) / len(total_datasets):.2f}")

    # Analyze TSID distribution
    print("\n" + "-"*70)
    print("TSID DISTRIBUTION (for datasets in these compilations)")
    print("-"*70)

    tsid_counts = [len(tsids) for dataset_id, tsids in dataset_tsids.items()
                   if dataset_id in total_datasets]
    tsid_counts.sort()

    if tsid_counts:
        print(f"Min TSIDs per dataset: {min(tsid_counts)}")
        print(f"Max TSIDs per dataset: {max(tsid_counts)}")
        print(f"Median TSIDs per dataset: {tsid_counts[len(tsid_counts)//2]}")

        # Show distribution
        from collections import Counter
        distribution = Counter(tsid_counts)
        print("\nDistribution of TSIDs per dataset:")
        for count in sorted(distribution.keys())[:20]:  # Show first 20
            print(f"  {count} TSIDs: {distribution[count]} datasets")
        if len(distribution) > 20:
            print(f"  ... and {len(distribution) - 20} more unique counts")

    # Compare with what we're seeing
    print("\n" + "="*70)
    print("COMPARISON WITH ACTUAL RESULTS")
    print("="*70)
    print(f"Expected (from CSV): {len(total_tsids)} TSIDs from {len(total_datasets)} datasets")
    print(f"Actual (from logs):  1708 TSIDs from 1334 datasets")
    print(f"Missing TSIDs:       {len(total_tsids) - 1708}")
    print(f"Missing datasets:    {len(total_datasets) - 1334}")

    if len(total_tsids) > 1708:
        pct_missing = ((len(total_tsids) - 1708) / len(total_tsids)) * 100
        print(f"Percentage missing:  {pct_missing:.1f}%")

if __name__ == "__main__":
    try:
        analyze_compilations()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
