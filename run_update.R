# run_update.R
# ============
# Refreshes lipdverse MySQL tables (`dataSetQuery` + `query`) on the
# production droplet, using the patched lipdverseR (isTerrestrial fix +
# parameterized connections).
#
# Designed to run *inside* the production docker network so it can reach
# the MySQL container by service alias (`mysql:3306`) without exposing
# the port to the host. The droplet's MySQL container is internal-only
# (no host port mapping), so external/legacy `host='143.198.98.66'`
# connections will not work.
#
# Usage (on the droplet):
# -----------------------
#   docker run --rm \
#     --network presto-production_presto-network \
#     --env-file /path/to/.env.production \
#     -v "$(pwd)/run_update.R:/run_update.R" \
#     rocker/geospatial:latest \
#     Rscript /run_update.R
#
# rocker/geospatial provides sf, dplyr, readr, tibble out of the box.
# RMySQL, DBI, spData, and the patched lipdverseR are installed below.
#
# Required env vars (from .env.production):
#   MYSQL_HOST       (defaults to "mysql" — the docker service alias)
#   MYSQL_USER       (e.g. "presto")
#   MYSQL_DATABASE   (e.g. "lipdverse")
#   MYSQL_PASSWORD   (the presto user's password)

suppressPackageStartupMessages({
  # Hard requirements at the top so a bad image fails fast.
  needed <- c("DBI", "RMySQL", "spData", "remotes")
  missing <- needed[!vapply(needed, requireNamespace, logical(1), quietly = TRUE)]
  if (length(missing) > 0) {
    cat("Installing missing packages:", paste(missing, collapse = ", "), "\n")
    install.packages(missing, repos = "https://cloud.r-project.org")
  }

  # geoChronR is used by lipdverseR's createQueryCsv() (R/queryCsv.R calls
  # geoChronR::convertAD2BP), but lipdverseR's DESCRIPTION does not declare
  # it under Imports, so install_github won't pull it. Install it from
  # GitHub explicitly here, before lipdverseR — otherwise the lipdverseR
  # install's lazy-load step fails with "there is no package called
  # 'geoChronR'" and removes the partial install.
  if (!requireNamespace("geoChronR", quietly = TRUE)) {
    cat("Installing geoChronR from nickmckay/GeoChronR...\n")
    remotes::install_github(
      "nickmckay/GeoChronR",
      upgrade = "never"
    )
  }

  # Always reinstall lipdverseR from the union fork's prod-update-combined
  # branch. The previous conditional (only install if missing OR missing the
  # `connections` parameter) silently kept stale installs across pushes to
  # the branch — fine when the package was idempotent, but it caused two
  # hard-to-diagnose failures in a row when the branch advanced. The runtime
  # cost is ~30-60s per run, which is acceptable for a manually-invoked
  # refresh script.
  cat("Installing patched lipdverseR from DaveEdge1/lipdverseR-union@prod-update-combined...\n")
  remotes::install_github(
    "DaveEdge1/lipdverseR-union",
    ref = "prod-update-combined",
    upgrade = "never",
    force = TRUE
  )

  library(dplyr)
})

# --- 1. Pull the latest lipdverseQuery.csv ------------------------------
csv_url   <- "https://lipdverse.org/lipdverse/lipdverseQuery.csv"
local_csv <- tempfile(pattern = "lipdverseQuery_", fileext = ".csv")

cat("Downloading", csv_url, "...\n")
download.file(csv_url, destfile = local_csv, mode = "wb", quiet = TRUE)

qt <- readr::read_csv(local_csv, show_col_types = FALSE)
cat("  loaded", nrow(qt), "time-series rows\n\n")

# --- 2. Pre-flight: confirm the land-detection fix is producing both
#        TRUE and FALSE values before we let it write to production.
cat("Pre-flight: testing land detection on a 500-row sample...\n")
# Build the sampling pool first so we can call nrow() on it. dplyr::n()
# in slice_sample(n = ...) is a data-masking helper and dplyr >= 1.1.0
# errors with "`n` must be a constant" when it's evaluated outside a
# data-masking verb like mutate/filter.
samp_pool <- qt |>
  dplyr::filter(!is.na(geo_longitude), !is.na(geo_latitude)) |>
  dplyr::distinct(datasetId, geo_longitude, geo_latitude)
samp <- samp_pool |>
  dplyr::slice_sample(n = min(500, nrow(samp_pool)))

samp_pts <- sf::st_as_sf(
  data.frame(samp$geo_longitude, samp$geo_latitude),
  coords = 1:2, crs = 4326
)
samp_terr <- lengths(sf::st_intersects(samp_pts, spData::world)) > 0

cat(sprintf("  sample: %d terrestrial, %d marine (out of %d)\n",
            sum(samp_terr), sum(!samp_terr), length(samp_terr)))

if (sum(samp_terr) == 0 || sum(!samp_terr) == 0) {
  stop("Sanity check failed: sample is entirely one class. ",
       "Aborting before writing to production.")
}
cat("  ok - proceeding.\n\n")

# --- 3. Build a connection from env vars --------------------------------
mysql_host <- Sys.getenv("MYSQL_HOST", unset = "mysql")
mysql_db   <- Sys.getenv("MYSQL_DATABASE", unset = "lipdverse")
mysql_user <- Sys.getenv("MYSQL_USER")
mysql_pass <- Sys.getenv("MYSQL_PASSWORD")

if (mysql_user == "" || mysql_pass == "") {
  stop("MYSQL_USER and MYSQL_PASSWORD must be set ",
       "(via --env-file .env.production or the shell environment).")
}

cat(sprintf("Connecting to %s@%s/%s ...\n", mysql_user, mysql_host, mysql_db))
con <- RMySQL::dbConnect(
  RMySQL::MySQL(),
  host     = mysql_host,
  port     = 3306,
  dbname   = mysql_db,
  user     = mysql_user,
  password = mysql_pass
)
on.exit(try(RMySQL::dbDisconnect(con), silent = TRUE), add = TRUE)

# --- 4. Run the patched update -----------------------------------------
# `connections = con` invokes the new parameterized branch. The patched
# function will not auto-disconnect a caller-supplied connection, so we
# can re-use it for the verification queries below.
lipdverseR::updateSqlQuery(qt, connections = con)

# --- 5. Post-update verification ---------------------------------------
cat("\nPost-update verification:\n")

terr_counts <- DBI::dbGetQuery(con, "
  SELECT isTerrestrial, COUNT(*) AS n
  FROM dataSetQuery
  GROUP BY isTerrestrial
  ORDER BY isTerrestrial
")
print(terr_counts)

if (nrow(terr_counts) < 2) {
  warning("dataSetQuery.isTerrestrial still has only one distinct value - ",
          "the fix may not have applied. Investigate before relying on the data.")
} else {
  cat("\nisTerrestrial column now has both 0 and 1 values - update successful.\n")
}

cat("\nDone. Flush the orchestrator's 24-hour datasetCache:\n")
cat("  docker compose -f docker-compose.do.yml restart presto-orchestrator\n")
