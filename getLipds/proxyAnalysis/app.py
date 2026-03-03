#!/usr/bin/env python3
"""
Proxy Analysis Service — FastAPI microservice for detecting duplicate proxy records.

Runs on port 8090 as a long-running service (not a one-off container) to avoid
startup latency during interactive use.

POST /analyze
  Body: { "tsids": ["GF123", "GH456", ...] }
  Returns:
    {
      "records": [...metadata per TSID...],
      "duplicateGroups": [...groups of likely duplicates...],
      "pcaCoords": [...PCA coordinates per TSID...]
    }

GET /health
  Returns: { "status": "ok" }
"""

from __future__ import annotations

import concurrent.futures
import io
import json
import logging
import math
import os
import re
import time
import zipfile
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set

import numpy as np
import pandas as pd
import requests
from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel
from scipy.stats import pearsonr
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Proxy Analysis Service")

# =============================================================================
# Configuration
# =============================================================================
QUERY_CSV_URL = "https://lipdverse.org/lipdverse/lipdverseQuery.zip"
GRAPHDB_URL = os.environ.get("GRAPHDB_URL", "https://linkedearth.graphdb.mint.isi.edu")
ORCHESTRATOR_URL = os.environ.get("ORCHESTRATOR_URL", "http://presto-orchestrator:3000")
SPATIAL_THRESHOLD_KM = 10.0
CORR_THRESHOLD = 0.8
DTW_NORM_THRESHOLD = 0.03
CACHE_TTL_SECONDS = 3600  # refresh metadata hourly

# =============================================================================
# Global metadata cache
# =============================================================================
_metadata_df: Optional[pd.DataFrame] = None
_metadata_cache_time: float = 0.0


# =============================================================================
# Pydantic models
# =============================================================================
class AnalyzeRequest(BaseModel):
    tsids: List[str]


# =============================================================================
# Metadata loading
# =============================================================================
def load_metadata() -> pd.DataFrame:
    global _metadata_df, _metadata_cache_time
    now = time.time()
    if _metadata_df is not None and (now - _metadata_cache_time) < CACHE_TTL_SECONDS:
        return _metadata_df

    logger.info("Downloading lipdverse metadata from %s", QUERY_CSV_URL)
    resp = requests.get(QUERY_CSV_URL, timeout=180)
    resp.raise_for_status()
    zf = zipfile.ZipFile(io.BytesIO(resp.content))
    with zf.open(zf.namelist()[0]) as f:
        df = pd.read_csv(f, low_memory=False)

    logger.info("Loaded %d records; columns: %s", len(df), list(df.columns[:25]))
    _metadata_df = df
    _metadata_cache_time = now
    return df


# =============================================================================
# Utility functions
# =============================================================================
def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _safe_float(val: Any) -> Optional[float]:
    try:
        v = float(val)
        return None if (math.isnan(v) or math.isinf(v)) else v
    except (TypeError, ValueError):
        return None


def _safe_str(val: Any) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    return s if s and s.lower() not in ("nan", "none", "null", "") else None


def _parse_compilations(comp_str: Optional[str]) -> Set[str]:
    """Split a compilation string (e.g. 'Pages2k;LR04') into a set of names."""
    if not comp_str:
        return set()
    return {part.strip().lower() for part in re.split(r"[;,|]", comp_str) if part.strip()}


def normalize_series(arr: np.ndarray) -> np.ndarray:
    lo, hi = arr.min(), arr.max()
    if hi - lo < 1e-10:
        return np.zeros_like(arr, dtype=float)
    return (arr - lo) / (hi - lo)


def compute_dtw_norm(s1: List[float], s2: List[float]) -> Optional[float]:
    """DTW on normalized series, normalized by series length."""
    try:
        from fastdtw import fastdtw

        a = normalize_series(np.array(s1, dtype=float))
        b = normalize_series(np.array(s2, dtype=float))
        # Use abs difference — euclidean() from scipy rejects scalar inputs
        dist, _ = fastdtw(a, b, dist=lambda x, y: abs(x - y))
        return float(dist) / max(len(a), len(b), 1)
    except Exception as exc:
        logger.warning("DTW computation failed: %s", exc)
        return None


