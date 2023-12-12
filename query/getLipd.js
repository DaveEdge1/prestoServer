const fs = require('fs');

var exec = require("child_process").exec;

print('Downloading files from LiPDverse')

query1 = exec('docker run --rm -v ${PWD}/output:/output -v ${PWD}/queryParams.json:/queryParams.json davidedge/lipd_webapps:queryContainer');

query1.stdout.pipe(fs.createWriteStream('queryContainer_stdout.log'));

