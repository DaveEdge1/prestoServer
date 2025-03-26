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
var file_path = "getLipd.R";
var r_comm = '/usr/bin/Rscript';
let path1 = '';
//var args = '--vanilla ' + file_path + ' ' + process.argv[2] + ' ' + process.argv[3];

function newStatus(TSIDs, uniqueID, callback) {
    if (typeof TSIDs == 'undefined' || typeof uniqueID == 'undefined') {
        console.log('Missing TSID or uniqueID');
        return callback(400);
    }

    const path1 = path.join(__dirname, '../userRecons', uniqueID);
    fs.mkdir(path1, (err) => {
        if (err) {
            console.log('function "mkdir" failed: ' + path1);
            return callback(400);
        } else {
            console.log('Directory created successfully at: ' + path1);
            return callback(200);
        }
    });
}


var rspawn1 = function (TSIDs, uniqueID, language){
	path1 = path.join(__dirname, '../userRecons', uniqueID)
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

newDir = function(dirname) {
	        fs.mkdirSync(dirname, { recursive: true }, (err) => {
			                  if (err) throw err;
			        });
	        return (dirname)
}

app.post('/lipds', function(req, res) {
	console.log('status: ' + newStatus(req.body.TSIDs, req.body.uniqueID))
	res.sendStatus(newStatus(req.body.TSIDs, req.body.uniqueID));
	var dir1 = newDir(path.join(__dirname, '../userRecons', req.body.uniqueID+'_'+req.body.recon))
	
	if (newStatus(req.body.TSIDs, req.body.uniqueID) == 200){
		var path0 = path.join(dir1, 'TSIDs.json')
		var fullJSON = `{"TSIDs":` + JSON.stringify(req.body.TSIDs) + `}`
		fs.writeFile(path0, fullJSON, (err) => {
			  if (err)
				    console.log(err);
			  else {
				      console.log("File written successfully at: " + path0);
				    }
		});
		/*rspawn1(req.body.TSIDs, req.body.uniqueID, req.body.language).then(reso => {
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
		});*/
	} else {
		var path0 = path.join(dir1, 'TSIDs_err.txt')
		fs.writeFile(path0, "Rserver error! TSIDs not written.", (err) => {
			  if (err)
				    console.log(err);
			  else {
				      console.log("File written successfully at: " + path0);
				    }
		});
	}
});

app.listen(PORT, function () {
		    console.log(`Express server listening on port ${PORT}`)
		  })
