#!/usr/bin/env python3
"""
Reorganizes DaveEdge1/LMR2 template repo in a single atomic commit.
Uses base_tree with sha:null for deletions.

NOTE: GitHub API blocks writing new blobs to .github/workflows/ without the
'workflow' OAuth scope. Workflow files must be updated manually via the GitHub
web editor after this script runs.

Usage: python scripts/cleanup_lmr2_template.py
Requires: gh CLI authenticated with push access to DaveEdge1/LMR2
"""

import json
import subprocess
import sys
import base64
import os

REPO = "DaveEdge1/LMR2"
BRANCH = "main"
TMPFILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_gh_input.json')

def gh_api(endpoint, input_data=None, jq=None):
    """Call gh api. POST is auto-detected when input_data is provided."""
    cmd = ["gh", "api", endpoint]
    if jq:
        cmd.extend(["--jq", jq])
    if input_data is not None:
        with open(TMPFILE, 'w', encoding='utf-8') as f:
            json.dump(input_data, f)
        cmd.extend(["--input", TMPFILE])
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"ERROR: gh api {endpoint}\n{result.stderr}", file=sys.stderr)
        sys.exit(1)
    if jq:
        return result.stdout.strip()
    return json.loads(result.stdout)

def gh_api_fields(endpoint, fields, jq=None):
    """Call gh api with -f field=value args."""
    cmd = ["gh", "api", endpoint]
    for k, v in fields.items():
        cmd.extend(["-f", f"{k}={v}"])
    if jq:
        cmd.extend(["--jq", jq])
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"ERROR: gh api {endpoint}\n{result.stderr}", file=sys.stderr)
        sys.exit(1)
    return result.stdout.strip() if jq else json.loads(result.stdout)

def get_file_content(path):
    """Get decoded file content from the repo."""
    data = gh_api(f"repos/{REPO}/contents/{path}")
    return base64.b64decode(data["content"]).decode("utf-8")

def create_blob(content):
    """Create a blob via --input file (avoids shell mangling of special chars)."""
    return gh_api(f"repos/{REPO}/git/blobs",
                  input_data={"content": content, "encoding": "utf-8"},
                  jq=".sha")

print("=== LMR2 Template Cleanup ===")
print(f"Repo: {REPO}\n")

# 1. Get current HEAD
print("1. Getting current HEAD...")
head_sha = gh_api(f"repos/{REPO}/git/ref/heads/{BRANCH}", jq=".object.sha")
tree_sha = gh_api(f"repos/{REPO}/git/commits/{head_sha}", jq=".tree.sha")
print(f"   HEAD: {head_sha}")
print(f"   Tree: {tree_sha}")

# 2. Get blob SHAs for scripts to move
print("2. Reading blob SHAs for scripts to move...")
current_tree = gh_api(f"repos/{REPO}/git/trees/{tree_sha}?recursive=1")
sha_map = {e["path"]: e["sha"] for e in current_tree["tree"] if e["type"] == "blob"}

scripts_to_move = ["cfr_main_code.py", "combine_seeds.py", "lipd_to_pdb.py", "convert_lipd_to_cfr_dataframe.py"]
for name in scripts_to_move:
    print(f"   {name}: {sha_map[name]}")

# 3. Update CITATION.cff
print("3. Updating CITATION.cff...")
citation = get_file_content("CITATION.cff")
zhu_ref = """\
  - type: article
    title: "cfr (v2024.1.26): a Python package for climate field reconstruction"
    authors:
      - family-names: Zhu
        given-names: F.
      - family-names: Emile-Geay
        given-names: J.
      - family-names: Hakim
        given-names: G. J.
      - family-names: Guillot
        given-names: D.
      - family-names: Khider
        given-names: D.
      - family-names: Tardif
        given-names: R.
      - family-names: Perkins
        given-names: W. A.
    journal: "Geoscientific Model Development"
    volume: 17
    issue: 8
    start: 3409
    end: 3431
    year: 2024
    doi: 10.5194/gmd-17-3409-2024
"""
updated_citation = citation.rstrip() + "\n" + zhu_ref

