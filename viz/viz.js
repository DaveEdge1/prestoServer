
express = require("express");
PORT = process.env.PORT || 3011
const fs = require('fs');
var path = require('path')
var app = express();

setPage = function(dir1){
	app.use(express.static(dir1 + 'public'));
	var html_name = dir1 + 'visualizer.html';
	return html_name;
}
	

app.get("/:reconID", (req, res) => {
	res.sendFile(setPage("/root/presto/userRecons/" + req.params.reconID + '/viz/'));
})

app.listen(PORT, function () {
	  console.log(`Express server listening on port ${PORT}`)
})
