// Mixed-workload load test — runs three scenarios in parallel to mimic
// what a real testing session looked like:
//
//   1. browsers : light traffic on /forms and /query (ramps to 15 VUs)
//   2. analyze  : a few VUs hammering proxy-analysis /analyze
//   3. data     : DB-backed data endpoints
//
// The purpose is to measure cross-service contention. The orchestrator
// crashed last session under a mix like this — running each in
// isolation hides interactions (e.g. orchestrator GC stalls during a
// big /analyze call holding the connection open).
//
// Usage (local):
//   docker run --rm -i \
//     --network prestoserver_presto-network \
//     -v "$(cygpath -w "$(pwd)"):/work" -w /work \
//     -e TARGET=http://nginx:81 \
//     -e ANALYZE_TARGET=http://proxy-analysis:8090/analyze \
//     grafana/k6 run /work/mixed.js
//
// Against prod (from outside): /analyze is internal-only, so this skips
// the analyze scenario when ANALYZE_TARGET is unset.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const TARGET         = __ENV.TARGET || 'http://localhost:81';
const ANALYZE_TARGET = __ENV.ANALYZE_TARGET || '';
const TSIDS_FILE     = __ENV.TSIDS_FILE || '/work/tsids.json';

const tsidsDoc    = JSON.parse(open(TSIDS_FILE));
const analyzePayload = JSON.stringify({ tsids: tsidsDoc.TSIDs.slice(0, 50) });

const browseLatency = new Trend('browse_latency_ms', true);
const analyzeFails  = new Counter('analyze_fails');

const scenarios = {
  browsers: {
    executor: 'ramping-vus',
    exec: 'browse',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 15 },
      { duration: '5m', target: 15 },
      { duration: '30s', target: 0 },
    ],
  },
  data: {
    executor: 'constant-vus',
    exec: 'dataReads',
    vus: 5,
    duration: '6m',
    startTime: '30s',
  },
};

if (ANALYZE_TARGET) {
  scenarios.analyze = {
    executor: 'constant-vus',
    exec: 'analyze',
    vus: 4,
    duration: '6m',
    startTime: '1m',
  };
}

export const options = {
  scenarios,
  thresholds: {
    http_req_failed: ['rate<0.10'],
  },
};

export function browse() {
  const r = http.get(`${TARGET}/forms`, { tags: { scenario: 'browsers' } });
  browseLatency.add(r.timings.duration);
  check(r, { 'forms ok': (res) => res.status < 400 });
  sleep(1 + Math.random() * 3);

  http.get(`${TARGET}/query/lmr`, { tags: { scenario: 'browsers' } });
  sleep(2 + Math.random() * 4);
}

export function dataReads() {
  http.get(`${TARGET}/data/compilations`, { tags: { scenario: 'data' } });
  sleep(2 + Math.random() * 3);
}

export function analyze() {
  const r = http.post(ANALYZE_TARGET, analyzePayload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '5m',
    tags: { scenario: 'analyze' },
  });
  if (r.status !== 200) {
    analyzeFails.add(1);
    console.log(`analyze fail: status=${r.status} body=${String(r.body).slice(0, 200)}`);
  }
  sleep(5 + Math.random() * 10);
}

// Default exec for any scenario that didn't specify exec — here we don't
// use it, but k6 requires a default export.
export default function () {
  sleep(1);
}