def compute_pearson(s1: List[float], s2: List[float]) -> Optional[float]:
    try:
        min_len = min(len(s1), len(s2))
        if min_len < 5:
            return None
        r, _ = pearsonr(s1[:min_len], s2[:min_len])
        return float(r) if not math.isnan(r) else None
    except Exception:
        return None


# =============================================================================
# SPARQL: fetch proxy values for a list of TSIDs
# =============================================================================
def fetch_ts_values(tsids: List[str]) -> Dict[str, List[float]]:
    if not tsids:
        return {}

    filter_parts = " || ".join(f'?hasVariableID = "{t}"' for t in tsids)
    query = f"""PREFIX le: <http://linked.earth/ontology#>
SELECT ?variableID ?values
WHERE {{
    ?ds a le:Dataset .
    ?ds le:includesPaleoData ?data .
    ?data le:foundInMeasurementTable ?table .
    ?table le:includesVariable ?var .
    ?var le:hasVariableID ?hasVariableID .
    FILTER ({filter_parts})
    ?var le:hasVariableID ?variableID .
    ?var le:hasValues ?values .
}}
LIMIT 10000"""

    url = f"{GRAPHDB_URL}/repositories/LiPDVerse3"
    try:
        resp = requests.post(
            url,
            data={"query": query},
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/sparql-results+json",
            },
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("SPARQL request failed: %s", exc)
        return {}

    results: Dict[str, List[float]] = {}
    for binding in data.get("results", {}).get("bindings", []):
        vid = binding.get("variableID", {}).get("value", "")
        vals_str = binding.get("values", {}).get("value", "")
        if vid and vals_str:
            try:
                vals = [
                    float(x)
                    for x in vals_str.split()
                    if x.lower() not in ("nan", "null", "none", "")
                ]
                if vals:
                    results[vid] = vals
            except (ValueError, AttributeError):
                pass

    logger.info(
        "SPARQL returned values for %d / %d TSIDs", len(results), len(tsids)
    )
    return results


# =============================================================================
# Build per-record metadata dict from a CSV row
# =============================================================================
def _first_present(row: pd.Series, *keys: str) -> Any:
    for k in keys:
        if k in row.index:
            v = row[k]
            if pd.notna(v):
                return v
    return None


def row_to_record(row: pd.Series) -> Dict[str, Any]:
    lat = _safe_float(_first_present(row, "geo_latitude", "geo_meanLat"))
    lon = _safe_float(_first_present(row, "geo_longitude", "geo_meanLon"))
    min_age = _safe_float(
        _first_present(row, "age_min", "ageMin", "age_min_ky", "minYear", "age_min_BP")
    )
    max_age = _safe_float(
        _first_present(row, "age_max", "ageMax", "age_max_ky", "maxYear", "age_max_BP")
    )
    resolution = _safe_float(
        _first_present(row, "resolution", "medianResolution", "median_resolution")
    )

    return {
        "tsid": _safe_str(_first_present(row, "paleoData_TSid", "TSid", "tsid")),
        "dataSetName": _safe_str(
            _first_present(row, "dataSetName", "datasetName", "datasetId")
        ),
        "archiveType": _safe_str(row.get("archiveType")),
        "variableName": _safe_str(row.get("paleoData_variableName")),
        "compilation": _safe_str(row.get("paleoData_mostRecentCompilations")),
        "lat": lat,
        "lon": lon,
        "minAge": min_age,
        "maxAge": max_age,
        "resolution": resolution,
    }


