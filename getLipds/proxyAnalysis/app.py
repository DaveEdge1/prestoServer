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

import asyncio
import concurrent.futures
import hashlib
import io
import json
import logging
import math
import os
import pickle
import re
import time
import zipfile
from collections import defaultdict, deque
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np
import pandas as pd
import requests
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from scipy.stats import pearsonr
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Proxy Analysis Service")


@app.on_event("startup")
async def _startup_sparql_health():
    """Rehydrate the LiPD cache index and start hourly SPARQL health probe.

    The lipdverse SPARQL endpoint periodically returns "XHR didn't work: 0",
    which stalls every /correlate call for ~20 s. This background task probes
    SPARQL once per hour and keeps _sparql_cooldown_until in sync so
    interactive requests never wait on a broken upstream.
    """
    _cache_rehydrate_on_startup()
    asyncio.create_task(_sparql_health_loop())

# =============================================================================
# Configuration
# =============================================================================
QUERY_CSV_URL = "https://lipdverse.org/lipdverse/lipdverseQuery.zip"
GRAPHDB_URL = os.environ.get("GRAPHDB_URL", "https://linkedearth.graphdb.mint.isi.edu")
ORCHESTRATOR_URL = os.environ.get("ORCHESTRATOR_URL", "http://presto-orchestrator:3000")
SPATIAL_THRESHOLD_KM = 10.0
CORR_THRESHOLD = 0.8
DTW_NORM_THRESHOLD = 0.03

# variableName values that are metadata / chronology artifacts, not proxy
# time series — skip them during duplicate detection. Kept in sync with
# DEFAULT_BLACKLIST_VARIABLE_NAMES in query/public/datacleaningApp.js.
NON_PROXY_VARIABLE_NAMES = {
    # axes
    "age", "year", "depth", "depthtop", "depthbottom", "juliandate", "duration",
    # uncertainty
    "uncertainty", "uncertaintyhigh", "uncertaintylow",
    "uncertainty1s", "uncertainty2s", "uncertaintyhigh95", "uncertaintylow95",
    # tree-ring chronology statistics
    "arstan", "rbar", "eps", "correlationcoefficient",
    "segmentlength", "samplecount", "residualchronology", "correction",
    # metadata / flags
    "sampleid", "core", "notes", "hashiatus", "hasgap",
    "composite", "needstobechanged", "count",
    # derived / dimensionality reduction
    "pc1", "cca1",
    # varve/sediment thickness — blacklisted except when annually resolved
    "thickness",
    # misc statistics
    "numberofsamples", "standarddeviation", "standarderror",
}


def _is_blacklisted(var_name: Optional[str], resolution: Optional[float]) -> bool:
    """Return True if a record's variableName should be skipped during duplicate
    detection. Mirrors the client-side rescue rule: `thickness` passes when
    the record is annually resolved (resolution <= 1).
    """
    if not var_name:
        return False
    vn = var_name.strip().lower()
    if vn not in NON_PROXY_VARIABLE_NAMES:
        return False
    if vn == "thickness" and resolution is not None and resolution <= 1:
        return False
    return True


# =============================================================================
# Per-dataset auto-selection (Tier A/B/C cascade)
# =============================================================================
# Archive → ordered variableName priority list. Case-insensitive. Top of list
# wins. Used as Tier C fallback when neither paleoData_useInGlobalTemperatureAnalysis
# populated for any record in the dataset.
ARCHIVE_VARIABLE_PRIORITY: Dict[str, List[str]] = {
    "coral":               ["d18O", "Sr/Ca", "Mg/Ca", "calcification"],
    "sclerosponge":        ["d18O", "Sr/Ca", "Mg/Ca"],
    "wood":                ["trsgi", "TRW", "MXD", "density", "BI", "reflectance", "trmxdsgi", "d18O", "d13C"],
    "glacierice":          ["d18O", "accumulation", "dD", "d2H", "melt"],
    "speleothem":          ["d18O", "d13C"],
    "marinesediment":      ["alkenone", "Uk37", "Mg/Ca", "d18O", "TEX86"],
    "lakesediment":        ["chironomid", "varveThickness", "thickness", "BSi", "d18O", "d2H", "TEX86", "pollen"],
    "peat":                ["d13C", "d18O", "testateAmoebae"],
    "fluvialsediment":     ["thickness", "BSi"],
    "shoreline":           ["lakeLevel"],
    "terrestrialsediment": ["d18O", "d13C", "pollen"],
    "midden":              ["pollen"],
    "molluskshell":        ["d18O", "Mg/Ca"],
    "groundice":           ["d18O"],
    "borehole":            ["temperature"],
    "documents":           ["phenology"],
}

# Case-insensitive aliases so "SrCa" matches "Sr/Ca", etc.
VARIABLE_ALIASES: Dict[str, str] = {
    "srca":   "sr/ca",
    "mgca":   "mg/ca",
    "uk'37":  "uk37",
}


def _norm_var(name: Optional[str]) -> str:
    """Lower-case and alias-normalize a variable name for priority lookup."""
    if not name:
        return ""
    s = str(name).strip().lower()
    return VARIABLE_ALIASES.get(s, s)


def _variable_rank(archive: Optional[str], variable: Optional[str]) -> int:
    """Return 0-based priority rank for a (archive, variable) pair. Unknown
    pairs get a large sentinel so step-5 tiebreakers decide."""
    if not archive:
        return 10_000
    pri = ARCHIVE_VARIABLE_PRIORITY.get(archive.strip().lower())
    if not pri:
        return 10_000
    norm = _norm_var(variable)
    for i, v in enumerate(pri):
        if _norm_var(v) == norm:
            return i
    return 10_000


def _parse_version_tuple(v: str) -> Tuple[int, ...]:
    """Parse a compilation version string like '2_1_4' into (2,1,4) for ordered
    comparison. Returns empty tuple on non-numeric input so plain strings sort
    lower than any versioned entry."""
    parts = []
    for chunk in v.split("_"):
        try:
            parts.append(int(chunk))
        except ValueError:
            return tuple()
    return tuple(parts)


def _tier_a_candidates(dataset_records: List[Dict]) -> List[Dict]:
    """Return records explicitly flagged useInGlobalTempAnalysis=True.
    The former inCompilationBeta branch was removed because
    paleoData_mostRecentCompilations already encodes compilation membership.
    """
    return [r for r in dataset_records if r.get("useInGlobalTempAnalysis") is True]


def _tier_b_candidates(dataset_records: List[Dict]) -> List[Dict]:
    """Records with a populated interp_Vars (current pipeline signal)."""
    out = []
    for rec in dataset_records:
        iv = rec.get("interp_Vars")
        if iv and str(iv).strip() and str(iv).strip().lower() not in ("na", "null", "none"):
            out.append(rec)
    return out


def _final_sort_key(rec: Dict) -> Tuple:
    """Tiebreaker: longest age span DESC, finest resolution ASC, tsid ASC."""
    min_age = rec.get("minAge")
    max_age = rec.get("maxAge")
    span = 0.0
    if min_age is not None and max_age is not None:
        span = abs(max_age - min_age)
    res = rec.get("resolution")
    res_key = res if res is not None else float("inf")
    return (-span, res_key, rec.get("tsid") or "")


