args = commandArgs(trailingOnly=TRUE)
#library(lipdR)
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

tsPick <- qt$paleoData_TSid[TSIndex]
dsPick <- unique(qt$datasetId[TSIndex])


load("/root/presto/getLipds/lipdverse_tts.RData")
tts <- tts[tts$paleoData_TSid %in% tsPick,]

if (length(dsPick) == 1){
	D <- lipdR::as.lipd(tts)
} else {
	D <- lipdR::as.multiLipd(tts)
}

if (args[3] == "R"){
	destPath <- file.path(args[2], "lipd.rds") 
	saveRDS(D, destPath)
} else {
	writeLipd(D, args[2])
}
