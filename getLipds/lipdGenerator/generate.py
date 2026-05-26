#!/usr/bin/env python3
"""
Generate LiPD data for LMR reconstruction based on query parameters.

Two entry points:

    python generate.py <query_params_json> <output_dir> [format]
        format: lpd | pickle | all (default: all)

    python generate.py citations <input> <output_dir> [--title=...] [--url=...]
                                                       [--unique-id=...] [--no-crossref]
        <input>: lipd_files.zip, *.pkl (legacy LiPD dict), or a directory of *.lpd
        Emits references.bib and CITATION.cff in <output_dir>.
"""

import sys
import os
import json
import re
import io
import glob
import zipfile
import pickle
import tempfile
import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import pandas as pd
import numpy as np

# The `lipd` library is only used by the create_pickles() path. Citations
# work straight from .lpd / legacy-pickle JSON, so don't fail at import time
# if it's missing (e.g. running the citations subcommand in a stripped env).
try:
    import lipd as lipd_lib
except ImportError:
    lipd_lib = None

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
    # If the user made a specific TSID selection (e.g. via the Data Cleaning page),
    # honour it directly instead of re-running the broad field filters.
    tsids = query_params.get('tsids')
    if tsids:
        tsid_col = next(
            (c for c in ['paleoData_TSid', 'paleoData_TSID', 'TSid', 'TSID'] if c in df.columns),
            None
        )
        if tsid_col:
            tsid_set = set(tsids)
            filtered = df[df[tsid_col].isin(tsid_set)]
            n_datasets = filtered['datasetId'].nunique()
            print(f"TSID filter: {len(tsids)} TSIDs requested → "
                  f"{len(filtered)} matching rows across {n_datasets} datasets")
            if n_datasets == 0:
                raise RuntimeError("No datasets match the specified TSIDs")
            return filtered
        else:
            print(f"Warning: TSID column not found in metadata CSV "
                  f"(tried paleoData_TSid / TSid). Falling back to field filters.")

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
        # May be a comma-separated list (e.g. "Pages2kTemperature-2_2_0, iso2k-1_1_2, ")
        if isinstance(compilation, str):
            compilations = [c.strip() for c in compilation.split(',') if c.strip()]
        else:
            compilations = [compilation]
        pattern = '|'.join(re.escape(c) for c in compilations)
        mask &= df['paleoData_mostRecentCompilations'].str.contains(pattern, case=False, na=False)
        print(f"Compilation filter: {compilations}")

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


def _resolve_version_url(dataset_id, original_url):
    """
    If the CSV version doesn't exist on the server (404), fetch the dataset's
    root index page to discover the actual latest version via its meta-refresh,
    then return the corrected URL.  Returns None if resolution fails.
    """
    try:
        root = requests.get(
            f"https://lipdverse.org/data/{dataset_id}/", timeout=30)
        m = re.search(r"content=\"0; url='([^']+)'", root.text)
        if m:
            ver_dir = m.group(1).split('/')[0]          # e.g. "1_0_7"
            base = original_url.rsplit('/', 2)[0]        # .../data/{datasetId}
            return f"{base}/{ver_dir}/lipd.lpd"
    except Exception:
        pass
    return None


def _download_one(dataset_id, url, output_dir):
    """Download a single .lpd file. Returns (dataset_id, version_mismatch, error)."""
    fname = os.path.join(output_dir, f"{dataset_id}.lpd")
    try:
        resp = requests.get(url, timeout=60)
        version_mismatch = False
        if resp.status_code == 404:
            fallback_url = _resolve_version_url(dataset_id, url)
            if fallback_url:
                resp = requests.get(fallback_url, timeout=60)
                version_mismatch = True
        resp.raise_for_status()
        with open(fname, 'wb') as f:
            f.write(resp.content)
        return (dataset_id, version_mismatch, None)
    except Exception as e:
        return (dataset_id, False, str(e))


def download_lpd_files(urls, output_dir, max_workers=20):
    downloaded = 0
    version_mismatches = 0
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(_download_one, dataset_id, url, output_dir): dataset_id
            for dataset_id, url in urls
        }
        for future in as_completed(futures):
            dataset_id, version_mismatch, error = future.result()
            if error:
                print(f"Warning: failed to download {dataset_id}: {error}")
            else:
                downloaded += 1
                if version_mismatch:
                    version_mismatches += 1
    if version_mismatches:
        print(f"  (version fallback used for {version_mismatches} datasets)")
    print(f"Downloaded {downloaded}/{len(urls)} .lpd files")
    if downloaded == 0:
        raise RuntimeError("Failed to download any .lpd files")
    return downloaded


