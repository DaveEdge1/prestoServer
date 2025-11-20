#!/usr/bin/env python3
"""
Verify the final output from the query/download form.
Checks TSIDs.json, datasetIds.json, and lipd_files.zip
"""

import json
import os
import sys
import zipfile
from urllib.request import urlretrieve

BASE_URL = "http://143.198.98.66:83/customRecons/1763585788448185_download"
OUTPUT_DIR = "/home/user/prestoServer/query/verification_output"

# Expected values from our analysis
EXPECTED_DATASETS = 1334
EXPECTED_TSIDS = 1708

def download_and_verify():
    """Download and verify all output files."""

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("="*70)
    print("VERIFYING FINAL OUTPUT FROM QUERY/DOWNLOAD FORM")
    print("="*70)

    # Download and verify TSIDs.json
    print("\n" + "-"*70)
    print("1. VERIFYING TSIDs.json")
    print("-"*70)

    tsids_url = f"{BASE_URL}/TSIDs.json"
    tsids_path = os.path.join(OUTPUT_DIR, "TSIDs.json")

    try:
        print(f"Downloading {tsids_url}...")
        urlretrieve(tsids_url, tsids_path)

        with open(tsids_path, 'r') as f:
            tsids_data = json.load(f)

        if isinstance(tsids_data, dict) and 'TSIDs' in tsids_data:
            tsids_list = tsids_data['TSIDs']
        elif isinstance(tsids_data, list):
            tsids_list = tsids_data
        else:
            tsids_list = []

        num_tsids = len(tsids_list)
        print(f"✓ Downloaded successfully")
        print(f"  Number of TSIDs: {num_tsids}")
        print(f"  Expected: {EXPECTED_TSIDS}")

        if num_tsids == EXPECTED_TSIDS:
            print(f"  ✓ MATCH! Correct number of TSIDs")
        else:
            print(f"  ✗ MISMATCH! Off by {abs(num_tsids - EXPECTED_TSIDS)}")

        # Show sample TSIDs
        if num_tsids > 0:
            print(f"\n  Sample TSIDs (first 5):")
            for tsid in tsids_list[:5]:
                print(f"    - {tsid}")

    except Exception as e:
        print(f"✗ ERROR: {e}")
        num_tsids = None

    # Download and verify datasetIds.json
    print("\n" + "-"*70)
    print("2. VERIFYING datasetIds.json")
    print("-"*70)

    datasets_url = f"{BASE_URL}/datasetIds.json"
    datasets_path = os.path.join(OUTPUT_DIR, "datasetIds.json")

    try:
        print(f"Downloading {datasets_url}...")
        urlretrieve(datasets_url, datasets_path)

        with open(datasets_path, 'r') as f:
            datasets_data = json.load(f)

        if isinstance(datasets_data, dict) and 'datasetIds' in datasets_data:
            datasets_list = datasets_data['datasetIds']
        elif isinstance(datasets_data, list):
            datasets_list = datasets_data
        else:
            datasets_list = []

        num_datasets = len(datasets_list)
        print(f"✓ Downloaded successfully")
        print(f"  Number of Dataset IDs: {num_datasets}")
        print(f"  Expected: {EXPECTED_DATASETS}")

        if num_datasets == EXPECTED_DATASETS:
            print(f"  ✓ MATCH! Correct number of datasets")
        else:
            print(f"  ✗ MISMATCH! Off by {abs(num_datasets - EXPECTED_DATASETS)}")

        # Check for duplicates
        unique_datasets = len(set(datasets_list))
        if unique_datasets == num_datasets:
            print(f"  ✓ All dataset IDs are unique")
        else:
            print(f"  ✗ WARNING: {num_datasets - unique_datasets} duplicate dataset IDs")

        # Show sample dataset IDs
        if num_datasets > 0:
            print(f"\n  Sample Dataset IDs (first 5):")
            for ds_id in datasets_list[:5]:
                print(f"    - {ds_id}")

    except Exception as e:
        print(f"✗ ERROR: {e}")
        num_datasets = None

    # Download and verify lipd_files.zip
    print("\n" + "-"*70)
    print("3. VERIFYING lipd_files.zip")
    print("-"*70)

    zip_url = f"{BASE_URL}/lipd_files.zip"
    zip_path = os.path.join(OUTPUT_DIR, "lipd_files.zip")

    try:
        print(f"Downloading {zip_url}...")
        urlretrieve(zip_url, zip_path)

        file_size_mb = os.path.getsize(zip_path) / (1024 * 1024)
        print(f"✓ Downloaded successfully")
        print(f"  File size: {file_size_mb:.2f} MB")

        # Open and analyze the ZIP
        with zipfile.ZipFile(zip_path, 'r') as zf:
            file_list = zf.namelist()
            lipd_files = [f for f in file_list if f.endswith('.lpd')]

            num_lipd_files = len(lipd_files)
            print(f"  Number of .lpd files: {num_lipd_files}")
            print(f"  Expected (matching datasets): {EXPECTED_DATASETS}")

            if num_lipd_files == EXPECTED_DATASETS:
                print(f"  ✓ MATCH! One LiPD file per dataset")
            else:
                print(f"  ✗ MISMATCH! Off by {abs(num_lipd_files - EXPECTED_DATASETS)}")

            # Check for other files
            other_files = [f for f in file_list if not f.endswith('.lpd')]
            if other_files:
                print(f"  Other files in ZIP: {len(other_files)}")
                for f in other_files[:5]:
                    print(f"    - {f}")

            # Show sample LiPD files
            if num_lipd_files > 0:
                print(f"\n  Sample LiPD files (first 5):")
                for lpd in lipd_files[:5]:
                    print(f"    - {lpd}")

    except Exception as e:
        print(f"✗ ERROR: {e}")
        num_lipd_files = None

    # Final summary
    print("\n" + "="*70)
    print("VERIFICATION SUMMARY")
    print("="*70)

    summary = []
    if num_tsids is not None:
        status = "✓" if num_tsids == EXPECTED_TSIDS else "✗"
        summary.append(f"{status} TSIDs: {num_tsids} (expected {EXPECTED_TSIDS})")

    if num_datasets is not None:
        status = "✓" if num_datasets == EXPECTED_DATASETS else "✗"
        summary.append(f"{status} Datasets: {num_datasets} (expected {EXPECTED_DATASETS})")

    if num_lipd_files is not None:
        status = "✓" if num_lipd_files == EXPECTED_DATASETS else "✗"
        summary.append(f"{status} LiPD files: {num_lipd_files} (expected {EXPECTED_DATASETS})")

    for line in summary:
        print(line)

    # Overall status
    all_match = (
        num_tsids == EXPECTED_TSIDS and
        num_datasets == EXPECTED_DATASETS and
        num_lipd_files == EXPECTED_DATASETS
    )

    print("\n" + "-"*70)
    if all_match:
        print("✓✓✓ ALL VERIFICATIONS PASSED ✓✓✓")
        print("The system is working correctly!")
    else:
        print("✗✗✗ SOME VERIFICATIONS FAILED ✗✗✗")
        print("Please review the mismatches above.")
    print("-"*70)

if __name__ == "__main__":
    try:
        download_and_verify()
    except Exception as e:
        print(f"FATAL ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