def compute_auto_selection(
    records: List[Dict],
) -> Tuple[Set[str], Set[str], Set[str], List[Dict]]:
    """Apply the three-tier cascade (Tier A: combined useInGlobal+inCompilationBeta,
    Tier B: interp_Vars, Tier C: archive->variable priority) to each dataset.

    Returns:
        auto_kept_tsids: TSIDs auto-picked as the dataset's primary proxy
        auto_dropped_tsids: every other record (includes needs-review members)
        needs_review_tsids: subset of auto_dropped_tsids that the UI must surface
            for manual resolution before Continue is allowed
        datasets: list of per-dataset dicts with status/confidence/rationale
    """
    # Group by dataset. Prefilter blacklisted + missing lat/lon here.
    by_dataset: Dict[str, List[Dict]] = defaultdict(list)
    excluded: Set[str] = set()
    for rec in records:
        tsid = rec.get("tsid")
        if not tsid:
            continue
        ds = rec.get("dataSetName")
        if not ds:
            # Records without a dataset name can't be grouped; auto-keep them
            # conservatively so we don't silently drop them.
            excluded.add(tsid)
            continue
        if _is_blacklisted(rec.get("variableName"), rec.get("resolution")):
            excluded.add(tsid)
            continue
        if rec.get("lat") is None or rec.get("lon") is None:
            excluded.add(tsid)
            continue
        by_dataset[ds].append(rec)

    auto_kept: Set[str] = set()
    auto_dropped: Set[str] = set(excluded)
    needs_review: Set[str] = set()
    datasets_out: List[Dict] = []

    for ds_name, ds_recs in by_dataset.items():
        archive = ds_recs[0].get("archiveType") if ds_recs else None
        tier = "C"
        candidates: List[Dict] = []
        confidence = "low"

        # Hard rule: any record explicitly flagged `useInGlobalTempAnalysis=TRUE`
        # by a compilation curator is always auto-kept, regardless of how many
        # such records exist in the dataset. These are presumed primary by the
        # community; the user can still override by expanding the card.
        forced_keep = [r for r in ds_recs if r.get("useInGlobalTempAnalysis") is True]
        if forced_keep:
            # Sort the forced-keep set so the first variable shown in the UI is
            # the top-priority proxy for the archive.
            forced_keep.sort(key=lambda r: (_variable_rank(archive, r.get("variableName")),
                                            _final_sort_key(r)))
            tier, candidates, confidence = "A", forced_keep, "high"
            # Fall through to the single-assignment block below — picked = candidates
            # (all of them) because forced_keep always auto-picks, never reviews.
        else:
            # Tier A (inCompilationBeta latest-version) → Tier B → Tier C cascade
            tier_a = _tier_a_candidates(ds_recs)
            if tier_a:
                tier, candidates, confidence = "A", tier_a, "high"
            else:
                tier_b = _tier_b_candidates(ds_recs)
                if tier_b:
                    tier, candidates, confidence = "B", tier_b, "medium"
                else:
                    # Tier C — everything in the dataset is a candidate; pick by priority
                    tier, candidates, confidence = "C", list(ds_recs), "low"

        # Sort candidates by priority rank, then final-sort key
        candidates.sort(key=lambda r: (_variable_rank(archive, r.get("variableName")),
                                       _final_sort_key(r)))

        picked: List[Dict] = []
        status = "auto-picked"

        if forced_keep:
            # Explicit curator flag — keep every flagged record, no review.
            picked = list(forced_keep)
        elif tier in ("A", "B"):
            if len(candidates) == 1:
                picked = [candidates[0]]
            else:
                # ≥2 candidates with no single clear primary. Auto-keep them
                # all (the plot + comparison table on expand show the user the
                # full picture); they can uncheck any row they decide to drop.
                # The `needs-review` status remains as a visual flag so the UI
                # can highlight these datasets for attention, but no Next-button
                # gating applies.
                status = "needs-review"
                picked = list(candidates)
        else:  # Tier C
            if not candidates:
                continue
            best_rank = _variable_rank(archive, candidates[0].get("variableName"))
            top = [r for r in candidates
                   if _variable_rank(archive, r.get("variableName")) == best_rank]
            if len(top) == 1 or best_rank < 10_000:
                # Unambiguous top or at least one match in the priority list
                picked = [top[0]]
            else:
                # No archive/variable match anywhere → pick single longest record
                picked = [candidates[0]]

        picked_tsids = {r["tsid"] for r in picked}
        ds_kept, ds_dropped = [], []
        for r in ds_recs:
            if r["tsid"] in picked_tsids:
                auto_kept.add(r["tsid"])
                ds_kept.append(r["tsid"])
            else:
                auto_dropped.add(r["tsid"])
                ds_dropped.append(r["tsid"])

        datasets_out.append({
            "dataSetName": ds_name,
            "archiveType": archive,
            "status": status,
            "tier": tier,
            "confidence": confidence,
            "autoKeptTsids": ds_kept,
            "autoDroppedTsids": ds_dropped,
            "candidateTsids": [r["tsid"] for r in candidates],
        })

    return auto_kept, auto_dropped, needs_review, datasets_out


# =============================================================================
# Filter-options metadata (for client-side auto-selection panel)
# =============================================================================
# Per-archive default whitelist. Flattened from ARCHIVE_VARIABLE_PRIORITY —
# every variable listed there is treated as a "default on" primary proxy for
# that archive. Archives present in the data but absent from this map have
# empty defaults (all variables start unchecked for those).
_ARCHIVE_DEFAULT_VARS: Dict[str, Set[str]] = {
    arch.lower(): {_norm_var(v) for v in vars_}
    for arch, vars_ in ARCHIVE_VARIABLE_PRIORITY.items()
}


def _is_default_variable(archive: Optional[str], variable: Optional[str]) -> bool:
    """Default-on policy for the Step-1 auto-selection variable list. Every
    variable present in the data starts checked — the Variable filter is
    primarily an opt-OUT tool for excluding known-unwanted proxies, not an
    opt-IN whitelist. The per-archive priority map (ARCHIVE_VARIABLE_PRIORITY)
    still drives server-side ranking; defaults here only control which
    checkboxes start selected in the UI.
    """
    return bool(variable)


_NO_INTERP_VALUE = "(no interpretation)"


def _interp_buckets(raw: Optional[str]) -> List[str]:
    """Split a raw interp_Vars cell into the deduped list of buckets it
    contributes to. Empty / NA / null → [_NO_INTERP_VALUE]. Multi-valued
    cells like "temperature|precipitationIsotope" → ["temperature",
    "precipitationIsotope"]. Duplicates within a cell (e.g. when a TS has
    the same interpretation in interpretation1_* and interpretation2_*) are
    collapsed so each record contributes at most 1 to any bucket's count.

    The upstream separator produced by lipdverseR's queryCsv.R is `|`;
    `;` and `,` are accepted defensively in case cells ever use them."""
    if raw is None:
        return [_NO_INTERP_VALUE]
    s = str(raw).strip()
    if not s or s.lower() in ("nan", "none", "null", "na"):
        return [_NO_INTERP_VALUE]
    seen: Set[str] = set()
    out: List[str] = []
    for p in re.split(r"[|;,]", s):
        v = p.strip()
        if v and v not in seen:
            seen.add(v)
            out.append(v)
    return out or [_NO_INTERP_VALUE]


def compute_filter_options(records: List[Dict]) -> Dict[str, Any]:
    """Build the filter-options payload consumed by the Step-1 auto-selection
    panel. Counts are over the raw (non-blacklisted) record set — the client
    derives "kept" counts by re-running the AND-filter in JS.

    Returns:
        {
          "interpVarSummary":  [{"value": str, "count": int}, ...],
          "variablesByArchive": {
              "<archive>": [
                  {"name": str, "count": int, "isDefault": bool}, ...
              ],
              ...
          },
        }
    """
    # interp_Vars counts (including "(no interpretation)" bucket)
    interp_counts: Dict[str, int] = defaultdict(int)
    # variablesByArchive: {archive: {variable_name: count}}
    vars_by_archive: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

    for rec in records:
        if _is_blacklisted(rec.get("variableName"), rec.get("resolution")):
            continue
        for bucket in _interp_buckets(rec.get("interp_Vars")):
            interp_counts[bucket] += 1
        archive = (rec.get("archiveType") or "").strip() or "(unknown)"
        variable = (rec.get("variableName") or "").strip()
        if variable:
            vars_by_archive[archive][variable] += 1

    # Sort interp values by count desc, with "(no interpretation)" last
    interp_summary = sorted(
        interp_counts.items(),
        key=lambda kv: (kv[0] == _NO_INTERP_VALUE, -kv[1], kv[0].lower()),
    )
    interp_out = [{"value": v, "count": c} for v, c in interp_summary]

    # Sort each archive's variables by count desc
    variables_out: Dict[str, List[Dict[str, Any]]] = {}
    for archive, var_counts in vars_by_archive.items():
        entries = [
            {
                "name": name,
                "count": count,
                "isDefault": _is_default_variable(archive, name),
            }
            for name, count in var_counts.items()
        ]
        entries.sort(key=lambda e: (-e["count"], e["name"].lower()))
        variables_out[archive] = entries

    return {
        "interpVarSummary": interp_out,
        "variablesByArchive": variables_out,
    }


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
# Prefer the local MySQL `query` table when MYSQL_HOST is configured — that's
# where the local-primary-proxy updater writes the enriched column
# (paleoData_useInGlobalTemperatureAnalysis) that doesn't exist in the
# upstream lipdverseQuery.zip. Fall back to the CSV zip when the DB is
# unavailable so the service still works standalone.
MYSQL_HOST = os.environ.get("MYSQL_HOST")
MYSQL_USER = os.environ.get("MYSQL_USER", "dave")
MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD")
MYSQL_DATABASE = os.environ.get("MYSQL_DATABASE", "lipdverse")


def _load_metadata_from_mysql() -> pd.DataFrame:
    import mysql.connector  # local import so non-MySQL deployments stay lean
    conn = mysql.connector.connect(
        host=MYSQL_HOST,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DATABASE,
    )
    try:
        df = pd.read_sql("SELECT * FROM query", conn)
    finally:
        conn.close()
    return df


def load_metadata() -> pd.DataFrame:
    global _metadata_df, _metadata_cache_time
    now = time.time()
    if _metadata_df is not None and (now - _metadata_cache_time) < CACHE_TTL_SECONDS:
        return _metadata_df

    df: Optional[pd.DataFrame] = None
    if MYSQL_HOST and MYSQL_PASSWORD:
        try:
            logger.info("Loading metadata from MySQL %s/%s", MYSQL_HOST, MYSQL_DATABASE)
            df = _load_metadata_from_mysql()
            logger.info(
                "Loaded %d records from MySQL; has_useInGlobal=%s",
                len(df),
                "paleoData_useInGlobalTemperatureAnalysis" in df.columns,
            )
        except Exception as exc:
            logger.warning("MySQL load failed, falling back to CSV: %s", exc)
            df = None

    if df is None:
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


def _ages_overlap(
    min_a: Optional[float],
    max_a: Optional[float],
    min_b: Optional[float],
    max_b: Optional[float],
) -> bool:
    """
    True iff two [minAge, maxAge] ranges overlap, or if either range is
    unknown (we conservatively keep records with missing age metadata rather
    than dropping them from duplicate review).
    """
    if min_a is None or max_a is None or min_b is None or max_b is None:
        return True
    lo_a, hi_a = (min_a, max_a) if min_a <= max_a else (max_a, min_a)
    lo_b, hi_b = (min_b, max_b) if min_b <= max_b else (max_b, min_b)
    return hi_a >= lo_b and hi_b >= lo_a


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


