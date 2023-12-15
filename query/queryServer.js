PORT = process.env.PORT || 3006

var express = require('express'),
    app = express()

app.use('/', express.static(path.join(__dirname, 'public')))

app.get('/', function (req, res) {
	res.sendFile(path.join(__dirname, 'index.html'))
});


app.listen(PORT, function () {
    console.log(`Express server listening on port ${PORT}`)
  })
