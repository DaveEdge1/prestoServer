#update the available downloads based on TSID lists
setwd("/root/presto/userRecons")
a1 <- list.files(pattern = "TSIDs.json$", recursive = TRUE)
print(paste0("current TSID sets: ", a1))
a2 <- vapply(strsplit(a1, "/", fixed = TRUE), "[", "", 1)
if (length(a1 > 0)){
  a1 <- lapply(a1, function(x) tools::md5sum(x))
  df1 <- data.frame("location" = a2, "md5" = unname(unlist(a1)))
} else {
  df1 <- data.frame("location" = "", "md5" = "")
}
print("writing /root/presto/getLipds/TSIDmd5.csv")
write.csv(df1, "/root/presto/getLipds/TSIDmd5.csv")
