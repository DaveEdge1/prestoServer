#!/usr/bin/env bash
# Wrapper: start docker stats collector in background, run k6 stampede,
# then stop the collector. Artifacts land in loadtest/runs/<timestamp>/.
#
# Usage:
#   ./run.sh [VUS]
#
# Example:
#   ./run.sh 25

set -euo pipefail

VUS="${1:-25}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
RUN_DIR="$SCRIPT_DIR/runs/$RUN_ID"
mkdir -p "$RUN_DIR"

echo "=== Run $RUN_ID (VUs=$VUS) ==="
echo "Artifacts: $RUN_DIR"

# Start stats collector in background (20 min cap)
"$SCRIPT_DIR/monitor.sh" "$RUN_DIR/stats.csv" 5 1200 &
MON_PID=$!
trap 'kill "$MON_PID" 2>/dev/null || true' EXIT

# Give the sampler a head start so t=0 is captured
sleep 2

# Run k6 inside the compose network
MSYS_NO_PATHCONV=1 docker run --rm \
    --network prestoserver_presto-network \
    -v "$(cygpath -w "$SCRIPT_DIR"):/work" \
    -w /work \
    -e VUS="$VUS" \
    grafana/k6 run \
        --summary-export=/work/runs/$RUN_ID/summary.json \
        /work/stampede.js \
    | tee "$RUN_DIR/k6.log"

# Let one more sample land after the test ends
sleep 7
kill "$MON_PID" 2>/dev/null || true
wait "$MON_PID" 2>/dev/null || true

echo
echo "=== Done ==="
echo "k6 log:   $RUN_DIR/k6.log"
echo "stats:    $RUN_DIR/stats.csv"
echo "summary:  $RUN_DIR/summary.json"
