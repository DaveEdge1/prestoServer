## Linking the query container with presto form and existing recons

Current functionality
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
