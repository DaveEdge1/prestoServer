const fs = require('fs');
const path = require('path')
var exec = require("child_process").exec;

print('Downloading files from LiPDverse')

query1 = exec('docker run --rm -v ${PWD}/output:/output -v ${PWD}/queryParams.json:/queryParams.json davidedge/lipd_webapps:queryContainer');

query1.stdout.pipe(fs.createWriteStream('queryContainer_stdout.log'));

findLipds = function(dir1){
  var lipdCount = fs.readdir(dir1, (err, files) => {
    files.filter(f => path.extname(f).toLowerCase() === '.lpd').length
    //console.log(result)
});
  return lipdCount;
}


print(findLipds(${PWD}/output))
