var fs = require('fs')
var YAML = require('yaml')
var bodyParser = require('body-parser')
const prompt = require('prompt-sync')();
require('./index.js');

reconTitle = function(recon){
	var reconTitles = fs.readFileSync("/root/presto/jsonEditor/reconTitles.json")
	var titlesJSON = JSON.parse(reconTitles)
	console.log(titlesJSON[recon])
	console.log(titlesJSON, recon)
	return(titlesJSON[recon])
}

const recon = prompt('Which recon are we writing a form for?');
console.log(`Okay, writing new form for ${recon}`);

fs.writeFile("/root/presto/query/" + recon  + ".html", htmlString, function(err) {
	    if(err) {
		            return console.log(err);
		        }
	    console.log("The " + recon + ".html file was saved!");
}); 


//fs.writeFile("/root/presto/jsonEditor/public/slider" + recon + ".js", jsExt + jsExt2 + jsExt3 + jsExt4, function(err) {
//	            if(err) {
//			                                return console.log(err);
//			                            }
//	            console.log("The slider" + recon + ".js file was saved!");
//});
