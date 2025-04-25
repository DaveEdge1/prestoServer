print("updating compilation metadata")
compilationMetadata <- readLines("https://lipdverse.org/lipdverse/compilationMetadata.json")
compilationMetadata <- c(paste0("var compilationJson = ", paste(compilationMetadata, collapse = "")))
write(compilationMetadata, "/root/presto/query/public/compilationMetadata.js")
