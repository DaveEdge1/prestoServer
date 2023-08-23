Docker = require('dockerode');
express = require("express");
child_process = require("child_process")
//const child = require('child_process').spawn;
PORT = process.env.PORT || 3000
const fs = require('fs');
var YAML = require('yaml')
const streams = require('memory-streams')
const path = require('path')
var configLoc = ''
var app = express()
var docker = new Docker({protocol:'http', host: 'localhost', port: 2375});
//var d = new Date();
//var timeNow = d.getTime()
var nodemailer = require('nodemailer');
var align = require('align-yaml');


var translate = function (uniqueID){
var yaml = require('js-yaml')

const lookup = function() {
	                const s = fs.readFileSync('/root/presto/prestoForm/holocene_da/lookup.json','utf8');
	                return JSON.parse(s)
}


const configs = yaml.load(fs.readFileSync('/root/presto/userRecons/' + uniqueID  + '/configs.yml','utf8'));


const configsOrig = yaml.load(fs.readFileSync('/root/presto/prestoForm/holocene_da/config_default.yml','utf8'));


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
					                                  } else {
										                                           
															                                                    configsOrig[orig] = configs1.value

																					                                     }
																									                                     }else{
																													                                             console.log('no value')
																																		                                     }
																																						                                  }
															                                }
					                        }
	                        console.log(configsOrig)
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
/*
updateHDAParams = function (){
	                require('child_process').fork('/root/presto/prestoForm/holocene_da/translate.js');
	                console.log("updating Holocene_DA paramters via /root/presto/prestoForm/holocene_da/translate.js")
	                return('/root/presto/prestoForm/holocene_da/config_default.yml')
}
*/
updateHDAParams = function (uniqueID){
         //const child = require('child_process').fork;
         //const script = '/root/presto/prestoForm/holocene_da/translate.js';
         translate(uniqueID)
	 //require('child_process').fork(['/root/presto/prestoForm/holocene_da/translate.js', uniqueID]);
         // pass the variable a to child
         //child('node', [script, uniqueID]);
	 //console.log('tranlate.js run successful')
	 return('/root/presto/userRecons/' + uniqueID  + '/configsTranslated.yml')
}

