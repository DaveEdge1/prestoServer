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
	Object.entries(qs).forEach(([key, value]) => {
		vals = ${value}
		console.log(${key}: ${value})
		const words = vals.split(',');
		var outString = key1 + ' ='
		for (let i = 0; i < words.length; i++) {
			var outString = outString + ' "' + words[i] + '"'
			if (i < (words.length-1)){
				var outString = outString + ' OR'
			}
		}
	}
	console.log(outString)
	return(outString)
}

app.get('/', function (req, res, next) {
   console.log(req.query.archiveType)
   con.getConnection(function(err) {
	  if (err) throw err;
	  console.log("Connected!");
	   console.log(Object.keys(req.query));
	  con.query("SELECT * FROM query WHERE " + buildQstring(req.query.archiveType) + ";", function (err, result, fields) {
		      if (err) throw err;
		      res.status(200).json(result);
		    });
   });
});

app.listen(PORT, function () {
  console.log(`Express server listening on port ${PORT}`)
})
