express = require("express");
PORT = process.env.PORT || 3000
const fs = require('fs');
var exec = require("child_process").exec;
//const streams = require('memory-streams')
const path = require('path')
var app = express()

var reconParams = function(recon) {
	const reconParamsNow = fs.readFileSync('/root/presto/presto/reconLib.json','utf8');
	//console.log(JSON.parse(reconParamsNow))
	//console.log(JSON.stringify(JSON.parse(reconParamsNow)))
	const rparams = JSON.parse(reconParamsNow)[recon]
	return rparams
}

async function startPresto(launchText, dirname) {
	console.log('starting presto...');
	console.log(launchText)
	var { stdout, stderr } = exec(launchText);
	stdout.pipe(fs.createWriteStream(dirname+'prestoGo_stdout.txt'));
	stderr.pipe(fs.createWriteStream(dirname+'prestoGo_stderr.txt'));
	console.log('dir: ' + dirname)
}
  
prestoStartHtml = function (uniqueID, user, domain, recon, language) {
	var dirname = '/root/presto/userRecons/' + uniqueID + '/';
	var execComm = 'node /root/presto/presto/prestoGo.js ' + uniqueID + ' ' + user + ' ' + domain + ' ' + recon + ' ' + language
	startPresto(execComm, dirname)
	return('Starting your custom PReSto ' + reconParams(recon).title + ', ID: '+ uniqueID +'<br /><br />' 
		 + "WARNING: Using your browser's 'back' button will overwrite your previous submission<br /><br />"  
		 + '<a href=' + reconParams(recon).github + 'target="_blank">visit the ' + reconParams(recon).title + ' webpage</a><br /><br />' 
		 + 'The results will be sent to: ' + user + '@' + domain 
		 + '<br /><br />If results do not arrive within 1-2 hours, check your Spam folder <br /><br />You will automatically be redirected to the Presto home page after 10 seconds'
	         + '<br /><br />Let us know how we are doing at the <strong><a href="https://forms.gle/1wPXaCY75WwMyHXJ8" target="_blank" rel="noopener noreferrer">feedback form</a></strong>.'
		 + '<script>history.pushState(null, null, window.location.href);history.back();window.onpopstate = () => history.forward();var timeout = 10000; setTimeout(function ()' 
		 + '{window.location = "https://paleopresto.com/"; }, timeout); </script>')
}

app.get("/:recon/:user/:domain/:uniqueID/:language", (req, res) => {
	console.log("uniqueID: " + req.params.uniqueID)
	console.log("reconID: " + req.params.uniqueID)
	res.send(prestoStartHtml(req.params.uniqueID, req.params.user, req.params.domain, req.params.recon, req.params.language))
})

app.listen(PORT, function () {
  console.log(`Express server listening on port ${PORT}`)
})
