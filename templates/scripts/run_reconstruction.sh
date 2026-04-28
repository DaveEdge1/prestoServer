#!/bin/bash

# Run Reconstruction Script
# Executes the paleoclimate reconstruction in a Docker container

set -e

echo "========================================"
echo "Running Paleoclimate Reconstruction"
echo "========================================"

DOCKER_IMAGE="${DOCKER_IMAGE:-davidedge/lipd_webapps:holocene_da}"
CONFIG_FILE="${CONFIG_FILE:-config/user_config.yml}"
RESULTS_DIR="${RESULTS_DIR:-results}"

echo "Docker Image: $DOCKER_IMAGE"
echo "Config File: $CONFIG_FILE"
echo "Results Directory: $RESULTS_DIR"

# Ensure results directory exists
mkdir -p "$RESULTS_DIR/data"
mkdir -p "$RESULTS_DIR/logs"

# Check if Docker is available
if ! command -v docker &> /dev/null; then
  echo "ERROR: Docker is not installed or not in PATH"
  exit 1
fi

# Pull the Docker image
echo ""
echo "Pulling Docker image: $DOCKER_IMAGE"
docker pull "$DOCKER_IMAGE"

# Run the reconstruction
echo ""
echo "Starting reconstruction..."
echo "This may take 30 minutes to 2 hours depending on the configuration."
echo ""

# Mount configuration and data directories
docker run --rm \
  -v "$(pwd)/config:/app/config:ro" \
  -v "$(pwd)/data:/app/data:ro" \
  -v "$(pwd)/$RESULTS_DIR:/app/results:rw" \
  "$DOCKER_IMAGE" \
  /bin/bash -c "cd /app && Rscript reconstruct.R /app/config/user_config.yml" \
  | tee "$RESULTS_DIR/logs/reconstruction.log"

# Check if reconstruction produced output
if [ ! -f "$RESULTS_DIR/data/reconstruction.nc" ]; then
  echo ""
  echo "⚠ Warning: Expected output file not found at $RESULTS_DIR/data/reconstruction.nc"
  echo "Checking for any NetCDF files in results..."
  find "$RESULTS_DIR" -name "*.nc" -type f
fi

echo ""
echo "========================================"
echo "Reconstruction Complete"
echo "========================================"

# List output files
echo "Output files:"
find "$RESULTS_DIR" -type f | sort
