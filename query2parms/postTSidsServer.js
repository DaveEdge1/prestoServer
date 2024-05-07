PORT = process.env.PORT || 3012

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

var newStatus = function(TSids, uniqueID){
	if (typeof TSids == 'undefined' || typeof uniqueID == 'undefined'){
		console.log("TSids: " + TSids)
		console.log("uniqueID: ", uniqueID)
		return(400)
	} else {
		return(200)
	}
}

var newDir = function(dir1){
	if (!fs.existsSync(dir1)) {
                fs.mkdir(dir1,
                        (err) => {
                        if (err) {
                                return console.error(err);
                        }
                });
        }
}

var writeIt = function(path1, TSids){
  fs.writeFileSync(path1, TSids);
  console.log('File created successfully at: ' + path1);
}

var writeJSON = function(TSids, uniqueID){
  //write a json file with the TSids in the uniqueID dir
  var dir1 = path.join(__dirname, '../userRecons', uniqueID);
  newDir(dir1);
  var path1 = path.join(dir1, "TSids.json");
  writeIt(path1,TSids);
};

app.post('/', function(req, res) {
	console.log('ping');
	res.sendStatus(newStatus(req.body.TSids, req.body.uniqueID));
	
	if (newStatus(req.body.TSids, req.body.uniqueID) == 200){	
		writeJSON(req.body.TSids, req.body.uniqueID);
	};
});

app.listen(PORT, function () {
		    console.log(`Express server listening on port ${PORT}`)
})
