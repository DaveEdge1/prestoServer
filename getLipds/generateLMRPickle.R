#!/usr/bin/Rscript
# Generate LiPD data for LMR reconstruction based on query parameters
# Usage: Rscript generateLMRPickle.R <query_params_json> <output_dir> [format]
# format: rds | lpd | lpd_zip | pickle | all (default: all)
#   rds     -> lipd.rds
#   lpd     -> *.lpd files (via lipdR::writeLipd)
#   lpd_zip -> *.lpd files + lipd_files.zip
#   pickle  -> *.lpd files (feed to lipdPickler container for .pkl)
#   all     -> rds + lpd + zip

args <- commandArgs(trailingOnly = TRUE)

if (length(args) < 2) {
  stop("Usage: Rscript generateLMRPickle.R <query_params_json> <output_dir> [format]")
}

query_params_file <- args[1]
output_dir <- args[2]
output_format <- if (length(args) >= 3) args[3] else "all"

cat("Starting LMR LiPD data generation...\n")
cat("Query params file:", query_params_file, "\n")
cat("Output dir:", output_dir, "\n")
cat("Output format:", output_format, "\n")

# Load required libraries
library(jsonlite)
library(lipdR)

# Read query parameters
query_params <- fromJSON(query_params_file)
cat("Query parameters:\n")
print(query_params)

# Build coordinate filter (default: global)
coord <- if (!is.null(query_params$coords) && length(query_params$coords) == 4) {
  query_params$coords  # [lat_min, lat_max, lon_min, lon_max]
} else {
  c(-90, 90, -180, 180)
}

# Query lipdverse with all provided filters
cat("\nQuerying lipdverse...\n")
qt <- queryLipdverse(
  coord          = coord,
  archive.type   = query_params$archiveTypes,
  variable.name  = query_params$variableName,
  compilation    = query_params$compilation,
  verbose        = TRUE
)

if (nrow(qt) == 0) {
  stop("No data matching query parameters")
}

cat("\nFound", nrow(qt), "time series across",
    length(unique(qt$datasetId)), "datasets\n")

# Get unique datasets and build download URLs
# URL pattern: https://lipdverse.org/data/{datasetId}/{ver_underscores}/lipd.lpd
# where version "1.0.2" becomes "1_0_2"
datasets <- unique(qt[, c("datasetId", "datasetVersion")])

urls <- character(nrow(datasets))
for (i in seq_len(nrow(datasets))) {
  dsid <- datasets$datasetId[i]
  vers <- gsub(".", "_", datasets$datasetVersion[i], fixed = TRUE)
  urls[i] <- paste0("https://lipdverse.org/data/", dsid, "/", vers, "/lipd.lpd")
}

cat("Downloading", length(urls), "LiPD files from lipdverse.org...\n")

# Download and load all matching LiPD files
D <- readLipd(urls)

if (is.null(D) || length(D) == 0) {
  stop("Failed to load any LiPD datasets")
}

n_datasets <- if (is.lipd(D)) 1 else length(D)
cat("Successfully loaded", n_datasets, "datasets\n")

# Ensure output directory exists
if (!dir.exists(output_dir)) dir.create(output_dir, recursive = TRUE)

write_rds <- output_format %in% c("rds", "all")
write_lpd <- output_format %in% c("lpd", "lpd_zip", "pickle", "all")
write_zip <- output_format %in% c("lpd_zip", "all")

# RDS output
if (write_rds) {
  rds_path <- file.path(output_dir, "lipd.rds")
  cat("Saving RDS...\n")
  saveRDS(D, file = rds_path)
  cat("  -", rds_path, "\n")
}

# LiPD file output
if (write_lpd) {
  cat("Writing LiPD files to:", output_dir, "\n")
  if (is.lipd(D)) {
    writeLipd(D, path = output_dir)
  } else {
    for (dsname in names(D)) {
      tryCatch(
        writeLipd(D[[dsname]], path = output_dir),
        error = function(e) cat("Warning: failed to write", dsname, ":", e$message, "\n")
      )
    }
  }
  lpd_count <- length(list.files(output_dir, pattern = "\\.lpd$"))
  cat("  -", lpd_count, ".lpd files written\n")

  if (write_zip) {
    zip_path <- file.path(output_dir, "lipd_files.zip")
    lpd_files <- list.files(output_dir, pattern = "\\.lpd$", full.names = TRUE)
    cat("Creating zip archive:", zip_path, "\n")
    zip(zip_path, files = lpd_files, flags = "-j")
    cat("  - ZIP created with", length(lpd_files), "files\n")
  }
}

cat("\nLMR LiPD data generation completed successfully\n")
cat("  - Datasets:", n_datasets, "\n")
cat("  - Format:", output_format, "\n")
