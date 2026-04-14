#!/usr/bin/env bash
# Test lipd_to_pdb.py locally using existing lipd_files.zip
# Run from prestoServer directory: bash test_lipd_to_pdb.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIPD_ZIP="$SCRIPT_DIR/temp/lipd_test/lipd_files.zip"
SCRIPT="$SCRIPT_DIR/templates/scripts/lipd_to_pdb.py"
OUTPUT_DIR="$SCRIPT_DIR/temp/lipd_test"
OUTPUT="$OUTPUT_DIR/test_lipd_cfr.pkl"

if [ ! -f "$LIPD_ZIP" ]; then
  echo "ERROR: $LIPD_ZIP not found"
  echo "Run a filtered LMR job first to populate temp/lipd_test/"
  exit 1
fi

echo "=== Testing lipd_to_pdb.py ==="
echo "Input zip: $LIPD_ZIP ($(du -h "$LIPD_ZIP" | cut -f1))"
echo "Script:    $SCRIPT"
echo ""

MSYS_NO_PATHCONV=1 docker run --rm \
  -v "$LIPD_ZIP:/app/lipd_files.zip:ro" \
  -v "$SCRIPT:/app/lipd_to_pdb.py:ro" \
  -v "$OUTPUT_DIR:/output" \
  -w /app \
  davidedge/lmr2:latest \
  conda run -n cfr-env python lipd_to_pdb.py lipd_files.zip /output/test_lipd_cfr.pkl

echo ""
if [ -f "$OUTPUT" ]; then
  echo "=== SUCCESS: test_lipd_cfr.pkl written ($(du -h "$OUTPUT" | cut -f1)) ==="
  rm -f "$OUTPUT"
else
  echo "=== FAILED: output file not created ==="
  exit 1
fi
