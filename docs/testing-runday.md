# Test session run-day checklist

What to do before, during, and after a human-tester session against
`https://custom.paleopresto.com/` so we always come away with usable
evidence — even if nothing crashes.

## Before the session (T-30 min)

1. **Confirm latest images are pulled on the prod host**
   ```bash
   ssh cefns_lipd@<prod-host>
   cd ~/presto
   podman-compose -f docker-compose.prod.yml pull
   podman-compose -f docker-compose.prod.yml up -d
   podman-compose -f docker-compose.prod.yml ps
   ```
   All services should be `Up` and healthy.

2. **Verify monitoring stack is healthy**
   - SSH-tunnel Grafana: `ssh -L 3001:localhost:3001 cefns_lipd@<prod-host>`
   - Open http://localhost:3001 — log in, "Presto Overview" should be present.
   - All panels should show data — if any are "No data", fix before testers join.

3. **Reset the run-folder locally**
   ```bash
   cd loadtest
   mkdir -p runs/human-$(date +%Y%m%d-%H%M)
   ```

4. **Send testers `testing-scenarios.md` 5–10 min before the start time**
   so they have the script open and aren't fumbling.

## During the session

Keep these tabs open on a dedicated monitor:

- **Grafana → Presto Overview** (http://localhost:3001) — watch:
  - Container memory % of limit (bottom row turning red = imminent OOM)
  - Container restarts (any non-zero = something crashed)
  - Orchestrator p95 latency (climbing past 10 s = something is queued up)
  - Recent errors (Loki panel)
- **Grafana → Explore → Loki** with query
  `{compose_project="prestoserver"} |~ "(?i)(error|fatal|exception)"`
  pinned, so you see error log lines as they happen.
- **A terminal tailing prod containers** as a backup:
  ```bash
  ssh cefns_lipd@<prod-host>
  podman-compose -f ~/presto/docker-compose.prod.yml logs -f --tail=50
  ```

If something breaks, **note the wall-clock time** in a scratchpad — that's
the only thing you'll need to find the incident in Grafana later.

## After the session

1. **Snapshot the dashboard** — open Presto Overview, set time range to
   cover the session, click `Share → Snapshot → Local Snapshot`. Save the
   URL in `loadtest/runs/human-<date>/snapshot.txt`.

2. **Export logs from the session window** — in Grafana → Explore →
   Loki, query `{compose_project="prestoserver"}` for the session window,
   click `Download → Plain text`. Save as
   `loadtest/runs/human-<date>/logs.txt`.

3. **Pull podman state** for any container that crashed:
   ```bash
   podman ps -a --format json > runs/human-<date>/podman-ps.json
   podman inspect <crashed-container> > runs/human-<date>/inspect.json
   ```

4. **Write a one-page summary** at `runs/human-<date>/SUMMARY.md`:
   what tasks the testers ran, what crashed (if anything), what the
   memory peaked at per container, any errors from the Loki panel.

## If a container crashes mid-session

Stay calm — `restart: unless-stopped` brings it back automatically.

1. Note the time.
2. In Grafana, look at the "Container restarts" panel and the memory
   panel for the crashed container in the 60 s before the restart.
3. The most likely cause is OOM (mem hit the orange/red threshold then
   container restart shows). Confirm with:
   ```bash
   ssh cefns_lipd@<prod-host>
   podman inspect <container> --format '{{.State.OOMKilled}} {{.State.ExitCode}}'
   # OOMKilled=true and ExitCode=137 confirms memory was the cause.
   ```
4. If memory wasn't the cause, look at the Loki panel for a fatal log
   line within 10 s of the restart timestamp.
