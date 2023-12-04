//Docker = require('dockerode');
express = require("express");
PORT = process.env.PORT || 3000
const fs = require('fs');
//const util = require('util');
var exec = require("child_process").exec;
var archiver = require('archiver');
var YAML = require('yaml')
const streams = require('memory-streams')
const path = require('path')
var app = express()
//var docker = new Docker({protocol:'http', host: 'localhost', port: 2375});
//var d = new Date();
//var timeNow = d.getTime()
var nodemailer = require('nodemailer');
var align = require('align-yaml');

const reconParams = function() {
	const reconParamsNow = fs.readFileSync('/root/presto/presto/reconLib.json','utf8');
	return JSON.parse(reconParamsNow)
}

var rparams = reconParams()

var translateJSON = function (uniqueID, recon){
	var yaml = require('js-yaml')
	
	const lookup = function() {
		const s = fs.readFileSync('/root/presto/prestoForm/' + recon + '/lookup.json','utf8');
		return JSON.parse(s)
	}
	
	const configs = yaml.load(fs.readFileSync('/root/presto/userRecons/' + uniqueID  + '/configs.yml','utf8'));
	
	const configsOrig = JSON.parse(fs.readFileSync('/root/presto/prestoForm/' + recon + '/params.json','utf8'));

	function writeJSON () {
		var yamlText = ''
		var newConfigs = configs
		var lookups = lookup()
		for (var key1 in lookups) {
			var first = lookups[key1].first
			var last = lookups[key1].last
			var orig = lookups[key1].orig
			var pos = lookups[key1].position
			if (configs.hasOwnProperty(first)){
				 if (configs[first].hasOwnProperty(last)){
				     console.log('long name: ' + configs[first][last].long_name)
					  if (configs[first][last].hasOwnProperty('value')){
					      console.log('orig key: ' + orig)
					      var configs1 = configs[first][last]
					      console.log('orig val: ' + configsOrig[orig])
					      console.log('new value: ' + configs1.value)
					      console.log('......................................................')
					      if (typeof(pos) != 'undefined'){
						      console.log('position length: ' + pos.length)
						      configsOrig[orig].length = new Array()
						      var origPos = 0
						      for (ii in pos){
							      console.log("position increment: " + ii + ' origPos: ' + origPos + ' newVal: ' + configs1.value[ii])
							      configsOrig[orig][origPos] = configs1.value[ii]
							      origPos = origPos + 1
						      }
						      if (orig == 'latRange' || orig == 'lonRange' || orig == 'searchRange'){
							      var newVal1 = configsOrig[orig] + ''
							      configsOrig[orig] = newVal1.split(",").map(Number).filter(x => !isNaN(x))
						      } else if (orig == 'binstart' || orig == 'binend' || orig == 'maxResolution' || orig == 'duration') {
							      var newVal1 = configsOrig[orig] + ''
							      configsOrig[orig] = parseInt(newVal1)
						      }
					      } else {
						      configsOrig[orig] = configs1.value
					      }
					  }
				 }
			}
		}
	}

	writeJSON()
	
	fs.writeFileSync('/root/presto/userRecons/' + uniqueID  + '/configsTranslated.json', JSON.stringify(configsOrig), function(err) {
		if(err) {
		          return console.log(err)
		}
		console.log('/root/presto/userRecons/' + uniqueID  + '/configsTranslated.json has been edited');
	});

}

var translate = function (uniqueID, recon){
	var yaml = require('js-yaml')
	
	const lookup = function() {
		const s = fs.readFileSync('/root/presto/prestoForm/' + recon + '/lookup.json','utf8');
		return JSON.parse(s)
	}
	
	const configs = yaml.load(fs.readFileSync('/root/presto/userRecons/' + uniqueID  + '/configs.yml','utf8'));
	
	const configsOrig = yaml.load(fs.readFileSync('/root/presto/prestoForm/' + recon + '/config_default.yml','utf8'));
	
	function writeYaml () {
		        var yamlText = ''
		        var newConfigs = configs
		        var lookups = lookup()
		        for (var key1 in lookups) {
	                        var first = lookups[key1].first
	                        var last = lookups[key1].last
	                        var orig = lookups[key1].orig
	                        if (configs.hasOwnProperty(first)){
	                                 if (configs[first].hasOwnProperty(last)){
	                                     console.log('long name: ' + configs[first][last].long_name)
	                                          if (configs[first][last].hasOwnProperty('value')){
		                                      console.log('orig key: ' + orig)
	                                              var configs1 = configs[first][last]
	                                              console.log('orig val: ' + configsOrig[orig])
	                                              console.log('new value: ' + configs1.value)
	                                              console.log('......................................................')
	                                 		  if (configs1.value == undefined || configs1.value == 'null'){
					                          if (orig == 'localization_radius' || orig == 'model_processing'){
									  configsOrig[orig] = 'None'
	   		                                          } else if (orig == 'assign_seasonality' || orig == 'change_uncertainty'){
									  configsOrig[orig] = false
			                                          }
		 	                                  } else if (orig == 'obs_regrid_nlat' || orig == 'obs_regrid_nlon'){
								  console.log("caught regrid var")
								  var newVal1 = configs1.value + ''
								  configsOrig[orig] = parseInt(newVal1)
							  } else if (orig == 'obs_annualize_months' || orig == 'annualize_proxydb_months'){
								  var newVal1 = configs1.value + ''
								  console.log("caught annualize months var")
								  configsOrig[orig] = newVal1.split(",").map(Number).filter(x => !isNaN(x))
							  } else {
							      configsOrig[orig] = configs1.value
	  	                                          }
						     }else{
							console.log('no value')
						  }
					 }
				}
			}
		}
	writeYaml()
	
	fs.writeFileSync('/root/presto/userRecons/' + uniqueID  + '/configsTranslated.yml', yaml.dump(configsOrig), function(err) {
		if(err) {
		          return console.log(err)
		}
		console.log('/root/presto/userRecons/' + uniqueID  + '/configsTranslated.yml has been edited');
	});
}

