args = commandArgs(trailingOnly=TRUE)
library(lipdR)
path2RData <- paste0(args[1], "/lipd.RData")
load(path2RData)
D <- structure(D, class = c("multi_lipd", class(list())))
tts <- as.lipdTsTibble(D)

print("write filtered tts")		 
destPaths2 <- file.path(args[1], "lipd_tts.rds") 
saveRDS(tts, destPaths2)
			 
print("write filtered multi-lipd") 
destPaths3 <- file.path(args[1], "lipd.rds") 
saveRDS(D, destPaths3)
