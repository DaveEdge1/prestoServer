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

import io
import json
import logging
import math
import os
import time
import zipfile
from collections import defaultdict
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import requests
from fastapi import FastAPI, HTTPException
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


def normalize_series(arr: np.ndarray) -> np.ndarray:
    lo, hi = arr.min(), arr.max()
    if hi - lo < 1e-10:
        return np.zeros_like(arr, dtype=float)
    return (arr - lo) / (hi - lo)


def compute_dtw_norm(s1: List[float], s2: List[float]) -> Optional[float]:
    """DTW on normalized series, normalized by series length."""
    try:
        from fastdtw import fastdtw
        from scipy.spatial.distance import euclidean

        a = normalize_series(np.array(s1, dtype=float))
        b = normalize_series(np.array(s2, dtype=float))
        dist, _ = fastdtw(a, b, dist=euclidean)
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
async def analyze(req: AnalyzeRequest) -> Dict[str, Any]:
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
        for j in range(i + 1, len(records)):
            rj = records[j]
            lat_j, lon_j = rj.get("lat"), rj.get("lon")
            var_j = rj.get("variableName")
            if lat_j is None or lon_j is None or not var_j:
                continue
            if var_i.lower() != var_j.lower():
                continue
            dist = haversine_km(lat_i, lon_i, lat_j, lon_j)
            if dist < SPATIAL_THRESHOLD_KM:
                candidate_pairs.append((i, j, dist))

    logger.info("Found %d spatial candidate pairs", len(candidate_pairs))

    # -------------------------------------------------------------------------
    # Fetch TS values for candidate TSIDs, compute Pearson + DTW
    # -------------------------------------------------------------------------
    candidate_tsids: set = set()
    for i, j, _ in candidate_pairs:
        candidate_tsids.add(records[i]["tsid"])
        candidate_tsids.add(records[j]["tsid"])

    ts_values: Dict[str, List[float]] = {}
    if candidate_tsids:
        ts_values = fetch_ts_values(list(candidate_tsids))

    # Evaluate each candidate pair
    confirmed_pairs: List[tuple] = []  # (i, j, dist_km, pearson_r, dtw_norm)

    for i, j, dist_km in candidate_pairs:
        tsid_i = records[i]["tsid"]
        tsid_j = records[j]["tsid"]
        vals_i = ts_values.get(tsid_i)
        vals_j = ts_values.get(tsid_j)

        pearson_r: Optional[float] = None
        dtw_norm: Optional[float] = None
        is_duplicate = False

        if vals_i and vals_j:
            pearson_r = compute_pearson(vals_i, vals_j)
            dtw_norm = compute_dtw_norm(vals_i, vals_j)
            if pearson_r is not None and pearson_r > CORR_THRESHOLD:
                is_duplicate = True
            if dtw_norm is not None and dtw_norm < DTW_NORM_THRESHOLD:
                is_duplicate = True
        else:
            # No TS data: conservatively flag all spatial candidates
            is_duplicate = True

        if is_duplicate:
            confirmed_pairs.append((i, j, dist_km, pearson_r, dtw_norm))

    logger.info("Confirmed %d duplicate pairs after correlation/DTW checks", len(confirmed_pairs))

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

    return {
        "records": records,
        "duplicateGroups": duplicate_groups,
        "pcaCoords": pca_coords,
    }


# =============================================================================
# Health check
# =============================================================================
@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}
