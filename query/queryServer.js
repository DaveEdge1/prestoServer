PORT = process.env.PORT || 3006

var express = require('express'),
    app = express()

const path = require("path")

var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
// in latest body-parser use like below.
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/', express.static(path.join(__dirname, 'public')))

app.get('/', function (req, res) {
	res.sendFile(path.join(__dirname, 'index.html'))
});

app.get('/:recon', function (req, res) {
	res.sendFile(path.join(__dirname, 'forms/', res.body.recon, '.html'))
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
	console.log(req.body)
	res.send(req.body)
	//res.download(writeConfigs(userInfo.recon, userInfo.parsedUser, userInfo.parsedDomain, req.body))
});

app.listen(PORT, function () {
    console.log(`Express server listening on port ${PORT}`)
  })
