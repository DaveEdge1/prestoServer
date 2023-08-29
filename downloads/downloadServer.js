express = require('express');
PORT = process.env.PORT || 3001;
const fs = require('fs');
//var archiver = require('archiver');
//var JSZip = require("jszip");
//var zip = require('express-zip');
//var AdmZip = require('adm-zip');
//const path = require('path');

var app = express();
/*
newZip = function (uniqueID) {
	var downloadLoc = '/root/presto/userRecons/' + uniqueID + '/' + uniqueID + '.zip'
	var source_dir = '/root/presto/userRecons/' + uniqueID
	var output = fs.createWriteStream(downloadLoc);
	var archive = archiver('zip');

	output.on('close', function () {
		    console.log(archive.pointer() + ' total bytes');
		    console.log('archiver has been finalized and the output file descriptor has closed.');
	});

	archive.on('error', function(err){
		    throw err;
	});

	archive.pipe(output);

	archive.directory(source_dir, false);
	
	archive.directory('subdir/', 'new-subdir');
	
	archive.finalize();

	res.writeHead(200, {
		                'Content-Disposition': 'attachment; filename="' + req.params.downloadId + '.zip"',
		                'Content-Type': '.zip',
		            })

	return(res.end(downloadLoc))
}
*/
app.get('/downloads/:downloadId', (req, res) => {
	/*
	newZip = function (uniqueID) {
		        var downloadLoc = '/root/presto/userRecons/' + uniqueID + '/' + uniqueID + '.zip'
		        var source_dir = '/root/presto/userRecons/' + uniqueID
		        var output = fs.createWriteStream(downloadLoc);
		        var archive = archiver('zip');

		        output.on('close', function () {
				                    console.log(archive.pointer() + ' total bytes');
						    console.log('archiver has been finalized and the output file descriptor has closed.');
				                    res.writeHead(200, {
						                  'Content-Disposition': 'attachment; filename="' + req.params.downloadId + '.zip"',
						                  'Content-Type': '.zip',
						    })
                                                    return(res.end(downloadLoc))
			});


        archive.on('error', function(err){
		                    throw err;
				            });
		archive.pipe(output);
                archive.directory(source_dir, false);
                archive.directory('subdir/', 'new-subdir');
                archive.finalize();
	}
	newZip(req.params.downloadId)
	    /*res.writeHead(200, {
	        'Content-Disposition': 'attachment; filename="' + req.params.downloadId + '.zip"',
	i        'Content-Type': '.zip',
	    })
	    //res.download(whereTo);
	  res.writeHead(200, {
	      'Content-Disposition': 'attachment; filename="' + req.params.downloadId + '.zip"',
	      'Content-Type': '.zip',
	  })*/
	  res.download('/root/presto/userRecons/' + req.params.downloadId + '/' + req.params.downloadId + '.zip')
});
/*




	  const archive = function (foldername) {
		  const zip = new JSZip();



















		      var zipName = "presto.zip";
		      const source = '/root/presto/userRecons/' + foldername;
		  const archive = archiver('zip', { zlib: { level: 9 }});
		      const stream = fs.createWriteStream('/root/presto/userRecons/'+foldername+'/'+zipName);

		      archive
		          .directory(source, false)
		          .on('error', err => {throw err;})
		          .pipe(stream);

		      stream.on('close', function(){
			            //res.status(200);
			            //res.download('/root/presto/userRecons/'+foldername+'/'+zipName)
			            //res.sendFile('/root/presto/downloads/index.html')
			          });
		      archive.finalize();
		      console.log("zip file created");
		  return ('/root/presto/userRecons/'+foldername+'/'+zipName)
	  }
	res.status(200);
	res.download(archive(req.params.downloadId))

});
  */

app.get('/downloadZip', (req, res) => {
	  res.download('presto.zip');
})



app.listen(PORT, function () {
	  console.log(`Express server listening on port ${PORT}`)
})