# -----------------------------------------------------------------------------
# Time-unit normalization
# -----------------------------------------------------------------------------
# LiPD / lipdverse time axes use a handful of conventions — "yr BP" (years
# before 1950), "yr AD" / "CE" (calendar years), "ky BP" (thousands of years
# BP), "Ma BP" (millions).  We normalize to a single common unit per request
# so that plots, duplicate detection, and temporal-overlap checks all speak
# the same language.
CANONICAL_YR_BP  = "yr BP"
CANONICAL_YR_AD  = "yr AD"
CANONICAL_KY_BP  = "ka BP"
CANONICAL_MA_BP  = "Ma BP"
# Preference order used as a tie-breaker when two units are equally popular.
_UNIT_PREFERENCE = [CANONICAL_YR_BP, CANONICAL_YR_AD, CANONICAL_KY_BP, CANONICAL_MA_BP]


def _canonical_time_unit(raw: Optional[str]) -> Optional[str]:
    """
    Map a raw unit string (from a LiPD column's ``units`` or ``variableName``)
    to one of our canonical tokens, or None if unrecognised.
    """
    if raw is None:
        return None
    s = str(raw).strip().lower()
    if not s or s in ("nan", "none", "null"):
        return None

    # Strip common suffixes / prefixes ("cal ", "calibrated ", "[...]", etc.)
    s = re.sub(r"[\[\](){}]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()

    has_bp = "bp" in s or "before present" in s
    has_ad = ("ad" in s and "add" not in s) or " ce" == s or s == "ce" or s.startswith("ce ") or s.endswith(" ce") or "year ce" in s or "year ad" in s or s in ("year", "years", "yr", "yrs", "yr ce", "yrs ce", "year ad", "years ad")

    # Mega-annum (millions of years before present)
    if re.search(r"\b(ma|myr|million\s*year|megayear)\b", s) and has_bp:
        return CANONICAL_MA_BP
    if re.search(r"\b(ma|myr)\b", s) and not has_ad:
        return CANONICAL_MA_BP

    # Kilo-annum (thousands of years before present)
    if re.search(r"\b(ka|kyr|kyrs|ky|kyear|kiloyear|thousand\s*year)\b", s) and has_bp:
        return CANONICAL_KY_BP
    if re.search(r"\b(ka|kyr|kyrs|ky)\b", s) and not has_ad:
        return CANONICAL_KY_BP

    # Years before present
    if has_bp:
        return CANONICAL_YR_BP

    # Calendar years AD / CE
    if has_ad:
        return CANONICAL_YR_AD

    # Bare "year" / "years" with no BP marker — treat as calendar year (AD).
    # This is the convention used by most recent instrumental records.
    if re.search(r"\byears?\b", s) or re.search(r"\byrs?\b", s):
        return CANONICAL_YR_AD

    return None


def _convert_time_value(v: float, src: str, dst: str) -> float:
    """
    Convert a single time value from ``src`` canonical unit to ``dst``.
    Both units must be canonical tokens from this module. Returns the value
    unchanged if the units are the same.
    """
    if src == dst:
        return v

    # First convert src → yr BP as the common intermediate.
    if src == CANONICAL_YR_BP:
        bp = v
    elif src == CANONICAL_YR_AD:
        bp = 1950.0 - v
    elif src == CANONICAL_KY_BP:
        bp = v * 1000.0
    elif src == CANONICAL_MA_BP:
        bp = v * 1_000_000.0
    else:
        return v  # unknown src

    # Then yr BP → dst.
    if dst == CANONICAL_YR_BP:
        return bp
    if dst == CANONICAL_YR_AD:
        return 1950.0 - bp
    if dst == CANONICAL_KY_BP:
        return bp / 1000.0
    if dst == CANONICAL_MA_BP:
        return bp / 1_000_000.0
    return v


def _convert_time_array(
    time_vals: List[float], src: Optional[str], dst: Optional[str]
) -> List[float]:
    """Convert a whole time array. If either unit is unknown, returns input."""
    if not time_vals or not src or not dst or src == dst:
        return time_vals
    return [_convert_time_value(float(t), src, dst) for t in time_vals]


def _pick_common_unit(units: List[Optional[str]]) -> Optional[str]:
    """
    Canonicalize every series to ``yr BP`` when at least one parseable unit
    is present in the group. Used by internal duplicate-detection code where
    the choice of unit doesn't affect downstream math — we pick BP because
    it's lipdverse's native convention.

    UI-facing /correlate uses `_pick_display_unit` instead, which switches
    between yr AD and yr BP based on whether the data lives in the common
    era or extends deeper into the past.
    """
    if any(u for u in units):
        return CANONICAL_YR_BP
    return None


def pick_session_display_unit(
    records: List[Dict],
    ad_threshold_bp: float = 2000.0,
) -> str:
    """Decide the user-facing time unit for an entire data-cleaning session.

    Looks at every record's CSV-derived ``maxAge`` (always yr BP by
    lipdverseR convention). If a majority of records with a defined maxAge
    don't extend beyond ``ad_threshold_bp`` years BP, return ``yr AD``;
    otherwise ``yr BP``. Defaults to yr BP when no records have a defined
    maxAge.

    This single decision is shipped in /analyze's response and applied
    consistently to every downstream display in the session (main records
    table, per-dataset plots, candidate tables, Step 2 plots, and anywhere
    else that renders an Age or Year axis).
    """
    within, beyond = 0, 0
    for r in records:
        ma = r.get("maxAge")
        if ma is None:
            continue
        try:
            ma = float(ma)
        except (TypeError, ValueError):
            continue
        if ma <= ad_threshold_bp:
            within += 1
        else:
            beyond += 1
    if within == 0 and beyond == 0:
        return CANONICAL_YR_BP
    return CANONICAL_YR_AD if within > beyond else CANONICAL_YR_BP


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
        _first_present(row, "minAge", "age_min", "ageMin", "age_min_ky", "minYear", "age_min_BP")
    )
    max_age = _safe_float(
        _first_present(row, "maxAge", "age_max", "ageMax", "age_max_ky", "maxYear", "age_max_BP")
    )
    resolution = _safe_float(
        _first_present(row, "resolution", "medianResolution", "median_resolution")
    )

    # Parse the useInGlobalTemperatureAnalysis string ("TRUE"/"FALSE"/NA) into
    # a strict bool. Absent column or any non-TRUE value → False (never None),
    # so compute_auto_selection can rely on `is True`.
    ugta_raw = _first_present(
        row,
        "paleoData_useInGlobalTemperatureAnalysis",
        "useInGlobalTemperatureAnalysis",
    )
    ugta = isinstance(ugta_raw, str) and ugta_raw.strip().upper() == "TRUE"

    return {
        "tsid": _safe_str(_first_present(row, "paleoData_TSid", "TSid", "tsid")),
        "dataSetName": _safe_str(
            _first_present(row, "dataSetName", "datasetName", "datasetId")
        ),
        "archiveType": _safe_str(row.get("archiveType")),
        "variableName": _safe_str(row.get("paleoData_variableName")),
        "proxy": _safe_str(row.get("paleoData_proxy")),
        "units": _safe_str(row.get("paleoData_units")),
        "compilation": _safe_str(row.get("paleoData_mostRecentCompilations")),
        "interp_Vars": _safe_str(_first_present(row, "interp_Vars", "interpVars")),
        "interp_Details": _safe_str(
            _first_present(row, "interp_Details", "interpDetails")
        ),
        "seasonality": _safe_str(
            _first_present(row, "interpretation1_seasonality", "seasonality")
        ),
        "useInGlobalTempAnalysis": ugta,
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
    # Filter-options payload for client-side auto-selection (Step 1 panel).
    # The client re-runs an AND-filter in JS on every toggle, so the server no
    # longer needs to pick primaries — it just ships the facet counts.
    # -------------------------------------------------------------------------
    filter_options = compute_filter_options(records)

    # -------------------------------------------------------------------------
    # Spatial duplicate detection: pairs within SPATIAL_THRESHOLD_KM with same
    # variableName, computed over *all* non-blacklisted records. The client
    # hides groups whose members don't survive the current filter, so we do
    # not need to recompute when filters change.
    # -------------------------------------------------------------------------
    candidate_pairs: List[tuple] = []  # (i, j, dist_km)
    kept_indices = [
        i for i, r in enumerate(records)
        if r.get("lat") is not None
        and r.get("lon") is not None
        and r.get("variableName")
        and not _is_blacklisted(r.get("variableName"), r.get("resolution"))
    ]

    for idx_i in range(len(kept_indices)):
        i = kept_indices[idx_i]
        ri = records[i]
        lat_i, lon_i = ri.get("lat"), ri.get("lon")
        var_i = ri.get("variableName")
        if lat_i is None or lon_i is None or not var_i:
            continue
        if _is_blacklisted(var_i, ri.get("resolution")):
            continue
        comp_i = _parse_compilations(ri.get("compilation"))
        min_i, max_i = ri.get("minAge"), ri.get("maxAge")
        for idx_j in range(idx_i + 1, len(kept_indices)):
            j = kept_indices[idx_j]
            rj = records[j]
            lat_j, lon_j = rj.get("lat"), rj.get("lon")
            var_j = rj.get("variableName")
            if lat_j is None or lon_j is None or not var_j:
                continue
            if _is_blacklisted(var_j, rj.get("resolution")):
                continue
            if var_i.lower() != var_j.lower():
                continue
            # Records from the same compilation are different data products,
            # not duplicates — skip them regardless of proximity.
            comp_j = _parse_compilations(rj.get("compilation"))
            if comp_i and comp_j and comp_i & comp_j:
                continue
            # Temporal overlap — if both records have a defined age range and
            # those ranges don't overlap, they cannot be duplicates.
            min_j, max_j = rj.get("minAge"), rj.get("maxAge")
            if not _ages_overlap(min_i, max_i, min_j, max_j):
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
        "interpVarSummary": filter_options["interpVarSummary"],
        "variablesByArchive": filter_options["variablesByArchive"],
        "displayTimeUnit": pick_session_display_unit(records),
    }


