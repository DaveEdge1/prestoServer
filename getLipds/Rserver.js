PORT = process.env.PORT || 3010

var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
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

async function createDirectory(TSIDs, uniqueID, dirPath) {
  try {
    fs.mkdirSync(dirPath);
    console.log(`Directory "${dirPath}" created successfully.`);
    return 200;
  } catch (error) {
    if (error.code === 'EEXIST') {
      console.error(`Directory "${dirPath}" already exists.`);
	    return 400;
    } else if (error.code === 'EACCES' || error.code === 'EPERM') {
        console.error(`Permission denied to create directory "${dirPath}".`);
	    return 400;
    } else if (error.code === 'ENOENT'){
        console.error(`Path "${dirPath}" is invalid.`);
	    return 400;
    }
     else {
      console.error(`An error occurred while creating directory "${dirPath}":`, error);
	     return 400;
    }
  }
}

function parseLipdSource(bodyIn) {
	if ("TSIDs" in bodyIn) {
	  return 'TSIDs'
	  console.log(`Writing TSIDs`);
	} else if ("archivedComp" in bodyIn) {
	  return 'archivedComp'
	  console.log(`Using Archived Compilation`);
	} else {
	  return NULL
	  console.log(`No TSIDs or archivedComp found!`);
	}
}

app.post('/lipds', function(req, res) {
	var dir1 = '/root/presto/userRecons/' + req.body.uniqueID + '_' + req.body.recon

	const lipdSource = parseLipdSource(req.body)

	if ("TSIDs" in req.body){
		createDirectory(req.body.TSIDs, req.body.uniqueID, dir1).then(status => {
		    console.log('Final status:', status);
		    res.sendStatus(status)
			if (status == 200){
				var path0 = path.join(dir1, 'TSIDs.json')
				var fullJSON = `{"TSIDs":` + JSON.stringify(req.body.TSIDs) + `}`
				fs.writeFile(path0, fullJSON, (err) => {
					  if (err)
						    console.log(err);
					  else {
						      console.log("File written successfully at: " + path0);
						    }
				});
			} else {
				var path0 = path.join(dir1, 'TSIDs_err.txt')
				fs.writeFile(path0, "Rserver error! TSIDs not written.", (err) => {
					  if (err)
						    console.log(err);
					  else {
						      console.log("File written successfully at: " + path0);
						}
				});
			}
		});
	} else if ("archivedComp" in req.body){
		createDirectory2(req.body.archivedComp, req.body.uniqueID, dir1).then(status => {
		    console.log('Final status:', status);
		    res.sendStatus(status)
			if (status == 200){
				var path0 = path.join(dir1, 'archivedComp.txt')
				fs.writeFile(path0, req.body.archivedComp, (err) => {
					  if (err)
						    console.log(err);
					  else {
						      console.log("File written successfully at: " + path0);
						    }
				});
			} else {
				var path0 = path.join(dir1, 'archivedComp_Err.txt')
				fs.writeFile(path0, "Rserver error! archivedComp not written.", (err) => {
					  if (err)
						    console.log(err);
					  else {
						      console.log("File written successfully at: " + path0);
						}
				});
			}
		});
	} else {
			console.log("Couldn't find TSIDs or archivedComp in POST from query")
		}
		
});

app.listen(PORT, function () {
		    console.log(`Express server listening on port ${PORT}`)
		  })
