#!/usr/bin/env python3
"""
Generate LiPD data for LMR reconstruction based on query parameters.

Usage: python generate.py <query_params_json> <output_dir> [format]

format: lpd | pickle | all (default: all)
  lpd     -> *.lpd files + lipd_files.zip
  pickle  -> *.lpd files + lipd.pkl (CFR format) + lipd_legacy.pkl
  all     -> everything above (default)
"""

import sys
import os
import json
import re
import io
import glob
import zipfile
import pickle

import requests
import pandas as pd
import numpy as np
import lipd as lipd_lib

QUERY_CSV_URL = "https://lipdverse.org/lipdverse/lipdverseQuery.zip"


# ---------------------------------------------------------------------------
# Step 1: Download and filter lipdverse metadata
# ---------------------------------------------------------------------------

def download_query_csv():
    print(f"Downloading lipdverse metadata from {QUERY_CSV_URL} ...")
    resp = requests.get(QUERY_CSV_URL, timeout=180)
    resp.raise_for_status()
    zf = zipfile.ZipFile(io.BytesIO(resp.content))
    with zf.open(zf.namelist()[0]) as f:
        df = pd.read_csv(f)
    print(f"Loaded {len(df)} time series records")
    return df


def filter_datasets(df, query_params):
    mask = pd.Series(True, index=df.index)

    coords = query_params.get('coords')
    if coords and len(coords) == 4:
        lat_min, lat_max, lon_min, lon_max = coords
        mask &= (df['geo_latitude'] >= lat_min) & (df['geo_latitude'] <= lat_max)
        mask &= (df['geo_longitude'] >= lon_min) & (df['geo_longitude'] <= lon_max)
        print(f"Coord filter: lat [{lat_min}, {lat_max}], lon [{lon_min}, {lon_max}]")

    archive_types = query_params.get('archiveTypes')
    if archive_types:
        if isinstance(archive_types, str):
            archive_types = [archive_types]
        pattern = '|'.join(re.escape(a) for a in archive_types)
        mask &= df['archiveType'].str.contains(pattern, case=False, na=False)
        print(f"Archive type filter: {archive_types}")

    variable_name = query_params.get('variableName')
    if variable_name:
        mask &= df['paleoData_variableName'].str.contains(variable_name, case=False, na=False)
        print(f"Variable name filter: {variable_name}")

    compilation = query_params.get('compilation')
    if compilation:
        mask &= df['paleoData_mostRecentCompilations'].str.contains(compilation, case=False, na=False)
        print(f"Compilation filter: {compilation}")

    filtered = df[mask]
    n_datasets = filtered['datasetId'].nunique()
    print(f"Filter result: {len(filtered)} time series across {n_datasets} datasets")
    if n_datasets == 0:
        raise RuntimeError("No datasets match the query parameters")
    return filtered


# ---------------------------------------------------------------------------
# Step 2: Download .lpd files
# ---------------------------------------------------------------------------

def build_urls(filtered_df):
    datasets = filtered_df[['datasetId', 'datasetVersion']].drop_duplicates()
    urls = []
    for _, row in datasets.iterrows():
        ver = str(row['datasetVersion']).replace('.', '_')
        url = f"https://lipdverse.org/data/{row['datasetId']}/{ver}/lipd.lpd"
        urls.append((str(row['datasetId']), url))
    return urls


def download_lpd_files(urls, output_dir):
    downloaded = 0
    for dataset_id, url in urls:
        fname = os.path.join(output_dir, f"{dataset_id}.lpd")
        try:
            resp = requests.get(url, timeout=60)
            resp.raise_for_status()
            with open(fname, 'wb') as f:
                f.write(resp.content)
            downloaded += 1
        except Exception as e:
            print(f"Warning: failed to download {dataset_id}: {e}")
    print(f"Downloaded {downloaded}/{len(urls)} .lpd files")
    if downloaded == 0:
        raise RuntimeError("Failed to download any .lpd files")
    return downloaded


# ---------------------------------------------------------------------------
# Step 3: Zip
# ---------------------------------------------------------------------------

def create_zip(output_dir):
    lpd_files = glob.glob(os.path.join(output_dir, '*.lpd'))
    zip_path = os.path.join(output_dir, 'lipd_files.zip')
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in lpd_files:
            zf.write(f, os.path.basename(f))
    print(f"Created {zip_path} with {len(lpd_files)} files")


# ---------------------------------------------------------------------------
# Step 4: Load .lpd files and create pickles
# ---------------------------------------------------------------------------

def _is_numeric_array(val):
    if val is None:
        return False
    if np.isscalar(val):
        return not pd.isna(val)
    try:
        arr = np.array(val, dtype=float)
        return len(arr) > 0 and not np.all(np.isnan(arr))
    except (ValueError, TypeError):
        return False