# ---------------------------------------------------------------------------
# Step 2b: Remove explicitly rejected TSIDs from .lpd files
# ---------------------------------------------------------------------------

def _remove_tsids_from_lpd(lpd_path, removed_tsids):
    """
    Remove columns matching removed_tsids from a single .lpd file (in-place).
    LiPD files are BagIt zips containing JSON-LD metadata + CSV data files.
    Returns the number of columns removed.
    """
    import csv as csv_mod
    import hashlib

    with zipfile.ZipFile(lpd_path, 'r') as zf_in:
        file_contents = {}
        for name in zf_in.namelist():
            file_contents[name] = zf_in.read(name)

    jsonld_name = next((n for n in file_contents if n.endswith('.jsonld')), None)
    if not jsonld_name:
        return 0

    metadata = json.loads(file_contents[jsonld_name])
    csv_columns_to_remove = {}  # csv_zip_path → set of 1-based column numbers
    removed_count = 0

    paleo_data = metadata.get('paleoData', [])
    if not isinstance(paleo_data, list):
        paleo_data = [paleo_data] if paleo_data else []

    for pg in paleo_data:
        tables = pg.get('measurementTable', [])
        if not isinstance(tables, list):
            tables = [tables] if tables else []
        for table in tables:
            columns = table.get('columns', [])
            csv_filename = table.get('filename', '')

            cols_to_remove = []
            col_numbers_to_remove = set()
            for col in columns:
                tsid = col.get('TSid', col.get('tsid', ''))
                if tsid in removed_tsids:
                    cols_to_remove.append(col)
                    col_num = col.get('number')
                    if col_num is not None:
                        col_numbers_to_remove.add(int(col_num))
                    removed_count += 1

            if not cols_to_remove:
                continue

            # Remove columns from JSON and renumber
            new_columns = [c for c in columns if c not in cols_to_remove]
            for idx, col in enumerate(new_columns):
                col['number'] = idx + 1
            table['columns'] = new_columns

            # Track CSV columns to remove
            if csv_filename:
                csv_zip_path = next(
                    (n for n in file_contents if n.endswith(csv_filename)), None)
                if csv_zip_path:
                    csv_columns_to_remove[csv_zip_path] = col_numbers_to_remove

    if removed_count == 0:
        return 0

    # Update JSON-LD
    file_contents[jsonld_name] = json.dumps(metadata, indent=2).encode('utf-8')

    # Update CSV files — remove columns by 1-based number
    for csv_path, col_nums in csv_columns_to_remove.items():
        if csv_path not in file_contents:
            continue
        csv_text = file_contents[csv_path].decode('utf-8')
        reader = csv_mod.reader(io.StringIO(csv_text))
        output = io.StringIO()
        writer = csv_mod.writer(output)
        for row in reader:
            writer.writerow([v for i, v in enumerate(row) if (i + 1) not in col_nums])
        file_contents[csv_path] = output.getvalue().encode('utf-8')

    # Recompute BagIt manifest checksums
    manifest_name = next((n for n in file_contents if n.endswith('manifest-md5.txt')), None)
    if manifest_name:
        bag_prefix = manifest_name.rsplit('manifest-md5.txt', 1)[0]
        new_lines = []
        for line in file_contents[manifest_name].decode('utf-8').strip().split('\n'):
            parts = line.split(None, 1)
            if len(parts) == 2:
                _, filepath = parts
                full_path = bag_prefix + filepath
                if full_path in file_contents:
                    h = hashlib.md5(file_contents[full_path]).hexdigest()
                    new_lines.append(f"{h}  {filepath}")
                else:
                    new_lines.append(line)
            else:
                new_lines.append(line)
        file_contents[manifest_name] = ('\n'.join(new_lines) + '\n').encode('utf-8')

    # Recompute tag manifest
    tagmanifest_name = next((n for n in file_contents if n.endswith('tagmanifest-md5.txt')), None)
    if tagmanifest_name:
        bag_prefix = tagmanifest_name.rsplit('tagmanifest-md5.txt', 1)[0]
        new_lines = []
        for line in file_contents[tagmanifest_name].decode('utf-8').strip().split('\n'):
            parts = line.split(None, 1)
            if len(parts) == 2:
                _, filepath = parts
                full_path = bag_prefix + filepath
                if full_path in file_contents:
                    h = hashlib.md5(file_contents[full_path]).hexdigest()
                    new_lines.append(f"{h}  {filepath}")
                else:
                    new_lines.append(line)
            else:
                new_lines.append(line)
        file_contents[tagmanifest_name] = ('\n'.join(new_lines) + '\n').encode('utf-8')

    # Write modified .lpd file
    with zipfile.ZipFile(lpd_path, 'w', zipfile.ZIP_DEFLATED) as zf_out:
        for name, content in file_contents.items():
            zf_out.writestr(name, content)

    return removed_count


