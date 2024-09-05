args = commandArgs(trailingOnly=TRUE)

existing <- tryCatch(read.csv("/root/presto/getLipds/TSIDmd5.csv"), error=function(e) NULL)
TSIDs.loc <- file.path(args[1], "TSIDs.json")
if (length(existing) > 0){
  a1 <- tools::md5sum(TSIDs.loc)
  md5Index <- which(existing$md5 == a1)[1]
  if (length(md5Index) > 0){
    dir.create(args[1], showWarnings = FALSE)
    write(existing$location[md5Index], file = file.path(args[1], "pointer.txt"))
  }
}
