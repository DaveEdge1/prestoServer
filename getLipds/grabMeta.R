print("updating compilation metadata")
compilationMetadata <- readLines("https://lipdverse.org/lipdverse/compilationMetadata.json")
compilationMetadata <- paste0("var compilationJson = ", compilationMetadata)
write(compilationMetadata, "/root/presto/query/public/compilationMetadata.js")
