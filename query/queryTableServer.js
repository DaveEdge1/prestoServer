PORT = process.env.PORT || 3007

var express = require('express'),
    app = express()

var mysql = require('mysql');
const path = require("path")

app.use('/', express.static(path.join(__dirname, 'public')))


app.get('/queryTable', function (req, res) {
	        res.sendFile(path.join(__dirname, 'query.html'))
});

app.listen(PORT, function () {
    console.log(`Express server listening on port ${PORT}`)
  })
