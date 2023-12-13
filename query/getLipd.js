const fs = require('fs');
const path = require('path')
var exec = require("child_process").exec;
var shelljs = require("shelljs");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

queryParams = async function (uniqueID){
  console.log('Downloading files from LiPDverse')
  query1 = exec('docker run --rm --name ' + uniqueID + ' -v ${PWD}/output:/output -v ${PWD}/queryParams.json:/queryParams.json davidedge/lipd_webapps:queryContainer');
  query1.stdout.pipe(fs.createWriteStream('queryContainer_stdout.log'));
  await sleep(5000)
  return 1
}

dockerStatus = async function (uniqueID) {
  docker_status = shelljs.exec('docker ps -a').stdout
	  if (docker_status.search(uniqueID) == -1){
		  console.log('no container launched!')
	  }
          if (docker_status.search(uniqueID) != -1){
                console.log('awaiting removal')
                //console.log('docker_status.search("test2") !== -1: ' + docker_status.search("test2") !== -1)
                while (docker_status.search(uniqueID) != -1){
			await sleep(5000)
                        docker_status = shelljs.exec('docker ps -a').stdout
                }
                console.log('container removed')
                return 'done'
        }
}

function findLipds(path1) {
	dirCont = fs.readdirSync(path1)
	if (dirCont == undefined){
		return 0
	} else if (dirCont.length == 0){
		return 0
	} else if (dirCont.filter(f => path.extname(f).toLowerCase() === '.lpd').length == 0){
		return 0
	} else {
		return 1
	}
}
		


/*
findLipds = function(path) {
  fs.readdirSync(path, function(err, content) {
    if (err) {
      console.log('error')
      return err;
    } else {
      console.log(path)
      console.log(content)
      return content;
    }
  });
}

findLipds = function(dir1){
    var lipdFiles = fs.readdir(dir1);
    //console.log('path: ' + dir1)
    //console.log('files: ' + files)
    var lipdCount = files.filter(f => path.extname(f).toLowerCase() === '.lpd').length;
    return lipdCount;
}
*/
runIt = async function (){
  var uniqueID = Math.floor(Math.random() * 10000);
  console.log('uniqueID: ' + uniqueID)
  await queryParams(uniqueID);
  await dockerStatus(uniqueID);
  console.log(fs.readdirSync('/root/presto/query/output').length)
  console.log(findLipds('/root/presto/query/output'))
}

runIt()
