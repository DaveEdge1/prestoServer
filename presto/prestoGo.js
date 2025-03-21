//Docker = require('dockerode');
const fs = require('fs');
var shelljs = require("shelljs");
//const util = require('util');
var exec = require("child_process").exec;
var execSync = require("child_process").execSync;
var archiver = require('archiver');
var YAML = require('yaml')
const streams = require('memory-streams')
const path = require('path')
//var docker = new Docker({protocol:'http', host: 'localhost', port: 2375});
//var d = new Date();
//var timeNow = d.getTime()
var nodemailer = require('nodemailer');
var align = require('align-yaml');

var reconParams = function(recon) {
	const reconParamsNow = fs.readFileSync('/root/presto/presto/reconLib.json','utf8');
	//console.log(JSON.parse(reconParamsNow))
	//console.log(JSON.stringify(JSON.parse(reconParamsNow)))
	const rparams = JSON.parse(reconParamsNow)[recon]
	return rparams
}

var translateJSON = function (uniqueID, recon){
	var yaml = require('js-yaml')
	
	const lookup = function() {
		const s = fs.readFileSync('/root/presto/prestoForm/' + recon + '/lookup.json','utf8');
		return JSON.parse(s)
	}
	console.log("recon: " + recon)
	function writeJSON (configs, configsOrig) {
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
						      //var origPos = 0
						      /*
						      for (ii in pos){
							      console.log("position increment: " + ii + ' origPos: ' + origPos + ' newVal: ' + configs1.value[ii])
							      //configsOrig[orig][origPos] = configs1.value[ii]
							      origPos = origPos + 1
						      }*/
						      if (orig == 'latRange' || orig == 'lonRange'){
							      var newVal1 = configs1.value
							      if (orig == 'latRange') {
								      for (let ii = 0; ii < 2; ii++){
									      console.log('key, ii, newVal1[ii], configsOrig[orig], configsOrig[orig[ii]]: ' + orig + ' ' + ii + ' ' + newVal1[ii] + ' ' + configsOrig[orig] + ' ' + configsOrig[orig[ii]])
									      configsOrig[orig][ii] = newVal1[ii]
								      }
							      } else if (orig == 'lonRange') {
							      		for (let ii = 2; ii < 4; ii++){
										console.log('key, ii, newVal1[ii], configsOrig[orig], configsOrig[orig[ii]]: ' + orig + ' ' + ii + ' ' + newVal1[ii] + ' ' + configsOrig[orig] + ' ' + configsOrig[orig[ii]])
										configsOrig[orig][(ii-2)] = newVal1[ii]
									}
							      }
						      } else if (orig == 'maxResolution' || orig == 'duration') {
							      var newVal1 = configs1.value
							      configsOrig[orig] = parseInt(newVal1)
						      } else if (orig == 'binstart') {
							      var newVal1 = configs1.value[0]
							      configsOrig[orig] = parseInt(newVal1)
						      } else if (orig == 'binend') {
							      var newVal1 = configs1.value[1]
							      configsOrig[orig] = parseInt(newVal1)
						      }
					      } else {
						      configsOrig[orig] = configs1.value
					      }
					  }
				 }
			}
		}
		fs.writeFileSync('/root/presto/userRecons/' + uniqueID  + '/configsTranslated.json', JSON.stringify(configsOrig), function(err) {
			if(err) {
			          return console.log(err)
			}
			console.log('/root/presto/userRecons/' + uniqueID  + '/configsTranslated.json has been edited');
		});
	}

	if (recon != "download"){
		const configs = yaml.load(fs.readFileSync('/root/presto/userRecons/' + uniqueID  + '/configs.yml','utf8'));
		
		const configsOrig = JSON.parse(fs.readFileSync('/root/presto/prestoForm/' + recon + '/params.json','utf8'));

		writeJSON(configs, configsOrig)
	}
}

function sleep(ms) {
    console.log("pausing for " + ms + " ms to complete background processes")
    return new Promise(resolve => setTimeout(resolve, ms));
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
							  } else if (orig[0] == 'obs_lat_min'){
								  console.log("GOT IN!")
						      		console.log('position length: ' + orig.length)
						      		var origPos = 0
						      		for (let ii = 0; ii < orig.length; ii++){
									/*
							      		console.log("position increment: " + ii + ' origPos: ' + origPos + ' newVal: ' + configs1.value[ii])
									console.log('configsOrig: ' + configsOrig)
									console.log('configsOrig[orig]: ' + configsOrig[orig])
									console.log('configsOrig[obs_lat_min]: ' + configsOrig['obs_lat_min'])
									console.log('orig[ii]: ' + orig[ii])
									console.log('configsOrig[orig[ii]]: ' + configsOrig[orig[ii]])
									console.log('configsOrig[orig][ii]: ' + configsOrig[orig][ii])
									console.log('configsOrig[orig][origPos]: ' + configsOrig[orig][origPos])
	                                                                */
							      		configsOrig[orig[ii]] = configs1.value[ii]						      	  	}
							  }
							  else {
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

	fs.writeFileSync('/root/presto/userRecons/' + uniqueID  + '/configsTranslated.yml', JSON.stringify(configsOrig), function(err) {
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
	    },
	from: 'no-reply@paleopresto.com'
});

