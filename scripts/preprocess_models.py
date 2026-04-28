#!/usr/bin/env python3
"""
Pre-process Holocene DA model data at common resolutions.

Downloads original model data from Zenodo (or uses a local path),
runs process_models() for each resolution/model combination, and
produces the _regrid NetCDF files needed by the GitHub Actions workflow.

Usage:
  python preprocess_models.py [--data-dir /path/to/extracted/zenodo] [--output-dir ./processed]

If --data-dir is not provided, downloads holocene_da_data.zip from Zenodo.

Output files are named: {model}_regrid.21999-0BP.tas.timeres_{res}.nc
Upload them as GitHub Release assets:
  gh release create model-data-v1 --repo DaveEdge1/presto-holocene_da --title "Pre-processed model data"
  gh release upload model-data-v1 --repo DaveEdge1/presto-holocene_da processed/*.nc
"""

import argparse
import os
import sys
import subprocess
import zipfile
import shutil

# Common resolutions to pre-process
RESOLUTIONS = [10, 20, 50, 100, 200, 500, 1000]
MODELS = ['hadcm3', 'trace']
VARIABLES = ['tas']
AGE_RANGE = [0, 22000]
ZENODO_URL = "https://zenodo.org/records/7407116/files/holocene_da_data.zip?download=1"


def download_zenodo(dest_dir):
    """Download and extract model data from Zenodo."""
    zip_path = os.path.join(dest_dir, 'holocene_da_data.zip')
    if not os.path.exists(zip_path):
        print(f"Downloading Zenodo archive to {zip_path} (~10.6 GB)...")
        subprocess.run(['curl', '-L', '-o', zip_path, ZENODO_URL], check=True)
    else:
        print(f"Using existing archive: {zip_path}")

    print("Extracting model data (models/original_model_data/)...")
    with zipfile.ZipFile(zip_path, 'r') as zf:
        for member in zf.namelist():
            if member.startswith('models/original_model_data/'):
                zf.extract(member, dest_dir)
    print("Extraction complete.")
    return dest_dir


def main():
    parser = argparse.ArgumentParser(description='Pre-process Holocene DA model data')
    parser.add_argument('--data-dir', type=str, default=None,
                        help='Path to extracted Zenodo data (contains models/original_model_data/). '
                             'If not provided, downloads from Zenodo.')
    parser.add_argument('--output-dir', type=str, default='./processed',
                        help='Output directory for processed NetCDF files')
    parser.add_argument('--resolutions', type=int, nargs='+', default=RESOLUTIONS,
                        help=f'Resolutions to process (default: {RESOLUTIONS})')
    args = parser.parse_args()

    output_dir = os.path.abspath(args.output_dir)
    os.makedirs(output_dir, exist_ok=True)

    # Get data directory
    if args.data_dir:
        data_dir = os.path.abspath(args.data_dir)
    else:
        data_dir = os.path.abspath('./zenodo_download')
        os.makedirs(data_dir, exist_ok=True)
        download_zenodo(data_dir)

    original_model_dir = os.path.join(data_dir, 'models', 'original_model_data') + '/'
    if not os.path.exists(original_model_dir):
        print(f"ERROR: Original model data not found at {original_model_dir}")
        sys.exit(1)

    print(f"Original model data: {original_model_dir}")
    print(f"Output directory: {output_dir}")
    print(f"Resolutions: {args.resolutions}")
    print(f"Models: {MODELS}")
    print()

    # Add the upstream Holocene-code to the path so we can import da_load_models
    # We need da_utils for the regridding step, so clone the repo if needed
    holocene_code_dir = os.path.join(data_dir, 'Holocene-code')
    if not os.path.exists(holocene_code_dir):
        print("Cloning Holocene-Reconstruction/Holocene-code for processing functions...")
        subprocess.run([
            'git', 'clone', 'https://github.com/Holocene-Reconstruction/Holocene-code.git',
            holocene_code_dir
        ], check=True)

    sys.path.insert(0, holocene_code_dir)
    import da_load_models

    total = len(args.resolutions) * len(MODELS) * len(VARIABLES)
    count = 0
    for res in args.resolutions:
        for model in MODELS:
            for var in VARIABLES:
                count += 1
                regrid_name = f"{model}_regrid"
                filename = f"{regrid_name}.21999-0BP.{var}.timeres_{res}.nc"
                filepath = os.path.join(output_dir, filename)

                if os.path.exists(filepath):
                    print(f"[{count}/{total}] SKIP (exists): {filename}")
                    continue

                print(f"[{count}/{total}] Processing: {filename}")
                print(f"  Model: {model}, Variable: {var}, Resolution: {res}yr, Age range: {AGE_RANGE}")

                try:
                    # process_models writes both native and _regrid files to output_dir
                    da_load_models.process_models(
                        model_name=regrid_name,  # _regrid suffix gets stripped inside
                        var_name=var,
                        time_resolution=res,
                        age_range=AGE_RANGE,
                        output_dir=output_dir + '/',
                        original_model_dir=original_model_dir
                    )

                    # Remove the native-grid file (we only need _regrid)
                    native_filename = f"{model}.21999-0BP.{var}.timeres_{res}.nc"
                    native_path = os.path.join(output_dir, native_filename)
                    if os.path.exists(native_path):
                        os.remove(native_path)
                        print(f"  Removed native-grid file: {native_filename}")

                    if os.path.exists(filepath):
                        size_mb = os.path.getsize(filepath) / (1024 * 1024)
                        print(f"  Created: {filename} ({size_mb:.1f} MB)")
                    else:
                        print(f"  WARNING: Expected file not created: {filename}")

                except Exception as e:
                    print(f"  ERROR processing {filename}: {e}")
                    import traceback
                    traceback.print_exc()

    print("\n=== Done ===")
    print(f"Output files in: {output_dir}")
    for f in sorted(os.listdir(output_dir)):
        if f.endswith('.nc'):
            size_mb = os.path.getsize(os.path.join(output_dir, f)) / (1024 * 1024)
            print(f"  {f} ({size_mb:.1f} MB)")

    print("\nTo upload as GitHub Release assets:")
    print(f"  gh release create model-data-v1 --repo DaveEdge1/presto-holocene_da --title 'Pre-processed model data v1'")
    print(f"  gh release upload model-data-v1 --repo DaveEdge1/presto-holocene_da {output_dir}/*.nc")


if __name__ == '__main__':
    main()
