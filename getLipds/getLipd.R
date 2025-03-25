args = commandArgs(trailingOnly=TRUE)
library(lipdR)
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

dsPick <- unique(qt$datasetId[TSIndex])
print(paste0("datasetIDs: ", dsPick))

D = readLipd(dsPick, paralell=T)

destPath <- file.path(args[2], "lipd.rds") 
saveRDS(D, destPath)
writeLipd(D, args[2])