def remove_rejected_tsids(output_dir, removed_tsids):
    """Remove explicitly rejected TSIDs from all .lpd files in output_dir."""
    removed_set = set(removed_tsids)
    lpd_files = glob.glob(os.path.join(output_dir, '*.lpd'))
    total_removed = 0
    files_modified = 0
    for fpath in lpd_files:
        n = _remove_tsids_from_lpd(fpath, removed_set)
        if n > 0:
            total_removed += n
            files_modified += 1
            print(f"  {os.path.basename(fpath)}: removed {n} column(s)")
    print(f"Removed {total_removed} column(s) from {files_modified} file(s)")


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
    if lipd_lib is None:
        raise RuntimeError("The `lipd` package is required for pickle creation but is not installed")
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

    # Keep records that have at least one valid time axis (age or year).
    # LMR can use either, so dropping records with no age but valid year is wrong.
    time_cols = [c for c in ['age', 'year'] if c in df.columns]
    if time_cols:
        has_time = pd.Series(False, index=df.index)
        for col in time_cols:
            has_time |= df[col].apply(_is_numeric_array)
        dropped = (~has_time).sum()
        if dropped > 0:
            print(f"Dropping {dropped} records with neither numeric age nor numeric year")
        df = df[has_time].copy()

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
# Citations: build references.bib and CITATION.cff from LiPD pub metadata
# ---------------------------------------------------------------------------
#
# Ports the bibtex-construction logic from
#   https://github.com/nickmckay/lipdverseR/blob/c06b00ad/R/references.R
# CrossRef DOI lookup uses doi.org content negotiation
# (Accept: application/x-bibtex), which is what RefManageR::GetBibEntryWithDOI
# calls under the hood — same result without the R toolchain.

CROSSREF_USER_AGENT = "prestoServer-citations/1.0 (mailto:dce725@gmail.com)"
CITEKEY_MAX_LEN = 127


def _norm_str(v):
    if v is None:
        return ""
    if isinstance(v, float) and np.isnan(v):
        return ""
    return str(v).strip()


def _truncate_center(s, n):
    if len(s) <= n:
        return s
    half = n // 2
    return s[:half] + s[len(s) - (n - half):]


def _make_citekey(first_author, year, title):
    a = re.sub(r'[^A-Za-z]', '', _norm_str(first_author)).lower()
    y = _norm_str(year)
    t = re.sub(r'[^A-Za-z0-9]', '', _norm_str(title)).lower()
    if not a:
        a = "author"
    if not y:
        y = "year"
    if not t:
        t = "needsatitle"
    return _truncate_center(a + y + t, CITEKEY_MAX_LEN)


def _format_authors_bibtex(authors):
    """Coerce LiPD pub.author (str | list[str] | list[{name}]) → BibTeX 'X and Y'."""
    if authors is None:
        return ""
    if isinstance(authors, str):
        parts = [p.strip() for p in re.split(r';|\band\b', authors) if p.strip()]
        return " and ".join(parts) if parts else authors.strip()
    if isinstance(authors, list):
        names = []
        for a in authors:
            if isinstance(a, dict):
                n = a.get('name') or a.get('Name') or ""
            else:
                n = str(a)
            n = n.strip()
            if n:
                names.append(n)
        return " and ".join(names)
    return _norm_str(authors)


def _first_author_surname(authors):
    formatted = _format_authors_bibtex(authors)
    if not formatted:
        return ""
    first = formatted.split(" and ", 1)[0]
    if "," in first:
        return first.split(",", 1)[0].strip()
    return first.strip().split()[-1] if first.strip() else ""


