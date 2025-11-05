# Setting Up the Public Presto Visualization Repository

This guide walks you through creating a public repository for the Presto visualization component, making it available for use from LMR2 and other repositories.

## Overview

We're extracting the visualization pipeline into its own public repository to:
- ✅ Keep prestoServer private (security)
- ✅ Make visualizations publicly reusable
- ✅ Enable GitHub Actions integration without PAT tokens
- ✅ Support open science practices

## Step-by-Step Setup

### Step 1: Create the GitHub Repository

1. Go to https://github.com/new
2. Repository name: `presto-viz` (or your choice)
3. Description: "Automated paleoclimate reconstruction visualization pipeline"
4. Visibility: **Public** ⭐
5. Initialize with:
   - ✅ README (we'll replace it)
   - ❌ .gitignore (script will create it)
   - ❌ License (script will create MIT license)
6. Click "Create repository"

### Step 2: Clone the New Repository

```bash
cd ~
git clone https://github.com/DaveEdge1/presto-viz.git
cd presto-viz
```

### Step 3: Run Migration Script

From your prestoServer directory:

```bash
cd /path/to/prestoServer
./.github/workflows/migrate-to-new-repo.sh ~/presto-viz
```

This will:
- Copy all necessary Python scripts
- Copy web assets
- Copy the reusable workflow
- Create README.md
- Create LICENSE (MIT)
- Create .gitignore
- Exclude viz.js (server-specific)

### Step 4: Review and Customize

```bash
cd ~/presto-viz
```

Review the following files:

#### README.md
- Update repository URLs if needed
- Add your funding acknowledgments
- Update contact information
- Add any additional documentation

#### LICENSE
- Confirm MIT license is appropriate
- Update copyright holder if needed

#### .github/workflows/presto-viz-reusable.yml
- Verify repository references are correct
- Adjust timeouts if needed

### Step 5: Commit and Push

```bash
cd ~/presto-viz

# Check what's been added
git status

# Add all files
git add .

# Commit
git commit -m "Initial commit: Presto visualization pipeline

Extracted from prestoServer for public use.

Features:
- Three-stage visualization pipeline
- NetCDF to interactive HTML
- GitHub Actions reusable workflow
- Support for DA Holocene and GraphEM

Excludes server-specific components (viz.js)"

# Push to GitHub
git push origin main
```

### Step 6: Verify Repository

1. Visit https://github.com/DaveEdge1/presto-viz
2. Check that README displays correctly
3. Verify files are present:
   - Python scripts (1_*, 2_*, 3_*, functions_presto.py)
   - presto_env.yml
   - web_assets/
   - .github/workflows/presto-viz-reusable.yml
4. Confirm viz.js is NOT present ✅

### Step 7: Update prestoServer References

The reusable workflow in prestoServer has already been updated to reference the new repo. Verify:

```yaml
# In .github/workflows/presto-viz-reusable.yml
repository: DaveEdge1/presto-viz  # Should be updated
```

### Step 8: Test from LMR2

Add to your LMR2 workflow:

```yaml
jobs:
  your-cfr-analysis:
    # ... your analysis ...

  visualize:
    needs: your-cfr-analysis
    uses: DaveEdge1/presto-viz/.github/workflows/presto-viz-reusable.yml@main
    with:
      reconstruction_id: CFR_${{ github.run_number }}
      artifact_name: cfr-netcdf-output
```

Run your LMR2 workflow and verify:
1. Visualization job triggers automatically
2. Artifacts are downloaded correctly
3. Visualizations are generated
4. HTML output is produced

## Repository Structure

After migration, your new presto-viz repository should look like:

```
presto-viz/
├── .github/
│   └── workflows/
│       └── presto-viz-reusable.yml
├── web_assets/
│   ├── assets/
│   │   ├── credits.txt
│   │   ├── logo.png
│   │   └── style.default.css
│   └── visualizer_template.html
├── 1_format_data_daholocene_graphem.py
├── 2_make_maps_and_ts.py
├── 3_make_html_file.py
├── functions_presto.py
├── presto_env.yml
├── run_script.sh
├── .gitignore
├── LICENSE
└── README.md
```

## Configuration Update Checklist

After creating the public repo, update these files in prestoServer:

- [x] `.github/workflows/presto-viz-reusable.yml` - Updated repository reference
- [ ] Main README - Add link to public presto-viz repo
- [ ] Any documentation mentioning visualization

Example update for prestoServer README:

```markdown
## Visualization

The Presto visualization component has been extracted to a public repository:
https://github.com/DaveEdge1/presto-viz

This allows other projects to use the visualization pipeline via GitHub Actions.
```

## Troubleshooting

### Issue: Workflow can't find repository

**Error**: "Repository not found"

**Solutions**:
1. Verify repository is public
2. Check repository name matches exactly in workflow
3. Ensure workflow file exists at `.github/workflows/presto-viz-reusable.yml`

### Issue: Workflow can't find files

**Error**: "FileNotFoundError: 1_format_data..."

**Solutions**:
1. Verify all Python scripts are at repository root (not in subdirectory)
2. Check working directory in workflow steps
3. Verify `cd presto-viz` command before running scripts

### Issue: Conda environment fails

**Error**: "Environment creation failed"

**Solutions**:
1. Verify `presto_env.yml` is at repository root
2. Check Python version compatibility
3. Review conda-incubator/setup-miniconda version

## Benefits Achieved

✅ **Security**: prestoServer stays private with server-specific configuration
✅ **Reusability**: Anyone can use presto-viz in their workflows
✅ **No tokens**: GitHub's built-in authentication handles everything
✅ **Open Science**: Public, citable, reproducible visualizations
✅ **Maintainability**: Single source for visualization logic
✅ **Community**: Enable external contributions and feedback

## Future Enhancements

Once the public repo is established, consider:

1. **Zenodo Integration**: Add DOI for citations
   - Connect GitHub repo to Zenodo
   - Create releases (v1.0, v1.1, etc.)
   - Get citable DOI

2. **GitHub Marketplace Action**: Convert to composite action
   - Create action.yml
   - Simpler syntax than workflow_call
   - Discoverable in marketplace

3. **Containerization**: Create Docker image
   - Faster environment setup
   - Better reproducibility
   - Publish to Docker Hub or GHCR

4. **Documentation Site**: Use GitHub Pages
   - Detailed API docs
   - Tutorials and examples
   - Gallery of visualizations

5. **Testing**: Add automated tests
   - Unit tests for functions
   - Integration tests with sample data
   - CI/CD for quality assurance

## Support

After setup, users can:
- Report issues: https://github.com/DaveEdge1/presto-viz/issues
- Ask questions: GitHub Discussions
- Contribute: Pull requests welcome

## Questions?

Refer to:
- `NEW-REPO-PLAN.md` - Detailed planning document
- `NEW-REPO-README-TEMPLATE.md` - README content
- `REUSABLE-WORKFLOW-GUIDE.md` - GitHub Actions integration guide

---

**Ready to create the public repository? Follow the steps above!**
