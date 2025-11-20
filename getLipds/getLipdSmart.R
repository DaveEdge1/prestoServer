args = commandArgs(trailingOnly=TRUE)
print("starting getLipdSmart.R")
library(lipdR)
library(jsonlite)
print(paste0("args: ", args))
if (length(args) != 3){
	stop("TSIDs, uniqueID, and language required")
}

# Parse arguments
TSIDs_query <- unlist(strsplit(args[1], split = ","))
userDir <- args[2]
language <- args[3]

if (length(TSIDs_query) < 1){
	stop("Requires at least 1 TSId")
}

print(paste0("Query contains ", length(TSIDs_query), " TSIDs"))

# Load the query table
qt <- read.csv("/root/presto/getLipds/lipdverseQuery.csv")

# Check if datasetIds.json exists (new pathway)
datasetIdsPath <- file.path(userDir, 'datasetIds.json')
if (file.exists(datasetIdsPath)){
	print("Found datasetIds.json - using smart download pathway")

	# Load datasetIds from the saved file
	datasetIdsJSON <- jsonlite::fromJSON(datasetIdsPath)
	datasetIds_query <- datasetIdsJSON$datasetIds
	print(paste0("Query targets ", length(datasetIds_query), " datasets"))

	# Get ALL TSIDs for these datasets from the query table (TSIDs-a)
	TSIDs_from_datasets <- qt$paleoData_TSid[qt$datasetId %in% datasetIds_query]
	TSIDs_from_datasets <- unique(TSIDs_from_datasets)
	print(paste0("These datasets contain ", length(TSIDs_from_datasets), " total TSIDs"))

	# Compare: Are all dataset TSIDs included in the query? (TSIDs-a vs TSIDs-b)
	excluded_TSIDs <- setdiff(TSIDs_from_datasets, TSIDs_query)
	num_excluded <- length(excluded_TSIDs)

	print(paste0("Number of TSIDs excluded by query: ", num_excluded))

	if (num_excluded == 0){
		print("=== SIMPLE PATH: No TSIDs excluded, downloading complete datasets ===")

		# Download complete LiPD files by datasetId
		print("Downloading LiPD files...")
		D <- lipdR::readLipd(datasetIds_query)

		# Create time series tibble
		tts <- as.lipdTsTibble(D)

		# Filter to only include the queried TSIDs (for safety, though should be all)
		tts <- tts[tts$paleoData_TSid %in% TSIDs_query,]

		print(paste0("Downloaded ", length(datasetIds_query), " datasets"))
		print(paste0("Time series table has ", nrow(tts), " rows"))

	} else {
		print("=== COMPLEX PATH: Some TSIDs excluded, filtering required ===")
		print(paste0("Excluded TSIDs (first 10): ", paste(head(excluded_TSIDs, 10), collapse=", ")))

		# Download complete LiPD files by datasetId
		print("Downloading LiPD files...")
		D <- lipdR::readLipd(datasetIds_query)

		# Create time series tibble
		tts <- as.lipdTsTibble(D)

		# Filter to ONLY the TSIDs from the query
		print(paste0("Filtering from ", nrow(tts), " to ", length(TSIDs_query), " time series"))
		tts <- tts[tts$paleoData_TSid %in% TSIDs_query,]
		print(paste0("After filtering: ", nrow(tts), " rows"))

		# Need to rebuild the multiLipd object with only the queried TSIDs
		# This is more complex - we need to remove specific time series from datasets
		if (length(datasetIds_query) == 1){
		  D <- lipdR::as.lipd(tts)
		} else {
		  D <- lipdR::as.multiLipd(tts)
		}
	}

} else {
	print("WARNING: datasetIds.json not found - falling back to old TSID-only pathway")
	print("This is inefficient. Consider updating the query form to include datasetIds.")

	# OLD PATHWAY: Filter from large lipdverse_tts.RData file
	# This requires the lipdverse_tts.RData file which may not exist
	ttsPath <- "/root/presto/getLipds/lipdverse_tts.RData"
	if (!file.exists(ttsPath)){
		stop("ERROR: lipdverse_tts.RData not found and no datasetIds provided. Cannot proceed.")
	}

	print("Loading lipdverse_tts.RData (this is slow)...")
	load(ttsPath)

	# Get dataset IDs from TSIDs
	TSIndex <- which(qt$paleoData_TSid %in% TSIDs_query)
	if(length(TSIndex)==0){
		print(paste0("Supplied TSIDs: ", TSIDs_query))
		stop("Error: Some of the listed TSids not located in query table")
	}

	dsPick <- unique(qt$datasetId[TSIndex])
	print(paste0("Found ", length(dsPick), " datasets"))

	# Filter the large tts object
	tts <- tts[tts$datasetId %in% dsPick,]
	tts <- tts[,unname(apply(tts, 2, function(x) sum(!is.na(x))))!=0]
	tts <- tts[tts$paleoData_TSid %in% TSIDs_query,]

	# Convert to multiLipd
	if (length(dsPick) == 1){
	  D <- lipdR::as.lipd(tts)
	} else {
	  D <- lipdR::as.multiLipd(tts)
	}

	datasetIds_query <- dsPick
}

# Final check for age/year columns
print("Checking for age/year columns...")
filtered_qt <- qt[qt$paleoData_TSid %in% TSIDs_query,]
year.only.datasets <- c()

for (ii in datasetIds_query){
  this.dataset <- filtered_qt[filtered_qt$datasetId == ii,]
  if ("age" %in% this.dataset$paleoData_variableName){
    # Has age column, good
  } else if ("year" %in% this.dataset$paleoData_variableName){
    year.only.datasets <- c(year.only.datasets, ii)
  } else {
    print(paste0("WARNING: ", ii, " has no age or year column! Removing!"))
    datasetIds_query <- datasetIds_query[!(datasetIds_query %in% ii)]
  }
}

# Create age columns where needed
if (length(year.only.datasets) > 0){
	print(paste0("Creating age columns for ", length(year.only.datasets), " datasets"))
	for (iii in year.only.datasets){
		tryCatch({
				L <- D[names(D)==iii]
				print(paste0("creating age column for ", iii))
				D[names(D)==iii] <- createColumn(
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
			},
				error = function(cond){
					message(conditionMessage(cond))
					print(paste0("ERROR: Failed to create age column for ", iii, ", removing"))
					D[names(D)==iii] <- NULL
					datasetIds_query <- datasetIds_query[!(datasetIds_query %in% iii)]
					}
			)
	}
}

# Refresh tts from final D
tts <- as.lipdTsTibble(D)

print("=== FINAL SUMMARY ===")
print(paste0("Final dataset count: ", length(datasetIds_query)))
print(paste0("Final TSID count: ", nrow(tts)))
print(paste0("Unique datasets in tts: ", length(unique(tts$datasetId))))

# Write outputs
print("Writing lipd_tts.rds")
destPaths2 <- file.path(userDir, "lipd_tts.rds")
saveRDS(tts, destPaths2)

print("Writing lipd.rds")
destPaths3 <- file.path(userDir, "lipd.rds")
saveRDS(D, destPaths3)

print("Writing temporary lipd files for pkl")
writeLipd(D, userDir)

print("Writing datasetIds.json")
DSids <- jsonlite::toJSON(as.list(data.frame("datasetIds"=datasetIds_query)))
destPaths4 <- file.path(userDir, "datasetIds.json")
write(DSids, destPaths4)

print("getLipdSmart.R completed successfully!")
