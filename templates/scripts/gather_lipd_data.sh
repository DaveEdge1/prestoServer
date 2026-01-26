#!/bin/bash

# Gather LiPD Proxy Data Script
# Downloads LiPD files based on TSIDs in the configuration file

set -e

echo "========================================"
echo "Gathering LiPD Proxy Data"
echo "========================================"

CONFIG_FILE="${CONFIG_FILE:-config/user_config.yml}"
LIPD_DIR="data/lipd"

mkdir -p "$LIPD_DIR"

echo "Reading configuration from: $CONFIG_FILE"

# Extract TSIDs from YAML config
# This assumes TSIDs are in a list format in the YAML
TSIDS=$(grep -E '^\s*-\s*[A-Za-z0-9]+\.[A-Za-z0-9_]+\.' "$CONFIG_FILE" | sed 's/^\s*-\s*//' | tr -d '"' | tr -d "'")

if [ -z "$TSIDS" ]; then
  echo "ERROR: No TSIDs found in configuration file"
  exit 1
fi

TSID_COUNT=$(echo "$TSIDS" | wc -l)
echo "Found $TSID_COUNT TSIDs to download"

# Download LiPD files from lipdverse
CURRENT=0
for TSID in $TSIDS; do
  CURRENT=$((CURRENT + 1))
  echo ""
  echo "[$CURRENT/$TSID_COUNT] Downloading TSID: $TSID"

  # Extract dataset name from TSID (first part before dot)
  DATASET=$(echo "$TSID" | cut -d'.' -f1)

  # Try downloading from lipdverse API
  LIPD_URL="https://lipdverse.org/data/${DATASET}.lpd"

  if curl -f -L -o "$LIPD_DIR/${DATASET}.lpd" "$LIPD_URL" 2>/dev/null; then
    echo "✓ Downloaded: ${DATASET}.lpd"
  else
    echo "⚠ Failed to download: ${DATASET}.lpd (URL: $LIPD_URL)"
    # Continue with other files rather than failing completely
  fi
done

echo ""
echo "========================================"
echo "LiPD Data Gathering Complete"
echo "========================================"

# List downloaded files
DOWNLOADED=$(find "$LIPD_DIR" -name "*.lpd" | wc -l)
echo "Successfully downloaded: $DOWNLOADED files"

if [ "$DOWNLOADED" -eq 0 ]; then
  echo "ERROR: No LiPD files were downloaded"
  exit 1
fi

ls -lh "$LIPD_DIR"
