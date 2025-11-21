process.argv.forEach(function (val, index, array) {
  console.log(index + ': ' + val);
});

var fs = require('fs');
const path = require("path")
const archiver = require("archiver")
const shelljs = require("shelljs")

var child_process = require('child_process');
var file_path = "/root/presto/getLipds/getLipdSmart.R";
var file_path2 = "/root/presto/getLipds/getLipdSmart.R";
var r_comm = '/usr/bin/Rscript';

async function routeExistingLipds(uniqueID){
	var root0 = '/root/presto/userRecons/'
	var root1 = path.join(root0, uniqueID)
	var path99 = path.join(root1, '/pointer.txt')
	if (checkFileExistsSync(path99)){
		console.log(path99 + ' exists')
		var s1 = fs.readFileSync(path99,'utf8');
		s1 = s1.replace(/(\r\n|\n|\r)/gm, "");
		var origpkl = root0 + s1 + '/lipd.pkl'
		var origtts = root0 + s1 + '/lipd_tts.rds'
		if (checkFileExistsSync(origpkl) && checkFileExistsSync(origtts)){
			console.log(origpkl + ' and ' + origpkl + ' exist')
			console.log('linking files')
			var bashText2 = 'ln -s ' + origpkl + ' ' + root1
			var bashText3 = 'ln -s ' + origtts + ' ' + root1
			shelljs.exec(bashText2).stdout
			shelljs.exec(bashText3).stdout
			return true
		} else {
			console.log('failed to link previously created data files!')
			console.log('creating new files from lipdverse')
			return false
		}
	} else {
		return false
	}
}

function checkFileExistsSync(filepath){
  console.log("checking for file: " + filepath)
  let flag = true;
  try{
    flag = fs.existsSync(filepath);
  }catch(e){
    console.log(e.message)
    console.log('file not found!')
    flag = false;
  }
	return flag;
}

