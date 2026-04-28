#!/usr/bin/env bash
# Sample `docker stats` every N seconds during a load test.
# Writes a CSV with one row per (sample_time, container).
#
# Usage:
#   ./monitor.sh <output.csv> [interval_seconds] [duration_seconds]
#
# Defaults: interval=5, duration=900 (15 min).
# Stop early with Ctrl-C — partial CSV is preserved.

set -euo pipefail

OUT="${1:-stats.csv}"
INTERVAL="${2:-5}"
DURATION="${3:-900}"

echo "timestamp,container,cpu_pct,mem_used_mib,mem_limit_mib,net_in_mb,net_out_mb,block_in_mb,block_out_mb,pids" > "$OUT"

# Convert "123.4MiB / 11.68GiB" -> "123.4,11960" (MiB), etc.
# docker stats output format is stable enough for awk parsing.
to_mib() {
    # arg: value like "123.4MiB" or "1.2GiB" or "512KiB"
    awk -v v="$1" 'BEGIN {
        n = v + 0
        if      (v ~ /GiB/) n *= 1024
        else if (v ~ /KiB/) n /= 1024
        else if (v ~ /B$/ && v !~ /[KMG]/) n /= 1048576
        printf "%.1f", n
    }'
}

to_mb() {
    awk -v v="$1" 'BEGIN {
        n = v + 0
        if      (v ~ /GB/) n *= 1000
        else if (v ~ /kB/) n /= 1000
        else if (v ~ /B$/ && v !~ /[kMG]/) n /= 1000000
        printf "%.3f", n
    }'
}

SECONDS=0
while (( SECONDS < DURATION )); do
    TS="$(date +%Y-%m-%dT%H:%M:%S)"
    docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}|{{.BlockIO}}|{{.PIDs}}' \
    | while IFS='|' read -r name cpu mem net block pids; do
        cpu_num="${cpu%\%}"
        mem_used="${mem%% *}"
        mem_limit="${mem##*/ }"
        net_in="${net%% *}"
        net_out="${net##*/ }"
        blk_in="${block%% *}"
        blk_out="${block##*/ }"
        printf '%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n' \
            "$TS" "$name" "$cpu_num" \
            "$(to_mib "$mem_used")" "$(to_mib "$mem_limit")" \
            "$(to_mb "$net_in")" "$(to_mb "$net_out")" \
            "$(to_mb "$blk_in")" "$(to_mb "$blk_out")" \
            "$pids" >> "$OUT"
    done
    sleep "$INTERVAL"
done

echo "Done. Samples written to $OUT"
