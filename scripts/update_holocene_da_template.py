#!/usr/bin/env python3
"""
Adds CITATION.cff and rewrites README.md for DaveEdge1/presto-holocene_da.

Usage: python scripts/update_holocene_da_template.py
Requires: gh CLI authenticated with push access to DaveEdge1/presto-holocene_da
"""

import json
import subprocess
import sys
import os

REPO = "DaveEdge1/presto-holocene_da"
BRANCH = "main"
TMPFILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_gh_input.json')

def gh_api(endpoint, input_data=None, jq=None):
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

def create_blob(content):
    return gh_api(f"repos/{REPO}/git/blobs",
                  input_data={"content": content, "encoding": "utf-8"},
                  jq=".sha")

print(f"=== Update {REPO} ===\n")

# 1. Get current HEAD
print("1. Getting current HEAD...")
head_sha = gh_api(f"repos/{REPO}/git/ref/heads/{BRANCH}", jq=".object.sha")
tree_sha = gh_api(f"repos/{REPO}/git/commits/{head_sha}", jq=".tree.sha")
print(f"   HEAD: {head_sha}")
print(f"   Tree: {tree_sha}")

# 2. Build CITATION.cff
print("2. Building CITATION.cff...")
citation_cff = """\
cff-version: 1.2.0
message: "If you use this reconstruction, please cite the references below."
title: "The Paleoclimate Reconstruction Storehouse (PReSto) platform"
type: software
authors:
  - family-names: Edge
    given-names: Dave
  - family-names: Erb
    given-names: Michael
  - family-names: McKay
    given-names: Nicholas
  - family-names: Zhu
    given-names: Feng
  - family-names: Khider
    given-names: Deborah
  - family-names: Emile-Geay
    given-names: Julien
  - family-names: Routson
    given-names: Cody
doi: 10.5281/zenodo.8274756
version: alpha-release
date-released: "2023-08-25"
url: "https://zenodo.org/record/8274756"
references:
  - type: article
    title: "Reconstructing Holocene temperatures in time and space using paleoclimate data assimilation"
    authors:
      - family-names: Erb
        given-names: M. P.
      - family-names: McKay
        given-names: N. P.
      - family-names: Steiger
        given-names: N.
      - family-names: Dee
        given-names: S.
      - family-names: Bova
        given-names: S.
      - family-names: Zhu
        given-names: F.
      - family-names: Emile-Geay
        given-names: J.
      - family-names: Hakim
        given-names: G. J.
    journal: "Climate of the Past"
    volume: 18
    start: 2599
    end: 2629
    year: 2022
    doi: 10.5194/cp-18-2599-2022
"""

