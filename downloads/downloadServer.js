express = require('express');
PORT = process.env.PORT || 3001;
const fs = require('fs');
var archiver = require('archiver');
const path = require('path');

var app = express();

app.get('/downloads/:downloadId', (req, res) => {
	  const archive = function (foldername) {
		      var zipName = "presto.zip";
		      const source = '/root/presto/userRecons/' + foldername;
		  const archive = archiver('zip', { zlib: { level: 9 }});
		      const stream = fs.createWriteStream(zipName);

		      archive
		          .directory(source, false)
		          .on('error', err => {throw err;})
		          .pipe(stream);

		      stream.on('close', function(){
			            res.status(200);
			            res.download('/root/presto/downloads/presto.zip')
			            //res.sendFile('/root/presto/downloads/index.html')
			          });
		      archive.finalize();
		      console.log("zip file created");
	  }
	archive(req.params.downloadId)

});
  

app.get('/downloadZip', (req, res) => {
	  res.download('presto.zip');
})



app.listen(PORT, function () {
	  console.log(`Express server listening on port ${PORT}`)
})
