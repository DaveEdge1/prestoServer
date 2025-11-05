# Presto Visualization Reusable Workflow Guide

This guide explains how to use the Presto Visualization reusable workflow from any repository, particularly from LMR2.

## Overview

The Presto Visualization workflow is now available as a **reusable workflow** that can be called directly from other repositories. This is the simplest and cleanest approach for cross-repository integration.

## ✨ Benefits of Reusable Workflow Approach

- ✅ **No PAT tokens required** - Uses GitHub's built-in authentication
- ✅ **Simple setup** - Just add a few lines to your workflow
- ✅ **Automatic artifact passing** - Artifacts flow seamlessly between workflows
- ✅ **Single source of truth** - Workflow logic stays in prestoServer repo
- ✅ **Easy updates** - Changes automatically propagate to all callers

## Quick Start

### Step 1: Update Your LMR2 Workflow

Add the Presto visualization as a dependent job in your existing workflow:

```yaml
name: Run CFR Analysis and Visualize

on:
  workflow_dispatch:
  push:
    branches: [main]

jobs:
  # Your existing CFR analysis job
  cfr-analysis:
    name: Run CFR Analysis
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      # ... your existing steps ...

      - name: Upload CFR outputs
        uses: actions/upload-artifact@v4
        with:
          name: cfr-netcdf-output
          path: output/*.nc  # Adjust path to your NetCDF files

  # Add this job to call Presto Visualization
  visualize-results:
    name: Create Presto Visualization
    needs: cfr-analysis
    uses: DaveEdge1/prestoServer/.github/workflows/presto-viz-reusable.yml@main
    with:
      reconstruction_id: CFR_${{ github.run_number }}_${{ github.run_id }}
      artifact_name: cfr-netcdf-output
```

That's it! No secrets, no tokens, just three lines of code.

### Step 2: Make prestoServer Repository Public (If Needed)

For the reusable workflow to be called from LMR2:
- **Option A**: Make prestoServer repository **public** (recommended for open science)
- **Option B**: If private, both repos must be in the same GitHub organization

## Workflow Parameters

### Required Inputs

| Parameter | Description | Example |
|-----------|-------------|---------|
| `reconstruction_id` | Unique identifier for this run | `CFR_${{ github.run_number }}` |
| `artifact_name` | Name of artifact containing NetCDF data | `cfr-netcdf-output` |

### Optional Inputs

| Parameter | Description | Default |
|-----------|-------------|---------|
| `data_dir` | Custom data directory path | `./data/{reconstruction_id}` |
| `output_dir` | Custom output directory path | `./output/{reconstruction_id}` |
| `web_data_dir` | Web assets directory | `viz/web_assets/` |

### Outputs

| Output | Description |
|--------|-------------|
| `visualization_artifact` | Name of the generated visualization artifact |

## Complete Example for LMR2

Here's a complete workflow file for your LMR2 repository:

```yaml
name: CFR Analysis with Presto Visualization

on:
  workflow_dispatch:
    inputs:
      experiment_name:
        description: 'Experiment name'
        required: true
        type: string
  push:
    branches: [main]

jobs:
  cfr-analysis:
    name: Run CFR Climate Reconstruction
    runs-on: ubuntu-latest

    steps:
      - name: Checkout LMR2
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt

      - name: Run CFR Analysis
        run: |
          python run_cfr_analysis.py \
            --config config/default.yml \
            --output output/

      - name: Upload CFR NetCDF outputs
        uses: actions/upload-artifact@v4
        with:
          name: cfr-netcdf-output
          path: |
            output/**/*.nc
            output/**/*.pkl
          retention-days: 90

  presto-visualization:
    name: Generate Presto Visualization
    needs: cfr-analysis
    if: success()  # Only run if CFR analysis succeeds
    uses: DaveEdge1/prestoServer/.github/workflows/presto-viz-reusable.yml@main
    with:
      reconstruction_id: ${{ inputs.experiment_name || format('CFR_{0}_{1}', github.run_number, github.run_id) }}
      artifact_name: cfr-netcdf-output

  # Optional: post-processing job that uses visualization output
  publish-results:
    name: Publish Results
    needs: [cfr-analysis, presto-visualization]
    runs-on: ubuntu-latest
    if: success()

    steps:
      - name: Download visualization
        uses: actions/download-artifact@v4
        with:
          name: ${{ needs.presto-visualization.outputs.visualization_artifact }}
          path: ./viz_output

      - name: Publish to GitHub Pages
        # ... your publishing steps ...
        run: echo "Publishing visualizations..."
```

## Advanced Usage

### Using Different Branches or Tags

You can specify a specific branch, tag, or commit:

```yaml
uses: DaveEdge1/prestoServer/.github/workflows/presto-viz-reusable.yml@v1.0.0
# or
uses: DaveEdge1/prestoServer/.github/workflows/presto-viz-reusable.yml@develop
# or
uses: DaveEdge1/prestoServer/.github/workflows/presto-viz-reusable.yml@abc123f
```

