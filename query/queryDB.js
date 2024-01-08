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
var cors = require('cors')
app.use(cors())

var mysql = require('mysql2');

var con = mysql.createPool({
	  host: "localhost",
	  user: "dave",
	  password: "peb0pk0q",
	  database: "lipdverse"
});

function buildQstring(qs){
	console.log(qs)
	console.log('key length: ' + Object.keys(qs).length)
	if (Object.keys(qs).length === 0){
		console.log('mySQL string is empty')
		return ''
	} else {
		
		var outString = ''
		Object.entries(qs).forEach(([key, value]) => {
			const words = value.split(',');
			console.log('words: ' + words)
			outString = key + ' ='
			for (let i = 0; i < words.length; i++) {
				outString = outString + ' "' + words[i] + '"'
				if (i < (words.length-1)){
					outString = outString + ' OR'
				}
			}
		})
		outString = ' WHERE ' + outString
		console.log('mySQL string: ' + outString)
		return(outString)

	}
}

app.get('/', function (req, res, next) {
   con.getConnection(function(err) {
	  if (err) throw err;
	  console.log("Connected!");
	  con.query("SELECT geo_latitude, geo_longitude FROM query" + buildQstring(req.query) + ";", function (err, result, fields) {
		      if (err) throw err;
		      res.status(200).json(result);
		    });
   });
});

app.listen(PORT, function () {
  console.log(`Express server listening on port ${PORT}`)
})
