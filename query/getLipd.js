if (process.argv.length === 2) {
	  console.error('Expected at least one argument!');
	  process.exit(1);
} else {
	console.log(process.argv[2])
	var uniqueID = process.argv[2]
}


const fs = require('fs');
const path = require('path')
var exec = require("child_process").exec;
var shelljs = require("shelljs");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

queryParams = async function (uniqueID){
  console.log('Downloading files from LiPDverse')
  query1 = exec('docker run --rm --name query' + uniqueID + ' -v /root/presto/userRecons/uniqueID/output:/output -v /root/presto/userRecons/uniqueID//queryParams.json:/queryParams.json davidedge/lipd_webapps:queryContainer');
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

findLipds = function (path1) {
	f_type = JSON.parse(fs.readFileSync('/root/presto/userRecons/uniqueID/queryParams.json', 'utf8'))['file.type']
	if (f_type != 'Python'){
		return 0
	} else {	
		dirCont = fs.readdirSync(path1)
		if (dirCont == undefined){
			return 0
		} else if (dirCont.length == 0){
			return 0
		} else if (dirCont.filter(f => path.extname(f).toLowerCase() === '.lpd').length == 0){
			return 0
		} else {
			pickle1 = exec('docker run --rm --name pickle' + uniqueID + ' -v ' + path1 + ':/output -v /root/presto/userRecons/uniqueID/lipd.pkl:/lipd.pkl davidedge/lipd_webapps:lipdPickler')
			pickle1.stdout.pipe(fs.createWriteStream('pickleContainer_stdout.log'));
			return 1
		}
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
  //var uniqueID = Math.floor(Math.random() * 10000);
  console.log('uniqueID: ' + uniqueID)
  await queryParams(uniqueID);
  await dockerStatus(uniqueID);
  //console.log(fs.readdirSync('/root/presto/query/output').length)
  return(findLipds('/root/presto/userRecons/uniqueID/output'))
}

runIt()