var writeTTS = async function (RData_path){
	var path899 = path.join(__dirname, '/writeTTS.R')
	var args2 = '--vanilla ' + path899 + ' ' + RData_path;
	return new Promise((resolve, reject) => {
		console.log("coverting Rdata to tts")
		console.log("rspawn2 args: " + args2)
		var rspawn2 = child_process.spawn(r_comm,[args2]);
		
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

var updateTSIDmd5 = async function (){
	var path89 = path.join(__dirname, '/updateTSIDmd5.R')
	var args2 = '--vanilla ' + path89;
	return new Promise((resolve, reject) => {
		console.log("starting TSID md5 update")
		console.log("rspawn2 args: " + args2)
		var rspawn2 = child_process.spawn(r_comm,[args2]);
		
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

var checkmd5 = async function (uniqueID){
	var path99 = path.join('/root/presto/userRecons', uniqueID)
	var path9 = path.join(__dirname, '/checkTSIDmd5.R')
	var path9999 = path.join('/root/presto/userRecons', uniqueID, 'TSIDs.json')
	const exists1 = await checkFileExistsSync(path9999)
	if (!exists1){
		console.log("no TSIDs.json file in directory: " + uniqueID)
		process.exit(1);
	}
	var args2 = '--vanilla ' + path9 + ' ' + path99;
	return new Promise((resolve, reject) => {
		console.log("starting TSID md5 check")
		console.log("rspawn2 args: " + args2)
		var rspawn2 = child_process.spawn(r_comm,[args2]);
		
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

async function newStatus(uniqueID){
	console.log("starting status check")
	if (typeof uniqueID == 'undefined'){
		return(3)
	}
	await checkmd5(uniqueID)
	console.log("md5 checked")
	var path999 = path.join('/root/presto/userRecons', uniqueID, '/pointer.txt')
	const exists1 = await checkFileExistsSync(path999)
	if (exists1){
		console.log("matching TSIDs file exists")
		return(2)
	} else {
		return(1)
	}

}

var rspawn1 = function (TSIDs, uniqueID){
	var path1 = path.join('/root/presto/userRecons', uniqueID)

	var path3 = path.join(path1, "lipd.pkl")
	fs.writeFile(path3, " ", (err) => {
		  if (err)
				console.log(err);
		  else {
				console.log("Blank lipd.pkl written successfully\n");
		       }
	});
	var args = '--vanilla ' + file_path + ' ' + TSIDs + ' ' + path1;
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
	console.log("launching lipd pickler (creates both cfr and legacy formats)")

	// Always use makeCfrPickle.py which creates both lipd.pkl (cfr) and lipd_legacy.pkl
	var dockerComm = "docker run --rm -v " + path1 + ":/output davidedge/lipd_webapps:lipdPickler";

	console.log("Docker command: " + dockerComm);
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

	return new Promise((resolve, reject) => {
		rmspawn.on('close', function (code) {
			console.log('rm lpd process exited with code ' + code);
			return(code)
		});
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
	}
};

function grabCompilationInfo(path){
	try {
	      const data = fs.readFileSync(path, 'utf8');
	      return JSON.parse(data);
	      // Work with jsonData
	    } catch (err) {
	      console.error("An error occurred while reading " + path + " :", err);
		return null;
	    }
}

// Download both R and Python formats for archived compilations
async function downloadCompilation(uniqueID) {
	const userDir = "/root/presto/userRecons/" + uniqueID
	const path2archiveJSON = userDir + "/archivedComp.json"
	const compilationDetails = grabCompilationInfo(path2archiveJSON);
	const baseURL = 'https://lipdverse.org/' + compilationDetails.compilation + '/' + compilationDetails.version + '/' + compilationDetails.compilation + compilationDetails.version

	// Download both .RData and .pkl files
	const downloads = [
		{ url: baseURL + '.RData', dest: userDir + '/lipd.RData', name: 'R format' },
		{ url: baseURL + '.pkl', dest: userDir + '/lipd.pkl', name: 'Python format' }
	];

	console.log('Downloading archived compilation in both R and Python formats...');

	for (const dl of downloads) {
		await new Promise((resolve, reject) => {
			const bashCommand = 'curl ' + dl.url + ' -o ' + dl.dest;
			console.log('Downloading ' + dl.name + ': ' + bashCommand);
			shelljs.exec(bashCommand, {async: true}, function(code, stdout, stderr) {
				if (code !== 0) {
					console.log('WARNING: Download failed for ' + dl.name + ' with code:', code);
					console.log('stderr:', stderr);
				} else {
					console.log(dl.name + ' download succeeded');
				}
				resolve(); // Continue even if one format fails
			});
		});
	}

	fs.appendFile(userDir + '/request-status.txt', "downloaded archived compilation (both formats)\n", function(err) {
		if (err) {
			console.log('Failed to append to status file:', err);
		}
	});
	console.log('Archived compilation downloads completed!');
}

var downloadEm = async function(uniqueID){
	const userDir1 = path.join('/root/presto/userRecons', uniqueID)
	const path1111 = path.join(userDir1, 'archivedComp.json')
	const exists1111 = await checkFileExistsSync(path1111)

	// Handle archived compilation requests
	if (exists1111){
		console.log('Found request for archived compilation: ' + path1111)
		await downloadCompilation(uniqueID);

		// Check if at least one format downloaded successfully
		const pathRData = path.join(userDir1, 'lipd.RData')
		const pathPkl = path.join(userDir1, 'lipd.pkl')
		const existsRData = await checkFileExistsSync(pathRData)
		const existsPkl = await checkFileExistsSync(pathPkl)

		if (existsRData || existsPkl){
			if (existsRData) {
				console.log("Writing lipd_tts file from R data...")
				await writeTTS(userDir1);
			}
			console.log("downloadLipds.js successful, downloaded archived compilation (both formats)")
			process.exit(0);
		} else {
			console.log("ERROR: No files downloaded successfully")
			process.exit(1);
		}
	}

	// Handle TSID-based requests
	var runStatus = await newStatus(uniqueID)
	updateTSIDmd5()

	if (runStatus == 2){
		if (await routeExistingLipds(uniqueID)){
			console.log("downloadLipds.js successful, found existing TSID set")
			process.exit(0);
		} else {
			runStatus = 1;
		}
	}

	if (runStatus == 1){
		console.log("No matching TSIDs set, building new collection")
		var path1 = path.join('/root/presto/userRecons', uniqueID, 'TSIDs.json')

		var fullJSON = JSON.parse(TSIDs(path1, uniqueID))
		rspawn1(fullJSON.TSIDs, uniqueID).then(reso => {
			console.log("R script exit code: " + reso)
			if (reso !== 0) {
				console.log("ERROR: R script failed")
				process.exit(1);
			}

			// Always create both pickle formats
			var pathToPkl = path.join('/root/presto/userRecons', uniqueID)
			console.log("Creating pickle files (both CFR and legacy formats)...")
			pickleEm(pathToPkl).then(reso => {
				console.log("pickleEm exit code: " + reso)
				if (reso == 0) {
					// Only remove .lpd files if pickle creation succeeded
					removeEm(pathToPkl).then(reso => {
						console.log("downloadLipds.js successful! Generated all output formats:")
						console.log("  - R files: lipd.rds, lipd_tts.rds")
						console.log("  - Python files: lipd.pkl (CFR), lipd_legacy.pkl")
						console.log("  - Archive: lipd_files.zip")
						console.log("  - Metadata: datasetIds.json")
						process.exit(0);
					});
				} else {
					console.log("ERROR: pickleEm failed with code " + reso)
					console.log("Preserving .lpd files for debugging")
					console.log("lipd_files.zip should still be available")
					process.exit(1);
				}
			}).catch(err => {
				console.log("ERROR: pickleEm failed with error: " + err)
				console.log("Preserving .lpd files for debugging")
				process.exit(1);
			})
		});
	} else {
		console.log("Error: Unexpected runStatus: " + runStatus)
		process.exit(1);
	}
};

// Only require uniqueID now (no language parameter)
downloadEm(process.argv[2])

