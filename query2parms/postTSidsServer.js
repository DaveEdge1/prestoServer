PORT = process.env.PORT || 3011

var fs = require('fs');
var express = require('express'),
		    app = express()

const path = require("path")
var bodyParser = require('body-parser');
var cors = require('cors');

//app.use(bodyParser.json());
app.use(bodyParser.json({
     parameterLimit: 100000,
     limit: '50mb',
     extended: true
}));
app.use(cors({origin: 'http://143.198.98.66:86'}));

var newStatus = function(TSIDs, uniqueID){
	if (typeof TSIDs == 'undefined' || typeof uniqueID == 'undefined'){
		return(400)
	} else {
		return(200)
	}
}

var writeJSON = function(TSids, uniqueID){
  //write a json file with the TSids in the uniqueID dir
  dir1 = path.join(__dirname, '../userRecons', uniqueID)
	fs.mkdir(dir1,
		(err) => {
		if (err) {
			return console.error(err);
		}
		console.log('Directory created successfully at: ' + dir1);
	});
  var path1 = path.join(dir1, "TSids.json")
  fs.writeFile(path1, TSids, (err) => {
            if (err)
                console.log(err);
            else {
                console.log('File created successfully at: ' + path1);
            }
  });
};

app.post('/', function(req, res) {
	res.sendStatus(newStatus(req.body.TSIDs));
	
	if (newStatus(req.body.TSIDs, req.body.uniqueID) == 200){	
		writeJSON(req.body.TSIDs req.body.uniqueID);
});

app.listen(PORT, function () {
		    console.log(`Express server listening on port ${PORT}`)
})