# 3. Build README
print("3. Building README...")
readme = """\
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.8274756.svg)](https://doi.org/10.5281/zenodo.8274756)

# PReSto Holocene DA Template

By [David Edge](https://orcid.org/0000-0001-6938-2850), [Michael Erb](https://orcid.org/0000-0002-1763-2522), & [Nicholas McKay](https://orcid.org/0000-0003-3598-5113).

[PReSto](https://paleopresto.com) (Paleoclimate Reconstruction Storehouse) lowers the barriers to utilizing, reproducing, and customizing paleoclimate reconstructions. This repository is a template used by PReSto to run the Holocene DA reconstruction via GitHub Actions.

## Holocene DA Method

This template reproduces and customizes the Holocene temperature reconstruction of [Erb et al. (2022)](https://doi.org/10.5194/cp-18-2599-2022), which uses offline paleoclimate data assimilation to reconstruct spatially complete temperature fields over the past 12,000 years.

Proxy observations are drawn from either:
- **Archived compilations** (e.g., Temperature 12k) downloaded directly from [LiPDverse](https://lipdverse.org)
- **Filtered selections** queried from LiPDverse via PReSto's interactive map interface

The prior is constructed from transient climate model simulations (HadCM3 and TraCE-21ka), regridded and time-averaged to the user-specified resolution. Pre-processed model data at standard resolutions (10\u20131000 yr) are stored as GitHub release assets; non-standard resolutions trigger a download of the original data from [Zenodo](https://zenodo.org/records/7407116).

The original reconstruction code is available at [Holocene-Reconstruction/Holocene-code](https://github.com/Holocene-Reconstruction/Holocene-code).

## File Structure

| Path | Purpose |
|------|---------|
| `config/user_config.yml` | Reconstruction parameters (overwritten per run by PReSto) |
| `query_params.json` | Data query filters (committed by PReSto to trigger the workflow) |

## Workflows

### `holocene_da.yml` \u2014 Holocene DA Reconstruction

Two-job pipeline triggered by a push to `query_params.json` or manual dispatch:

1. **prepare-data** \u2014 Acquires proxy data via one of two pathways:
   - *Archived*: downloads a pre-built compilation pickle from LiPDverse
   - *Filtered*: runs the `lipdGenerator` Docker container to query LiPDverse and produce a legacy pickle
2. **reconstruct** \u2014 Downloads pre-processed model data (or raw data from Zenodo for non-standard resolutions), runs the Holocene DA algorithm inside the `davidedge/lipd_webapps:holocene_da` Docker container, and commits results to the repository

### `visualize.yml` \u2014 Visualization

Triggered automatically after a successful `holocene_da.yml` run (or manually). Calls the [presto-viz](https://github.com/DaveEdge1/presto-viz) reusable workflow to generate an interactive visualization and deploys it to GitHub Pages.

## How to Use

1. **Fork or clone** this repository
2. Edit `config/user_config.yml` to customize reconstruction parameters (time resolution, age range, proxy archives, localization radius, etc.)
3. Push your changes; the workflow triggers automatically when `query_params.json` is updated, or run it manually from the **Actions** tab
4. Reconstruction results are saved as artifacts (90-day retention) and committed to the `results/` directory
5. Visualizations are deployed to the repository's GitHub Pages site
"""

# 4. Create blobs
print("4. Creating blobs...")
citation_blob = create_blob(citation_cff)
print(f"   CITATION.cff: {citation_blob}")
readme_blob = create_blob(readme)
print(f"   README.md: {readme_blob}")

# 5. Build tree (add/update with base_tree)
print("5. Creating tree...")
tree_items = [
    {"path": "CITATION.cff", "mode": "100644", "type": "blob", "sha": citation_blob},
    {"path": "README.md", "mode": "100644", "type": "blob", "sha": readme_blob},
]

new_tree = gh_api(f"repos/{REPO}/git/trees", input_data={
    "base_tree": tree_sha,
    "tree": tree_items
})
new_tree_sha = new_tree["sha"]
print(f"   New tree: {new_tree_sha}")

# 6. Create commit
print("6. Creating commit...")
new_commit = gh_api(f"repos/{REPO}/git/commits", input_data={
    "message": "Add CITATION.cff and rewrite README with method description, file structure, and workflow docs",
    "tree": new_tree_sha,
    "parents": [head_sha],
})
new_commit_sha = new_commit["sha"]
print(f"   Commit: {new_commit_sha}")

# 7. Update ref
print("7. Updating ref...")
gh_api(f"repos/{REPO}/git/refs/heads/{BRANCH}",
       input_data={"sha": new_commit_sha})

# Cleanup
if os.path.exists(TMPFILE):
    os.unlink(TMPFILE)

print(f"\n=== Done! ===")
print(f"Commit: {new_commit_sha}")
print(f"View: https://github.com/{REPO}/commit/{new_commit_sha}")
print()
print("MANUAL STEPS REQUIRED (GitHub API cannot modify workflow files):")
print("  1. Replace .github/workflows/holocene_da.yml with templates/workflows/holocene_da.yml")
print("  2. Replace .github/workflows/visualize.yml with templates/workflows/holocene_da_visualize.yml")