let transporter = nodemailer.createTransport({
    host: 'smtp.zoho.com',
	    port: 465,
	    name: 'zoho.com',
	    auth: {
		    user: "no-reply@paleopresto.com",
		    pass: "5-KBS%*YsTneRs4"
	    }
});

updateParams = function (uniqueID, recon){
	if (recon == 'holocene_da' || recon == 'graph_em'){
		translate(uniqueID, recon)
		return('/root/presto/userRecons/' + uniqueID  + '/configsTranslated.yml')
	} else {
		translateJSON(uniqueID, recon)
		return('/root/presto/userRecons/' + uniqueID  + '/configsTranslated.json')
	}
	
}

countNetcdf = function (dirname) {
  var txtFiles;
  fs.readdir(dirname, function(err, files) {
  txtFiles = files.filter(el => path.extname(el) === '.nc')
  })
  return (txtFiles)
}

emailHTML = function (dockerSuccess, uniqueID, destURL, configLoc) {
   var configFileTxt = function (configFileLoc) {
	   var s = fs.readFileSync(configFileLoc,'utf8');
	   s = align(s, 5)
	   return s
   }
	if (dockerSuccess > 0) {
		var text1 = '<p>Thank you for using Presto! Unfortunately the combination of parameters selected caused an error in the reconstruction code. The output of the code up the the point of error is shown in the log file at the linked URL. This link will expire after 7 days.</p>'
	} else {
		var text1 = '<p>Thank you for using Presto! Use the link below to access the results of your custom reconstruction. This link will expire after 7 days.</p>'
	}
	text1 = text1
		+ '<br>'
		+ '<a href="' + destURL + '" download>Download Custom Reconstruction '+uniqueID+'</a>'
		+ '<br><br>'
		+ '<p style="font-size: 16px; font-weight: 700">Custom Parameters:</p>'
		+ '<pre>' + configFileTxt(configLoc) + '</pre>'
		+ '<br><br>'
		+ '<div><p style="font-size: 16px; font-weight: 700">Acknowledgement</p></div>'
		+ '<div>If you publish or present this work, please acknowledge all of the science and tools that make PReSto possible.<br></div>'
		+ '<div><br></div><div><b>Data</b></div>'
		+ '<div>Please cite the datasets you used in PReSto. This potentially includes both paleoclimate data and model simulations. <a href="https://lipdverse.org" target="_blank">lipdverse</a> provides bibliographies, bibtex files, and guidance on how to best cite data, including large data compilations. Reference information for model simulations is provided in the Reconstructions section of&nbsp;<a href="https://paleopresto.com/" target="_blank">paleopresto</a>.</div><div><br></div>'
		+ '<div><b>Reconstruction Algorithm</b></div>'
		+ '<div>Cite the paper(s) that present or describe the analytical approach. This information is provided in the Reconstructions section of&nbsp;<a href="https://paleopresto.com/" target="_blank">paleopresto</a>.</div><div><br></div>'
		+ '<div><b>PReSto</b></div>'
		+ '<div>PReSto is still in development, but if you use PReSto in a research project, please cite it as:&nbsp;</div><div><br></div>'
		+ '<div>Dave Edge, Michael Erb, Nicholas McKay, Feng Zhu, Deborah Khider, Julien Emile-Geay, &amp; Cody Routson. (2023). The Paleoclimate Reconstruction Storehouse (PReSto) platform (alpha-release). Zenodo. <a href="https://doi.org/10.5281/zenodo.8274756">https://doi.org/10.5281/zenodo.8274756</a><br></div>'
		+ '<br>'
		+ '<br>'
		+ '<br>'
		+ '<br>'
		+ '<a href="https://paleopresto.com/" target="_blank"><img src="https://paleopresto.com/img/logo.png" alt="Presto logo" height="50" width="141"></a>'
		+ '<br>'
		+ '<p>This account is not monitored for replies</p>'
		+ '<p>If the link above does not initiate a download, try manually copying the link address to your browser</p>'
		+ '<p>If you are having trouble with Presto please <a href = "mailto:david.edge@nau.edu?Subject=' + uniqueID  +'">email us directly</a>  with your unique reconstruction id: ' + uniqueID + '</p>'
	return(text1)
}

  sendEmail = function (dockerSuccess, user, domain, uniqueID, configLoc) {
    var destURL = 'http://143.198.98.66:83/downloads/' + uniqueID
    var mailOptions = {
      from: 'no-reply@paleopresto.com',
      to: user + '@' + domain,
      subject: 'Presto Custom Reconstruction ' + uniqueID,
      html: emailHTML(dockerSuccess, uniqueID, destURL, configLoc)
    };
      transporter.sendMail(mailOptions, function(error, info){
       if (error) {
	  console.log(error);
       } else {
	  console.log('Email sent: ' + info.response);
       }
     });
  }

        zipIt = function (uniqueID) {
		var downloadLoc = '/root/presto/userRecons/' + uniqueID + '/' + uniqueID + '.zip'
		var source_dir = '/root/presto/userRecons/' + uniqueID
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
		archive.finalize();
	}


