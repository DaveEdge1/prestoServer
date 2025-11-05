# Presto Visualization - New Repository Setup

This document describes the plan for extracting the Presto visualization component into a standalone public repository.

## Repository Name Suggestions

- `presto-viz` (recommended - short and clear)
- `presto-visualization`
- `paleoclimate-viz`

## Files to Include

### Core Python Scripts
```
/
├── 1_format_data_daholocene_graphem.py
├── 2_make_maps_and_ts.py
├── 3_make_html_file.py
├── functions_presto.py
└── presto_env.yml
```

### Web Assets
```
/web_assets/
├── assets/
│   ├── credits.txt
│   ├── logo.png
│   └── style.default.css
└── visualizer_template.html
```

### Documentation & Workflow
```
/.github/
└── workflows/
    └── presto-viz-reusable.yml
```

### Root Files
```
/
├── README.md
├── LICENSE
├── .gitignore
└── run_script.sh (reference example)
```

## Files to EXCLUDE

- `viz.js` - Server-specific application, not needed for standalone viz

## Repository Structure

```
presto-viz/
├── .github/
│   └── workflows/
│       └── presto-viz-reusable.yml      # Reusable workflow for GitHub Actions
├── web_assets/
│   ├── assets/
│   │   ├── credits.txt
│   │   ├── logo.png
│   │   └── style.default.css
│   └── visualizer_template.html
├── 1_format_data_daholocene_graphem.py   # Step 1: Format input data
├── 2_make_maps_and_ts.py                 # Step 2: Generate maps and time series
├── 3_make_html_file.py                   # Step 3: Create HTML visualization
├── functions_presto.py                   # Helper functions
├── presto_env.yml                        # Conda environment specification
├── run_script.sh                         # Example shell script
├── README.md                             # Documentation
├── LICENSE                               # Open source license (suggest MIT or Apache 2.0)
└── .gitignore                            # Git ignore file
```

## Required Changes

### 1. Update Reusable Workflow
Change from:
```yaml
repository: DaveEdge1/prestoServer
```
To:
```yaml
repository: DaveEdge1/presto-viz  # Or your chosen repo name
```

### 2. Update File Paths in Workflow
Since files will be at root level, update:
```yaml
environment-file: presto/viz/presto_env.yml
```
To:
```yaml
environment-file: presto-viz/presto_env.yml
```

And script paths from:
```yaml
python -u viz/1_format_data_daholocene_graphem.py
```
To:
```yaml
python -u 1_format_data_daholocene_graphem.py
```

### 3. Clean Any References
Review and update:
- Dataset source URLs in Python scripts (currently: https://paleopresto.com/custom.html)
  - Could be changed to the GitHub repo URL or kept as is for attribution
- Any server-specific paths (currently clean - uses sys.argv)

## README.md Template

Create a comprehensive README with:

1. **Project Description**
   - What it does
   - Who it's for
   - Example use cases

2. **Installation**
   - Conda environment setup
   - Dependencies

3. **Usage**
   - Command-line usage
   - GitHub Actions workflow integration
   - Example data formats

4. **Input Data Requirements**
   - Expected NetCDF structure
   - Configuration files needed

5. **Output**
   - What files are generated
   - How to view visualizations

6. **Citation**
   - How to cite the software
   - Link to papers/documentation

7. **License**
   - Open source license

8. **Contributing**
   - How to report issues
   - How to contribute

## License Recommendation

**MIT License** or **Apache 2.0** - Both are permissive and widely used in scientific software:
- **MIT**: Simple, permissive, allows commercial use
- **Apache 2.0**: More detailed, includes patent protection

For scientific software, MIT is often preferred for simplicity.

## Steps to Create the New Repository

### On GitHub
1. Create new public repository named `presto-viz` (or your choice)
2. Initialize with README
3. Don't add .gitignore yet (we'll create custom one)

### Locally
1. Clone the new repository
2. Copy files from prestoServer/viz/ (excluding viz.js)
3. Update workflow file paths
4. Create README.md
5. Create LICENSE file
6. Create .gitignore
7. Test locally if possible
8. Commit and push

### Update prestoServer
1. Update the reusable workflow reference
2. Update documentation to point to new repo
3. Add link to public repo in prestoServer README

## Migration Command Example

```bash
# Create new repo directory
cd ~/
git clone https://github.com/DaveEdge1/presto-viz.git
cd presto-viz

# Copy files from prestoServer (excluding viz.js)
cp ~/prestoServer/viz/1_format_data_daholocene_graphem.py .
cp ~/prestoServer/viz/2_make_maps_and_ts.py .
cp ~/prestoServer/viz/3_make_html_file.py .
cp ~/prestoServer/viz/functions_presto.py .
cp ~/prestoServer/viz/presto_env.yml .
cp ~/prestoServer/viz/run_script.sh .
cp -r ~/prestoServer/viz/web_assets .

# Copy workflow (we'll update it)
mkdir -p .github/workflows
cp ~/prestoServer/.github/workflows/presto-viz-reusable.yml .github/workflows/

# Create new files
# Create README, LICENSE, .gitignore

# Commit
git add .
git commit -m "Initial commit: Extract visualization from prestoServer"
git push origin main
```

## Testing the Integration

After creating the new repository:

1. **Test the workflow locally** (if possible)
2. **Test from LMR2**:
   ```yaml
   uses: DaveEdge1/presto-viz/.github/workflows/presto-viz-reusable.yml@main
   ```
3. **Verify artifact handling**
4. **Check outputs**

## Benefits of This Approach

✅ **Security**: No exposure of server paths, IPs, or configuration
✅ **Reusability**: Anyone can use the visualization tools
✅ **Maintenance**: Single source for visualization logic
✅ **Open Science**: Transparent, reproducible visualizations
✅ **Community**: Others can contribute improvements
✅ **Citation**: Citable software (can add DOI via Zenodo)

## Next Steps

1. Decide on repository name
2. Create the repository on GitHub
3. Prepare files for migration
4. Update workflows and paths
5. Write comprehensive README
6. Add LICENSE
7. Test integration with LMR2
8. Announce to community!
