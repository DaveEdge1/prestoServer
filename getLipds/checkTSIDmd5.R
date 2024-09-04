existing <- read.csv("/root/presto/getLipds/TSIDmd5.csv")
if (length(existing) > 0){
  a1 <- tools::md5sum(arg)
  md5Index <- which(existing == a1)
  if (md5Index > 0){
    
