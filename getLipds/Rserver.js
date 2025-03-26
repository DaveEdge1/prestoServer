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

async function newStatus(TSIDs, uniqueID, dir1) {
    if (typeof TSIDs == 'undefined' || typeof uniqueID == 'undefined') {
        console.log('Missing TSID or uniqueID');
        return 400;
    }
    const path1 = path.join(__dirname, '../userRecons', dir1);
    try {
        await fs.mkdir(path1, { recursive: true });
	console.log('Directory created successfully at: ' + path1);
	return 200;

    } catch (err) {
        console.log('function "mkdir" failed: ' + path1);
        return 400;
    }
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
	var dir1 = '/root/presto/userRecons/' + req.body.uniqueID + '_' + req.body.recon
        fs.mkdirSync(dir1, { recursive: true });
	newStatus(req.body.TSIDs, req.body.uniqueID, dir1).then(status => {
	    console.log('Final status:', status);
	    res.sendStatus(status)
		
		if (status == 200){
			var path0 = path.join(dir1, 'TSIDs.json')
			var fullJSON = `{"TSIDs":` + JSON.stringify(req.body.TSIDs) + `}`
			fs.writeFile(path0, fullJSON, (err) => {
				  if (err)
					    console.log(err);
				  else {
					      console.log("File written successfully at: " + path0);
					    }
			});
	
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
});

app.listen(PORT, function () {
		    console.log(`Express server listening on port ${PORT}`)
		  })
