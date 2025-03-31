args = commandArgs(trailingOnly=TRUE)
print("starting getLipd.R")
library(lipdR)
library(jsonlite)
print(paste0("args: ", args))
if (length(args) != 3){
	stop("TSIDs, uniqueID, and language required")
}
TSIDs <- unlist(strsplit(args[1], split = ","))
if (length(TSIDs) < 1){
	stop("Requires at least 1 TSId")
}

qt <- read.csv("/root/presto/getLipds/lipdverseQuery.csv")
TSIndex <- which(qt$paleoData_TSid %in% TSIDs)

if(length(TSIndex)==0){
	print(paste0("Supplied TDids: ", TSIDs))
	stop("Error: Some of the listed TSids not located in query table")
}

print("filter for datasets, then time series")
dsPick <- unique(qt$datasetId[TSIndex])
print(paste0("Total datasetIDs: ", length(dsPick)))
print(paste0("Total TSIDs: ", length(TSIndex)))
tsPick <- qt$paleoData_TSid[TSIndex]
timePick <- which(which(qt$datasetId %in% dsPick) %in% which(qt$paleoData_variableName %in% c("age","year")))
print(paste0("Total number of time columns: ", length(timePick)))
tsPick <- c(tsPick, qt$paleoData_TSid[timePick])
print(paste0("Total TSIDs including time coulmns (BEFORE age filter): ", length(tsPick)))
filtered_qt <- qt[qt$paleoData_TSid %in% tsPick,]

#for each dataset, ensure we have an age/year
#if we only have year, convert to age
for (ii in dsPick){
	this.dataset <- filtered_qt[qt$datasetId == ii,]
	print(paste0("unique variableNames in this dataset: ", unique(this.dataset$paleoData_variableName)))
	if ("age" %in% this.dataset$paleoData_variableName){
		print(paste0(ii, " has age"))
	} else if ("year" %in% this.dataset$paleoData_variableName){
		print(paste0(ii, " has year"))
	} else {
		warning(paste0(ii, " has no age/year! Removing!"))
		dsPick <- dsPick[!(dsPick %in% ii)]
	}
}
tsPick <- filtered_qt$paleoData_TSid[filtered_qt$datasetId %in% dsPick]

print(paste0("Total TSIDs including time coulmns (AFTER age filter): ", length(tsPick)))

print("filter ts tibble")
load("/root/presto/getLipds/lipdverse_tts.RData")
tts <- tts[tts$datasetId %in% dsPick,]
tts <- tts[,unname(apply(tts, 2, function(x) sum(!is.na(x))))!=0]

print("write filtered tts")
tts <- tts[tts$paleoData_TSid %in% tsPick,]
print(paste0("dim(tts): ", dim(tts)))
print(paste0("unique datasets: ", length(unique(tts$datasetId))))
destPaths2 <- file.path(args[2], "lipd_tts.rds") 
saveRDS(tts, destPaths2)

print("write filtered multi-lipd")
if (length(dsPick) == 1){
  D <- lipdR::as.lipd(tts)
} else {
  D <- lipdR::as.multiLipd(tts)
}
destPaths3 <- file.path(args[2], "lipd.rds") 
saveRDS(D, destPaths3)

print("write temporary lipd files for pkl")
writeLipd(D, args[2])

print("write datasetIds.json")
DSids <- jsonlite::toJSON(as.list(data.frame("datasetIds"=dsPick)))
destPaths4 <- file.path(args[2], "datasetIds.json") 
write(DSids, destPaths4)
