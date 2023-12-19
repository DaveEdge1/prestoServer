## Linking the query container with presto form and existing recons

### Current functionality
* mysql database for lipdverse query running at port=3306
  * access for nick and datathrough Rmysql
  * nodejs access via queryDB.js (port 88)
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
* Autocomplete now functions as it should
* Form inputs are not taken from the slected checkboxes (maybe because I changed the values from ('selectProp' to 'groupBy')
* The form currently sends a post request which prints the json form output on the webpage