updateParams = function (uniqueID, recon){
	if (recon == 'holocene_da' || recon == 'graph_em'){
		translate(uniqueID, recon)
		return('/root/presto/userRecons/' + uniqueID  + '/configsTranslated.yml')
	} else if (recon == 'temp12k') {
		translateJSON(uniqueID, recon)
		return('/root/presto/userRecons/' + uniqueID  + '/configsTranslated.json')
	} else {
		return true
	}
	
}
/*
function printProgress(progress){
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(progress);
}
*/
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

emailHTML = function (uniqueID, destURL, configLoc, recon) {
   var vizURL = function(configLoc){ 
	   if (configLoc == true) {
		   return '<br>'
	   } else {
		   return '<a href="' + 'http://143.198.98.66:91/'+ uniqueID + '" download>Copy and paste this URL into a new browser window to VISUALIZE your results</a><br>'
	   }
   };
   var indexURL = "http://143.198.98.66:83/customRecons/"+ uniqueID + "/"
   var configFileTxt = function (configFileLoc) {
	   if (configFileLoc == true){
		   return "";
	   } else {
		+ '<br>'
		   var s = fs.readFileSync(configFileLoc,'utf8');
		   s = align(s, 5)
		   return s
	   }
   }
	console.log("vizURL(configLoc): " + vizURL(configLoc))
	console.log("destURL: " + destURL)
	/*
	if (dockerSuccess > 0) {
		var text1 = '<p>Thank you for using Presto! Unfortunately the combination of parameters selected caused an error in the reconstruction code. The output of the code up the the point of error is shown in the log file at the linked URL. This link will expire after 7 days.</p>'
	} else {
		var text1 = '<p>Thank you for using Presto! Use the link below to access the results of your custom reconstruction. This link will expire after 7 days.</p>'
	}
        */
	var text1 = '<p>Thank you for using PReSto! Use the URL below to download the results of your custom ' + reconParams(recon).title + '. This link will expire after 7 days.</p>'
	text1 = text1
		+ '<br>'
		+ vizURL(configLoc)
	        + '<a href="' + indexURL + '" download>Copy and paste this URL into a new browser window to BROWSE ALL files created</a>'
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
		+ '<p>If for some reason your reconstruction has failed, the docker stdout and stderr files can be used to understand why. If you are having trouble with Presto please <a href = "mailto:david.edge@nau.edu?Subject=' + uniqueID  +'">email us directly</a>  with your unique reconstruction id: ' + uniqueID + '</p>'
	        + '<p>Let us know how we are doing at the <strong><a href="https://forms.gle/1wPXaCY75WwMyHXJ8" target="_blank" rel="noopener noreferrer">feedback form</a></strong>.</p>'
	return(text1)
}

  sendEmail = function (user, domain, uniqueID, configLoc, recon) {
    console.log('attempting to send email')
    var destURL = 'http://143.198.98.66:83/downloads/' + uniqueID
    var mailOptions = {
      from: 'no-reply@paleopresto.com',
      to: user + '@' + domain,
      subject: 'Presto Custom Reconstruction ' + uniqueID,
      html: emailHTML(uniqueID, destURL, configLoc, recon)
    };
      transporter.sendMail(mailOptions, function(error, info){
       if (error) {
	fs.appendFileSync('/root/presto/userRecons/' + uniqueID  + '/request-status.txt', "email error" + "\n", function(err) {
		if(err) {
		          return console.log(err)
		}
		console.log('/root/presto/userRecons/' + uniqueID  + '/request-status.txt has been initiated!');
	});
	  console.log(error);
       } else {
		fs.appendFileSync('/root/presto/userRecons/' + uniqueID  + '/request-status.txt', "email sent" + "\n", function(err) {
			if(err) {
			          return console.log(err)
			}
			console.log('/root/presto/userRecons/' + uniqueID  + '/request-status.txt has been initiated!');
		});
	  console.log('Email sent: ' + info.response);
       }
     });
  }



