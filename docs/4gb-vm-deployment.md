# 4 GB VM Deployment Plan

Captures the memory optimizations made on the `claude/python-lipdgenerator`
branch and the deployment requirements for a **2 vCPU / 4 GB / 200 GB disk**
target VM expected to handle ~25 concurrent users.

## What changed

Five changes landed during the perf pass. All are committed; the prod images
need a rebuild + push for the server to pick them up.

| Change | File | Effect |
|---|---|---|
| Disk-backed `_lipd_series_cache` | `getLipds/proxyAnalysis/app.py` | proxy-analysis RAM stays flat as datasets accumulate; cache survives restarts |
| MySQL buffer pool capped at 256 MB | `docker-compose*.yml` (`--innodb-buffer-pool-size=256M`) | mysql RAM bounded |
| 2 uvicorn workers | `getLipds/proxyAnalysis/Dockerfile` | parallel `/analyze` handling; ~34% lower p95 latency |
| Disk-authoritative cache lookup | `getLipds/proxyAnalysis/app.py` (`_cache_lookup`) | multi-worker workers share the same disk cache |
| Lipdverse circuit breaker | `getLipds/proxyAnalysis/app.py` | bounds upstream-flakiness blast radius from 66s tail to ~20s |

## Measured performance (Docker Desktop, ~3 effective cores)

25-VU stampede on `POST /datacleaning/analyze` with a 1207-TSID payload.

| Configuration | min | median | p95 | max | wall | proxy-analysis peak RSS |
|---|---|---|---|---|---|---|
| 1 worker, no breaker | 1.5s | 17.0s | 32.7s | 33.2s | 33s | 900 MB |
| 4 workers, no breaker | 3.3s | 13.1s | 18.6s | 18.9s | 19s | 2018 MB |
| 2 workers, no breaker | 2.3s | 8.0s | 21.5s | 21.7s | 22s | 1180 MB |
| **2 workers, with breaker (flaky upstream)** | 2.4s | 10.8s | **19.5s** | 19.7s | 20s | 997 MB |
| 2 workers, no breaker (flaky upstream) | 3.3s | 27.0s | 65s | 66s | 66s | n/a |

Conclusion: **2 workers + breaker** is the chosen config. On the actual VM
with 2 vCPUs (vs 3 on the test machine), expect p95 to rise some — re-test
after deploy.

## Memory budget on 4 GB

| Component | Steady | Stampede peak |
|---|---|---|
| Linux + Docker daemon | 600 MB | 600 MB |
| proxy-analysis (2 workers) | 600 MB | 1100 MB |
| mysql | 500 MB | 500 MB |
| presto-orchestrator | 135 MB | 135 MB |
| nginx + tile-server | 17 MB | 17 MB |
| **Subtotal** | **1.85 GB** | **2.35 GB** |
| Free headroom | 2.15 GB | 1.65 GB |
| Per concurrent reconstruction submission | — | +500–1500 MB transient (lipdGenerator) |

Stampede on `/analyze` plus two concurrent reconstruction submissions is the
realistic worst case and lands at ~3.85 GB. Without mitigation that's an
OOM-killer risk.

## Required pre-deployment changes

### 1. Swap (highest leverage)

A 2 GB swap file lets Linux absorb burst pressure instead of OOM-killing
containers. Free on a 200 GB disk. **This is the single most important
mitigation for the 4 GB target.**

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Optionally tune swappiness so swap is only used under real pressure:

```bash
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf
sudo sysctl -p /etc/sysctl.d/99-swappiness.conf
```

### 2. Per-container memory limits (already applied to `docker-compose.prod.yml`)

Caps mean a runaway container gets OOM-killed and restarted by its
restart-policy, instead of dragging down the whole VM. Limits are sized to
match observed peaks plus modest headroom:

| Service | `mem_limit` | Reasoning |
|---|---|---|
| proxy-analysis | 1400m | Peak 1100 MB + 27% headroom for upstream-fetch spikes |
| mysql | 700m | Buffer pool 256 MB + connection buffers + thread cache |
| presto-orchestrator | 400m | Peak 135 MB + headroom for spawned-container metadata |
| tile-server, nginx | (no limit) | Negligible RAM |

If a container hits its limit, you'll see it in `docker events` and the
`docker-compose ps` Status column will flip during the restart.

## Tuning option: 1 worker if memory pressure shows

The 2-worker config carries ~300 MB extra over 1 worker (each worker loads
its own copy of the lipdverse metadata DataFrame). If post-deploy monitoring
shows the VM swapping under load, drop to 1 worker by editing
`getLipds/proxyAnalysis/Dockerfile`:

```dockerfile
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8090", "--workers", "1"]
```

Tradeoff: serial `/analyze` execution; p95 returns to ~33s under stampede.
Acceptable if real arrivals are staggered (most likely).

## Deployment sequence

1. **Provision VM** (2 vCPU / 4 GB / 200 GB disk, Ubuntu LTS or similar)
2. **One-time host prep** — install Docker/Podman, add the swap file,
   `loginctl enable-linger` if rootless. See `digitalocean-runbook.md` or
   `production-runbook.md` for the matching host's recipe.
3. **Pull updated images** from Docker Hub:
   ```bash
   cd ~/presto
   docker compose -f docker-compose.prod.yml pull   # or podman-compose
   docker compose -f docker-compose.prod.yml up -d
   ```
4. **Verify health**:
   ```bash
   docker stats --no-stream
   curl http://localhost:9025/health
   docker compose -f docker-compose.prod.yml logs proxy-analysis | grep "rehydrated\|workers"
   ```
   Expected: 2 worker processes started, cache rehydrated from
   `lipd-cache-data` volume, RSS ~600 MB.
5. **Smoke-test `/analyze`** with a real session via the UI.

## Validating performance against the VM

The repo's load test rig works against a remote VM by setting the target URL
and seeding a real session first:

```bash
# On the VM, run a real /lipds query through the UI to populate
# userRecons/{uniqueID}_LMR/TSIDs.json. Then from any machine:

TARGET=http://<vm-ip>:9025/datacleaning/analyze \
  ./loadtest/run.sh 25
```

p95 budget on the VM:
- **Acceptable**: <30s p95 (matches the 1-worker dev-test result)
- **Good**: <22s p95 (matches the 2-worker dev-test result)
- **Concerning**: >40s p95 (likely CPU oversubscription — drop to 1 worker)

Memory budget on the VM:
- Watch `docker stats` during the test; proxy-analysis should peak <1.4 GB
  (its `mem_limit`)
- `free -m` should never show <200 MB free — if it does, swap will activate
  and tail latencies will rise

## Known limitations

- **Lipdverse outages still cost the in-flight burst.** The breaker bounds
  *subsequent* damage. To bound the in-flight burst would need shared-state
  breakers (Redis), out of scope for this volume.
- **Per-worker breaker state.** Each uvicorn worker independently learns
  upstream is dead. Minor inefficiency, not a correctness issue.
- **Per-worker lipdverse metadata copy.** Each worker holds ~300 MB of the
  pandas DataFrame. `gunicorn --preload` could share via copy-on-write but
  Python refcount touches break the COW benefit; not pursued.
