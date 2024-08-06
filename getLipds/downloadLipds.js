var fs = require('fs');
const path = require("path")
var bodyParser = require('body-parser');

//app.use(bodyParser.json());
app.use(bodyParser.json({
     parameterLimit: 100000,
     limit: '50mb',
     extended: true
}));

var child_process = require('child_process');
var file_path = "getLipd.R";
var r_comm = '/usr/bin/Rscript';
let path1 = '';
//var args = '--vanilla ' + file_path + ' ' + process.argv[2] + ' ' + process.argv[3];

var newStatus = function(TSIDs, uniqueID, language){
	if (typeof TSIDs == 'undefined' || typeof uniqueID == 'undefined' || typeof language == 'undefined'){
		return(false)
	} else {
		return(true)
	}
}


var rspawn1 = function (TSIDs, uniqueID, language){
	path1 = path.join(__dirname, '../userRecons', uniqueID)
	fs.mkdir(path1,
		(err) => {
		if (err) {
			return console.error(err);
		}
		console.log('Directory created successfully at: ' + path1);
	});
	if (language == "Python"){
		var path3 = path.join(path1, "lipd.pkl")
		fs.writeFile(path3, " ", (err) => {
			                                  if (err)
				                                            console.log(err);
			                                  else {
								                                                console.log("Blank lipd.pkl written successfully\n");
								                                              }
			                        });
	}
	var args = '--vanilla ' + file_path + ' ' + TSIDs + ' ' + path1 + ' ' + language;
	return new Promise((resolve, reject) => {
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
		  		resolve(code)
			});
	});
	
}

pickleEm = function(path1){
	                                console.log("launching lipd pickler")
	                                var dockerComm = "docker run -v " + path1 +":/output -v " + path1 + "/lipd.pkl:/lipd.pkl davidedge/lipd_webapps:lipdPickler"
	                                var dockerspawn = child_process.exec(dockerComm);
	                                                        dockerspawn.stdout.on('data', function (data) {
									                                                                                                console.log(data.toString());
									                                                                                        });

	                                                        dockerspawn.stderr.on('data', function (data) {
									                                                                                                console.log('stderr: ' + data);
									                                                                                                console.log(data.toString().search("error"));
									                                                                                                console.log(dockerspawn.connected);
									                                                                                                if ((data.toString().search("error") != -1) ) {
																						                                                                                                                                                console.log('process has been killed - "error" keyword found in stderr!');
																						                                                                                                                                                dockerspawn.kill('SIGTERM');
																						                                                                                                                                        }
									                                                                                        });

	                                                        dockerspawn.on('close', function (code) {
									                                                                                                console.log('child process exited with code ' + code);
									                                                                                                return(code)
									                                                                                        });
}

app.post('/lipds', function(req, res) {
	
	if (newStatus(req.body.TSIDs, req.body.uniqueID, req.body.language)){
		path1 = path.join(__dirname, '../userRecons', req.body.uniqueID, 'TSIDs.json')
		var fullJSON = `{"TSIDs":` + JSON.stringify(req.body.TSIDs) + `}`
		fs.writeFile(path1, fullJSON, (err) => {
			  if (err)
				    console.log(err);
			  else {
				      console.log("File written successfully at: " + path1);
				    }
		});
		rspawn1(req.body.TSIDs, req.body.uniqueID, req.body.language).then(reso => {
			var path2 = path.join(path1, "processCode.txt")
			fs.writeFile(path2, reso.toString(), (err) => {
				  if (err)
					    console.log(err);
				  else {
					      console.log("File written successfully\n");
					      console.log("The written has the following contents:");
					      console.log(fs.readFileSync(path2, "utf8"));
					    }
			});
			fs.writeFile('TSIDs.txt', JSON.stringify(req.body.TSIDs), (err) => {
				  if (err)
					    console.log(err);
				  else {
					      console.log("File written successfully\n");
					      console.log("The written has the following contents:");
					      console.log(fs.readFileSync(path2, "utf8"));
					    }
			});
			if (reso == 0 && req.body.language == "Python"){
				pickleEm(path1)
			}
		});
	}

});

app.listen(PORT, function () {
		    console.log(`Express server listening on port ${PORT}`)
		  })
