process.argv.forEach(function (val, index, array) {
  console.log(index + ': ' + val);
});

var fs = require('fs');
const path = require("path")
const archiver = require("archiver")
const shelljs = require("shelljs")

var child_process = require('child_process');
var file_path = "/root/presto/getLipds/getLipd.R";
var file_path2 = "/root/presto/getLipds/getLipd.R";
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
	var path99 = path.join(__dirname, '../userRecons', uniqueID)
	var path9 = path.join(__dirname, '/checkTSIDmd5.R')
	var path9999 = path.join(__dirname, '../userRecons', uniqueID, 'TSIDs.json')
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

async function newStatus(uniqueID, language){
	console.log("starting status check")
	if (typeof uniqueID == 'undefined' || typeof language == 'undefined'){
		return(3)
	}
	await checkmd5(uniqueID)
	console.log("md5 checked")
	var path999 = path.join(__dirname, '../userRecons', uniqueID, '/pointer.txt')
	const exists1 = await checkFileExistsSync(path999)
	if (exists1){
		console.log("matching TSIDs file exists")
		return(2)
	} else {
		return(1)
	}

}

var rspawn1 = function (TSIDs, uniqueID, language){
	var path1 = path.join(__dirname, '../userRecons', uniqueID)

	var path3 = path.join(path1, "lipd.pkl")
	fs.writeFile(path3, " ", (err) => {
		  if (err)
				console.log(err);
		  else {
				console.log("Blank lipd.pkl written successfully\n");
		       }
	});
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

function addExt(allButExt, language) {
	if (language == 'R'){
		return allButExt + '.RData';
	} else if (language == 'Python'){
		return allButExt + '.pkl';
	}
}



async function downloadCompilation(uniqueID, URL, language) {

	const userDir = "/root/presto/userRecons/" + uniqueID
	const path2archiveJSON = userDir + "/archivedComp.json"
	var archivedComp = '';
	var archivedVers = '';
	const compilationDetails = grabCompilationInfo(path2archiveJSON);
	const allButExt = 'https://lipdverse.org/' + compilationDetails.compilation + '/' + compilationDetails.version + '/' + compilationDetails.compilation + compilationDetails.version
	const dataURL = addExt(allButExt, language)
	const destPath = addExt(userDir+'/lipd', language)
	
		return new Promise((resolve, reject) => {
			console.log('downloading compilation...');
			var bashCommand = 'curl ' + dataURL + ' -o ' + destPath
			console.log('bash command: ' + bashCommand);
			shelljs.exec('curl ' + dataURL + ' -o ' + destPath, {async: true}, function(code, stdout, stderr) {
			  if (code !== 0) {
			    console.log('curl failed with code:', code);
			    console.log('stderr:', stderr);
			    // Handle error if needed
			    return;
			  }
			  console.log('curl succeeded:', stdout);
			
			  fs.appendFile('/root/presto/userRecons/' + uniqueID + '/request-status.txt', "downloaded archived compilation\n", function(err) {
			    if (err) {
			      return console.log('Failed to append to status file:', err);
			    }
			    console.log('archived compilation download completed!');
			    resolve();
			  });
			});
		});

}

var downloadEm = async function(uniqueID, language){
	const userDir1 = path.join(__dirname, '../userRecons', uniqueID)
	const path1111 = path.join(userDir1, 'archivedComp.json')
	const exists1111 = await checkFileExistsSync(path1111)

	if (process.argv.length == 4){

		if (exists1111){
			console.log('found request for archived compilation: ' + path1111)
			await downloadCompilation(uniqueID, URL, language);
			const path2222 = addExt(userDir1+'/lipd', language)
			const exists2222 = await checkFileExistsSync(path2222)
			if (language == 'R'){
				if (exists2222){
					console.log("writing lipd tts file")
					await writeTTS("/root/presto/userRecons/" + uniqueID);
					console.log("downloadLipds.js successful, downloaded archived compilation")
					process.exit(0);
				} else {
					console.log("no file at expected path: " + path2222)
					process.exit(1);
				}
			}
			
		}

		
		var runStatus = await newStatus(uniqueID, language)
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
			console.log("no matching TSIDs set, building new collection")
			var path1 = path.join(__dirname, '../userRecons', uniqueID, 'TSIDs.json')

			var fullJSON = JSON.parse(TSIDs(path1, uniqueID))
			rspawn1(fullJSON.TSIDs, uniqueID, language).then(reso => {
					console.log("rspawn1 reso: " + reso)
					console.log("rspawn1 language: " + language)
   					//if (reso == 0 && language == "Python"){
					var pathToPkl = path.join(__dirname, '../userRecons', uniqueID)
					console.log("attempting pickle")
					pickleEm(pathToPkl).then(reso => {
						removeEm(pathToPkl).then(reso => {
							console.log("downloadLipds.js successful, new lipd set created")
							process.exit(0);
						});
					})
			});

		} else {
			console.log("Error: num args to downloadLipds.js: " + process.argv.length)
			console.log("runStatus: " + runStatus)
			process.exit(1);
		}
	}

};

downloadEm(process.argv[2], process.argv[3])

