process.argv.forEach(function (val, index, array) {
  console.log(index + ': ' + val);
});

var fs = require('fs');
const path = require("path")
const archiver = require("archiver")

var child_process = require('child_process');
var file_path = "/root/presto/getLipds/getLipd.R";
var r_comm = '/usr/bin/Rscript';

function checkFileExistsSync(filepath){
  let flag = true;
  try{
    fs.accessSync(filepath, fs.constants.F_OK);
  }catch(e){
    flag = false;
  }
  return flag;
}

var checkmd5 = function (uniqueID){
	var path99 = path.join(__dirname, '../userRecons', uniqueID)
	var path9 = path.join(__dirname, '/checkTSIDmd5.R')
	var args2 = '--vanilla ' + path9 + ' ' + path99;
	return new Promise((resolve, reject) => {
		console.log("starting TSID md5 check")
		var rspawn2 = child_process.spawn(r_comm,[args]);
		
		rspawn2.stdout.on('data', function (data) {
			console.log(data.toString());
		});

		rspawn2.stderr.on('data', function (data) {
			console.log('rspawn2 stderr: ' + data);
			console.log(data.toString().search("error"));
			console.log(rspawn2.connected);
			if ((data.toString().search("error") != -1) ) {
				console.log('rspawn2 process has been killed - "error" keyword found in stderr!');
				rspawn2.kill('SIGTERM');
			}
		});
		
		rspawn2.on('close', function (code) {
			console.log('rspawn2 exited with code ' + code);
			resolve(code)
		});
	});
}

var newStatus = function(uniqueID, language){
	console.log("starting status check")
	if (typeof uniqueID == 'undefined' || typeof language == 'undefined'){
		return(3)
	}
	checkmd5(uniqueID).then(reso => {
		console.log("md5 checked")
		var path999 = path.join(__dirname, '/checkTSIDmd5.R')
		if (checkFileExistsSync(path999)){
			console.log("matching TSIDs file exists")
			return(2)
		} else {
			return(1)
		}
	});
}

var rspawn1 = function (TSIDs, uniqueID, language){
	var path1 = path.join(__dirname, '../userRecons', uniqueID)
	/*
	fs.mkdir(path1,
		(err) => {
		if (err) {
			return console.error(err);
		}
		console.log('Directory created successfully at: ' + path1);
	});*/
	//if (language == "Python"){
	var path3 = path.join(path1, "lipd.pkl")
	fs.writeFile(path3, " ", (err) => {
		  if (err)
				console.log(err);
		  else {
				console.log("Blank lipd.pkl written successfully\n");
		       }
	});
	//}
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
				console.log("code: " + code)
				resolve(code)
			});
	});
	
};

pickleEm = function(path1){
	console.log("launching lipd pickler")
	var dockerComm = "docker run --rm -v " + path1 +":/output -v " + path1 + "/lipd.pkl:/lipd.pkl davidedge/lipd_webapps:lipdPickler"
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
	return new Promise((resolve, reject) => {
		dockerspawn.on('close', function (code) {
			console.log('lipd pickler process exited with code ' + code);
			resolve(code)
		});
	});
};

removeEm = function(path1){
	console.log("removing .lpd files")
	var rmComm = "rm " + path1 + "/*.lpd"
	console.log("rm command: " + rmComm)
	var rmspawn = child_process.exec(rmComm);
	rmspawn.stdout.on('data', function (data) {
		console.log(data.toString());
	});

	rmspawn.stderr.on('data', function (data) {
		console.log('stderr: ' + data);
		console.log(data.toString().search("error"));
		console.log(rmspawn.connected);
		if ((data.toString().search("error") != -1) ) {
			console.log('process has been killed - "error" keyword found in stderr!');
			rmspawn.kill('SIGTERM');
		}
	});

	rmspawn.on('close', function (code) {
		console.log('rm lpd process exited with code ' + code);
		return(code)
	});
};

zipIt = function (source_dir) {
	var moveEm = 'mv ' + source_dir + '/*.ext ' + path.join(source_dir, lipds)
	console.log("moveEm text: " + moveEm)

	var movespawn = function(moveEm){
		child_process.exec(moveEm);
		movespawn.stdout.on('data', function (data) {
			console.log(data.toString());
		});
	
		movespawn.stderr.on('data', function (data) {
			console.log('stderr: ' + data);
			console.log(data.toString().search("error"));
			console.log(movespawn.connected);
			if ((data.toString().search("error") != -1) ) {
				console.log('moveEm process has been killed - "error" keyword found in stderr!');
				movespawn.kill('SIGTERM');
			}
		});
		return new Promise((resolve, reject) => {
			movespawn.on('close', function (code) {
				console.log('moveEm process exited with code ' + code);
				resolve(code)
			});
		});
	}
	movespawn.then(reso => {
	
		var downloadLoc = path.join(source_dir, source_dir + '.zip')
		var output = fs.createWriteStream(downloadLoc);
		var archive = archiver('zip');
		output.on('close', function () {
			console.log(archive.pointer() + ' total bytes');
			console.log('archiver has been finalized and the output file descriptor has closed.');
		})
		archive.on('error', function(err){
			throw err;
		});
		archive.pipe(output);
		archive.directory(source_dir, false);
		//archive.directory('subdir/', 'new-subdir');
		return(archive.finalize());
	});
}

TSIDs = function(path1, uniqueID){
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
		var runStatus = newStatus(uniqueID, language)
	
		if (runStatus == 1){
			var path1 = path.join(__dirname, '../userRecons', uniqueID, 'TSIDs.json')

			var fullJSON = JSON.parse(TSIDs(path1, uniqueID))
			rspawn1(fullJSON.TSIDs, uniqueID, language).then(reso => {
					console.log("rspawn1 reso: " + reso)
					console.log("rspawn1 language: " + language)
   					//if (reso == 0 && language == "Python"){
					var pathToPkl = path.join(__dirname, '../userRecons', uniqueID)
					console.log("attempting pickle")
					pickleEm(pathToPkl).then(reso => {
						removeEm(pathToPkl)
					})
					//} else {
						//console.log("no pickling")
					//}
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
			console.log("downloadLipds.js successful")
			process.exit(0);
		} else if (runStatus == 2){
			console.log("downloadLipds.js successful, found existing TSID set")
			process.exit(0);
		} else {
			console.log("Error: num args to downloadLipds.js: " + process.argv.length)
			console.log("runStatus: " + runStatus)
			process.exit(1);
		}
	}

};

downloadEm(process.argv[2], process.argv[3])

