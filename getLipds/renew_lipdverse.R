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
a1 <- vapply(strsplit(a1, "/", fixed = TRUE), "[", "", 1)
if length(a1 > 0){
  a1 <- lapply(a1, function(x) tools::md5sum(x))
  df1 <- data.frame("location" = names(unlist(a1)), "md5" = unname(unlist(a1)))
  write.csv(df1, "/root/presto/getLipds/TSIDmd5.csv")
}
