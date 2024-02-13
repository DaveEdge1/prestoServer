args = commandArgs(trailingOnly=TRUE)
if (length(args) != 2){
	stop("TSIDs and user ID required")
}
TSIDs <- unlist(strsplit(args[1], split = ","))
if (length(TSIDs) < 1){
	stop("Requires at least 1 TSId")
}
library(lipdR)
qt <- lipdR:::newQueryTable()
TSIndex <- which(qt$paleoData_TSid %in% TSIDs)

if(length(TSIndex)==0){
	print(paste0("Supplied TDids: ", TSIDs))
	stop("Error: Some of the listed TSids not located in query table")
}

tsPick <- qt$paleoData_TSid[TSIndex]
dsPick <- unique(qt$datasetId[TSIndex])


D <- readLipd(dsPick)
tts <- as.lipdTsTibble(D)
tts <- tts[tts$paleoData_TSid %in% tsPick,]

if (length(dsPick) == 1){
	D <- as.lipd(tts)
} else {
	D <- as.multiLipd(tts)
}

destPath <- paste0("../userRecons/", args[2], ".rds") 
saveRDS(D, destPath)
