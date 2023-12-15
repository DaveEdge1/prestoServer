## Linking the query container with presto form and existing recons

### Current functionality
* Node app at query/getLipd.js 
* Accepts a json query file(queryParams.json)
* queryContainer runs query in lipdR
  * If queryParams.json specifies R interface, outputs .rds
  * Else if Python interface, outputs folder of .lpd files
  * queryContainer stdout stored as ‘queryContainer_stdout.log’
* Node app checks for R/Python param
  * If R, finished
  * If Python launch the lipdPickler container
    * Accepts directory path as input
    * Outputs lipid.pkl and ‘pickleContainer_stdout.log’

### Working on selecting multiple values from a list with autocomplete
* currently running via query/queryServer.js at port 86
* Needs some fine tuning - should not be checking the 'synonyms', but should be able to search on both those, the PAST terms, and the lipdName
