print("updating compilation metadata")
compilationMetadata <- readLines("https://lipdverse.org/lipdverse/compilationMetadata.json")
write(compilationMetadata, "/root/presto/query/public/compilationMetadata.json")
