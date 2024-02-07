PORT = process.env.PORT || 3009

var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var fs = require('fs');
var express = require('express'),
	    app = express()

const path = require("path")

var bodyParser = require('body-parser');
app.use(bodyParser.json());

sparqlConstr = function(TSIDs){
	                var query1st = fs.readFileSync('queryHalf1.sparql','utf8');
	                var query2nd = fs.readFileSync('queryHalf2.sparql','utf8');
	                var filterString = '                FILTER (';
	                filterString +=  '?hasVariableID = "' + TSIDs[0] + '" ';
	                if (TSIDs.length > 0){
				                                        for (var i=0; i<TSIDs.length; i++){
										                                                                        filterString +=  '|| ?hasVariableID = "' + TSIDs[i] + '" ';
										                                                                }
				                                }
	                filterString += ')';
	                var queryWhole = query1st + filterString + query2nd
	                console.log(queryWhole);
	                return encodeURI(queryWhole);
}

//var xhr = new XMLHttpRequest();
sendQuery = function(TSIDs){
	    xhr = new XMLHttpRequest();
	    //xhr.timeout = 2000;
		return new Promise((resolve, reject) => {
	    	xhr.onreadystatechange = (e) => {
			if (xhr.readyState !== 4) {
				return;
			}
			if (xhr.status === 200){
				prevResp = xhr.responseText.substring(19);
				prevResp = prevResp.replaceAll("NaN", "null");
				prevResp = '"' + prevResp
				prevResp = prevResp.replaceAll(',"[','":[');
				prevResp = prevResp.replaceAll(']"', '],"');
				prevResp = prevResp.replaceAll(/[\r\n]/g, "");
				prevResp = prevResp.substring(0, prevResp.length-2);
				prevResp = "{" + prevResp + "}";
				prevResp = JSON.parse(prevResp);
				console.log(prevResp);
				resolve(JSON.stringify(prevResp));
			} else {
				var resp1 = "XHR didn't work: " + xhr.status;
				console.log(resp1);
				resolve(resp1);
			}
		};
		xhr.open("POST", "https://linkedearth.graphdb.mint.isi.edu/repositories/LiPDVerse3", false);
		xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		jsbody = 'query=' + sparqlConstr(TSIDs);
		xhr.send(jsbody);
		});
}



app.post('/sparql', function(req, res) {
	sendQuery(req.body.TSIDs).then(reso => res.json(reso));
});

app.listen(PORT, function () {
	    console.log(`Express server listening on port ${PORT}`)
	  })