### Custom Directory Structure

```yaml
visualize-results:
  uses: DaveEdge1/prestoServer/.github/workflows/presto-viz-reusable.yml@main
  with:
    reconstruction_id: my_experiment_001
    artifact_name: cfr-netcdf-output
    data_dir: /custom/data/path
    output_dir: /custom/output/path
```

### Matrix Strategy for Multiple Experiments

Run visualizations for multiple configurations:

```yaml
jobs:
  cfr-analysis:
    strategy:
      matrix:
        scenario: [historical, rcp45, rcp85]
    # ... analysis steps ...

  visualize-results:
    needs: cfr-analysis
    strategy:
      matrix:
        scenario: [historical, rcp45, rcp85]
    uses: DaveEdge1/prestoServer/.github/workflows/presto-viz-reusable.yml@main
    with:
      reconstruction_id: CFR_${{ matrix.scenario }}_${{ github.run_number }}
      artifact_name: cfr-output-${{ matrix.scenario }}
```

## Artifact Flow Diagram

```
┌─────────────────────────────────────────────┐
│         LMR2 Repository                     │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │   Job: cfr-analysis                 │   │
│  │   - Run CFR Analysis                │   │
│  │   - Generate NetCDF outputs         │   │
│  │   - Upload artifact: "cfr-netcdf"   │   │
│  └────────────┬────────────────────────┘   │
│               │                             │
│               ▼                             │
│  ┌─────────────────────────────────────┐   │
│  │   Job: visualize-results            │   │
│  │   Calls: prestoServer/workflow      │   │
│  └────────────┬────────────────────────┘   │
└───────────────┼─────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│     DaveEdge1/prestoServer                  │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │   Reusable Workflow                 │   │
│  │   - Download artifact "cfr-netcdf"  │   │
│  │   - Run format_data.py              │   │
│  │   - Run make_maps_and_ts.py         │   │
│  │   - Run make_html_file.py           │   │
│  │   - Upload artifact: "presto-viz"   │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
                │
                ▼
        ┌───────────────┐
        │  Artifacts:   │
        │  - Logs       │
        │  - HTML viz   │
        │  - Images     │
        └───────────────┘
```

## Troubleshooting

### Error: "Workflow does not exist or does not have a workflow_call trigger"

**Solution**: Make sure you're using the `presto-viz-reusable.yml` file, not `presto-viz.yml`

### Error: "Resource not accessible by integration"

**Solution**: The prestoServer repository must be either:
- Public (recommended)
- Or in the same GitHub organization as LMR2

### Artifacts not found

**Solution**: Ensure the artifact name matches exactly:
```yaml
# In LMR2
- name: Upload CFR outputs
  with:
    name: cfr-netcdf-output  # Must match

# In workflow call
  with:
    artifact_name: cfr-netcdf-output  # Must match
```

### Workflow times out

**Solution**: The workflow has a 3-hour timeout. For larger datasets:
1. Optimize Python scripts
2. Reduce data resolution
3. Split processing into multiple jobs

## Comparison: Reusable Workflow vs Other Approaches

| Feature | Reusable Workflow | Repository Dispatch | Containerized Action |
|---------|------------------|---------------------|---------------------|
| Setup Complexity | ⭐ Simple | ⭐⭐ Moderate | ⭐⭐⭐ Complex |
| PAT Token Required | ❌ No | ✅ Yes | ❌ No |
| Artifact Sharing | ✅ Automatic | ⚠️ Manual | ✅ Automatic |
| Maintenance | ⭐ Easy | ⭐⭐ Moderate | ⭐⭐⭐ Complex |
| Reusability | ✅ High | ⚠️ Medium | ✅ High |
| Version Control | ✅ Git refs | ❌ No | ✅ Docker tags |

## Future: Containerized Action

If you need full portability (e.g., for GitHub Marketplace), we can containerize the workflow:

```dockerfile
# Future: Dockerfile for Presto Visualization
FROM condaforge/mambaforge:latest

COPY viz/ /presto/viz/
COPY environment.yml /presto/

RUN mamba env create -f /presto/environment.yml && \
    mamba clean -afy

ENTRYPOINT ["/presto/entrypoint.sh"]
```

This would allow:
- Publishing to GitHub Marketplace
- Use in any repository without workflow_call
- Complete environment isolation

Let me know if you'd like me to implement the containerized version!

## Next Steps

1. **Add workflow to LMR2**: Copy the example workflow above
2. **Update artifact names**: Match your actual CFR output names
3. **Test it**: Run your CFR Analysis and watch the visualization trigger automatically
4. **Iterate**: Adjust timeouts and paths as needed

## Questions?

Check the main workflow file for implementation details:
- `presto-viz-reusable.yml` - The reusable workflow
- `call-presto-viz-from-lmr2-example.yml` - Complete example

Happy visualizing! 🎉