/*
newDir = function(dirname) {
	fs.mkdirSync(dirname, (err) => {
		  if (err) throw err;
	});
	return (dirname)
}
*/
app.get("/holocene_da/:user/:domain/:loc/:uniqueID", (req, res) => {
  //console.log('dirname: ' + dirname())
  var dockerSuccess = 0
  const stdout = new streams.WritableStream()
  const stderr = new streams.WritableStream()
  //var d = new Date();
  var timeNow = req.params.uniqueID
  var destURL = 'http://137.184.4.96:83/downloads/' + timeNow
  var dirname = '/root/presto/userRecons/' + timeNow + '/';
  //var emailRecip = req.params.user + '@' + req.params.domain;
  if (req.params.loc === 'default') {
	  configLoc = '/root/presto/presto/holocene_da/config_default.yml'
  } else {
	  configLoc = updateHDAParams(req.params.uniqueID)
  }
  //res.redirect('/root/presto/presto/submitted.html')
	res.send('Starting your custom Presto reconstruction<br /><br />' + "WARNING: Using your browser's 'back' button will overwrite your previous submission<br /><br />"  + '<a href=https://github.com/Holocene-Reconstruction/Holocene-code target="_blank">Holocene DA Reconstruction Code</a><br /><br />' + 'The results will be sent to: ' + req.params.user + '@' + req.params.domain + '<br /><br />If results do not arrive within 1-2 hours, check your Spam folder <br /><br />You will automatically be redirected to the Presto home page after 10 seconds' + '<script>history.pushState(null, null, window.location.href);history.back();window.onpopstate = () => history.forward();var timeout = 10000; setTimeout(function () {window.location = "https://paleopresto.com/"; }, timeout); </script>')
      let options = {
      Tty: false,
      HostConfig: {
	AutoRemove: true,
        Binds: [
          dirname + ':/results',
	  configLoc + ':/config_default.yml'
        ]	
      }
    }
	
	docker.run('davidedge/lipd_webapps:holocene_da',
	  [], 
	  [stdout, stderr],
	  options,

	  function (err, data, container) {
		    var configFileTxt = function (configFileLoc) {
			        var s = fs.readFileSync(configFileLoc,'utf8');
			        //s = YAML.parse(s)
			        //s = YAML.stringify(s)
			        s = align(s, 5)
			        //s = s.replace(/(?:\r\n|\r|\n)/g, '<br>');
			        return s
		    }
		    console.log(configFileTxt(configLoc))
                    var mailOptions = {
			      from: 'no-reply@paleopresto.com',
			      to: req.params.user + '@' + req.params.domain,
			      subject: 'Presto Custom Reconstruction ' + timeNow,
			      html:   '<p>Thank you for using Presto! Use the link below to access the results of your custom reconstruction. This link will expire after 7 days.</p>'
			              + '<br>'
			              + '<a href="' + destURL + '" download>Download Custom Reconstruction '+timeNow+'</a>'
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
			              + '<p>If you are having trouble with Presto please <a href = "mailto:david.edge@nau.edu?Subject=' + timeNow  +'">email us directly</a>  with your unique reconstruction id: ' + timeNow + '</p>'
			      };
		      var mailOptions2 = {
			                    from: 'no-reply@paleopresto.com',
			                    to: req.params.user + '@' + req.params.domain,
			                    subject: 'Presto Custom Reconstruction ' + timeNow,
			                    html:   '<p>Thank you for using Presto! Unfortunately the combination of parameters selected caused an error in the reconstruction code. The output of the code up the the point of error is shown in the log file at the linked URL. This link will expire after 7 days.</p>'
			                            + '<br>'
			                            + '<a href="' + destURL + '" download>Download Custom Reconstruction '+timeNow+'</a>'
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
			                            + '<p>If you are having trouble with Presto please <a href = "mailto:david.edge@nau.edu' + timeNow  +'">email us directly</a>  with your unique reconstruction id: ' + timeNow + '</p>'
		      };
		  fs.readdir(dirname, function(err, files) {
			    const txtFiles = files.filter(el => path.extname(el) === '.nc')
			    console.log('.nc files: names, length, length==0')
			    console.log(txtFiles)
			    console.log(txtFiles.length)
			    dockerSuccess = txtFiles.length
			  })
		  /*fs.copyFile(configLoc, dirname+'configs.yml', 0, (err) => {
			 if (err) {
			           console.log("Error Found:", err);
			 } else {
			           console.log("\nFile Contents of copied_file:")
			 }
		  });*/
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

		  if (dockerSuccess>0){
		     transporter.sendMail(mailOptions2, function(error, info){
		       if (error) {
		          console.log(error);
		       } else {
		          console.log('Email sent: ' + info.response);
		       }
		     });
		  } else {


         transporter.sendMail(mailOptions, function(error, info){
           if (error) {
             console.log(error);
           } else {
             console.log('Email sent: ' + info.response);
           }
	 });
		  }
	})
})


app.get("/temp12k/username/:user/domainname/:domain/configloc/:loc", (req, res) => {
  var d = new Date();
  var timeNow = d.getTime()
 
  var destURL = 'http://137.184.4.96:83/downloads/' + timeNow
  var dirname = '/root/presto/' + timeNow + '/';
  var emailRecip = req.params.user + '@' + req.params.domain;
  if (req.params.loc === 'default') {
          configLoc = '/rooti/presto/presto/temp12k/params.json'
  } else {
          configLoc = '/root/presto/prestoForm/temp12k/params.json'
  }
  var mailOptions = {
  from: 'paleoreconstorehouse@gmail.com',
  to: emailRecip,
  subject: 'Presto Reconstruction Download',
  text: 'Copy and paste the following URL into your web browser to download the requested reconstruction (expires after 7 days): \n' + destURL + '\n\nThis account is not monitored for replies\n' + 'More at https://paleopresto.com/'
  };
  res.send('Starting your reconstruction<br /><br />' + 'Temp 12k - https://github.com/paleopresto/temp12k-regional-composites<br /><br />' + 'The results will be sent to: ' + emailRecip + '<br>If results do not arrive within 1-2 hours, check your Spam folder')
      let options = {
      Tty: false,
      HostConfig: {
        Binds: [
          dirname + ':/output',
        configLoc + ':/params.json'
        ]
      }
    }
        docker.run('davidedge/lipd_webapps:temp12k',
          [],
          process.stdout,
          options,

          function (err, data, container) {
          //console.log(data.StatusCode);

         transporter.sendMail(mailOptions, function(error, info){
           if (error) {
             console.log(error);
           } else {
             console.log('Email sent: ' + info.response);
           }
         });
})
})


app.listen(PORT, function () {
  console.log(`Express server listening on port ${PORT}`)
})
