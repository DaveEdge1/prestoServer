PORT = process.env.PORT || 3006

var express = require('express'),
    app = express()

const path = require("path")

app.use('/', express.static(path.join(__dirname, 'public')))

app.get('/', function (req, res) {
	res.sendFile(path.join(__dirname, 'index.html'))
});
/*
app.get('/2', function (req, res) {
	res.sendFile(path.join(__dirname, 'index2.html'))
});

app.get('/queryTable', function (req, res) {
	        res.sendFile(path.join(__dirname, 'query.html'))
});
*/
app.post('/lipdVerse', function(req, res) {
        //console.log(userInfo)
	//console.log(req.body)
	//var d = new Date();
	//var timeNow = function() { return("" + d.getTime() + Math.round(Math.random()*10000))}
	//var downloadPath = writeConfigs(req.query.recon, req.query.user, req.query.domain, req.body, req.query.uniqueID)
	res.send(req.body)
	//res.download(writeConfigs(userInfo.recon, userInfo.parsedUser, userInfo.parsedDomain, req.body))
});

app.listen(PORT, function () {
    console.log(`Express server listening on port ${PORT}`)
  })
