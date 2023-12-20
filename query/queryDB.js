/*if (process.argv.length === 2) {
          console.error('Expected at least one argument!');
          process.exit(1);
} else {
        console.log(process.argv[2])
        var uniqueID = process.argv[2]
}*/

PORT = process.env.PORT || 3007

var express = require('express'),
    app = express()

var mysql = require('mysql');

var con = mysql.createConnection({
	  host: "localhost",
	  user: "dave",
	  password: "peb0pk0q",
	  database: "lipdverse"
});

function buildQstring(qs){
	console.log(qs)
	console.log(qs['archiveType'])
	const words = qs.split(',');
	console.log(words)
	var outString = 'archiveType = '
	for (let i = 0; i < words.length; i++) {
		var outString = outString + ' ' + words[i]
		if (i < words.length){
			var outString = outString + ' OR '
		}
	}
	console.log(outstring)
	return(outString)
}

app.get('/', function (req, res) {
   //res.send("hi")
   con.connect(function(err) {
	  if (err) throw err;
	  console.log("Connected!");
	  con.query("SELECT * FROM query WHERE " + buildQstring(req.query.archiveType) + ";", function (err, result, fields) {
		      if (err) throw err;
		      res.send(req.query.qstring + JSON.stringify(result));
		    });
   });
});

app.listen(PORT, function () {
  console.log(`Express server listening on port ${PORT}`)
})