# =============================================================================
# PCA on record metadata
# =============================================================================
def compute_pca(records: List[Dict]) -> List[Dict]:
    feature_rows: List[List[float]] = []
    valid_indices: List[int] = []

    for i, rec in enumerate(records):
        lat, lon = rec.get("lat"), rec.get("lon")
        if lat is None or lon is None:
            continue
        min_age = rec.get("minAge") or 0.0
        max_age = rec.get("maxAge") or 0.0
        res = rec.get("resolution") or 0.0
        feature_rows.append([lat, lon, min_age, max_age, res])
        valid_indices.append(i)

    # Default coords (all zeros)
    pca_coords = [
        {"tsid": rec["tsid"], "pc1": 0.0, "pc2": 0.0, "archiveType": rec.get("archiveType")}
        for rec in records
    ]

    if len(feature_rows) < 2:
        return pca_coords

    X = np.array(feature_rows, dtype=float)
    # Impute column means for any NaN/Inf
    col_means = np.where(
        np.isfinite(X).any(axis=0), np.nanmean(np.where(np.isfinite(X), X, np.nan), axis=0), 0.0
    )
    for j in range(X.shape[1]):
        bad = ~np.isfinite(X[:, j])
        X[bad, j] = col_means[j]

    n_components = min(2, X.shape[0], X.shape[1])
    try:
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        pca = PCA(n_components=n_components)
        coords = pca.fit_transform(X_scaled)
    except Exception as exc:
        logger.warning("PCA failed: %s", exc)
        return pca_coords

    for k, idx in enumerate(valid_indices):
        rec = records[idx]
        pca_coords[idx] = {
            "tsid": rec["tsid"],
            "pc1": float(coords[k, 0]) if coords.shape[1] > 0 else 0.0,
            "pc2": float(coords[k, 1]) if coords.shape[1] > 1 else 0.0,
            "archiveType": rec.get("archiveType"),
        }

    return pca_coords


# =============================================================================
# Union-Find for grouping
# =============================================================================
def make_union_find(n: int):
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    return find, union