removeZipped = function(source_dir){
	var list = fs.readdirSync(source_dir);
    	for(var i = 0; i < list.length; i++) {
        	var filename = path.join(source_dir, list[i]);
		var stat = fs.statSync(filename);
		if (stat.isDirectory()){
			removeZipped(filename);
		} else {
			fs.unlinkSync(filename);
		}
	}
	fs.rmdirSync(source_dir);
}

zipIt = function (source_dir) {
	try{
		var downloadLoc = path.join(source_dir, source_dir + '.zip')
		var output = fs.createWriteStream(downloadLoc);
		var archive = archiver('zip');
		output.on('close', function () {
			console.log(archive.pointer() + ' total bytes');
			console.log('archiver has been finalized and the output file descriptor has closed.');
		})
		archive.on('error', function(err){
			console.error("zipping processes error!")
			throw err;
		});
		archive.pipe(output);
		archive.directory(source_dir, false);
	}catch(e){
		console.error("zipping processes error!")
	}
	//archive.directory('subdir/', 'new-subdir');
	return(archive.finalize());
}

vizStatus = async function (uniqueID) {
  var viz_status = fs.existsSync("/root/presto/userRecons/"+uniqueID+"/viz/visualizer.html")
  var timeElapsed = 0;
	  if (viz_status){
		  console.log('html visualizer file exists!')
	  }
          if (!(viz_status)){
                console.log('awaiting viz completion')
                //console.log('docker_status.search("test2") !== -1: ' + docker_status.search("test2") !== -1)
                while (!(viz_status)){
			await sleep(10000)
			timeElapsed += 10;
			if(timeElapsed >= 1000){
        			break;
    			}
                        viz_status = fs.existsSync("/root/presto/userRecons/"+uniqueID+"/viz/visualizer.html")
			var minutes = Math.floor(timeElapsed/60)
			var seconds = timeElapsed - minutes * 60;
			console.log("time elapsed: " + minutes + ":" + seconds)
			if (seconds == 0){
				var execText2 = "tail /root/presto/userRecons/"+uniqueID+"/viz_stderr.txt"
				shelljs.exec(execText2)
			}
			//console.log("time elapsed: " + minutes + ":" + seconds)
                }
                console.log('viz complete')
                return 'done'
        }
}

function checkFileExistsSync(filepath){
  let flag = true;
  try{
    fs.accessSync(filepath, fs.constants.F_OK);
  }catch(e){
    flag = false;
  }
  return flag;
}

