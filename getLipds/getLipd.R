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
tsPick <- qt$paleoData_TSid[TSIndex]
timePick <- which(which(qt$datasetId %in% dsPick) %in% which(qt$paleoData_variableName %in% c("age","year")))
tsPick <- c(tsPick, qt$paleoData_TSid[timePick])
print(paste0("Total TSIDs (including time coulmns): ", length(tsPick)))

print("filter ts tibble")
load("/root/presto/getLipds/lipdverse_tts.RData")
tts <- tts[tts$datasetId %in% dsPick,
tts <- tts[,unname(apply(tts, 2, function(x) sum(!is.na(x))))!=0]

print("write filtered tts")
tts <- tts[tts$paleoData_TSid %in% tsPick,]
print(paste0("dim(tts): ", dim(tts)))
print(paste0("unique datasets: ", length(unique(tts$datasetId))))
destPaths2 <- file.path(args[2], "lipd_tts.rds") 
saveRDS(tts, destPaths2)

print("write datasetIds.json")
DSids <- jsonlite::toJSON(as.list(data.frame("datasetIds"=dsPick)))
destPaths4 <- file.path(args[2], "datasetIds.json") 
write(DSids, destPaths4)