# =============================================================================
# Streaming analysis endpoint (SSE)
# =============================================================================
def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


@app.post("/analyze-stream")
async def analyze_stream(req: AnalyzeRequest, background_tasks: BackgroundTasks):
    tsids = req.tsids
    if not tsids:
        raise HTTPException(status_code=400, detail="No TSIDs provided")

    async def generate():
        logger.info("Stream: analyzing %d TSIDs", len(tsids))

        # Phase 1: metadata
        yield _sse_event({"phase": "metadata", "status": "loading"})
        try:
            df = load_metadata()
        except Exception as exc:
            yield _sse_event({"phase": "metadata", "status": "error", "message": str(exc)})
            return

        # Find TSid column
        tsid_col = None
        for candidate in ("paleoData_TSid", "TSid", "tsid", "TSID"):
            if candidate in df.columns:
                tsid_col = candidate
                break
        if tsid_col is None:
            yield _sse_event({"phase": "metadata", "status": "error", "message": "TSid column not found"})
            return

        filtered = df[df[tsid_col].isin(set(tsids))].copy()
        yield _sse_event({"phase": "metadata", "status": "done", "recordCount": len(filtered)})

        # Phase 2: build records
        seen: set = set()
        records: list = []
        for _, row in filtered.iterrows():
            rec = row_to_record(row)
            if rec["tsid"] and rec["tsid"] not in seen:
                seen.add(rec["tsid"])
                records.append(rec)

        yield _sse_event({
            "phase": "records",
            "status": "done",
            "records": records,
            # Single global time unit applied to every Age/Year display in
            # the session. Client stores + echoes back via /correlate so plots
            # stay consistent with tables.
            "displayTimeUnit": pick_session_display_unit(records),
        })

        # Phase 2b: filter-options (interp_Vars counts + per-archive variable
        # whitelist). The client uses these to drive the Step-1 auto-selection
        # panel and runs the AND-filter in JS on every toggle.
        filter_options = compute_filter_options(records)
        yield _sse_event({
            "phase": "filterOptions",
            "status": "done",
            "interpVarSummary": filter_options["interpVarSummary"],
            "variablesByArchive": filter_options["variablesByArchive"],
        })

        # Phase 3: PCA (over full record set so the visualization keeps context).
        pca_coords = compute_pca(records)
        yield _sse_event({"phase": "pca", "status": "done", "pcaCoords": pca_coords})

        # Phase 4: spatial duplicate detection — over all non-blacklisted
        # records. The client hides groups whose members don't survive the
        # current filter, so filter changes don't require server recomputation.
        kept_indices = [
            i for i, r in enumerate(records)
            if r.get("lat") is not None
            and r.get("lon") is not None
            and r.get("variableName")
            and not _is_blacklisted(r.get("variableName"), r.get("resolution"))
        ]
        total_records = len(kept_indices)
        yield _sse_event({"phase": "duplicates", "status": "progress", "checked": 0, "total": total_records})
        await asyncio.sleep(0)

        candidate_pairs: list = []
        last_yield_time = time.time()

        for idx_i in range(len(kept_indices)):
            i = kept_indices[idx_i]
            ri = records[i]
            lat_i, lon_i = ri.get("lat"), ri.get("lon")
            var_i = ri.get("variableName")
            if (
                lat_i is not None and lon_i is not None and var_i
                and not _is_blacklisted(var_i, ri.get("resolution"))
            ):
                comp_i = _parse_compilations(ri.get("compilation"))
                var_i_lower = var_i.lower()
                min_i, max_i = ri.get("minAge"), ri.get("maxAge")
                for idx_j in range(idx_i + 1, len(kept_indices)):
                    j = kept_indices[idx_j]
                    rj = records[j]
                    lat_j, lon_j = rj.get("lat"), rj.get("lon")
                    var_j = rj.get("variableName")
                    if lat_j is None or lon_j is None or not var_j:
                        continue
                    if _is_blacklisted(var_j, rj.get("resolution")):
                        continue
                    if var_i_lower != var_j.lower():
                        continue
                    comp_j = _parse_compilations(rj.get("compilation"))
                    if comp_i and comp_j and comp_i & comp_j:
                        continue
                    min_j, max_j = rj.get("minAge"), rj.get("maxAge")
                    if not _ages_overlap(min_i, max_i, min_j, max_j):
                        continue
                    dist = haversine_km(lat_i, lon_i, lat_j, lon_j)
                    if dist < SPATIAL_THRESHOLD_KM:
                        candidate_pairs.append((i, j, dist))

            # Throttle by wall-clock time: emit a progress event at most once
            # every 0.5s, regardless of dataset size.
            now = time.time()
            if now - last_yield_time >= 0.5:
                yield _sse_event({"phase": "duplicates", "status": "progress", "checked": idx_i + 1, "total": total_records})
                last_yield_time = now
                await asyncio.sleep(0)  # release event loop so the chunk flushes

        # Group with union-find
        confirmed_pairs = [(i, j, d, None, None) for i, j, d in candidate_pairs]
        find, union = make_union_find(len(records))
        pair_info: dict = {}

        for i, j, dist_km, pearson_r, dtw_norm in confirmed_pairs:
            union(i, j)
            key = (min(i, j), max(i, j))
            pair_info[key] = {
                "distKm": round(dist_km, 2),
                "pearson": round(pearson_r, 4) if pearson_r is not None else None,
                "dtw": round(dtw_norm, 6) if dtw_norm is not None else None,
            }

        groups_dict: dict = defaultdict(list)
        for i, j, *_ in confirmed_pairs:
            root = find(i)
            if i not in groups_dict[root]:
                groups_dict[root].append(i)
            if j not in groups_dict[root]:
                groups_dict[root].append(j)

        duplicate_groups: list = []
        for group_id, (root, members) in enumerate(groups_dict.items()):
            if len(members) < 2:
                continue
            correlations: list = []
            dtw_distances: list = []
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

        yield _sse_event({"phase": "duplicates", "status": "done", "duplicateGroups": duplicate_groups})

        # Start background preload
        groups_tsids = [g["records"] for g in duplicate_groups]
        if groups_tsids:
            background_tasks.add_task(_preload_lipd_cache, groups_tsids)

        yield _sse_event({"phase": "complete"})

    return StreamingResponse(generate(), media_type="text/event-stream")


# =============================================================================
# On-demand correlation endpoint (called per duplicate group on click)
# =============================================================================
class CorrelateRequest(BaseModel):
    tsids: List[str]
    # Optional: the session-wide display unit chosen at /analyze time. When
    # provided, it overrides the per-request unit detection so every group's
    # plot shares the same axis as the main records table.
    display_unit: Optional[str] = None


# =============================================================================
# LiPD file fallback: download directly from lipdverse.org
# =============================================================================

# =============================================================================
# Disk-backed LiPD series cache
# =============================================================================
# Heavy per-dataset time series are stored as pickle files under _CACHE_DIR so
# container memory stays flat regardless of how many datasets have been seen.
# Two small structures stay resident:
#   _lipd_index            (dsid, dsver) -> set(tsids in that dataset)
#   _lipd_column_meta_cache tsid -> {units, variableName}
# These power /preload-status and _get_time_units without touching disk.
# On startup the cache directory is walked and both are rebuilt, so a restart
# is free — no re-download of previously cached datasets.

_CACHE_DIR = os.environ.get("LIPD_CACHE_DIR", "/cache/lipd")
os.makedirs(_CACHE_DIR, exist_ok=True)

_lipd_index: Dict[Tuple[str, str], Set[str]] = {}
_lipd_column_meta_cache: Dict[str, Dict[str, Optional[str]]] = {}


def _cache_path(dsid: str, dsver: str) -> str:
    key_bytes = f"{dsid}|{dsver}".encode("utf-8")
    return os.path.join(_CACHE_DIR, hashlib.sha256(key_bytes).hexdigest() + ".pkl")


def _cache_load_one(path: str) -> Optional[Dict[str, Any]]:
    try:
        with open(path, "rb") as f:
            return pickle.load(f)
    except Exception as exc:
        logger.warning("LiPD cache: failed to load %s: %s", path, exc)
        return None


