PORT = process.env.PORT || 3006

var express = require('express'),
    app = express()

const path = require("path")

app.use('/', express.static(path.join(__dirname, 'public')))

app.get('/', function (req, res) {
	res.sendFile(path.join(__dirname, 'index.html'))
});

app.get('/2', function (req, res) {
	res.sendFile(path.join(__dirname, 'index2.html'))
});

app.get('/queryTable', function (req, res) {
	        res.sendFile(path.join(__dirname, 'query.html'))
});

app.listen(PORT, function () {
    console.log(`Express server listening on port ${PORT}`)
  })
