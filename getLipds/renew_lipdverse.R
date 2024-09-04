library(lipdR)

#update the lipdverse tts file for TSID-based filtering
load("/root/presto/getLipds/lipdverse.RData")
rm(D)
gc()
tts <- as.lipdTsTibble(TS)
rm(TS)
gc()
save(tts, file="/root/presto/getLipds/lipdverse_tts.RData")

#update the available downloads based on TSID lists
setwd("/root/presto/userRecons")
a1 <- list.files(pattern = "TSIDs.json$", recursive = TRUE)
a1 <- lapply(a1, function(x) tools::md5sum(x))
write.csv(unname(unlist(a1)), "/root/presto/getLipds/TSIDmd5.csv")
