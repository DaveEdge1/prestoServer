process.argv.forEach(function (val, index, array) {
  console.log(index + ': ' + val);
});

var fs = require('fs');
const path = require("path")

var child_process = require('child_process');
var file_path = "getLipd.R";
var r_comm = '/usr/bin/Rscript';
//var args = '--vanilla ' + file_path + ' ' + process.argv[2] + ' ' + process.argv[3];

var newStatus = function(uniqueID, language){
	if (typeof uniqueID == 'undefined' || typeof language == 'undefined'){
		return(false)
	} else {
		return(true)
	}
}


var rspawn1 = function (TSIDs, uniqueID, language){
	var path1 = path.join(__dirname, '../userRecons', uniqueID)
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

			/*
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
			*/
			rspawn.on('close', function (code) {
		  		console.log('child process exited with code ' + code);
		  		resolve(code)
			});
	});
	
};

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
};

TSIDs = function(path1){
	try {
	  return fs.readFileSync(path1, { encoding: 'utf8', flag: 'r' });
	} catch (error) {
	  console.log('no TSIDs file for given uniqueID: ' + uniqueID)
			process.exit(1);
	  // Expected output: ReferenceError: nonExistentFunction is not defined
	  // (Note: the exact output may be browser-dependent)
	}
	/*
	fs.statSync(path1, function(err, stat) {
		if (err == null) {
			console.log('path1: ' + path1);
			const TSIDs2 = fs.readFileSync(path1, { encoding: 'utf8', flag: 'r' });
			console.log('TSIDs read from file: ' + TSIDs2);
			return TSIDs2
		} else {
			console.log('no TSIDs file for given uniqueID: ' + uniqueID)
			process.exit(1);
		}
	});
 */
};

var downloadEm = function(uniqueID, language){

	if (process.argv.length == 4){
	
		if (newStatus(uniqueID, language)){
			var path1 = path.join(__dirname, '../userRecons', uniqueID, 'TSIDs.json')

			var fullJSON = JSON.parse(TSIDs(path1))
			rspawn1(fullJSON.TSIDs, uniqueID, language).then(reso => {
   					if (reso == 0 && language == "Python"){
						pickleEm(path1)
					}
			});
     				/*
				if (reso == 1){
					process.exit(1);
				} else {
					
					var path2 = path.join(__dirname, '../userRecons', uniqueID, "processCode.txt")
					fs.writeFile(path2, reso.toString(), (err) => {
						  if (err)
							    console.log(err);
						  else {
							      console.log("File written successfully\n");
							      console.log("The written has the following contents:");
							      console.log(fs.readFileSync(path2, "utf8"));
							    }
					});
					fs.writeFile('TSIDs.txt', JSON.stringify(TSIDs), (err) => {
						  if (err)
							    console.log(err);
						  else {
							      console.log("File written successfully\n");
							      console.log("The written has the following contents:");
							      console.log(fs.readFileSync(path2, "utf8"));
							    }
					});
					if (reso == 0 && language == "Python"){
						pickleEm(path1)
					}
				//}
			//});*/
		}
	} else {
		console.log("Error: num args to downloadLipds.js: " + process.argv.length)
		process.exit(1);
	}

};

downloadEm(process.argv[2], process.argv[3])