def _fallback_bibtex(pub, citekey):
    raw_type = _norm_str(pub.get('type') or pub.get('bibtype'))
    bibtype = "article" if (not raw_type or "article" in raw_type.lower()) else "misc"

    authors = _format_authors_bibtex(pub.get('author')) or "Missing Author"
    title   = _norm_str(pub.get('title')) or "Missing Title"
    year    = _norm_str(pub.get('year'))  or "Missing Year"
    journal = _norm_str(pub.get('journal'))
    doi     = _norm_str(pub.get('doi'))

    fields = [
        f"  author = {{{authors}}}",
        f"  title = {{{title}}}",
        f"  year = {{{year}}}",
    ]
    if bibtype == "article":
        fields.append(f"  journal = {{{journal or 'Missing Journal'}}}")
    for key in ('volume', 'number', 'issue', 'pages', 'publisher'):
        val = _norm_str(pub.get(key))
        if val:
            k = 'number' if key == 'issue' else key
            fields.append(f"  {k} = {{{val}}}")
    if doi:
        fields.append(f"  doi = {{{doi}}}")
    return f"@{bibtype}{{{citekey},\n" + ",\n".join(fields) + "\n}\n"


def _replace_bibtex_key(entry, new_key):
    """Rewrite the citekey on the first line of a BibTeX entry from doi.org."""
    return re.sub(r'^(@\w+\{)[^,]+,', r'\1' + new_key + ',', entry, count=1)


def _crossref_bibtex(doi, session, cache):
    """Fetch BibTeX for a DOI via doi.org content negotiation. None on failure."""
    if not doi:
        return None
    if doi in cache:
        return cache[doi]
    url = f"https://doi.org/{doi}"
    try:
        resp = session.get(url, headers={
            'Accept': 'application/x-bibtex; charset=utf-8',
            'User-Agent': CROSSREF_USER_AGENT,
        }, timeout=15, allow_redirects=True)
        if resp.status_code == 200 and resp.text.strip().startswith('@'):
            cache[doi] = resp.text.strip() + "\n"
            return cache[doi]
    except requests.RequestException:
        pass
    cache[doi] = None
    return None


def _read_pubs_from_lpd_zip(lpd_path):
    """Open a .lpd file (BagIt zip) and return the `pub` list from its JSON-LD."""
    try:
        with zipfile.ZipFile(lpd_path, 'r') as zf:
            jsonld_name = next((n for n in zf.namelist() if n.endswith('.jsonld')), None)
            if not jsonld_name:
                return []
            meta = json.loads(zf.read(jsonld_name).decode('utf-8'))
    except (zipfile.BadZipFile, json.JSONDecodeError, OSError) as e:
        print(f"  Warning: could not read {os.path.basename(lpd_path)}: {e}")
        return []
    pubs = meta.get('pub', [])
    if isinstance(pubs, dict):
        pubs = [pubs]
    return [p for p in (pubs or []) if isinstance(p, dict)]


def _iter_pubs_from_input(input_path):
    """Yield (dataset_label, pub_dict) for every pub in the input."""
    if os.path.isdir(input_path):
        for lpd in sorted(glob.glob(os.path.join(input_path, '*.lpd'))):
            label = os.path.splitext(os.path.basename(lpd))[0]
            for pub in _read_pubs_from_lpd_zip(lpd):
                yield label, pub
        return

    ext = os.path.splitext(input_path)[1].lower()

    if ext == '.zip':
        with tempfile.TemporaryDirectory() as tmp:
            with zipfile.ZipFile(input_path, 'r') as zf:
                zf.extractall(tmp)
            for lpd in sorted(glob.glob(os.path.join(tmp, '*.lpd'))):
                label = os.path.splitext(os.path.basename(lpd))[0]
                for pub in _read_pubs_from_lpd_zip(lpd):
                    yield label, pub
        return

    if ext == '.pkl':
        with open(input_path, 'rb') as f:
            obj = pickle.load(f)
        # Legacy format: {'D': dict_of_datasets} or just dict_of_datasets
        if isinstance(obj, dict) and 'D' in obj and isinstance(obj['D'], dict):
            d = obj['D']
        elif isinstance(obj, dict):
            d = obj
        else:
            print(f"Warning: pickle {input_path} is not a LiPD dict (got {type(obj).__name__}); "
                  f"citations need lipd_legacy.pkl, not the flattened CFR DataFrame.")
            return
        for label, record in d.items():
            if not isinstance(record, dict):
                continue
            pubs = record.get('pub', [])
            if isinstance(pubs, dict):
                pubs = [pubs]
            for pub in (pubs or []):
                if isinstance(pub, dict):
                    yield label, pub
        return

    raise ValueError(f"Unsupported input: {input_path} (expected .zip, .pkl, or directory)")


