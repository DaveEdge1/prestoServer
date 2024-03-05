
express = require("express");
PORT = process.env.PORT || 3011
const fs = require('fs');

var app = express();

app.get("/:reconID", (req, res) => {
	res.send("/root/presto/userRecons/" + req.params.reconID
})

app.listen(PORT, function () {
	  console.log(`Express server listening on port ${PORT}`)
})