# =============================================================================
# Main analysis endpoint
# =============================================================================
@app.post("/analyze")
async def analyze(req: AnalyzeRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    tsids = req.tsids
    if not tsids:
        raise HTTPException(status_code=400, detail="No TSIDs provided")

    logger.info("Analyzing %d TSIDs", len(tsids))

    try:
        df = load_metadata()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Failed to load metadata: {exc}")

    # Find the TSid column
    tsid_col = None
    for candidate in ("paleoData_TSid", "TSid", "tsid", "TSID"):
        if candidate in df.columns:
            tsid_col = candidate
            break
    if tsid_col is None:
        raise HTTPException(status_code=500, detail="TSid column not found in metadata CSV")

    filtered = df[df[tsid_col].isin(set(tsids))].copy()
    logger.info("Matched %d rows for %d requested TSIDs", len(filtered), len(tsids))

    # Build per-record metadata, deduplicated by tsid
    seen: set = set()
    records: List[Dict] = []
    for _, row in filtered.iterrows():
        rec = row_to_record(row)
        if rec["tsid"] and rec["tsid"] not in seen:
            seen.add(rec["tsid"])
            records.append(rec)

    # -------------------------------------------------------------------------
    # PCA
    # -------------------------------------------------------------------------
    pca_coords = compute_pca(records)

    # -------------------------------------------------------------------------
    # Spatial duplicate detection: pairs within SPATIAL_THRESHOLD_KM with same variableName
    # -------------------------------------------------------------------------
    candidate_pairs: List[tuple] = []  # (i, j, dist_km)

    for i in range(len(records)):
        ri = records[i]
        lat_i, lon_i = ri.get("lat"), ri.get("lon")
        var_i = ri.get("variableName")
        if lat_i is None or lon_i is None or not var_i:
            continue
        comp_i = _parse_compilations(ri.get("compilation"))
        for j in range(i + 1, len(records)):
            rj = records[j]
            lat_j, lon_j = rj.get("lat"), rj.get("lon")
            var_j = rj.get("variableName")
            if lat_j is None or lon_j is None or not var_j:
                continue
            if var_i.lower() != var_j.lower():
                continue
            # Records from the same compilation are different data products,
            # not duplicates — skip them regardless of proximity.
            comp_j = _parse_compilations(rj.get("compilation"))
            if comp_i and comp_j and comp_i & comp_j:
                continue
            dist = haversine_km(lat_i, lon_i, lat_j, lon_j)
            if dist < SPATIAL_THRESHOLD_KM:
                candidate_pairs.append((i, j, dist))

    logger.info("Found %d spatial candidate pairs", len(candidate_pairs))

    # -------------------------------------------------------------------------
    # All spatial candidate pairs are returned as potential duplicates.
    # Correlation/DTW are computed on-demand per group via POST /correlate.
    # -------------------------------------------------------------------------
    confirmed_pairs: List[tuple] = [
        (i, j, dist_km, None, None) for i, j, dist_km in candidate_pairs
    ]
    logger.info("Returning %d spatial candidate pairs as duplicate groups", len(confirmed_pairs))

    # -------------------------------------------------------------------------
    # Group confirmed pairs with union-find
    # -------------------------------------------------------------------------
    find, union = make_union_find(len(records))
    pair_info: Dict[tuple, Dict] = {}

    for i, j, dist_km, pearson_r, dtw_norm in confirmed_pairs:
        union(i, j)
        key = (min(i, j), max(i, j))
        pair_info[key] = {
            "distKm": round(dist_km, 2),
            "pearson": round(pearson_r, 4) if pearson_r is not None else None,
            "dtw": round(dtw_norm, 6) if dtw_norm is not None else None,
        }

    groups_dict: Dict[int, List[int]] = defaultdict(list)
    for i, j, *_ in confirmed_pairs:
        root = find(i)
        if i not in groups_dict[root]:
            groups_dict[root].append(i)
        if j not in groups_dict[root]:
            groups_dict[root].append(j)

    duplicate_groups: List[Dict] = []
    for group_id, (root, members) in enumerate(groups_dict.items()):
        if len(members) < 2:
            continue

        correlations: List[Dict] = []
        dtw_distances: List[Dict] = []

        for k1 in range(len(members)):
            for k2 in range(k1 + 1, len(members)):
                mi, mj = members[k1], members[k2]
                key = (min(mi, mj), max(mi, mj))
                info = pair_info.get(key, {})
                correlations.append({
                    "tsid1": records[mi]["tsid"],
                    "tsid2": records[mj]["tsid"],
                    "pearson": info.get("pearson"),
                    "distKm": info.get("distKm"),
                })
                dtw_distances.append({
                    "tsid1": records[mi]["tsid"],
                    "tsid2": records[mj]["tsid"],
                    "dtw": info.get("dtw"),
                })

        duplicate_groups.append({
            "groupId": group_id,
            "records": [records[m]["tsid"] for m in members],
            "correlations": correlations,
            "dtwDistances": dtw_distances,
        })

    # Start background preload in group order so top groups are ready first
    groups_tsids = [g["records"] for g in duplicate_groups]
    if groups_tsids:
        background_tasks.add_task(_preload_lipd_cache, groups_tsids)

    return {
        "records": records,
        "duplicateGroups": duplicate_groups,
        "pcaCoords": pca_coords,
    }


# =============================================================================
# On-demand correlation endpoint (called per duplicate group on click)
# =============================================================================
class CorrelateRequest(BaseModel):
    tsids: List[str]


# =============================================================================
# LiPD file fallback: download directly from lipdverse.org
# =============================================================================

# Session cache: (dsid, dsver) -> {tsid: [float|None, ...]}
# Avoids re-downloading the same dataset multiple times within one container run.
# Only successful downloads are stored; failures are never cached.
_lipd_series_cache: Dict[tuple, Dict[str, List]] = {}


def _resolve_lipd_url(dsid: str, dsver: str) -> Optional[str]:
    """
    Return the actual .lpd download URL for a dataset on lipdverse.org.

    The version stored in the metadata CSV (e.g. "1.0.8") sometimes differs
    from the version actually hosted (e.g. "1_0_7").  Strategy:
      1. Try the CSV version (dots → underscores) with a HEAD request.
      2. If that 404s, fetch the bare directory listing and parse the
         meta-refresh redirect to discover the real version.

    No result is cached — every call hits lipdverse.org fresh.
    """
    base = f"https://lipdverse.org/data/{dsid}"
    ver_underscored = dsver.replace(".", "_")
    canonical_url = f"{base}/{ver_underscored}/lipd.lpd"

    try:
        head = requests.head(canonical_url, timeout=5, allow_redirects=True)
        if head.status_code == 200:
            return canonical_url
    except Exception:
        pass

    try:
        dir_resp = requests.get(f"{base}/", timeout=5)
        if dir_resp.status_code == 200:
            m = re.search(r"""url=['"]([\w_]+)/index\.html['"]""", dir_resp.text, re.IGNORECASE)
            if m:
                actual_ver = m.group(1)
                resolved_url = f"{base}/{actual_ver}/lipd.lpd"
                logger.info("LiPD URL resolved %s: %s → %s", dsid, ver_underscored, actual_ver)
                return resolved_url
    except Exception as exc:
        logger.warning("LiPD URL resolution failed for %s: %s", dsid, exc)

    return None


def _fetch_one_lipd(dsid: str, dsver: str) -> Dict[str, List]:
    """
    Download one LiPD ZIP, extract ALL column series, and cache by (dsid, dsver).
    Returns the full {tsid: values} dict for that dataset.
    Keyed by version so an updated dataset at the source gets a fresh download.
    """
    cache_key = (dsid, dsver)
    if cache_key in _lipd_series_cache:
        return _lipd_series_cache[cache_key]

    url = _resolve_lipd_url(dsid, dsver)
    if url is None:
        logger.warning("LiPD fallback: could not resolve URL for dataset %s", dsid)
        return {}

    try:
        resp = requests.get(url, timeout=45)
        resp.raise_for_status()
        zf = zipfile.ZipFile(io.BytesIO(resp.content))

        # Parse metadata.jsonld for tsid → (csv_filename, column_number)
        with zf.open("bag/data/metadata.jsonld") as f:
            meta_json = json.load(f)

        tsid_to_col: Dict[str, tuple] = {}
        for paleo in meta_json.get("paleoData", []):
            for table in paleo.get("measurementTable", []):
                fname = table.get("filename", "")
                for col in table.get("columns", []):
                    t = str(col.get("TSid", ""))
                    n = col.get("number")
                    if t and n is not None and fname:
                        tsid_to_col[t] = (fname, int(n))

        # Extract every column and cache the full dataset.
        # Store None for missing/non-finite values to preserve row alignment
        # between proxy and time columns (needed for paired sort in /correlate).
        dataset_series: Dict[str, List] = {}
        for tsid, (fname, col_num) in tsid_to_col.items():
            csv_path = f"bag/data/{fname}"
            if csv_path not in zf.namelist():
                continue
            with zf.open(csv_path) as f:
                # LiPD CSVs have no header row — first row is data
                csv_df = pd.read_csv(f, header=None)
            col_idx = col_num - 1
            if col_idx >= csv_df.shape[1]:
                continue
            raw = []
            for v in csv_df.iloc[:, col_idx].tolist():
                try:
                    fv = float(v)
                    raw.append(fv if math.isfinite(fv) else None)
                except (TypeError, ValueError):
                    raw.append(None)
            if any(v is not None for v in raw):
                dataset_series[tsid] = raw

        logger.info(
            "LiPD fallback: loaded %d series from dataset %s", len(dataset_series), dsid
        )
        _lipd_series_cache[cache_key] = dataset_series
        return dataset_series

    except Exception as exc:
        logger.warning("LiPD fallback failed for dataset %s: %s", dsid, exc)
        return {}


def _is_finite_float(v: Any) -> bool:
    try:
        return math.isfinite(float(v))
    except (TypeError, ValueError):
        return False


def _preload_lipd_cache(groups: List[List[str]]) -> None:
    """
    Background task: warm _lipd_series_cache one group at a time, in display order.
    Processing groups sequentially means group 0 is ready first (matches page order).
    Within each group, datasets are downloaded in parallel by _fetch_ts_from_lipd.
    """
    for i, group_tsids in enumerate(groups):
        try:
            _fetch_ts_from_lipd(group_tsids)
            logger.info("Background preload: group %d complete", i)
        except Exception as exc:
            logger.warning("Background preload: group %d failed: %s", i, exc)
    logger.info("Background preload done (%d datasets cached)", len(_lipd_series_cache))


def _fetch_ts_from_lipd(tsids: List[str]) -> Dict[str, List[float]]:
    """
    Download LiPD ZIP files in parallel and extract time series values by TSid.
    Results are cached per dataset so repeated calls for the same dataset are free.
    """
    df = load_metadata()
    tsid_col = next(
        (c for c in ("paleoData_TSid", "TSid", "tsid", "TSID") if c in df.columns), None
    )
    if tsid_col is None:
        return {}

    tsid_set = set(tsids)

    # Collect unique datasets that contain at least one requested TSid.
    # Time-axis TSids may not appear as rows but live in the same LiPD file
    # as their proxy TSid — the full-dataset extraction in _fetch_one_lipd
    # captures them automatically.
    dataset_meta: Dict[str, str] = {}  # dsid -> dsver
    for _, row in df[df[tsid_col].isin(tsid_set)].iterrows():
        dsid = str(row.get("datasetId", ""))
        dsver = str(row.get("datasetVersion", "1.0.0"))
        if dsid and dsid not in dataset_meta:
            dataset_meta[dsid] = dsver

    # Download datasets in parallel (I/O bound — use threads)
    results: Dict[str, List[float]] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        futures = {
            executor.submit(_fetch_one_lipd, dsid, dsver): dsid
            for dsid, dsver in dataset_meta.items()
        }
        for future in concurrent.futures.as_completed(futures):
            dataset_series = future.result()
            for tsid, vals in dataset_series.items():
                if tsid in tsid_set and tsid not in results:
                    results[tsid] = vals

    logger.info(
        "LiPD fallback total: %d / %d TSIDs resolved", len(results), len(tsid_set)
    )
    return results


# =============================================================================
# SPARQL via internal orchestrator
# =============================================================================
def _fetch_ts_via_orchestrator(tsids: List[str]) -> tuple[Dict[str, List[float]], Optional[str]]:
    """Call the Node.js /sparql endpoint and return (values_dict, error_string)."""
    try:
        resp = requests.post(
            f"{ORCHESTRATOR_URL}/sparql",
            json={"TSIDs": tsids},
            timeout=30,
        )
        resp.raise_for_status()
        raw = resp.json()  # outer JSON decode → a string (double-encoded by Node.js res.json)
        if isinstance(raw, str):
            if raw.startswith("{"):
                parsed = json.loads(raw)
                return {k: v for k, v in parsed.items() if isinstance(v, list)}, None
            else:
                return {}, raw  # e.g. "XHR didn't work: 500"
        elif isinstance(raw, dict):
            return {k: v for k, v in raw.items() if isinstance(v, list)}, None
        return {}, f"Unexpected response type: {type(raw)}"
    except Exception as exc:
        logger.warning("SPARQL via orchestrator failed: %s", exc)
        return {}, str(exc)


@app.post("/correlate")
async def correlate(req: CorrelateRequest) -> Dict[str, Any]:
    tsids = req.tsids
    if len(tsids) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 TSIDs")

    logger.info("Correlating %d TSIDs: %s", len(tsids), tsids)

    # Load metadata for lat/lon, variableName, and time TSids
    try:
        df = load_metadata()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Failed to load metadata: {exc}")

    tsid_col = next(
        (c for c in ("paleoData_TSid", "TSid", "tsid", "TSID") if c in df.columns), None
    )
    if tsid_col is None:
        raise HTTPException(status_code=500, detail="TSid column not found")

    filtered = df[df[tsid_col].isin(set(tsids))]
    meta = {str(row[tsid_col]): row for _, row in filtered.iterrows()}

    # Map each proxy TSid → its corresponding time-axis TSid
    time_tsid_map: Dict[str, str] = {}
    for tsid in tsids:
        row = meta.get(tsid)
        if row is not None:
            t_tsid = _safe_str(_first_present(row, "paleoData_hasTimeTsid"))
            if t_tsid:
                time_tsid_map[tsid] = t_tsid

    # Query proxy + time TSids in one call
    all_query_tsids = list(tsids) + [
        t for t in time_tsid_map.values() if t not in tsids
    ]

    ts_values, sparql_error = _fetch_ts_via_orchestrator(all_query_tsids)
    logger.info(
        "SPARQL: got values for %d / %d TSIDs%s",
        len(ts_values),
        len(all_query_tsids),
        f" (error: {sparql_error})" if sparql_error else "",
    )

    # Fallback: download LiPD files directly when SPARQL is unavailable
    if sparql_error and not ts_values:
        logger.info("SPARQL unavailable — falling back to LiPD file download")
        try:
            ts_values = _fetch_ts_from_lipd(all_query_tsids)
            if ts_values:
                logger.info("LiPD fallback succeeded: %d TSIDs", len(ts_values))
                sparql_error = None  # suppress warning — fallback worked
        except Exception as exc:
            logger.warning("LiPD fallback also failed: %s", exc)

    # Build per-tsid series objects (proxy values + time axis)
    series: Dict[str, Dict] = {}
    for tsid in tsids:
        proxy_vals = ts_values.get(tsid, [])
        t_tsid = time_tsid_map.get(tsid)
        time_vals = ts_values.get(t_tsid, []) if t_tsid else []
        row = meta.get(tsid)
        label = (
            _safe_str(_first_present(row, "paleoData_variableName")) if row is not None else None
        )
        dataset_name = (
            _safe_str(_first_present(row, "dataSetName", "datasetId")) if row is not None else None
        )
        compilation = (
            _safe_str(row.get("paleoData_mostRecentCompilations")) if row is not None else None
        )
        # Sort by time axis so traces don't zigzag and Pearson/DTW are meaningful.
        # When arrays share the same row count (None-preserving extraction), pair
        # them row-by-row, drop rows where either value is None, then sort by time.
        if time_vals and proxy_vals and len(time_vals) == len(proxy_vals):
            # Strip None rows (must be done before monotonicity check)
            clean = [(t, v) for t, v in zip(time_vals, proxy_vals)
                     if t is not None and v is not None]
            # Fast monotonicity check — only sort if actually out of order
            if len(clean) > 1 and any(clean[i][0] > clean[i+1][0] for i in range(len(clean)-1)):
                clean = sorted(clean, key=lambda p: p[0])
            time_vals  = [p[0] for p in clean]
            proxy_vals = [p[1] for p in clean]
        else:
            # Lengths differ or no time axis — strip Nones independently.
            # Do NOT use the time array as x when lengths don't match (different
            # tables); the JS fallback will use sequential indices instead.
            proxy_vals = [v for v in proxy_vals if v is not None]
            time_vals  = []

        series[tsid] = {
            "values": proxy_vals,
            "time": time_vals,
            "label": label or tsid,
            "dataSetName": dataset_name,
            "compilation": compilation,
        }

    # Compute pairwise Pearson + DTW + distance
    pairs = []
    for i in range(len(tsids)):
        for j in range(i + 1, len(tsids)):
            ti, tj = tsids[i], tsids[j]
            vals_i = series[ti]["values"]
            vals_j = series[tj]["values"]

            dist_km = None
            ri, rj = meta.get(ti), meta.get(tj)
            if ri is not None and rj is not None:
                lat_i = _safe_float(_first_present(ri, "geo_latitude", "geo_meanLat"))
                lon_i = _safe_float(_first_present(ri, "geo_longitude", "geo_meanLon"))
                lat_j = _safe_float(_first_present(rj, "geo_latitude", "geo_meanLat"))
                lon_j = _safe_float(_first_present(rj, "geo_longitude", "geo_meanLon"))
                if all(v is not None for v in (lat_i, lon_i, lat_j, lon_j)):
                    dist_km = round(haversine_km(lat_i, lon_i, lat_j, lon_j), 2)

            pearson_r = compute_pearson(vals_i, vals_j) if vals_i and vals_j else None
            dtw_norm = compute_dtw_norm(vals_i, vals_j) if vals_i and vals_j else None

            pairs.append({
                "tsid1": ti,
                "tsid2": tj,
                "pearson": round(pearson_r, 4) if pearson_r is not None else None,
                "dtw": round(dtw_norm, 6) if dtw_norm is not None else None,
                "distKm": dist_km,
            })

    result: Dict[str, Any] = {"pairs": pairs, "series": series}
    if sparql_error:
        result["warning"] = "Time series could not be retrieved — SPARQL service unavailable and LiPD file download returned no data."
    return result


# =============================================================================
# Preload status — client polls this to discover which groups are ready
# =============================================================================
@app.get("/preload-status")
def preload_status() -> Dict[str, Any]:
    """Return the set of TSIDs whose data is already in the cache."""
    ready: Set[str] = set()
    for dataset_series in _lipd_series_cache.values():
        ready.update(dataset_series.keys())
    return {"readyTsids": list(ready)}


# =============================================================================
# Health check
# =============================================================================
@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}
