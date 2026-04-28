// Stampede load test — 25 concurrent /analyze calls hit proxy-analysis at once.
//
// Run via docker so we can attach to the compose network and reach the
// service by name (no host port exposure needed):
//
//   docker run --rm -i \
//     --network prestoserver_presto-network \
//     -v "C:/Users/dce25/prestoServer/loadtest:/work" \
//     -w /work \
//     grafana/k6 run --summary-export=results.json stampede.js
//
// Tunables via env:
//   VUS        number of concurrent virtual users (default 25)
//   TARGET     full URL to /analyze (default http://proxy-analysis:8090/analyze)
//   TIMEOUT    per-request timeout (default 10m)
//   TSIDS_FILE path inside container to TSIDs.json (default /work/tsids.json)

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const VUS        = Number(__ENV.VUS || 25);
const TARGET     = __ENV.TARGET || 'http://proxy-analysis:8090/analyze';
const TIMEOUT    = __ENV.TIMEOUT || '10m';
const TSIDS_FILE = __ENV.TSIDS_FILE || '/work/tsids.json';

// open() is only valid in init context — runs once at start
const tsidsDoc = JSON.parse(open(TSIDS_FILE));
const payload = JSON.stringify({ tsids: tsidsDoc.TSIDs });

export const options = {
  scenarios: {
    stampede: {
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: 1,
      maxDuration: '15m',
    },
  },
  // Don't fail the whole run on one slow request — we care about the distribution
  thresholds: {
    http_req_failed: ['rate<0.20'],
  },
};

const analyzeLatency = new Trend('analyze_latency_ms', true);
const analyzeErrors  = new Counter('analyze_errors');

export default function () {
  const res = http.post(TARGET, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: TIMEOUT,
    tags: { endpoint: 'analyze' },
  });

  analyzeLatency.add(res.timings.duration);

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'has records': (r) => {
      try { return Array.isArray(r.json('records')); }
      catch { return false; }
    },
  });
  if (!ok) {
    analyzeErrors.add(1);
    console.log(`VU ${__VU} failed: status=${res.status} body=${String(res.body).slice(0, 200)}`);
  }
}
