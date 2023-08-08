Docker = require('dockerode');
express = require("express");
child_process = require("child_process")
PORT = process.env.PORT || 3000
const fs = require('fs');

var configLoc = ''
var app = express()
var docker = new Docker({protocol:'http', host: 'localhost', port: 2375});
var d = new Date();
var timeNow = d.getTime()
var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: 'paleoreconstorehouse@gmail.com',
    pass: 'aregl(&*%06KH965FYiuf964',
    clientId: '1046081870453-ochoaknev6e8i97mp9nk0q0lib8goj9g.apps.googleusercontent.com',
    clientSecret: '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',
    refreshToken: '1//049ckF8lMF4jbCgYIARAAGAQSNwF-L9IrdZMFEBkWpv5KY9-ZusiJrXx2IAyFQc2VxsT3Gf3HHVehvc9032fQyYoDsNCbolRP47g'
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
  from: 'paleoreconstorehouse@gmail.com',
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
	  + '<p>If you are having trouble with Presto please <a href = "mailto:david.edge@nau.edu">email us directly</a>  with your unqie reconstruction id: ' + timeNow + '</p>'
	  //'Copy and paste the following URL into your web browser to download the requested reconstruction (expires after 7 days): \n' + destURL + '\n\nThis account is not monitored for replies\n' + 'More at https://paleopresto.com/'
  };
  res.send('Starting your reconstruction<br /><br />' + 'Holocene DA Recon - https://github.com/Holocene-Reconstruction/Holocene-code<br /><br />' + 'The results will be sent to: ' + emailRecip)
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
}).then(function(data) {
  return docker.remove();
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
  res.send('Starting your reconstruction<br /><br />' + 'Temp 12k - https://github.com/paleopresto/temp12k-regional-composites<br /><br />' + 'The results will be sent to: ' + emailRecip)
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
