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

dsPick <- unique(qt$datasetId[TSIndex])
tsPick <- qt$paleoData_TSid[TSIndex]
age.year.Inices <- which(qt$paleoData_variableName %in% c("age","year"))
timePick <- qt$paleoData_TSid[age.year.Inices[age.year.Inices %in% which(qt$datasetId %in% dsPick)]]
tsPick <- c(tsPick, timePick)
print(paste0("Total TSIDs including time coulmns (BEFORE age/year filter): ", length(tsPick)))

filtered_qt <- qt[qt$paleoData_TSid %in% tsPick,]
year.only.datasets <- c()

for (ii in dsPick){
  this.dataset <- filtered_qt[filtered_qt$datasetId == ii,]
  if ("age" %in% this.dataset$paleoData_variableName){
  } else if ("year" %in% this.dataset$paleoData_variableName){
    year.only.datasets <- c(year.only.datasets, ii)
  } else {
    print(paste0(ii, " has no age! Removing!"))
    dsPick <- dsPick[!(dsPick %in% ii)]
  }
}

tsPick <- filtered_qt$paleoData_TSid[filtered_qt$datasetId %in% dsPick]
print(paste0("Total TSIDs including time coulmns (AFTER age/year filter): ", length(tsPick)))
if (length(tsPick) == 0){
	stop("No data remaining after removing data that lack an 'age' column")
}

print("filter ts tibble")
load("/root/presto/getLipds/lipdverse_tts.RData")
tts <- tts[tts$datasetId %in% dsPick,]
tts <- tts[,unname(apply(tts, 2, function(x) sum(!is.na(x))))!=0]
tts <- tts[tts$paleoData_TSid %in% tsPick,]
print(paste0("dim(tts): ", dim(tts)))
print(paste0("unique datasets: ", length(unique(tts$datasetId))))

#convert to multipilp
if (length(dsPick) == 1){
  D <- lipdR::as.lipd(tts)
} else {
  D <- lipdR::as.multiLipd(tts)
}

#create age columns where needed
if (length(year.only.datasets) > 0){
	for (iii in year.only.datasets){
		tryCatch({
				L <- D[names(D)==ii]
				print(paste0("creating age column for ", ii))
				D[names(D)==ii] <- createColumn(
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
					print(paste0("removing ", ii))
					D[names(D)==ii] <- NULL
					}
			)
	}
}
			 
print("write filtered tts")		 
destPaths2 <- file.path(args[2], "lipd_tts.rds") 
saveRDS(tts, destPaths2)
			 
print("write filtered multi-lipd") 
destPaths3 <- file.path(args[2], "lipd.rds") 
saveRDS(D, destPaths3)

print("write temporary lipd files for pkl")
writeLipd(D, args[2])

print("write datasetIds.json")
DSids <- jsonlite::toJSON(as.list(data.frame("datasetIds"=dsPick)))
destPaths4 <- file.path(args[2], "datasetIds.json") 
write(DSids, destPaths4)