def _yaml_escape(s):
    """Quote a string for safe inclusion in CITATION.cff."""
    s = _norm_str(s)
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'


DATA_BIB_FILENAME = 'data_references.bib'
DATA_REF_TITLE = 'Source paleoclimate data bibliography'


def _data_addendum_message(n_records, n_pubs):
    return (f"Additionally, please cite the underlying paleoclimate data sources "
            f"listed in {DATA_BIB_FILENAME} "
            f"({n_pubs} publications across {n_records} datasets) "
            f"and the lipdverse compilation.")


def _data_bibliography_ref(n_records, n_pubs):
    return {
        'type': 'generic',
        'title': DATA_REF_TITLE,
        'notes': f"{n_pubs} publications across {n_records} datasets in {DATA_BIB_FILENAME}",
    }


def _merge_into_existing_cff(existing_path, output_path, n_records, n_pubs):
    """Merge a data-source addendum into a pre-existing CITATION.cff.

    Idempotent: skips the message addendum or the data-bibliography reference
    if either is already present (so repeat runs in the same fork don't pile
    on duplicates).
    """
    import yaml
    with open(existing_path, 'r', encoding='utf-8') as f:
        cff = yaml.safe_load(f)
    if not isinstance(cff, dict):
        raise ValueError(f"Existing {existing_path} is not a YAML mapping")

    addendum = _data_addendum_message(n_records, n_pubs)
    msg = cff.get('message', '') or ''
    if DATA_BIB_FILENAME not in msg:
        cff['message'] = (msg.rstrip() + (' ' if msg.strip() else '') + addendum).strip()

    refs = cff.get('references') or []
    if not isinstance(refs, list):
        refs = []
    already_present = any(
        isinstance(r, dict) and r.get('title', '').strip() == DATA_REF_TITLE
        for r in refs
    )
    if not already_present:
        refs.append(_data_bibliography_ref(n_records, n_pubs))
    cff['references'] = refs

    with open(output_path, 'w', encoding='utf-8') as f:
        yaml.safe_dump(cff, f, sort_keys=False, allow_unicode=True,
                       default_flow_style=False)
    print(f"Merged data-source addendum into {output_path} "
          f"(from existing {existing_path})")


def _write_citation_cff(output_dir, title, url, unique_id, authors, n_records, n_pubs):
    """Write a fresh, minimal CITATION.cff. Used when no existing file is mounted."""
    cff_path = os.path.join(output_dir, 'CITATION.cff')
    today = datetime.date.today().isoformat()
    repo_title = title or (f"Presto reconstruction {unique_id}" if unique_id
                           else "Presto reconstruction")
    msg = ("If you use this reconstruction, please also cite the underlying "
           "paleoclimate data sources listed in " + DATA_BIB_FILENAME + " "
           f"({n_pubs} publications across {n_records} datasets) "
           "and the lipdverse compilation.")

    # `authors` is REQUIRED by the CFF schema — without it GitHub rejects the
    # file with "CITATION.cff cannot be parsed". Default to a single entity
    # entry so the file is always valid.
    author_list = [a for a in (authors or []) if _norm_str(a)]
    if not author_list:
        author_list = ["PReSto user"]

    lines = [
        "cff-version: 1.2.0",
        f"message: {_yaml_escape(msg)}",
        "authors:",
    ]
    for name in author_list:
        lines.append(f"  - name: {_yaml_escape(name)}")
    lines.extend([
        "type: dataset",
        f"title: {_yaml_escape(repo_title)}",
        f"date-released: {today}",
    ])
    if url:
        lines.append(f"url: {_yaml_escape(url)}")
    if unique_id:
        lines.append(f"identifiers:")
        lines.append(f"  - type: other")
        lines.append(f"    value: {_yaml_escape(unique_id)}")
        lines.append(f"    description: {_yaml_escape('Presto unique reconstruction ID')}")
    with open(cff_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(lines) + "\n")
    print(f"Wrote fresh {cff_path}")


