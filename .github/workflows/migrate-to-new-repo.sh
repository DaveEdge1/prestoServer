#!/bin/bash
# Migration script to copy visualization files to new presto-viz repository
# Usage: ./migrate-to-new-repo.sh /path/to/new/presto-viz/repo

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 /path/to/presto-viz/repo"
    echo "Example: $0 ~/presto-viz"
    exit 1
fi

TARGET_DIR="$1"

if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Target directory does not exist: $TARGET_DIR"
    echo "Please create the repository first:"
    echo "  git clone https://github.com/DaveEdge1/presto-viz.git $TARGET_DIR"
    exit 1
fi

echo "=== Migrating Presto Visualization to $TARGET_DIR ==="

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PRESTO_SERVER_DIR="$( cd "$SCRIPT_DIR/../../.." && pwd )"
VIZ_DIR="$PRESTO_SERVER_DIR/viz"

echo "Source directory: $VIZ_DIR"
echo "Target directory: $TARGET_DIR"
echo ""

# Copy Python scripts
echo "Copying Python scripts..."
cp "$VIZ_DIR/1_format_data_daholocene_graphem.py" "$TARGET_DIR/"
cp "$VIZ_DIR/2_make_maps_and_ts.py" "$TARGET_DIR/"
cp "$VIZ_DIR/3_make_html_file.py" "$TARGET_DIR/"
cp "$VIZ_DIR/functions_presto.py" "$TARGET_DIR/"

# Copy environment file
echo "Copying conda environment file..."
cp "$VIZ_DIR/presto_env.yml" "$TARGET_DIR/"

# Copy run script (for reference)
echo "Copying shell script..."
cp "$VIZ_DIR/run_script.sh" "$TARGET_DIR/"

# Copy web assets
echo "Copying web assets..."
cp -r "$VIZ_DIR/web_assets" "$TARGET_DIR/"

# Create .github/workflows directory
echo "Creating .github/workflows directory..."
mkdir -p "$TARGET_DIR/.github/workflows"

# Copy the reusable workflow
echo "Copying reusable workflow..."
cp "$SCRIPT_DIR/presto-viz-reusable.yml" "$TARGET_DIR/.github/workflows/"

# Copy README template
echo "Copying README template..."
cp "$SCRIPT_DIR/NEW-REPO-README-TEMPLATE.md" "$TARGET_DIR/README.md"

# Create .gitignore
echo "Creating .gitignore..."
cat > "$TARGET_DIR/.gitignore" << 'EOF'
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
ENV/
*.egg-info/
dist/
build/

# Jupyter Notebook
.ipynb_checkpoints

# Data files (don't commit large data files)
*.nc
*.pkl
*.h5
*.hdf5

# Output files
*.png
*.jpg
*.jpeg
*.html
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Conda
*.tar.bz2
EOF

# Create LICENSE file (MIT)
echo "Creating MIT LICENSE..."
YEAR=$(date +%Y)
cat > "$TARGET_DIR/LICENSE" << EOF
MIT License

Copyright (c) $YEAR PaleoPresto Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF

echo ""
echo "=== Migration Complete! ==="
echo ""
echo "Files copied to: $TARGET_DIR"
echo ""
echo "Next steps:"
echo "1. cd $TARGET_DIR"
echo "2. Review the README.md file"
echo "3. git add ."
echo "4. git commit -m 'Initial commit: Presto visualization pipeline'"
echo "5. git push origin main"
echo ""
echo "File structure:"
cd "$TARGET_DIR"
tree -L 2 -I '__pycache__' || ls -lR

echo ""
echo "IMPORTANT: Excluded files (server-specific, not copied):"
echo "  - viz.js (server application, not needed for standalone viz)"
echo ""
echo "Repository is ready to be pushed to GitHub!"