def _cache_lookup(dsid: str, dsver: str) -> Optional[Dict[str, List]]:
    """Return cached {tsid: values} for a dataset, or None if not cached.

    Disk is authoritative — under multi-worker uvicorn, another worker may
    have written the pickle without updating this worker's in-memory index.
    We lazy-populate the per-worker index + meta cache on hit.
    """
    key = (dsid, dsver)
    path = _cache_path(dsid, dsver)
    if not os.path.exists(path):
        _lipd_index.pop(key, None)
        return None
    data = _cache_load_one(path)
    if data is None:
        _lipd_index.pop(key, None)
        return None
    series = data.get("series", {})
    if key not in _lipd_index:
        _lipd_index[key] = set(series.keys())
        _lipd_column_meta_cache.update(data.get("meta", {}))
    return series


def _cache_store(
    dsid: str,
    dsver: str,
    series: Dict[str, List],
    meta: Dict[str, Dict[str, Optional[str]]],
) -> None:
    path = _cache_path(dsid, dsver)
    tmp = path + ".tmp"
    try:
        with open(tmp, "wb") as f:
            pickle.dump(
                {"dsid": dsid, "dsver": dsver, "series": series, "meta": meta},
                f,
                protocol=pickle.HIGHEST_PROTOCOL,
            )
        os.replace(tmp, path)
        _lipd_index[(dsid, dsver)] = set(series.keys())
        _lipd_column_meta_cache.update(meta)
    except Exception as exc:
        logger.warning("LiPD cache: failed to write %s: %s", path, exc)
        try:
            os.remove(tmp)
        except OSError:
            pass


def _cache_rehydrate_on_startup() -> None:
    if not os.path.isdir(_CACHE_DIR):
        return
    loaded = 0
    for fname in os.listdir(_CACHE_DIR):
        if not fname.endswith(".pkl"):
            continue
        data = _cache_load_one(os.path.join(_CACHE_DIR, fname))
        if data is None:
            continue
        dsid = data.get("dsid")
        dsver = data.get("dsver")
        if not dsid or dsver is None:
            continue
        _lipd_index[(dsid, dsver)] = set(data.get("series", {}).keys())
        _lipd_column_meta_cache.update(data.get("meta", {}))
        loaded += 1
    logger.info("LiPD cache rehydrated: %d datasets indexed from %s", loaded, _CACHE_DIR)


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


# =============================================================================
# Lipdverse circuit breaker
# =============================================================================
# Two-level protection against slow/dead lipdverse.org responses dragging
# /analyze latency into the minutes.
#
#   Per-dataset negative cache: skip a (dsid, dsver) for 5 min after it fails
#   Global breaker: if >50% of recent (60s) outcomes are failures with at
#                   least 4 samples, open for 90s and short-circuit all calls
#
# State is per-worker (each uvicorn worker keeps its own dicts/deque). Under
# fork that means a transient outage is "discovered" once per worker — minor
# duplication but no correctness issue.

_lipd_recent_failures: Dict[Tuple[str, str], float] = {}
_LIPD_FAILURE_COOLDOWN = 300

_lipd_global_open_until: float = 0.0
_lipd_recent_outcomes: deque = deque(maxlen=40)
_LIPD_BREAKER_FAIL_RATE = 0.5
_LIPD_BREAKER_MIN_SAMPLES = 4
_LIPD_BREAKER_WINDOW = 60
_LIPD_BREAKER_OPEN_FOR = 90

_LIPD_GET_TIMEOUT = 12


def _breaker_should_skip(dsid: str, dsver: str) -> bool:
    now = time.time()
    if now < _lipd_global_open_until:
        return True
    last_fail = _lipd_recent_failures.get((dsid, dsver))
    if last_fail is not None and (now - last_fail) < _LIPD_FAILURE_COOLDOWN:
        return True
    return False


def _breaker_record(dsid: str, dsver: str, success: bool) -> None:
    global _lipd_global_open_until
    now = time.time()
    _lipd_recent_outcomes.append((now, success))
    if success:
        _lipd_recent_failures.pop((dsid, dsver), None)
    else:
        _lipd_recent_failures[(dsid, dsver)] = now

    recent = [ok for ts, ok in _lipd_recent_outcomes if (now - ts) < _LIPD_BREAKER_WINDOW]
    if len(recent) >= _LIPD_BREAKER_MIN_SAMPLES:
        fail_rate = sum(1 for ok in recent if not ok) / len(recent)
        if fail_rate >= _LIPD_BREAKER_FAIL_RATE and now > _lipd_global_open_until:
            logger.warning(
                "LiPD breaker OPEN (fail rate %.0f%%, %d samples in last %ds) — "
                "skipping lipdverse.org for %ds",
                fail_rate * 100, len(recent),
                _LIPD_BREAKER_WINDOW, _LIPD_BREAKER_OPEN_FOR,
            )
            _lipd_global_open_until = now + _LIPD_BREAKER_OPEN_FOR


def _fetch_one_lipd(dsid: str, dsver: str) -> Dict[str, List]:
    """
    Download one LiPD ZIP, extract ALL column series, and cache by (dsid, dsver).
    Returns the full {tsid: values} dict for that dataset.
    Keyed by version so an updated dataset at the source gets a fresh download.
    """
    cached = _cache_lookup(dsid, dsver)
    if cached is not None:
        return cached

    if _breaker_should_skip(dsid, dsver):
        return {}

    url = _resolve_lipd_url(dsid, dsver)
    if url is None:
        logger.warning("LiPD fallback: could not resolve URL for dataset %s", dsid)
        _breaker_record(dsid, dsver, success=False)
        return {}

    try:
        resp = requests.get(url, timeout=_LIPD_GET_TIMEOUT)
        resp.raise_for_status()
        zf = zipfile.ZipFile(io.BytesIO(resp.content))

        # Parse metadata.jsonld for tsid → (csv_filename, column_number)
        with zf.open("bag/data/metadata.jsonld") as f:
            meta_json = json.load(f)

        tsid_to_col: Dict[str, tuple] = {}
        local_meta: Dict[str, Dict[str, Optional[str]]] = {}
        for paleo in meta_json.get("paleoData", []):
            for table in paleo.get("measurementTable", []):
                fname = table.get("filename", "")
                for col in table.get("columns", []):
                    t = str(col.get("TSid", ""))
                    n = col.get("number")
                    if t and n is not None and fname:
                        tsid_to_col[t] = (fname, int(n))
                        # Per-column metadata (units / variableName). Used
                        # later to determine the native unit of a time axis
                        # so we can normalize all series to a common frame.
                        local_meta[t] = {
                            "units":        _safe_str(col.get("units")),
                            "variableName": _safe_str(col.get("variableName")),
                        }

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
        _cache_store(dsid, dsver, dataset_series, local_meta)
        _breaker_record(dsid, dsver, success=True)
        return dataset_series

    except Exception as exc:
        logger.warning("LiPD fallback failed for dataset %s: %s", dsid, exc)
        _breaker_record(dsid, dsver, success=False)
        return {}


def _is_finite_float(v: Any) -> bool:
    try:
        return math.isfinite(float(v))
    except (TypeError, ValueError):
        return False


def _preload_lipd_cache(groups: List[List[str]]) -> None:
    """
    Background task: warm the LiPD disk cache one group at a time, in display order.
    Processing groups sequentially means group 0 is ready first (matches page order).
    Within each group, datasets are downloaded in parallel by _fetch_ts_from_lipd.
    """
    for i, group_tsids in enumerate(groups):
        try:
            _fetch_ts_from_lipd(group_tsids)
            logger.info("Background preload: group %d complete", i)
        except Exception as exc:
            logger.warning("Background preload: group %d failed: %s", i, exc)
    logger.info("Background preload done (%d datasets cached)", len(_lipd_index))


def _get_time_units(time_tsids: List[str]) -> Dict[str, Optional[str]]:
    """
    Return {time_tsid: canonical_unit} for each time-axis TSid.

    Reads from ``_lipd_column_meta_cache``; if a TSid is not present, the
    parent dataset's LiPD file is downloaded (via ``_fetch_ts_from_lipd``)
    to populate the cache, then the lookup retries.
    """
    out: Dict[str, Optional[str]] = {}
    missing: List[str] = []
    for t in time_tsids:
        meta = _lipd_column_meta_cache.get(t)
        if meta is None:
            missing.append(t)
        else:
            canon = _canonical_time_unit(meta.get("units"))
            if canon is None:
                # Fall back to variableName hints ("year", "age", …)
                canon = _canonical_time_unit(meta.get("variableName"))
            out[t] = canon

    if missing:
        try:
            _fetch_ts_from_lipd(missing)
        except Exception as exc:
            logger.warning("Units: warm-cache fetch failed: %s", exc)
        for t in missing:
            meta = _lipd_column_meta_cache.get(t)
            if meta is None:
                out[t] = None
                continue
            canon = _canonical_time_unit(meta.get("units"))
            if canon is None:
                canon = _canonical_time_unit(meta.get("variableName"))
            out[t] = canon
    return out


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
# Circuit breaker: when the upstream SPARQL endpoint is broken (e.g. lipdverse
# returns "XHR didn't work: 0"), every request wastes ~20s. After a failure,
# suppress SPARQL attempts for a cooldown window so the LiPD file fallback runs
# immediately. The hourly health loop keeps this flag in sync with reality so
# users don't have to pay the timeout themselves.
_sparql_cooldown_until: float = 0.0
SPARQL_COOLDOWN_SECONDS = 3900  # slightly longer than the 1-hour probe interval
SPARQL_PROBE_INTERVAL = 3600    # 1 hour