runRecon = async function(uniqueID, user, domain, recon, language) {

	fs.writeFileSync('/root/presto/userRecons/' + uniqueID  + '/request-status.txt', "request initiated" + "\n", function(err) {
		if(err) {
		          return console.log(err)
		}
		console.log('/root/presto/userRecons/' + uniqueID  + '/request-status.txt has been initiated!');
	});

	console.log('reconParams(recon): ' + reconParams(recon))
	console.log('recon: ' + reconParams(recon).title)
	console.log('resultsDir: ', reconParams(recon).resultsDir)
	console.log('paramsLoc: ', reconParams(recon).paramsCon)
	console.log('container: ', reconParams(recon).conTag)
	console.log('language: ' + language)
	
	var stdout = new streams.WritableStream()
	var stderr = new streams.WritableStream()
	var dirname = '/root/presto/userRecons/' + uniqueID + '/';
	var configLoc = updateParams(uniqueID, recon)

	if (recon == 'holocene_da'){
		var launchText = 'docker run --rm --name ' + uniqueID + ' -v /root/presto/userRecons/'+uniqueID+'/lipd.pkl:/proxies/temp12k/Temp12k1_0_2.pkl ' + ' -v ' + dirname + ':' + reconParams(recon).resultsDir + ' -v ' + configLoc + ':' + reconParams(recon).paramsCon + ' -v /root/holocene_da/da_main_code.py:/da_main_code.py -v /root/holocene_da/make_basic_figures.py:/make_basic_figures.py ' + reconParams(recon).conTag
	} else if (recon == 'temp12k'){
		var launchText = 'docker run --rm --name ' + uniqueID + ' -v /root/presto/userRecons/'+uniqueID+'/lipd.rds:/lipd.rds ' + '-v /root/temp12k-regional-composites/regional_composites.R:/regional_composites.R -v ' + dirname + ':' + reconParams(recon).resultsDir + ' -v ' + configLoc + ':' + reconParams(recon).paramsCon + ' ' + reconParams(recon).conTag
	} else {
		var launchText = 'console.log("lipd download only")'
	}

	//if (routeExistingLipds(uniqueID)){
	//	console.log('using existing lipd data');
	//} else {

	var lipdText = 'node /root/presto/getLipds/downloadLipds.js ' + uniqueID + ' ' + language

	function gatherLipds(cmd) {
	fs.appendFileSync('/root/presto/userRecons/' + uniqueID  + '/request-status.txt', "gathering lipd data" + "\n", function(err) {
		if(err) {
		          return console.log(err)
		}
		console.log('/root/presto/userRecons/' + uniqueID  + '/request-status.txt has been initiated!');
	});
	console.log('gathering lipd data... ' + cmd);
	  try {
	    return execSync(cmd).toString();
	  } 
	  catch (error) {
	    error.status;  // Might be 127 in your example.
	    error.message; // Holds the message you typically want.
	    error.stderr;  // Holds the stderr output. Use `.toString()`.
	    error.stdout;  // Holds the stdout output. Use `.toString()`.
	  }
	};
	console.log(gatherLipds(lipdText));
	/*
	async function gatherLipds(lipdText) {
		  console.log('gathering lipd data... ' + lipdText);
		  console.log(execSync(lipdText).toString())
		  //stdout.pipe(fs.createWriteStream(dirname+'docker_stdout.txt'));
		  //stderr.pipe(fs.createWriteStream(dirname+'docker_stderr.txt'));
	
		  console.log('dir: ' + '/root/presto/userRecons/' + uniqueID)
	
		  await sleep(1000)
	}
	await gatherLipds(lipdText)
	*/
	//}
	
	async function startContainer(launchText) {
	fs.appendFileSync('/root/presto/userRecons/' + uniqueID  + '/request-status.txt', "container launched" + "\n", function(err) {
		if(err) {
		          return console.log(err)
		}
		console.log('/root/presto/userRecons/' + uniqueID  + '/request-status.txt has been initiated!');
	});
	  console.log('running container...');
	  console.log(launchText)
	  var { stdout, stderr } = exec(launchText);
	  stdout.pipe(fs.createWriteStream(dirname+'docker_stdout.txt'));
	  stderr.pipe(fs.createWriteStream(dirname+'docker_stderr.txt'));

	  console.log('dir: ' + '/root/presto/userRecons/' + uniqueID)

	  await sleep(5000)
	  await dockerStatus(uniqueID);

	fs.appendFileSync('/root/presto/userRecons/' + uniqueID  + '/request-status.txt', "container completed" + "\n", function(err) {
		if(err) {
		          return console.log(err)
		}
		console.log('/root/presto/userRecons/' + uniqueID  + '/request-status.txt has been initiated!');
	});

	}
	if (recon != "download"){
		await startContainer(launchText)
	}
	
	async function writeViz(uniqueID, dirname) {
	const dirCont = fs.readdirSync( '/root/presto/userRecons/' + uniqueID );
	const files = dirCont.filter( ( elm ) => elm.match(/.*\.(nc?)/ig));
	if (files.length < 1) {
	        console.log("no nc files in dir!");
	        fs.appendFileSync('/root/presto/userRecons/' + uniqueID  + '/request-status.txt', "viz halted, nc file missing! Check docker logs" + "\n", function(err) {
			if(err) {
			          return console.log(err)
			}
		});
		process.exit(1)
    	}
	fs.appendFileSync('/root/presto/userRecons/' + uniqueID  + '/request-status.txt', "viz launched" + "\n", function(err) {
		if(err) {
		          return console.log(err)
		}
		console.log('/root/presto/userRecons/' + uniqueID  + '/request-status.txt has been initiated!');
	});
		var bashText = '/usr/bin/bash /root/presto/viz/run_script.sh ' + uniqueID
		var { stdout, stderr } = exec(bashText);
		stdout.pipe(fs.createWriteStream(dirname+'viz_stdout.txt'));
	  	stderr.pipe(fs.createWriteStream(dirname+'viz_stderr.txt'));

		await sleep(1000)
	  	await vizStatus(uniqueID);
	fs.appendFileSync('/root/presto/userRecons/' + uniqueID  + '/request-status.txt', "viz completed" + "\n", function(err) {
		if(err) {
		          return console.log(err)
		}
		console.log('/root/presto/userRecons/' + uniqueID  + '/request-status.txt has been initiated!');
	});
	}

	if (recon != "download"){
		await writeViz(uniqueID, dirname)
	}
	  await sleep(1000)
	  //await zipIt('/root/presto/userRecons/' + uniqueID)
	  console.log('files zipped');
	  sendEmail(user, domain, uniqueID, configLoc, recon)
}

runRecon(process.argv[2], process.argv[3], process.argv[4], process.argv[5], process.argv[6])
