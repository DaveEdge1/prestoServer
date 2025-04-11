library(lipdR)

#update the available downloads based on TSID lists
print("browsing userRecons for local data")
setwd("/root/presto/userRecons")
a1 <- list.files(pattern = "TSIDs.json$", recursive = TRUE)
a2 <- vapply(strsplit(a1, "/", fixed = TRUE), "[", "", 1)
if (length(a1 > 0)){
  a1 <- lapply(a1, function(x) tools::md5sum(x))
  df1 <- data.frame("location" = a2, "md5" = unname(unlist(a1)))
  write.csv(df1, "/root/presto/getLipds/TSIDmd5.csv")
}
print("updated TSIDmd5!")

print("updating compilation metadata")
compilationMetadata <- readLines("https://lipdverse.org/lipdverse/compilationMetadata.json")
write(compilationMetadata, "C:/users/dce25/Downloads/compilationMetadata.json")

#update the local lipdverse copy
latestMD5 <- readLines("https://lipdverse.org/lipdverse/lipdverseQuery.md5")
prevMD5 <- readLines("/root/presto/getLipds/lipdverseQuery.md5")

if (latestMD5 != prevMD5){
  print("lipdverse updates available, downloading latest")
  write(latestMD5, file="/root/presto/getLipds/lipdverseQuery.md5")
  
  #update the lipdverse query table
  qt <- read.csv("https://lipdverse.org/lipdverse/lipdverseQuery.csv")
  write.csv(qt, "/root/presto/getLipds/lipdverseQuery.csv")
  print("lipdverseQuery updated!")

  #update the lipdverse tts file for TSID-based filtering
  D <- lipdR::readLipd(qt$datasetId)
  tts <- as.lipdTsTibble(D)
  save(tts, file="/root/presto/getLipds/lipdverse_tts.RData")
  print("lipdverse updates complete!")
} else {
  print("no changes to lipdverse since last update, quitting...")
}