# 4. New README
print("4. Building new README...")
new_readme = """\
[![DOI](https://zenodo.org/badge/1078431321.svg)](https://doi.org/10.5281/zenodo.17819391)

# PReSto LMR Template

By [David Edge](https://orcid.org/0000-0001-6938-2850), [Tanaya Gondhalekar](https://orcid.org/0009-0004-2440-3266), & [Julien Emile-Geay](https://orcid.org/0000-0001-5920-4751).

[PReSto](https://paleopresto.com) (Paleoclimate Reconstruction Storehouse) lowers the barriers to utilizing, reproducing, and customizing paleoclimate reconstructions. This repository is a template used by PReSto to run the Last Millennium Reanalysis (LMR) via GitHub Actions.

## LMR Method

This template reproduces and customizes the Last Millennium Reanalysis, version 2.1 ([Tardif et al., 2019](https://doi.org/10.5194/cp-15-1251-2019)), which uses the offline data assimilation method of [Hakim et al. (2016)](https://doi.org/10.1002/2016JD024751). The reconstruction is implemented using the [cfr](https://fzhu2e.github.io/cfr/) Python package ([Zhu et al., 2024](https://doi.org/10.5194/gmd-17-3409-2024)).

Proxy observations are drawn from either:
- **Archived compilations** (e.g., PAGES 2k v2) downloaded directly from [LiPDverse](https://lipdverse.org)
- **Filtered selections** queried from LiPDverse via PReSto's interactive map interface

The prior is CCSM4 Last Millennium simulation (850\u20131850 CE) for surface temperature (`tas`) and precipitation (`pr`).

## File Structure

| Path | Purpose |
|------|---------|
| `scripts/cfr_main_code.py` | Main reconstruction driver |
| `scripts/lipd_to_pdb.py` | Converts LiPD `.lpd` files to cfr ProxyDatabase |
| `scripts/convert_lipd_to_cfr_dataframe.py` | Converts legacy LiPD pickle to CFR DataFrame |
| `scripts/combine_seeds.py` | Merges multi-seed reconstruction outputs into `combined_recon.nc` |
| `lmr_configs.yml` | Reconstruction parameters (overwritten per run by PReSto) |
| `query_params.json` | Data query filters (committed by PReSto to trigger the workflow) |
| `Dockerfile` | Container definition for the cfr environment |
| `environment.yml` | Conda environment specification |
| `CITATION.cff` | Citation metadata |

## Workflows

### `cfr-custom.yml` \u2014 LMR CFR Reconstruction

Two-job pipeline triggered by a push to `query_params.json` or manual dispatch:

1. **prepare-data** \u2014 Acquires proxy data via one of three pathways:
   - *Archived*: downloads a pre-built compilation pickle from LiPDverse
   - *Filtered*: runs the `lipdGenerator` Docker container to query LiPDverse and package selected `.lpd` files, then converts them to a cfr ProxyDatabase
   - *Traditional*: downloads a pre-generated pickle from a provided URL
2. **reconstruct** \u2014 Runs the CFR reconstruction inside the `davidedge/lmr2` Docker container, combines seed runs, uploads results as artifacts, and commits them to the repository

### `visualize.yml` \u2014 Visualization

Triggered automatically after a successful `cfr-custom.yml` run (or manually). Calls the [presto-viz](https://github.com/DaveEdge1/presto-viz) reusable workflow to generate an interactive visualization and deploys it to GitHub Pages.

## How to Use

1. **Fork or clone** this repository
2. Edit `lmr_configs.yml` to customize reconstruction parameters \u2014 see the [cfr LMR guide](https://fzhu2e.github.io/cfr/ug-lmr.html) for configuration options
3. Push your changes; the workflow triggers automatically when `query_params.json` is updated, or run it manually from the **Actions** tab
4. Reconstruction results are saved as artifacts (90-day retention) and committed to the `recons/` directory
5. Visualizations are deployed to the repository's GitHub Pages site
"""

# 5. Create blobs
print("5. Creating blobs...")
citation_blob = create_blob(updated_citation)
print(f"   CITATION.cff: {citation_blob}")
readme_blob = create_blob(new_readme)
print(f"   README.md: {readme_blob}")

# 6. Build tree
print("6. Building tree...")

