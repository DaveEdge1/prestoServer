const fs = require('fs');

var exec = require("child_process").exec;
query1 = exec('docker run --rm -v ${PWD}/output:/output -v ${PWD}/queryParams.json:/queryParams.json davidedge/lipd_webapps:queryContainer');

//var myFile = fs.createWriteStream("queryContainer_stdout.log");

query1.stdout.pipe(fs.createWriteStream('queryContainer_stdout.log'));

//run query container from json
/*
exec("docker run --rm -v ${PWD}/output:/output -v ${PWD}/queryParams.json:/queryParams.json davidedge/lipd_webapps:queryContainer", (error, stdout, stderr) => {
	    if (error) {
		            console.log(`error: ${error.message}`);
		            return;
		        }
	    if (stderr) {
		            console.log(`stderr: ${stderr}`);
		            return;
		        }
	    console.log(`stdout: ${stdout}`);
});
*/
