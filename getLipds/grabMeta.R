print("updating compilation metadata")
compilationMetadata <- readLines("https://lipdverse.org/lipdverse/compilationMetadata.json")
write(compilationMetadata, "C:/users/dce25/Downloads/compilationMetadata.json")
