# Load testing

Synthetic load to reproduce the conditions that crashed the production
containers during the human test session, plus a minimal monitoring
loop so we always have evidence after a run.

## Scripts

| Script | Pressure | Use when |
|---|---|---|
| `stampede.js` | 25 concurrent `/analyze` POSTs to proxy-analysis | Reproduce proxy-analysis OOM in isolation |
| `browse.js` | Ramp to 20 VUs on `/forms` and `/query` for 5 min | Reproduce orchestrator load from browser fan-out |
| `mixed.js` | `browsers` + `data` (+ optional `analyze`) in parallel | Realistic test-session shape; catches cross-service contention |

All three use Trend/Counter metrics that surface under `k6_*` in
Prometheus when k6 is run with `--out experimental-prometheus-rw` (see
"Streaming results to Prometheus" below).

## Quick start (local, against compose stack)

```bash
docker-compose up -d
cd loadtest

# 1. Stampede — proxy-analysis only
./run.sh 25

# 2. Browse — orchestrator only
docker run --rm -i \
  --network prestoserver_presto-network \
  -v "$(cygpath -w "$(pwd)"):/work" -w /work \
  -e TARGET=http://nginx:81 \
  grafana/k6 run /work/browse.js

# 3. Mixed — full picture
docker run --rm -i \
  --network prestoserver_presto-network \
  -v "$(cygpath -w "$(pwd)"):/work" -w /work \
  -e TARGET=http://nginx:81 \
  -e ANALYZE_TARGET=http://proxy-analysis:8090/analyze \
  grafana/k6 run /work/mixed.js
```

While each test runs, watch the live dashboard at
[http://localhost:3001](http://localhost:3001) (Grafana → Presto Overview).

## Against production

Production is `https://custom.paleopresto.com/`. Run k6 from your laptop
(no need to log in to the prod host). `/analyze` is internal-only, so
omit `ANALYZE_TARGET` and the analyze scenario will skip itself.

```bash
k6 run -e TARGET=https://custom.paleopresto.com browse.js
k6 run -e TARGET=https://custom.paleopresto.com mixed.js
```

Before running, SSH-tunnel to Grafana so you can watch in real time:

```bash
ssh -L 3001:localhost:3001 cefns_lipd@<prod-host>
# then open http://localhost:3001
```

## Streaming results to Prometheus

If you want k6's per-iteration metrics overlaid in Grafana alongside
container metrics, point k6 at the local Prometheus remote-write
endpoint:

```bash
docker run --rm -i \
  --network prestoserver_presto-network \
  -v "$(cygpath -w "$(pwd)"):/work" -w /work \
  -e K6_PROMETHEUS_RW_SERVER_URL=http://prometheus:9090/api/v1/write \
  -e TARGET=http://nginx:81 \
  grafana/k6 run --out experimental-prometheus-rw /work/browse.js
```

This requires Prometheus to allow remote write — currently disabled.
For one-off use, add `--web.enable-remote-write-receiver` to the
prometheus service `command:` block in `docker-compose.yml`.

## Artifacts

`run.sh` writes a per-run directory to `runs/<timestamp>/` containing:

- `k6.log` — full k6 stdout
- `summary.json` — k6 end-of-run summary (thresholds, percentiles)
- `stats.csv` — `docker stats` sample every 5 s

For ad-hoc runs, redirect manually:

```bash
mkdir -p runs/$(date +%Y%m%d-%H%M%S)
... k6 run ... | tee runs/$(date +%Y%m%d-%H%M%S)/k6.log
```
