args = commandArgs(trailingOnly=TRUE)

existing <- tryCatch(read.csv("/root/presto/getLipds/TSIDmd5.csv"), error=function(e) NULL)
TSIDs.loc <- file.path(args[1], "TSIDs.json")
print(paste0("md5 of existing: ",  existing))

if (length(existing) > 0){
  a1 <- tools::md5sum(TSIDs.loc)
  print(paste0("md5 of new TSIDs: ",  a1))
  md5Index <- which(existing$md5 == a1)[1]
  print(paste0("md5Index: ",  md5Index))
  print(paste0("length(md5Index): ",  length(md5Index)))
  if (!is.na(md5Index)){
    dir.create(args[1], showWarnings = FALSE)
    write(existing$location[md5Index], file = file.path(args[1], "pointer.txt"))
  }
}