async def _sparql_health_loop() -> None:
    """Background task: probe SPARQL once per hour and update the cooldown."""
    global _sparql_cooldown_until
    # Wait briefly so the app can finish starting before the first probe.
    await asyncio.sleep(5)
    while True:
        try:
            # Need a real TSID to probe with; pull one from metadata.
            probe_tsid: Optional[str] = None
            try:
                df = await asyncio.to_thread(load_metadata)
                tsid_col = next(
                    (c for c in ("paleoData_TSid", "TSid", "tsid", "TSID") if c in df.columns),
                    None,
                )
                if tsid_col and not df.empty:
                    series = df[tsid_col].dropna()
                    if not series.empty:
                        probe_tsid = str(series.iloc[0])
            except Exception as exc:
                logger.warning("SPARQL health probe: metadata load failed: %s", exc)

            if probe_tsid:
                # Bypass the cooldown for the probe itself.
                _sparql_cooldown_until = 0.0
                result, err = await asyncio.to_thread(
                    _fetch_ts_via_orchestrator, [probe_tsid]
                )
                if err or not result:
                    # _fetch_ts_via_orchestrator already set the cooldown on real failures;
                    # make sure it's set here too (covers empty-but-no-error edge case).
                    _sparql_cooldown_until = time.time() + SPARQL_COOLDOWN_SECONDS
                    logger.info("SPARQL health probe: unhealthy (%s)", err or "empty result")
                else:
                    _sparql_cooldown_until = 0.0
                    logger.info(
                        "SPARQL health probe: OK (%d values for %s)",
                        len(result), probe_tsid,
                    )
        except Exception as exc:
            logger.warning("SPARQL health loop iteration error: %s", exc)

        await asyncio.sleep(SPARQL_PROBE_INTERVAL)


def _fetch_ts_via_orchestrator(tsids: List[str]) -> tuple[Dict[str, List[float]], Optional[str]]:
    """Call the Node.js /sparql endpoint and return (values_dict, error_string)."""
    global _sparql_cooldown_until
    now = time.time()
    if now < _sparql_cooldown_until:
        remaining = int(_sparql_cooldown_until - now)
        return {}, f"SPARQL in cooldown ({remaining}s remaining after prior failure)"
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
                # e.g. "XHR didn't work: 0" — upstream is broken, start cooldown
                _sparql_cooldown_until = time.time() + SPARQL_COOLDOWN_SECONDS
                logger.warning(
                    "SPARQL upstream failed (%s); suppressing for %ds",
                    raw, SPARQL_COOLDOWN_SECONDS,
                )
                return {}, raw
        elif isinstance(raw, dict):
            return {k: v for k, v in raw.items() if isinstance(v, list)}, None
        return {}, f"Unexpected response type: {type(raw)}"
    except Exception as exc:
        _sparql_cooldown_until = time.time() + SPARQL_COOLDOWN_SECONDS
        logger.warning(
            "SPARQL via orchestrator failed: %s; suppressing for %ds",
            exc, SPARQL_COOLDOWN_SECONDS,
        )
        return {}, str(exc)


@app.post("/correlate")
async def correlate(req: CorrelateRequest) -> Dict[str, Any]:
    tsids = req.tsids
    if not tsids:
        raise HTTPException(status_code=400, detail="tsids array is required")

    logger.info("Correlating %d TSIDs: %s", len(tsids), tsids)
    _t0 = time.time()

    # Load metadata for lat/lon, variableName, and time TSids
    try:
        df = load_metadata()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Failed to load metadata: {exc}")
    _t_meta = time.time()

    tsid_col = next(
        (c for c in ("paleoData_TSid", "TSid", "tsid", "TSID") if c in df.columns), None
    )
    if tsid_col is None:
        raise HTTPException(status_code=500, detail="TSid column not found")

    filtered = df[df[tsid_col].isin(set(tsids))]
    meta = {str(row[tsid_col]): row for _, row in filtered.iterrows()}

    # Resolve bare hasTimeTsid pointers to the canonical year/age column TSid.
    # Many LiPD exports store `paleoData_hasTimeTsid` as the raw LiPD column
    # ID (e.g. "LPD33714919") while the year row itself carries a suffixed
    # TSid (e.g. "LPD33714919_iso2k"). Querying the bare ID hits a different
    # column or nothing at all. Build a lookup from hasTimeTsid → own_TSid
    # by scanning the year/age rows in every dataset touched by this batch.
    dataset_names = filtered["dataSetName"].dropna().unique().tolist() if "dataSetName" in filtered.columns else []
    time_tsid_lookup: Dict[str, str] = {}
    if dataset_names and "paleoData_variableName" in df.columns:
        var_lower = df["paleoData_variableName"].astype(str).str.lower()
        time_rows = df[
            df["dataSetName"].isin(dataset_names)
            & var_lower.isin(["year", "age", "yearad", "year ad"])
        ]
        for _, row in time_rows.iterrows():
            htt = _safe_str(_first_present(row, "paleoData_hasTimeTsid"))
            own = _safe_str(row.get(tsid_col))
            if htt and own:
                time_tsid_lookup[htt] = own

    # Map each proxy TSid → its corresponding time-axis TSid (resolved).
    time_tsid_map: Dict[str, str] = {}
    for tsid in tsids:
        row = meta.get(tsid)
        if row is not None:
            t_tsid = _safe_str(_first_present(row, "paleoData_hasTimeTsid"))
            if t_tsid:
                # Prefer the canonical year-row TSid if present; otherwise
                # fall back to the raw pointer (which may itself be the
                # real TSid for datasets without the suffix mismatch).
                time_tsid_map[tsid] = time_tsid_lookup.get(t_tsid, t_tsid)

    # Query proxy + time TSids in one call
    all_query_tsids = list(tsids) + [
        t for t in time_tsid_map.values() if t not in tsids
    ]

    _t_sparql_start = time.time()
    ts_values, sparql_error = _fetch_ts_via_orchestrator(all_query_tsids)
    _t_sparql = time.time()
    logger.info(
        "SPARQL: got values for %d / %d TSIDs in %.2fs%s",
        len(ts_values),
        len(all_query_tsids),
        _t_sparql - _t_sparql_start,
        f" (error: {sparql_error})" if sparql_error else "",
    )

    # Fallback: download LiPD files when SPARQL failed OR returned incomplete data.
    # A partial SPARQL result (some TSIDs missing) is the common case for newer
    # records not yet indexed in GraphDB — don't wait until ts_values is empty.
    # Also fall back when proxy/time lengths MISMATCH (SPARQL pre-strips Nones,
    # which destroys the row alignment we need for per-series time axes).
    missing_proxy = [t for t in tsids if t not in ts_values]
    length_mismatch = False
    for tsid in tsids:
        t_tsid = time_tsid_map.get(tsid)
        if not t_tsid:
            continue
        pv = ts_values.get(tsid, [])
        tv = ts_values.get(t_tsid, [])
        if pv and tv and len(pv) != len(tv):
            length_mismatch = True
            break
    if sparql_error or missing_proxy or length_mismatch:
        if sparql_error:
            logger.info("SPARQL unavailable — falling back to LiPD file download")
        elif length_mismatch:
            logger.info(
                "SPARQL proxy/time length mismatch — re-fetching via LiPD to preserve row alignment"
            )
        else:
            logger.info(
                "SPARQL missing %d/%d proxy TSIDs — supplementing with LiPD fallback",
                len(missing_proxy), len(tsids),
            )
        try:
            lipd_values = _fetch_ts_from_lipd(all_query_tsids)
            if lipd_values:
                # Merge: fill gaps without overwriting good SPARQL data.
                # But when a length mismatch was detected, OVERWRITE with
                # LiPD values — SPARQL's None-stripped arrays are useless
                # for time-aligned analysis even when non-empty.
                for k, v in lipd_values.items():
                    if k not in ts_values or length_mismatch:
                        ts_values[k] = v
                still_missing = [t for t in tsids if t not in ts_values]
                logger.info(
                    "After LiPD fallback: %d TSIDs resolved, %d still missing",
                    len(ts_values), len(still_missing),
                )
                if not still_missing:
                    sparql_error = None  # all gaps filled — suppress warning
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

    # -------------------------------------------------------------------------
    # Normalize time axes to a common unit across the entire group.
    # Each proxy TSid's time axis lives under its `paleoData_hasTimeTsid`.
    # We look up the raw unit for each time TSid, pick the mode across the
    # group, then convert every series' time array into that unit so plots
    # and comparisons share a coordinate system.
    # -------------------------------------------------------------------------
    time_tsids_unique = list({tt for tt in time_tsid_map.values() if tt})
    time_unit_by_ttsid = _get_time_units(time_tsids_unique) if time_tsids_unique else {}
    # Per-series native unit (keyed by proxy tsid, via its time tsid)
    native_unit_by_tsid: Dict[str, Optional[str]] = {
        tsid: time_unit_by_ttsid.get(time_tsid_map.get(tsid, ""))
        for tsid in tsids
    }
    # Prefer the session-wide display unit from /analyze when the client
    # passes it, so every plot in the session shares the same axis. Fall
    # back to BP when native units are parseable but no hint was supplied.
    if req.display_unit in (CANONICAL_YR_BP, CANONICAL_YR_AD, CANONICAL_KY_BP, CANONICAL_MA_BP):
        common_unit = req.display_unit if any(native_unit_by_tsid.values()) else None
    else:
        common_unit = _pick_common_unit(list(native_unit_by_tsid.values()))
    if common_unit:
        for tsid in tsids:
            s = series[tsid]
            if not s["time"]:
                continue
            src = native_unit_by_tsid.get(tsid)
            if not src:
                # Unknown native unit — skip conversion rather than guess.
                s["timeUnit"] = None
                continue
            s["time"] = _convert_time_array(s["time"], src, common_unit)
            s["timeUnit"] = common_unit
            # Re-sort monotonically after conversion (AD↔BP flips direction)
            if len(s["time"]) > 1:
                pairs_tv = list(zip(s["time"], s["values"]))
                if any(pairs_tv[i][0] > pairs_tv[i + 1][0] for i in range(len(pairs_tv) - 1)):
                    pairs_tv.sort(key=lambda p: p[0])
                    s["time"]   = [p[0] for p in pairs_tv]
                    s["values"] = [p[1] for p in pairs_tv]
    else:
        for tsid in tsids:
            series[tsid]["timeUnit"] = None

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

            # Use the time-aware correlation so the UI shows the same Pearson
            # value the automated-review detector sees. compute_pearson() does
            # naive positional prefix comparison and misaligns series with
            # different sampling grids.
            pearson_r = _pair_correlation(series[ti], series[tj]) if vals_i and vals_j else None
            dtw_norm = compute_dtw_norm(vals_i, vals_j) if vals_i and vals_j else None

            pairs.append({
                "tsid1": ti,
                "tsid2": tj,
                "pearson": round(pearson_r, 4) if pearson_r is not None else None,
                "dtw": round(dtw_norm, 6) if dtw_norm is not None else None,
                "distKm": dist_km,
            })

    _t_end = time.time()
    logger.info(
        "/correlate timing: total=%.2fs meta=%.2fs sparql=%.2fs rest=%.2fs (tsids=%d, pairs=%d)",
        _t_end - _t0,
        _t_meta - _t0,
        _t_sparql - _t_sparql_start,
        _t_end - _t_sparql,
        len(tsids),
        len(pairs),
    )

    result: Dict[str, Any] = {
        "pairs": pairs,
        "series": series,
        "commonTimeUnit": common_unit,
    }
    if sparql_error:
        result["warning"] = "Time series could not be retrieved — SPARQL service unavailable and LiPD file download returned no data."
    return result


