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

buildQstring function (qs){
	qs.length
}

app.get('/', function (req, res) {
   //res.send("hi")
   con.connect(function(err) {
	  if (err) throw err;
	  console.log("Connected!");
	  con.query("SELECT * FROM query WHERE archiveType = 'Peat' AND interpretation1_seasonality = 'Warmest Month' AND maxAge > 5000 AND (continent = 'Europe' OR continent = 'Asia');", function (err, result, fields) {
		      if (err) throw err;
		      res.send(req.query.qstring + JSON.stringify(result));
		    });
   });
});

app.listen(PORT, function () {
  console.log(`Express server listening on port ${PORT}`)
})
