var mysql = require('mysql');

var con = mysql.createConnection({
	  host: "localhost",
	  user: "dave",
	  password: "peb0pk0q",
	  database: "lipdverse"
});

con.connect(function(err) {
	  if (err) throw err;
	  console.log("Connected!");
	  var sql = "CREATE TABLE query (paleoData_TSid VARCHAR(255), archiveType VARCHAR(255), paleoData_variableName VARCHAR(255), paleoData_units VARCHAR(255), paleoData_proxy VARCHAR(255), geo_latitude FLOAT(7,4), geo_longitude FLOAT(), geo_elevation FLOAT(), minAge FLOAT(), maxAge FLOAT(), medianResolution FLOAT(), auth VARCHAR(255), datasetId VARCHAR(255), country VARCHAR(255), interp_Vars VARCHAR(255), interp_Details VARCHAR(255), paleoData_mostRecentCompilations VARCHAR(255), interpretation1_seasonality VARCHAR(255))";
	  con.query(sql, function (err, result) {
		      if (err) throw err;
		      console.log("Table created");
		    });
});
