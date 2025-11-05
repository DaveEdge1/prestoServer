# Presto Visualization Workflow Integration Guide

This guide explains how to use the Presto Visualization workflow with data from the LMR2 repository.

## Overview

The Presto Visualization workflow can be triggered in two ways:
1. **Manual trigger** - Run directly from GitHub Actions UI
2. **Automated trigger** - Triggered automatically from LMR2 repository after CFR Analysis completes

## Setup Instructions

### Step 1: Create a Personal Access Token (PAT)

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Name it something like "Presto Workflow Trigger"
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
5. Generate and copy the token

### Step 2: Add Token to LMR2 Repository

1. Go to your LMR2 repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `PRESTO_WORKFLOW_TOKEN`
5. Value: Paste the PAT you created
6. Click "Add secret"

### Step 3: Add Workflow to LMR2 Repository

Copy the workflow from `trigger-from-lmr2-example.yml` to your LMR2 repository:

```bash
# In your LMR2 repository
mkdir -p .github/workflows
# Copy the trigger-from-lmr2-example.yml file
# Rename it to something like: trigger-presto-viz.yml
```

**Important:** Update the following values in the workflow:
- `workflows: ["Run CFR Analysis"]` - Replace with your actual workflow name
- `artifact_name: "cfr-analysis-output"` - Replace with your actual artifact name
- `repository: DaveEdge1/prestoServer` - Update if your prestoServer repo is different

### Step 4: Find Your Artifact Name

To find the artifact name from your LMR2 workflow:
1. Go to Actions tab in LMR2 repository
2. Click on the latest "Run CFR Analysis" workflow run
3. Scroll to the bottom and note the artifact name (e.g., "cfr-netcdf-output")
4. Update the `artifact_name` in the trigger workflow

## Usage

### Option 1: Automatic Trigger from LMR2

Once set up, the workflow will automatically trigger when "Run CFR Analysis" completes successfully:
1. Run your CFR Analysis workflow in LMR2
2. When it completes, it will automatically trigger Presto Visualization
3. Check the Actions tab in prestoServer repository to see the running workflow

### Option 2: Manual Trigger

To manually trigger the workflow:
1. Go to prestoServer repository → Actions tab
2. Select "Presto Visualization Processing"
3. Click "Run workflow"
4. Fill in the parameters:
   - **reconstruction_id**: A unique identifier (e.g., "17095846334578667_HoloceneDA")
   - **source_repository**: "DaveEdge1/LMR2"
   - **workflow_run_id**: Find this in the URL of your LMR2 workflow run
   - **artifact_name**: Name of the artifact from LMR2

## Workflow Parameters

### Required
- `reconstruction_id`: Unique identifier for this reconstruction run

### Optional (for cross-repository integration)
- `source_repository`: Repository containing the artifact (e.g., "DaveEdge1/LMR2")
- `workflow_run_id`: GitHub run ID from the source workflow
- `artifact_name`: Name of the artifact to download
- `data_dir`: Custom data directory path
- `output_dir`: Custom output directory path

## How It Works

1. **Artifact Download**: If source repository parameters are provided, the workflow downloads the NetCDF artifact from LMR2
2. **Data Preparation**: Moves the downloaded files to the data directory
3. **Script 1**: Formats the data (15 min timeout)
4. **Script 2**: Creates maps and time series (120 min timeout)
5. **Script 3**: Generates HTML visualization (10 min timeout)
6. **Upload Results**: Uploads logs and visualization outputs as artifacts

## Outputs

The workflow produces the following artifacts:
- `presto-viz-logs-{reconstruction_id}`: All log files from the processing
- `presto-viz-output-{reconstruction_id}`: Complete visualization output including HTML files

## Troubleshooting

### Workflow doesn't trigger automatically
- Verify the PAT has `workflow` permissions
- Check the secret is named `PRESTO_WORKFLOW_TOKEN` in LMR2 repository
- Ensure the workflow name matches exactly in the trigger workflow

### Artifact download fails
- Verify the artifact name is correct
- Check the workflow_run_id is valid
- Ensure artifacts exist and haven't expired (default 90 days)

### Permission errors
- The PAT needs access to both repositories
- Ensure the token hasn't expired

## Example: Finding Workflow Run ID

The workflow run ID is in the URL when viewing a workflow run:
```
https://github.com/DaveEdge1/LMR2/actions/runs/1234567890
                                                   ^^^^^^^^^^
                                                   This is the run ID
```

## Notes

- Artifacts are retained for 30 days by default
- The workflow has a 3-hour total timeout
- Downloaded artifacts are automatically placed in the data directory
- The workflow supports both Ubuntu and custom execution environments