def run_citations(input_path, output_dir,
                  title=None, url=None, unique_id=None, authors=None,
                  merge_cff=None, use_crossref=True):
    os.makedirs(output_dir, exist_ok=True)

    seen_keys = {}        # citekey -> bibtex entry
    seen_dois = set()     # to dedupe DOI hits across datasets
    cache = {}            # DOI -> bibtex string (or None for miss)
    session = requests.Session() if use_crossref else None

    n_datasets = 0
    seen_datasets = set()

    for label, pub in _iter_pubs_from_input(input_path):
        if label not in seen_datasets:
            seen_datasets.add(label)
            n_datasets += 1

        doi = _norm_str(pub.get('doi'))
        first_author = _first_author_surname(pub.get('author'))
        year = _norm_str(pub.get('year'))
        title_p = _norm_str(pub.get('title'))
        citekey = _make_citekey(first_author, year, title_p)

        # DOI-level dedupe — if we've seen this DOI under any citekey, skip
        if doi and doi.lower() in seen_dois:
            continue

        if citekey in seen_keys:
            if doi:
                seen_dois.add(doi.lower())
            continue

        entry = None
        if use_crossref and doi:
            bib = _crossref_bibtex(doi, session, cache)
            if bib:
                entry = _replace_bibtex_key(bib, citekey)
        if entry is None:
            entry = _fallback_bibtex(pub, citekey)

        seen_keys[citekey] = entry
        if doi:
            seen_dois.add(doi.lower())

    bib_path = os.path.join(output_dir, DATA_BIB_FILENAME)
    with open(bib_path, 'w', encoding='utf-8') as f:
        f.write(f"% Auto-generated by lipdGenerator from {os.path.basename(input_path)}\n")
        f.write(f"% {len(seen_keys)} unique publications across {n_datasets} datasets\n\n")
        for key in sorted(seen_keys):
            f.write(seen_keys[key])
            f.write("\n")
    print(f"Wrote {bib_path}: {len(seen_keys)} unique pubs across {n_datasets} datasets")

    # If a pre-existing CITATION.cff was mounted, merge an addendum into it
    # so the curated platform-level metadata is preserved. Otherwise write a
    # fresh minimal CFF from the supplied --title/--author/etc.
    cff_out = os.path.join(output_dir, 'CITATION.cff')
    if merge_cff and os.path.isfile(merge_cff):
        _merge_into_existing_cff(merge_cff, cff_out, n_datasets, len(seen_keys))
    else:
        _write_citation_cff(output_dir, title, url, unique_id, authors,
                            n_datasets, len(seen_keys))


def _parse_citations_args(argv):
    """Parse citations-subcommand args. Returns (input, output_dir, opts)."""
    positional = []
    opts = {'title': None, 'url': None, 'unique_id': None,
            'authors': [], 'merge_cff': None, 'use_crossref': True}
    for arg in argv:
        if arg.startswith('--title='):
            opts['title'] = arg[len('--title='):]
        elif arg.startswith('--url='):
            opts['url'] = arg[len('--url='):]
        elif arg.startswith('--unique-id='):
            opts['unique_id'] = arg[len('--unique-id='):]
        elif arg.startswith('--author='):
            opts['authors'].append(arg[len('--author='):])
        elif arg.startswith('--merge-cff='):
            opts['merge_cff'] = arg[len('--merge-cff='):]
        elif arg == '--no-crossref':
            opts['use_crossref'] = False
        else:
            positional.append(arg)
    if len(positional) < 2:
        print("Usage: generate.py citations <input> <output_dir> "
              "[--title=...] [--url=...] [--unique-id=...] [--author=...] "
              "[--merge-cff=PATH] [--no-crossref]")
        sys.exit(1)
    return positional[0], positional[1], opts


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) >= 2 and sys.argv[1] == 'citations':
        input_path, output_dir, opts = _parse_citations_args(sys.argv[2:])
        run_citations(input_path, output_dir, **opts)
        return

    if len(sys.argv) < 3:
        print("Usage: generate.py <query_params_json> <output_dir> [format]")
        print("       generate.py citations <input> <output_dir> [options]")
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

    # Remove explicitly rejected TSIDs from .lpd files (from data cleaning)
    removed_tsids = query_params.get('removedTsids', [])
    if removed_tsids:
        print(f"\nRemoving {len(removed_tsids)} rejected TSID(s) from .lpd files...")
        remove_rejected_tsids(output_dir, removed_tsids)

    if write_lpd:
        create_zip(output_dir)

    if write_pickle:
        create_pickles(output_dir)

    print("\nDone.")
    print(f"  Datasets: {filtered['datasetId'].nunique()}")
    print(f"  Format:   {fmt}")


if __name__ == '__main__':
    main()
