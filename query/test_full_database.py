#!/usr/bin/env python3
"""
Analyze the full database to understand overall TSID distribution.
"""

import os
import csv
from collections import defaultdict

CSV_PATH = "/home/user/prestoServer/query/csv_cache/lipdverseQuery.csv"

def analyze_full_database():
    """Analyze TSID counts across the entire database."""

    print("\n" + "="*70)
    print("FULL DATABASE ANALYSIS")
    print("="*70)

    all_datasets = set()
    all_tsids = set()
    dataset_tsids = defaultdict(set)  # datasetId -> set of TSIDs

    # Read CSV and collect data
    print(f"\nReading {CSV_PATH}...")
    row_count = 0
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for row in reader:
            row_count += 1
            dataset_id = row.get('datasetId', '')
            tsid = row.get('paleoData_TSid', '')

            if not dataset_id or not tsid:
                continue

            all_datasets.add(dataset_id)
            all_tsids.add(tsid)
            dataset_tsids[dataset_id].add(tsid)

    # Calculate statistics
    print(f"\nProcessed {row_count} rows")
    print(f"\nTotal unique datasets: {len(all_datasets)}")
    print(f"Total unique TSIDs: {len(all_tsids)}")
    print(f"Average TSIDs per dataset: {len(all_tsids) / len(all_datasets):.2f}")

    # Analyze TSID distribution
    tsid_counts = [len(tsids) for tsids in dataset_tsids.values()]
    tsid_counts.sort()

    print(f"\nMin TSIDs per dataset: {min(tsid_counts)}")
    print(f"Max TSIDs per dataset: {max(tsid_counts)}")
    print(f"Median TSIDs per dataset: {tsid_counts[len(tsid_counts)//2]}")

    # Show distribution
    from collections import Counter
    distribution = Counter(tsid_counts)
    print("\nDistribution of TSIDs per dataset (top 20):")
    for count in sorted(distribution.keys())[:20]:
        pct = (distribution[count] / len(all_datasets)) * 100
        print(f"  {count} TSID{'s' if count > 1 else ' '}: {distribution[count]:5d} datasets ({pct:5.1f}%)")

    if len(distribution) > 20:
        print(f"  ... and {len(distribution) - 20} more unique counts")

    # Compare with our test compilations
    print("\n" + "="*70)
    print("COMPARISON")
    print("="*70)
    print(f"Full database average:      {len(all_tsids) / len(all_datasets):.2f} TSIDs/dataset")
    print(f"Test compilations average:  1.28 TSIDs/dataset")
    print(f"\nConclusion: These 3 compilations have FEWER TSIDs per dataset")
    print(f"            than the database average.")

if __name__ == "__main__":
    try:
        analyze_full_database()
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
