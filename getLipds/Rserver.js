PORT = process.env.PORT || 3010

var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var fs = require('fs');
var express = require('express'),
		    app = express()

const path = require("path")
var bodyParser = require('body-parser');
var cors = require('cors');

//app.use(bodyParser.json());
app.use(bodyParser.json({
     parameterLimit: 100000,
     limit: '50mb',
     extended: true
}));
app.use(cors({origin: 'http://143.198.98.66:86'}));

var child_process = require('child_process');
var file_path = "getLipd.R"
var r_comm = '/usr/bin/Rscript'
//var args = '--vanilla ' + file_path + ' ' + process.argv[2] + ' ' + process.argv[3];
var rspawn1 = function (TSIDs, uniqueID){
	var args = '--vanilla ' + file_path + ' ' + TSIDs + ' ' + uniqueID;
	return new Promise((resolve, reject) => {
		if (TSIDs == 'undefined' || uniqueID == 'undefined){
			resolve("Missing one of: TSIDs, uniqueID")
		}
	var rspawn = child_process.spawn(r_comm,[args]);

	rspawn.stdout.on('data', function (data) {
		  console.log(data.toString());
	});

	rspawn.stderr.on('data', function (data) {
		  console.log('stderr: ' + data);
		console.log(data.toString().search("error"));
		console.log(rspawn.connected);
		if ((data.toString().search("error") != -1) ) {
			console.log('process has been killed - "error" keyword found in stderr!');
			rspawn.kill('SIGTERM');
		}
	});

	rspawn.on('close', function (code) {
		  console.log('child process exited with code ' + code);
		  resolve("lipd data saved!")
	});
	});
}

app.post('/lipds', function(req, res) {
		rspawn1(req.body.TSIDs, req.body.uniqueID).then(reso => res.send(reso));
});

app.listen(PORT, function () {
		    console.log(`Express server listening on port ${PORT}`)
		  })
