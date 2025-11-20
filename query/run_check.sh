#!/bin/bash
# Wrapper script to run check_mysql_sync.py with conda environment

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ENV_NAME="lipdverse-db"

# Check if conda environment exists
if ! conda env list | grep -q "^${ENV_NAME} "; then
    echo "ERROR: Conda environment '${ENV_NAME}' not found"
    echo "Run './setup_env.sh' first to create the environment"
    exit 1
fi

# Run the script in the conda environment
echo "Running check_mysql_sync.py in conda environment '${ENV_NAME}'..."
echo ""

conda run -n ${ENV_NAME} python "${SCRIPT_DIR}/check_mysql_sync.py" "$@"
