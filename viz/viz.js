
express = require("express");
PORT = process.env.PORT || 3011
const fs = require('fs');
var path = require('path')
var app = express();

function fromDir(startPath, filter) {

    console.log('Starting from dir '+startPath+'/');

    if (!fs.existsSync(startPath)) {
        console.log("no dir ", startPath);
        return;
    }

    var files = fs.readdirSync(startPath);
    for (var i = 0; i < files.length; i++) {
        var filename = path.join(startPath, files[i]);
        var stat = fs.lstatSync(filename);
        if (stat.isDirectory()) {
            fromDir(filename, filter); //recurse
        } else if (filename.endsWith(filter)) {
            console.log('-- found: ', filename);
        };
    };
};

setPage = function(dir1){
	app.use(express.static(dir1 + '/assets'));
	var html_name = fromDir(dir1, 'html');
	return html_name;
}
	

app.get("/:reconID", (req, res) => {
	res.send(setPage("/root/presto/userRecons/" + req.params.reconID));
})

app.listen(PORT, function () {
	  console.log(`Express server listening on port ${PORT}`)
})