# =============================================================================
# Exact-duplicate detection endpoint
# =============================================================================
class ExactDuplicatesRequest(BaseModel):
    groups: List[List[str]]
    include_near: bool = False
    near_threshold: float = 0.99


def _clean_series_for_tsids(tsids: List[str]) -> Dict[str, Dict[str, List[float]]]:
    """
    Resolve cleaned (None-stripped, time-axis-sorted) value and time arrays for
    each TSID.  Returns {tsid: {"values": [...], "time": [...]}}; "time" may be
    an empty list if the record has no usable time axis.

    Mirrors the extraction logic used by /correlate: fetch via orchestrator SPARQL
    with a LiPD file fallback, pair proxy values to their time axis when possible,
    strip rows where either value is None, and sort by time.
    """
    if not tsids:
        return {}

    try:
        df = load_metadata()
    except Exception:
        df = None

    meta: Dict[str, pd.Series] = {}
    if df is not None:
        tsid_col = next(
            (c for c in ("paleoData_TSid", "TSid", "tsid", "TSID") if c in df.columns),
            None,
        )
        if tsid_col is not None:
            filtered = df[df[tsid_col].isin(set(tsids))]
            meta = {str(row[tsid_col]): row for _, row in filtered.iterrows()}

    # Map each proxy TSid → its corresponding time-axis TSid (if known)
    time_tsid_map: Dict[str, str] = {}
    for tsid in tsids:
        row = meta.get(tsid)
        if row is not None:
            t_tsid = _safe_str(_first_present(row, "paleoData_hasTimeTsid"))
            if t_tsid:
                time_tsid_map[tsid] = t_tsid

    all_query_tsids = list(tsids) + [
        t for t in time_tsid_map.values() if t not in tsids
    ]

    ts_values, sparql_error = _fetch_ts_via_orchestrator(all_query_tsids)
    missing_proxy = [t for t in tsids if t not in ts_values]
    if sparql_error or missing_proxy:
        try:
            lipd_values = _fetch_ts_from_lipd(all_query_tsids)
            for k, v in lipd_values.items():
                if k not in ts_values:
                    ts_values[k] = v
        except Exception as exc:
            logger.warning("LiPD fallback failed in exact-duplicates: %s", exc)

    clean: Dict[str, Dict[str, List[float]]] = {}
    for tsid in tsids:
        proxy_vals = ts_values.get(tsid, [])
        t_tsid = time_tsid_map.get(tsid)
        time_vals_raw = ts_values.get(t_tsid, []) if t_tsid else []
        if time_vals_raw and proxy_vals and len(time_vals_raw) == len(proxy_vals):
            rows = [(t, v) for t, v in zip(time_vals_raw, proxy_vals)
                    if t is not None and v is not None]
            if len(rows) > 1 and any(rows[i][0] > rows[i + 1][0] for i in range(len(rows) - 1)):
                rows.sort(key=lambda p: p[0])
            clean[tsid] = {
                "values": [p[1] for p in rows],
                "time":   [p[0] for p in rows],
            }
        else:
            clean[tsid] = {
                "values": [v for v in proxy_vals if v is not None],
                "time":   [],
            }

    # Normalize all time arrays to a common unit (mode across this batch) so
    # exact-duplicate detection and temporal-overlap checks are comparable.
    time_tsids_unique = list({tt for tt in time_tsid_map.values() if tt})
    if time_tsids_unique:
        unit_by_ttsid = _get_time_units(time_tsids_unique)
        native_unit_by_tsid = {
            tsid: unit_by_ttsid.get(time_tsid_map.get(tsid, ""))
            for tsid in tsids
        }
        common_unit = _pick_common_unit(list(native_unit_by_tsid.values()))
        if common_unit:
            for tsid in tsids:
                entry = clean[tsid]
                if not entry["time"]:
                    continue
                src = native_unit_by_tsid.get(tsid)
                if not src or src == common_unit:
                    continue
                entry["time"] = _convert_time_array(entry["time"], src, common_unit)
                if len(entry["time"]) > 1:
                    rows = list(zip(entry["time"], entry["values"]))
                    if any(rows[i][0] > rows[i + 1][0] for i in range(len(rows) - 1)):
                        rows.sort(key=lambda p: p[0])
                        entry["time"]   = [r[0] for r in rows]
                        entry["values"] = [r[1] for r in rows]
    return clean


def _pair_correlation(
    series_i: Dict[str, List[float]],
    series_j: Dict[str, List[float]],
) -> Optional[float]:
    """
    Return the Pearson r between two cleaned series, or None if incomputable.

    Prefers time-axis intersection (matches value pairs at equal time points,
    requires ≥ 2 matched pairs and ≥ 90 % of the shorter series to line up).
    Falls back to prefix comparison on the min-length when a time axis is
    missing on either side.
    """
    vals_i = series_i.get("values") or []
    vals_j = series_j.get("values") or []
    time_i = series_i.get("time")   or []
    time_j = series_j.get("time")   or []

    if not vals_i or not vals_j:
        return None

    # --- Fast path: identical time axes (same length + same values) ----------
    # This is the common case for exact-duplicate records, so avoid the dict
    # construction below and just correlate the raw values in place.
    if (
        time_i and time_j
        and len(time_i) == len(time_j) == len(vals_i) == len(vals_j)
        and time_i == time_j
    ):
        try:
            r, _ = pearsonr(vals_i, vals_j)
        except Exception:
            return None
        if math.isnan(r):
            return None
        return float(r)

    # --- Time-axis intersection path -----------------------------------------
    # Try matching by equal time values first. If ≥ 90 % of the shorter series
    # lines up, trust that result.
    if time_i and time_j and len(time_i) == len(vals_i) and len(time_j) == len(vals_j):
        idx_j = {t: v for t, v in zip(time_j, vals_j)}
        matched_i: List[float] = []
        matched_j: List[float] = []
        for t, v in zip(time_i, vals_i):
            if t in idx_j:
                matched_i.append(v)
                matched_j.append(idx_j[t])
        shorter = min(len(vals_i), len(vals_j))
        if len(matched_i) >= max(2, int(0.9 * shorter)):
            try:
                r, _ = pearsonr(matched_i, matched_j)
            except Exception:
                return None
            if math.isnan(r):
                return None
            return float(r)

        # --- Overlap + linear interpolation path -------------------------
        # Different sampling grids: resample one onto the other's time
        # points within the overlapping time range, then correlate. This
        # catches e.g. annual vs depth-sampled copies of the same record
        # that would otherwise be misaligned by the prefix fallback.
        lo = max(min(time_i), min(time_j))
        hi = min(max(time_i), max(time_j))
        if hi > lo:
            try:
                ti = np.asarray(time_i, dtype=float)
                vi = np.asarray(vals_i, dtype=float)
                tj = np.asarray(time_j, dtype=float)
                vj = np.asarray(vals_j, dtype=float)
                # Pick the denser of the two series in the overlap as the
                # reference grid so we preserve as much signal as possible.
                mask_i = (ti >= lo) & (ti <= hi)
                mask_j = (tj >= lo) & (tj <= hi)
                ni, nj = int(mask_i.sum()), int(mask_j.sum())
                if ni >= 2 and nj >= 2:
                    if ni >= nj:
                        ref_t = ti[mask_i]
                        ref_v = vi[mask_i]
                        other_v = np.interp(ref_t, tj, vj)
                    else:
                        ref_t = tj[mask_j]
                        ref_v = vj[mask_j]
                        other_v = np.interp(ref_t, ti, vi)
                    if ref_v.size >= 2:
                        r, _ = pearsonr(ref_v, other_v)
                        if not math.isnan(r):
                            return float(r)
            except Exception:
                pass
        # else: fall through to prefix fallback

    # --- Fallback: prefix comparison on equal-length min prefix --------------
    min_len = min(len(vals_i), len(vals_j))
    if min_len < 2:
        return None
    try:
        r, _ = pearsonr(vals_i[:min_len], vals_j[:min_len])
    except Exception:
        return None
    if math.isnan(r):
        return None
    return float(r)