DELETE_PATHS = [
    "cfr_pages2kv2.nc", "lipd.pkl",
    "presto-viz-cfr-fix.patch", "presto-viz-script1-complete-fix.patch",
    "presto-viz-script2-cyclic-fix.patch", "presto-viz-script2-fix.patch",
    "presto-viz-script2-multiprocessing-fix.patch", "presto-viz-script2-regionmask-fix.patch",
    "CFR_ANALYSIS_INDEX.md", "CFR_FILES_AND_FUNCTIONS.md",
    "CFR_PROXY_DATA_LOADING_ANALYSIS.md", "CFR_QUICK_REFERENCE.md",
    "LIPD_TO_CFR_CONVERSION_PLAN.md", "PICKLE_TO_NETCDF_README.md",
    ".github/CFR_CUSTOM_WORKFLOW_README.md", ".github/DOCKER_HUB_SETUP.md",
    ".github/GITHUB_PAGES_DEPLOYMENT.md", ".github/PRESTO_VIZ_FIX.md",
    "Dockerfile.lipd-convert", "convert_pickle_to_netcdf.py",
    "test_config_locally.py", ".claude/settings.local.json",
    ".github/workflows/docker-build.yml",
    # Old locations of moved scripts
    "cfr_main_code.py", "combine_seeds.py", "lipd_to_pdb.py",
    "convert_lipd_to_cfr_dataframe.py",
]

tree_items = []

# Deletions
for path in DELETE_PATHS:
    tree_items.append({"path": path, "mode": "100644", "type": "blob", "sha": None})

# Updated files (NOT workflows — those need manual update)
tree_items.append({"path": "CITATION.cff", "mode": "100644", "type": "blob", "sha": citation_blob})
tree_items.append({"path": "README.md", "mode": "100644", "type": "blob", "sha": readme_blob})

# Moved scripts
for script in scripts_to_move:
    tree_items.append({"path": f"scripts/{script}", "mode": "100644", "type": "blob", "sha": sha_map[script]})

n_deletes = len(DELETE_PATHS)
n_adds = len(tree_items) - n_deletes
print(f"   {len(tree_items)} tree operations ({n_deletes} deletes, {n_adds} adds/updates)")

# 7. Create tree with base_tree
print("7. Creating new tree...")
new_tree = gh_api(f"repos/{REPO}/git/trees", input_data={
    "base_tree": tree_sha,
    "tree": tree_items
})
new_tree_sha = new_tree["sha"]
print(f"   New tree: {new_tree_sha}")

# 8. Create commit
print("8. Creating commit...")
new_commit = gh_api(f"repos/{REPO}/git/commits", input_data={
    "message": "Clean up template: remove unused files, reorganize scripts into scripts/, update citations and README",
    "tree": new_tree_sha,
    "parents": [head_sha],
})
new_commit_sha = new_commit["sha"]
print(f"   Commit: {new_commit_sha}")

# 9. Update branch ref
print("9. Updating ref...")
gh_api_fields(f"repos/{REPO}/git/refs/heads/{BRANCH}",
              {"sha": new_commit_sha},
              jq=".object.sha")

# Cleanup
if os.path.exists(TMPFILE):
    os.unlink(TMPFILE)

print(f"\n=== Done! ===")
print(f"Commit: {new_commit_sha}")
print(f"View: https://github.com/{REPO}/commit/{new_commit_sha}")
print()
print("MANUAL STEPS REQUIRED (GitHub API cannot modify workflow files):")
print("  1. Edit .github/workflows/cfr-custom.yml via GitHub web UI:")
print("     Replace all script paths from root to scripts/ directory:")
print("       lipd_to_pdb.py -> scripts/lipd_to_pdb.py")
print("       convert_lipd_to_cfr_dataframe.py -> scripts/convert_lipd_to_cfr_dataframe.py")
print("       cfr_main_code.py -> scripts/cfr_main_code.py")
print("       combine_seeds.py -> scripts/combine_seeds.py")
print("  2. Edit .github/workflows/visualize.yml via GitHub web UI:")
print("     Remove the TODO comment line referencing PRESTO_VIZ_FIX.md")