runRecon = async function(uniqueID, user, domain, recon) {

	console.log('recon: ' + rparams[recon].title)

	console.log('resultsDir: ', rparams[recon].resultsDir)
	console.log('paramsLoc: ', rparams[recon].paramsCon)
	console.log('container: ', rparams[recon].conTag)
	
	var configLoc = updateParams(uniqueID, recon)
	//const stdout = new streams.WritableStream()
	//const stderr = new streams.WritableStream()
	var dirname = '/root/presto/userRecons/' + uniqueID + '/';
	//var dockerSuccess = countNetcdf(dirname)
	/*
	let options = {
		Tty: false,
		HostConfig: {
			AutoRemove: true,
			Binds: [
				dirname + ':' + rparams[recon].resultsDir,
				configLoc + ':' + rparams[recon].paramsCon
				]
			}
		}
        */
	var launchText = 'docker run --rm -v ' + dirname + ':' + rparams[recon].resultsDir + ' -v ' + configLoc + ':' + rparams[recon].paramsCon + ' ' + rparams[recon].conTag
	console.log('here1')
	async function startContainer(launchText) {
	  console.log('running container...');

	  console.log('container function running')
	  console.log(launchText)
	  var { stdout, stderr } = exec(launchText);
	  //container1.stdout.pipe(fs.createWriteStream(dirname+'docker_stdout.txt'));
	  //container1.stderr.pipe(fs.createWriteStream(dirname+'docker_stdout.txt'));
		function delay(milliseconds){
		    return new Promise(resolve => {
		        setTimeout(resolve, milliseconds);
		    });
		}
		console.log('dir: ' + '/root/presto/userRecons/' + uniqueID)
		console.log('nc files: ' + countNetcdf('/root/presto/userRecons/' + uniqueID))
	  //while (countNetcdf('/root/presto/userRecons/' + uniqueID) === undefined) {
	//	  delay(1000);
	  //}
	  await delay(300000);

	}
	  await startContainer(launchText)
	  fs.writeFile(dirname+'docker_stdout.txt', stdout.toString())
	  fs.writeFile(dirname+'docker_stderr.txt', stderr.toString())
	  console.log('end of container function')
	  console.log('container run complete');
	  sendEmail(dockerSuccess, user, domain, uniqueID, configLoc)
	  zipIt(uniqueID)
	

        /*

	
		docker.run(rparams[recon].conTag,
			   [],
			   [stdout, stderr],
			   options,
			   
			   function (err, data, container) {
				   fs.writeFile(dirname+'docker_stdout.txt', stdout.toString(), function(err) {
					   if(err) {
						   return console.log(err);
					   }
				   });
				   fs.writeFile(dirname+'docker_stderr.txt', stderr.toString(), function(err) {
					   if(err) {
						   return console.log(err);
					   }
				   });
				   sendEmail(dockerSuccess, user, domain, uniqueID, configLoc)
				   zipIt(uniqueID)
			   })*/
}
  
prestoStartHtml = function (uniqueID, user, domain, recon) {
	return('Starting your' + rparams[recon].title + 'custom Presto reconstruction, ID: '+ uniqueID +'<br /><br />' 
		 + "WARNING: Using your browser's 'back' button will overwrite your previous submission<br /><br />"  
		 + '<a href=' + rparams[recon].github + 'target="_blank">' + rparams[recon].title + 'Reconstruction Code</a><br /><br />' 
		 + 'The results will be sent to: ' + user + '@' + domain 
		 + '<br /><br />If results do not arrive within 1-2 hours, check your Spam folder <br /><br />You will automatically be redirected to the Presto home page after 10 seconds' 
		 + '<script>history.pushState(null, null, window.location.href);history.back();window.onpopstate = () => history.forward();var timeout = 10000; setTimeout(function ()' 
		 + '{window.location = "https://paleopresto.com/"; }, timeout); </script>')
}

app.get("/:recon/:user/:domain/:uniqueID", (req, res) => {
	res.send(prestoStartHtml(req.params.uniqueID, req.params.user, req.params.domain, req.params.recon))
	runRecon(req.params.uniqueID, req.params.user, req.params.domain, req.params.recon)
})

app.listen(PORT, function () {
  console.log(`Express server listening on port ${PORT}`)
})
