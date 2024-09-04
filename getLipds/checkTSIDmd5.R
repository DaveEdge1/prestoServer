existing <- read.csv("/root/presto/getLipds/TSIDmd5.csv")
if (length(existing) > 0){
  a1 <- tools::md5sum(arg)
  md5Index <- which(existing$md5 == a1)
  if (md5Index > 0){
    