def create_pickles(output_dir):
    print("\nLoading .lpd files with lipd library...")
    D = lipd_lib.readLipd(output_dir + "/")

    TS = lipd_lib.extractTs(D)
    print(f"Extracted {len(TS)} time series objects")

    df = pd.DataFrame(TS)
    print(f"DataFrame shape: {df.shape}")
    initial_count = len(df)

    dataset_col = 'dataSetName' if 'dataSetName' in df.columns else 'datasetId'

    # Drop entire datasets missing critical metadata
    if dataset_col in df.columns:
        datasets_missing_proxy = set()
        datasets_missing_archive = set()

        if 'paleoData_proxy' in df.columns and 'paleoData_variableName' in df.columns:
            auxiliary_vars = ['age', 'year', 'depth']
            for dataset in df[dataset_col].unique():
                proxy_records = df[
                    (df[dataset_col] == dataset) &
                    (~df['paleoData_variableName'].isin(auxiliary_vars))
                ]
                if len(proxy_records) > 0 and proxy_records['paleoData_proxy'].isna().all():
                    datasets_missing_proxy.add(dataset)

        if 'archiveType' in df.columns:
            for dataset in df[dataset_col].unique():
                if df[df[dataset_col] == dataset]['archiveType'].isna().all():
                    datasets_missing_archive.add(dataset)

        datasets_to_drop = datasets_missing_proxy | datasets_missing_archive
        if datasets_to_drop:
            print(f"Dropping {len(datasets_to_drop)} datasets missing critical metadata "
                  f"({len(datasets_missing_proxy)} missing proxy, "
                  f"{len(datasets_missing_archive)} missing archiveType)")
            df = df[~df[dataset_col].isin(datasets_to_drop)].copy()

    # Forward-fill proxy/archiveType within each dataset
    if dataset_col in df.columns:
        for col in ['paleoData_proxy', 'archiveType']:
            if col in df.columns:
                df[col] = df.groupby(dataset_col)[col].transform(lambda x: x.ffill().bfill())

    # Handle paleoData_pages2kID at dataset level
    if dataset_col in df.columns:
        if 'paleoData_pages2kID' in df.columns:
            dataset_pages2k_map = df.groupby(dataset_col)['paleoData_pages2kID'].first()
            missing = dataset_pages2k_map[dataset_pages2k_map.isna()].index
            if len(missing) > 0:
                print(f"Creating fallback pages2kIDs for {len(missing)} datasets")
                if 'datasetId' in df.columns:
                    for name in missing:
                        dataset_pages2k_map[name] = df[df[dataset_col] == name]['datasetId'].iloc[0]
                elif 'paleoData_TSid' in df.columns:
                    for name in missing:
                        dataset_pages2k_map[name] = df[df[dataset_col] == name]['paleoData_TSid'].iloc[0]
                else:
                    for i, name in enumerate(missing):
                        dataset_pages2k_map[name] = f'unknown_{i}'
            df['paleoData_pages2kID'] = df[dataset_col].map(dataset_pages2k_map)
        else:
            print("paleoData_pages2kID missing, creating from datasetId or dataSetName")
            if 'datasetId' in df.columns:
                id_map = df.groupby(dataset_col)['datasetId'].first()
                df['paleoData_pages2kID'] = df[dataset_col].map(id_map)
            else:
                df['paleoData_pages2kID'] = df[dataset_col]

    # Coerce string columns
    string_columns = [
        'paleoData_proxy', 'archiveType', 'dataSetName',
        'paleoData_variableName', 'paleoData_units', 'yearUnits',
        'paleoData_pages2kID',
    ]
    for col in string_columns:
        if col in df.columns:
            if col not in ['paleoData_proxy', 'archiveType']:
                df[col] = df[col].fillna('unknown')
            df[col] = df[col].astype(str)

    # Coerce numeric columns
    for col in ['geo_meanLat', 'geo_meanLon', 'geo_meanElev']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    # Validate paleoData_values
    if 'paleoData_values' in df.columns:
        numeric_mask = df['paleoData_values'].apply(_is_numeric_array)
        dropped = (~numeric_mask).sum()
        if dropped > 0:
            print(f"Dropping {dropped} records with non-numeric paleoData_values")
            df = df[numeric_mask].copy()

    # Validate primary time columns (age/year) — depth is optional and skipped
    for col in ['age', 'year']:
        if col in df.columns:
            time_mask = df[col].apply(_is_numeric_array)
            dropped = (~time_mask).sum()
            if dropped > 0:
                print(f"Dropping {dropped} records with non-numeric {col}")
                df = df[time_mask].copy()

    print(f"\nFinal DataFrame: {df.shape} "
          f"({initial_count - len(df)} records removed)")

    # CFR-compatible pickle (primary)
    cfr_path = os.path.join(output_dir, 'lipd.pkl')
    with open(cfr_path, 'wb') as f:
        pickle.dump(df, f, protocol=4)
    print(f"Saved CFR pickle: {cfr_path}")

    # Legacy pickle
    legacy_path = os.path.join(output_dir, 'lipd_legacy.pkl')
    with open(legacy_path, 'wb') as f:
        pickle.dump({'D': D}, f, protocol=2)
    print(f"Saved legacy pickle: {legacy_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 3:
        print("Usage: generate.py <query_params_json> <output_dir> [format]")
        print("format: lpd | pickle | all  (default: all)")
        sys.exit(1)

    query_params_path = sys.argv[1]
    output_dir = sys.argv[2]
    fmt = sys.argv[3] if len(sys.argv) >= 4 else 'all'

    with open(query_params_path) as f:
        query_params = json.load(f)

    print(f"Query params: {json.dumps(query_params, indent=2)}")
    print(f"Output dir:   {output_dir}")
    print(f"Format:       {fmt}\n")

    os.makedirs(output_dir, exist_ok=True)

    write_lpd = fmt in ('lpd', 'all')
    write_pickle = fmt in ('pickle', 'all')

    # Always need .lpd files — they are the intermediate for pickle too
    metadata = download_query_csv()
    filtered = filter_datasets(metadata, query_params)
    urls = build_urls(filtered)
    print(f"\nDownloading {len(urls)} .lpd files...")
    download_lpd_files(urls, output_dir)

    if write_lpd:
        create_zip(output_dir)

    if write_pickle:
        create_pickles(output_dir)

    print("\nDone.")
    print(f"  Datasets: {filtered['datasetId'].nunique()}")
    print(f"  Format:   {fmt}")


if __name__ == '__main__':
    main()