def _classify_pair(
    series_i: Dict[str, List[float]],
    series_j: Dict[str, List[float]],
    include_near: bool,
    near_threshold: float,
) -> Optional[Tuple[str, float]]:
    """
    Classify the relationship between two cleaned series.

    Returns:
      * ("exact", r) when Pearson r > 0.999. Loose enough to catch records
        republished across compilations with minor re-processing (trimming,
        interpolation, unit conversion).
      * ("near",  r) when r ≥ near_threshold (any length combination),
        if include_near.
      * None otherwise.

    No temporal-range short-circuit here: if time-unit normalization fails
    for one of the series (e.g. the LiPD column lacks a recognised ``units``
    field) the ranges can look disjoint even when the records are identical.
    Since duplicate groups are already filtered spatially to a handful of
    members, running the correlation directly is cheap and avoids that
    false-negative.
    """
    r = _pair_correlation(series_i, series_j)
    if r is None:
        return None
    if r > 0.999:
        return ("exact", r)
    if include_near and r >= near_threshold:
        return ("near", r)
    return None


def _build_group_clusters(
    members: List[str],
    clean: Dict[str, Dict[str, List[float]]],
    include_near: bool,
    near_threshold: float,
) -> List[Dict[str, Any]]:
    """
    Run union-find over all exact / near-duplicate pairs within a single group
    and return the resulting clusters. A cluster is tagged "near" if any pair
    inside it is only a near-match; otherwise "exact".
    """
    n = len(members)
    if n < 2:
        return []

    find, union = make_union_find(n)
    pairs: List[Dict[str, Any]] = []

    for i in range(n):
        series_i = clean[members[i]]
        for j in range(i + 1, n):
            series_j = clean[members[j]]
            classified = _classify_pair(series_i, series_j, include_near, near_threshold)
            if classified is None:
                continue
            kind, r = classified
            union(i, j)
            pairs.append({
                "tsid1": members[i],
                "tsid2": members[j],
                "pearson": r,
                "kind": kind,
            })

    if not pairs:
        return []

    roots: Dict[int, List[int]] = defaultdict(list)
    for idx in range(n):
        roots[find(idx)].append(idx)

    clusters: List[Dict[str, Any]] = []
    for root_members in roots.values():
        if len(root_members) < 2:
            continue
        cluster_tsids = [members[m] for m in root_members]
        cluster_set = set(cluster_tsids)
        cluster_pairs = [
            p for p in pairs
            if p["tsid1"] in cluster_set and p["tsid2"] in cluster_set
        ]
        cluster_kind = "near" if any(p["kind"] == "near" for p in cluster_pairs) else "exact"
        lengths = {t: len(clean[t]["values"]) for t in cluster_tsids}
        min_r = min(p["pearson"] for p in cluster_pairs)
        clusters.append({
            "tsids":   cluster_tsids,
            "lengths": lengths,
            "length":  max(lengths.values()),   # legacy single-length field
            "pairs":   cluster_pairs,
            "kind":    cluster_kind,
            "minPearson": min_r,
        })
    return clusters


@app.post("/exact-duplicates")
async def exact_duplicates(req: ExactDuplicatesRequest) -> Dict[str, Any]:
    """
    Given the spatial duplicate groups already surfaced by /analyze, return
    clusters of exact (Pearson r = 1.0) and optionally near-duplicate
    (different length, Pearson r ≥ near_threshold) records.

    Clusters are computed per-group via union-find.
    """
    groups = req.groups or []
    if not groups:
        return {"clusters": [], "skipped": []}

    all_tsids: List[str] = []
    seen: Set[str] = set()
    for grp in groups:
        for t in grp:
            if t and t not in seen:
                seen.add(t)
                all_tsids.append(t)

    logger.info(
        "exact-duplicates: scanning %d tsids across %d groups (near=%s, thr=%.3f)",
        len(all_tsids), len(groups), req.include_near, req.near_threshold,
    )

    clean = _clean_series_for_tsids(all_tsids)

    skipped: List[Dict[str, str]] = []
    for t in all_tsids:
        if not clean.get(t, {}).get("values"):
            skipped.append({"tsid": t, "reason": "no_series"})

    clusters_out: List[Dict[str, Any]] = []
    for grp in groups:
        members = [t for t in grp if clean.get(t, {}).get("values")]
        clusters_out.extend(
            _build_group_clusters(members, clean, req.include_near, req.near_threshold)
        )

    logger.info(
        "exact-duplicates: found %d clusters (%d tsids skipped)",
        len(clusters_out), len(skipped),
    )

    return {"clusters": clusters_out, "skipped": skipped}


@app.post("/exact-duplicates-stream")
async def exact_duplicates_stream(req: ExactDuplicatesRequest):
    """
    Streaming variant of /exact-duplicates.

    Previously this endpoint called ``_clean_series_for_tsids`` once per group,
    which meant N sequential SPARQL round-trips and N independent time-unit
    normalization passes — slow once N grew past a few dozen groups.  We now
    flatten all groups into a single tsid list, fetch them in one batch, and
    stream progress only for the (cheap) clustering phase.
    """
    groups = req.groups or []
    include_near = req.include_near
    near_threshold = req.near_threshold

    async def generate():
        total = len(groups)
        yield _sse_event({"phase": "start", "total": total})
        await asyncio.sleep(0)

        if total == 0:
            yield _sse_event({"phase": "done", "clusters": [], "skipped": []})
            return

        # ---- Phase A: single batched fetch for every tsid across all groups
        all_tsids: List[str] = []
        seen: Set[str] = set()
        for grp in groups:
            for t in grp:
                if t and t not in seen:
                    seen.add(t)
                    all_tsids.append(t)

        # Fetch in chunks so we can emit a real progress fraction. Precision
        # is not critical — the point is to show the bar moving while a long
        # SPARQL round-trip is in flight.
        FETCH_CHUNK = 20
        total_tsids = len(all_tsids)
        yield _sse_event({
            "phase": "fetch",
            "fetched": 0,
            "totalTsids": total_tsids,
            "total": total,
        })
        await asyncio.sleep(0)

        clean: Dict[str, Dict[str, List[float]]] = {}
        try:
            for start in range(0, total_tsids, FETCH_CHUNK):
                chunk = all_tsids[start:start + FETCH_CHUNK]
                chunk_clean = await asyncio.to_thread(_clean_series_for_tsids, chunk)
                clean.update(chunk_clean)
                yield _sse_event({
                    "phase": "fetch",
                    "fetched": min(start + FETCH_CHUNK, total_tsids),
                    "totalTsids": total_tsids,
                    "total": total,
                })
                await asyncio.sleep(0)
        except Exception as exc:
            logger.warning("exact-duplicates-stream: batch fetch failed: %s", exc)
            yield _sse_event({"phase": "error", "message": f"Fetch failed: {exc}"})
            return

        skipped: List[Dict[str, str]] = [
            {"tsid": t, "reason": "no_series"}
            for t in all_tsids
            if not clean.get(t, {}).get("values")
        ]

        # ---- Phase B: clustering per group (pure Python, fast)
        clusters_out: List[Dict[str, Any]] = []
        for idx, grp in enumerate(groups):
            members = [
                t for t in dict.fromkeys(grp)
                if t and clean.get(t, {}).get("values")
            ]
            if len(members) >= 2:
                clusters_out.extend(
                    _build_group_clusters(members, clean, include_near, near_threshold)
                )
            # Emit progress after every group; these events are tiny and
            # clustering is cheap, so the UI stays responsive.
            yield _sse_event({
                "phase": "progress",
                "checked": idx + 1,
                "total": total,
            })
            if (idx & 7) == 0:
                await asyncio.sleep(0)

        yield _sse_event({
            "phase": "done",
            "clusters": clusters_out,
            "skipped": skipped,
        })

    return StreamingResponse(generate(), media_type="text/event-stream")


# =============================================================================
# Preload status — client polls this to discover which groups are ready
# =============================================================================
@app.get("/preload-status")
def preload_status() -> Dict[str, Any]:
    """Return the set of TSIDs whose data is already in the cache."""
    ready: Set[str] = set()
    for tsids in _lipd_index.values():
        ready.update(tsids)
    return {"readyTsids": list(ready)}


# =============================================================================
# Health check
# =============================================================================
@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}
