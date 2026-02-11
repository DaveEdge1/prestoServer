#!/usr/bin/Rscript
# Generate LiPD pickle for LMR reconstruction based on query parameters
# Usage: Rscript generateLMRPickle.R <query_params_json> <output_pickle_path>

args <- commandArgs(trailingOnly = TRUE)

if (length(args) != 2) {
  stop("Usage: Rscript generateLMRPickle.R <query_params_json> <output_pickle_path>")
}

query_params_file <- args[1]
output_path <- args[2]

cat("Starting LMR LiPD pickle generation...\n")
cat("Query params file:", query_params_file, "\n")
cat("Output path:", output_path, "\n")

# Load required libraries
library(jsonlite)
library(lipdR)

# Read query parameters
query_params <- fromJSON(query_params_file)
cat("Query parameters:\n")
print(query_params)

# Load the lipdverse query table
qt <- read.csv("/root/presto/getLipds/lipdverseQuery.csv")
cat("Loaded query table with", nrow(qt), "records\n")

# Filter by compilation
if (!is.null(query_params$compilation)) {
  compilation_filter <- qt$paleoData_compilation == query_params$compilation
  qt <- qt[compilation_filter, ]
  cat("After compilation filter:", nrow(qt), "records\n")
}

# Filter by geographic bounds [lat_min, lat_max, lon_min, lon_max]
if (!is.null(query_params$coords) && length(query_params$coords) == 4) {
  lat_min <- query_params$coords[1]
  lat_max <- query_params$coords[2]
  lon_min <- query_params$coords[3]
  lon_max <- query_params$coords[4]

  geo_filter <- (qt$geo_latitude >= lat_min) &
                (qt$geo_latitude <= lat_max) &
                (qt$geo_longitude >= lon_min) &
                (qt$geo_longitude <= lon_max)
  qt <- qt[geo_filter, ]
  cat("After geographic filter:", nrow(qt), "records\n")
}

# Filter by archive types
if (!is.null(query_params$archiveTypes) && length(query_params$archiveTypes) > 0) {
  archive_filter <- qt$archiveType %in% query_params$archiveTypes
  qt <- qt[archive_filter, ]
  cat("After archive type filter:", nrow(qt), "records\n")
}

# Filter by variable name
if (!is.null(query_params$variableName)) {
  var_filter <- qt$paleoData_variableName == query_params$variableName
  qt <- qt[var_filter, ]
  cat("After variable name filter:", nrow(qt), "records\n")
}

# Get unique TSIDs and datasets
TSIDs <- unique(qt$paleoData_TSid)
if (length(TSIDs) == 0) {
  stop("No data matching query parameters")
}

cat("Found", length(TSIDs), "matching time series\n")

# Add age/year columns to TSIDs
dsPick <- unique(qt$datasetId)
age_year_indices <- which(qt$paleoData_variableName %in% c("age", "year"))
timePick <- qt$paleoData_TSid[age_year_indices[age_year_indices %in% which(qt$datasetId %in% dsPick)]]
tsPick <- c(TSIDs, timePick)
tsPick <- unique(tsPick)

cat("Total TSIDs including time columns:", length(tsPick), "\n")

# Filter for datasets with age or year
filtered_qt <- qt[qt$paleoData_TSid %in% tsPick, ]
year_only_datasets <- c()

for (ds_id in dsPick) {
  this_dataset <- filtered_qt[filtered_qt$datasetId == ds_id, ]
  if ("age" %in% this_dataset$paleoData_variableName) {
    # Has age, good
  } else if ("year" %in% this_dataset$paleoData_variableName) {
    year_only_datasets <- c(year_only_datasets, ds_id)
  } else {
    cat("Dataset", ds_id, "has no age column, removing\n")
    dsPick <- dsPick[!(dsPick %in% ds_id)]
  }
}

tsPick <- filtered_qt$paleoData_TSid[filtered_qt$datasetId %in% dsPick]
cat("After age/year filter:", length(tsPick), "TSIDs\n")

if (length(tsPick) == 0) {
  stop("No data remaining after removing datasets without age column")
}

# Load the lipdverse time series tibble
cat("Loading lipdverse time series data...\n")
load("/root/presto/getLipds/lipdverse_tts.RData")

# Filter tts
tts <- tts[tts$datasetId %in% dsPick, ]
tts <- tts[, unname(apply(tts, 2, function(x) sum(!is.na(x)))) != 0]
tts <- tts[tts$paleoData_TSid %in% tsPick, ]

cat("Filtered tts dimensions:", dim(tts), "\n")
cat("Unique datasets:", length(unique(tts$datasetId)), "\n")

# Convert to LiPD format
if (length(dsPick) == 1) {
  D <- lipdR::as.lipd(tts)
} else {
  D <- lipdR::as.multiLipd(tts)
}

# Create age columns where needed (for year-only datasets)
if (length(year_only_datasets) > 0) {
  for (ds_id in year_only_datasets) {
    tryCatch({
      cat("Creating age column for dataset:", ds_id, "\n")
      L <- D[[ds_id]]
      D[[ds_id]] <- createColumn(
        L,
        paleo.or.chron = "paleo",
        paleo.or.chron.number = 1,
        table.type = "measurement",
        table.number = 1,
        variableName = "age",
        units = "yr BP",
        values = 1950 - L$paleoData[[1]]$measurementTable[[1]]$year$values,
        additional.metadata = NA
      )
    }, error = function(e) {
      cat("Warning: Failed to create age column for", ds_id, ":", e$message, "\n")
    })
  }
}

# Save to RDS format first
temp_dir <- dirname(output_path)
rds_path <- file.path(temp_dir, "lipd.rds")
tts_path <- file.path(temp_dir, "lipd_tts.rds")

cat("Saving LiPD data to RDS format...\n")
saveRDS(D, file = rds_path)
saveRDS(tts, file = tts_path)

cat("LMR LiPD data generation completed successfully\n")
cat("  - Datasets:", length(dsPick), "\n")
cat("  - Time series:", length(tsPick), "\n")
cat("  - RDS file:", rds_path, "\n")
cat("  - TTS file:", tts_path, "\n")
cat("Note: Pickle conversion will be handled by Python Docker container\n")
