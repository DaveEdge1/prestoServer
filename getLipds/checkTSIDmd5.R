existing <- read.csv("/root/presto/getLipds/TSIDmd5.csv")
TSIDs.loc <- file.path(arg, "TSIDs.json")
if (length(existing) > 0){
  a1 <- tools::md5sum(TSIDs.loc)
  md5Index <- which(existing$md5 == a1)
  if (md5Index > 0){
    write(existing$location[md5Index], file = file.path(arg, "pointer.txt"))
    }
  }
