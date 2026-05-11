// Browse load test — simulates concurrent users opening forms and the
// query UI without triggering reconstructions. Proxies the kind of
// "ten testers all clicked the link at once" traffic that hammered the
// orchestrator on the last test session.
//
// What it hits:
//   GET /forms                         (EJS-rendered home)
//   GET /forms/<form>                  (any registered form)
//   GET /query/LMR                     (cached query template)
//   GET /data/<sample-endpoint>        (DB-backed JSON)
//   GET /health                        (sanity-check baseline)
//
// Usage (against local compose, behind nginx port 81):
//   docker run --rm -i \
//     --network prestoserver_presto-network \
//     -v "$(cygpath -w "$(pwd)"):/work" -w /work \
//     -e TARGET=http://nginx:81 \
//     grafana/k6 run /work/browse.js
//
// Against prod:
//   k6 run -e TARGET=https://custom.paleopresto.com browse.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const TARGET = __ENV.TARGET || 'http://localhost:81';

const formsLatency = new Trend('forms_latency_ms', true);
const queryLatency = new Trend('query_latency_ms', true);

export const options = {
  scenarios: {
    // Ramp: simulates testers arriving over a 2-minute window then
    // browsing for 5 minutes — the realistic shape of an organized test
    // session.
    ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m',  target: 20 },  // arrival ramp
        { duration: '5m',  target: 20 },  // sustained browsing
        { duration: '1m',  target: 0  },  // wind-down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed:   ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  // Health probe — cheap, used as a baseline reference in Grafana.
  http.get(`${TARGET}/health`, { tags: { endpoint: 'health' } });

  // Forms landing page — common first hit.
  let r = http.get(`${TARGET}/forms`, { tags: { endpoint: 'forms' } });
  formsLatency.add(r.timings.duration);
  check(r, { 'forms 2xx/3xx': (res) => res.status < 400 });

  sleep(1 + Math.random() * 2);

  // Query UI — served from cached HTML at startup, should be very fast.
  r = http.get(`${TARGET}/query/LMR`, { tags: { endpoint: 'query_lmr' } });
  queryLatency.add(r.timings.duration);
  check(r, { 'query 2xx': (res) => res.status === 200 });

  sleep(2 + Math.random() * 3);
}
