Docker = require('dockerode');
express = require("express");
child_process = require("child_process")
PORT = process.env.PORT || 3000
const fs = require('fs');
const streams = require('memory-streams')
const path = require('path')
var configLoc = ''
var app = express()
var docker = new Docker({protocol:'http', host: 'localhost', port: 2375});
var d = new Date();
var timeNow = d.getTime()
var nodemailer = require('nodemailer');

/*const { google } = require("googleapis");
const OAuth2 = google.auth.OAuth2;
const myOAuth2Client = new OAuth2(
	'1046081870453-g0nj94lb3kpal58elfiklrc8tm3ofv6c.apps.googleusercontent.com',
	'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',
	"https://developers.google.com/oauthplayground"
)
myOAuth2Client.setCredentials({
	refresh_token:'1//04YIbdUZ1XuQ-CgYIARAAGAQSNwF-L9Ir35IF06Q1GEJ7yI6qWGk1OKbhnxh3bGI6NRWHEm_6N3Sj99oWgToZXpadmBc0d9tRxrE'
});
const myAccessToken = myOAuth2Client.getAccessToken()*/
var transporter = nodemailer.createTransport({
  service: 'hotmail',
  auth: {
    user: 'paleopresto@outlook.com',
    pass: 'U4,wU_?dBN)U,b6',
    //clientId: '1046081870453-g0nj94lb3kpal58elfiklrc8tm3ofv6c.apps.googleusercontent.com',
    //clientSecret: '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',
    //accessToken: myAccessToken,
    //refreshToken: '1//04wi-3Qq9II9TCgYIARAAGAQSNwF-L9IrQH8H5dcZ2-nD6fDBqmys5oT_b15bvciRUDMQ9W6XqG4SJgTrvV_lN2KeUysGX50GlTE'
  }
});

updateHDAParams = function (){
	                require('child_process').fork('/root/presto/prestoForm/holocene_da/translate.js');
	                console.log("updating Holocene_DA paramters via /root/presto/prestoForm/holocene_da/translate.js")
	                return('/root/presto/prestoForm/holocene_da/config_default.yml')
}

newDir = function(dirname) {
	fs.mkdirSync(dirname, (err) => {
		  if (err) throw err;
	});
	return (dirname)
}

app.get("/holocene_da/username/:user/domainname/:domain/configloc/:loc", (req, res) => {
  //console.log('dirname: ' + dirname())
  var dockerSuccess = 0
  const stdout = new streams.WritableStream()
  const stderr = new streams.WritableStream()
  var d = new Date();
  var timeNow = "" + d.getTime() + Math.round(Math.random()*10000)
  var destURL = 'http://137.184.4.96:83/downloads/' + timeNow
  var dirname = '/root/presto/userRecons/' + timeNow + '/';
  var emailRecip = req.params.user + '@' + req.params.domain;
  if (req.params.loc === 'default') {
	  configLoc = '/root/presto/presto/holocene_da/config_default.yml'
  } else {
	  configLoc = updateHDAParams()
  }
  var mailOptions = {
  from: 'paleopresto@outlook.com',
  to: emailRecip,
  subject: 'Presto Custom Reconstruction ' + timeNow,
  html:   '<p>Thank you for using Presto! Use the link below to access the results of your custom reconstruction. This link will expire after 7 days.</p>'
	  + '<br>'
	  + '<a href="' + destURL + '" download>Download Custom Reconstruction '+timeNow+'</a>'
	  + '<br>'
	  + '<br>'
	  + '<br>'
	  + '<br>'
	  + '<br>'
	  + '<br>'
	  + '<a href="https://paleopresto.com/" target="_blank"><img src="https://paleopresto.com/img/logo.png" alt="Presto logo" height="50" width="141"></a>'
	  + '<br>'
	  + '<p>This account is not monitored for replies</p>'
	  + '<p>If the link above does not initiate a download, try manually copying the link address to your browser</p>'
	  + '<p>If you are having trouble with Presto please <a href = "mailto:david.edge@nau.edu">email us directly</a>  with your unqie reconstruction id: ' + timeNow + '</p>'
	  //'Copy and paste the following URL into your web browser to download the requested reconstruction (expires after 7 days): \n' + destURL + '\n\nThis account is not monitored for replies\n' + 'More at https://paleopresto.com/'
  };
    var mailOptions2 = {
	      from: 'paleopresto@outlook.com',
	      to: emailRecip,
	      subject: 'Presto Custom Reconstruction ' + timeNow,
	      html:   '<p>Thank you for using Presto! Unfortunately the combination of parameters selected caused an error in the reconstruction code. The output of the code up the the point of error is shown in the log file at the linked URL. This link will expire after 7 days.</p>'
	              + '<br>'
	              + '<a href="' + destURL + '" download>Download Custom Reconstruction '+timeNow+'</a>'
	              + '<br>'
	              + '<br>'
	              + '<br>'
	              + '<br>'
	              + '<br>'
	              + '<br>'
	              + '<a href="https://paleopresto.com/" target="_blank"><img src="https://paleopresto.com/img/logo.png" alt="Presto logo" height="50" width="141"></a>'
	              + '<br>'
	              + '<p>This account is not monitored for replies</p>'
	              + '<p>If the link above does not initiate a download, try manually copying the link address to your browser</p>'
	              + '<p>If you are having trouble with Presto please <a href = "mailto:david.edge@nau.edu">email us directly</a>  with your unqie reconstruction id: ' + timeNow + '</p>'
	              //'Copy and paste the following URL into your web browser to download the requested reconstruction (expires after 7 days): \n' + destURL + '\n\nThis account is not monitored for replies\n' + 'More at https://paleopresto.com/'
};
  res.send('Starting your custom Presto reconstruction<br /><br />' + '<a href=https://github.com/Holocene-Reconstruction/Holocene-code target="_blank">Holocene DA Reconstruction Code</a><br /><br />' + 'The results will be sent to: ' + emailRecip + '<br /><br />If results do not arrive within 1-2 hours, check your Spam folder <br /><br />You will automatically be redirected to the Presto home page after 5 seconds' + '<script>var timeout = 5000; setTimeout(function () {window.location = "https://paleopresto.com/"; }, timeout); </script>')
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
	fs.copyFileSync(configLoc, newDir(dirname)+'configs.yml', 0, (err) => {
		  if (err) {
			      console.log("Error Found:", err);
			    }
		  else {
		          console.log("\nFile Contents of copied_file:")
		       }
		  });
	docker.run('davidedge/lipd_webapps:holocene_da',
	  [], 
	  [stdout, stderr],
	  options,

	  function (err, data, container) {
          //console.log(datai.StatusCode);
		  fs.readdir(dirname, function(err, files) {
			    const txtFiles = files.filter(el => path.extname(el) === '.nc')
			    console.log('.nc files: names, length, length==0')
			    console.log(txtFiles)
			    console.log(txtFiles.length)
			    dockerSuccess = txtFiles.length
			  })
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

		  if (dockerSuccess==0){
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
