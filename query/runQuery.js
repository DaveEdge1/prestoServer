var shelljs = require("shelljs");
var fs = require('fs')


queryThenReport = function (){
	//var queryOut = await shelljs.exec('node /root/presto/query/getLipd.js')
	
	return shelljs.exec('node /root/presto/query/getLipd.js ${process.argv[2]}');
}

queryThenReport();
