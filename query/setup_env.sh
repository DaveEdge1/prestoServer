#!/bin/bash
# Setup conda environment for LiPDverse database tools

set -e  # Exit on error

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ENV_NAME="lipdverse-db"

echo "========================================"
echo "LiPDverse Database Tools - Environment Setup"
echo "========================================"
echo ""

# Check if conda is available
if ! command -v conda &> /dev/null; then
    echo "ERROR: conda not found"
    echo ""
    echo "Please install Miniconda or Anaconda first:"
    echo "  https://docs.conda.io/en/latest/miniconda.html"
    echo ""
    echo "Or use pip in a virtual environment instead:"
    echo "  python3 -m venv venv"
    echo "  source venv/bin/activate"
    echo "  pip install mysql-connector-python"
    exit 1
fi

echo "✓ Found conda at: $(which conda)"
echo ""

# Check if environment already exists
if conda env list | grep -q "^${ENV_NAME} "; then
    echo "Environment '${ENV_NAME}' already exists"
    read -p "Do you want to recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Removing existing environment..."
        conda env remove -n ${ENV_NAME} -y
    else
        echo "Using existing environment"
        echo ""
        echo "To activate: conda activate ${ENV_NAME}"
        exit 0
    fi
fi

# Create environment
echo "Creating conda environment '${ENV_NAME}'..."
cd "$SCRIPT_DIR"

if [ -f "environment.yml" ]; then
    echo "Using environment.yml..."
    conda env create -f environment.yml
else
    echo "Creating environment manually..."
    conda create -n ${ENV_NAME} python=3.10 -y
    conda run -n ${ENV_NAME} pip install mysql-connector-python
fi

echo ""
echo "========================================"
echo "✓ Setup complete!"
echo "========================================"
echo ""
echo "To use the tools:"
echo "  1. Activate the environment:"
echo "     conda activate ${ENV_NAME}"
echo ""
echo "  2. Run the scripts:"
echo "     python check_mysql_sync.py"
echo "     python update_lipdverse_db.py"
echo ""
echo "  3. Deactivate when done:"
echo "     conda deactivate"
echo ""
