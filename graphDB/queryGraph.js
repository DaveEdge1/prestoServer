// Parse a SPARQL query to a JSON object
var SparqlParser = require('sparqljs').Parser;
var fs = require('fs');
var SparqlGenerator = require('sparqljs').Generator;
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

//var request = require('request');
//var querystring = require('querystring');
var TSIDs = ["Asia_163", "Asia_022", "S2LR1f792pGT8l"];
console.log(TSIDs.length);
sparqlConstr = function(TSIDs){
	var query1st = fs.readFileSync('queryHalf1.sparql','utf8');
	var query2nd = fs.readFileSync('queryHalf2.sparql','utf8');
	//var queryWhole = query1st + '                FILTER (?hasVariableID = "Asia_163" || ?hasVariableID = "Asia_022" || ?hasVariableID = "S2LR1f792pGT8l") .' + query2nd
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

parseSparql = function(sparqlFile, parse=false){
	var query1 = fs.readFileSync(sparqlFile,'utf8')
	console.log("original sparql:")
	console.log(query1)

	if (parse == true){
		var parser = new SparqlParser();
		var parsedQuery = parser.parse(query1);
		console.log("JSON query:");
		JSquery = JSON.parse(JSON.stringify(parsedQuery)).where;
		//console.log(JSON.stringify(JSquery));
		//console.log(Object.values(JSquery));
		//console.log(Object.values(JSquery)[1]);
		//console.log(Object.values(JSquery)[1].expression);
		console.log(Object.values(JSquery)[1].expression.args);
		console.log(Object.values(JSquery)[1].expression.args[0].args);
		console.log(Object.values(JSquery)[1].expression.args[0].args[0].args);
		console.log(Object.values(JSquery)[1].expression.args[0].args[1].args);
		console.log(Object.values(JSquery)[1].expression.args[1].args);
		//console.log(Object.values(JSquery)[1].expression.args[1]);
		//console.log(Object.values(JSquery)[0].expression.arg[1].args);
		//console.log(Object.values(JSquery)[1].expression.args[1].args);
		//console.log(Object.values(JSquery)[1].expression.args[2].args);
		//console.log(Object.values(JSquery)[1].expression.args[2].args);
	} else {
		var parsedQuery = encodeURI(query1);
		console.log("URI: ");
		console.log(parsedQuery);
	}
	//var retString = JSON.stringify(parsedQuery)
	//return retString
	return parsedQuery
}


jsonToSparql = function(jsonQuery){
	console.log('\n')
	console.log('\n')
	console.log("json version:")
	console.log(jsonQuery)
	console.log(JSON.stringify(jsonQuery))
	console.log('\n')
	console.log('\n')
	var generator = new SparqlGenerator({ /* prefixes, baseIRI, factory, sparqlStar */ });
	var generatedQuery = generator.stringify(jsonQuery);
	console.log("regenerated sparql:")
	return generatedQuery;
}

    let prevResp = '';
    var xhr = new XMLHttpRequest();
    sendQuery = function(){
	xhr = new XMLHttpRequest();
        xhr.timeout = 2000;
        xhr.onreadystatechange = function(e){
            //console.log(this);
            if (xhr.readyState === 4){
                if (xhr.status === 200){
			const promise1 = new Promise((resolve, reject) => {
							    prevResp = xhr.responseText.substring(19);
							    prevResp = prevResp.replaceAll("NaN", "null");
							    prevResp = '"' + prevResp
							    prevResp = prevResp.replaceAll(',"[','":[');
							    prevResp = prevResp.replaceAll(']"', '],"');
							    prevResp = prevResp.replaceAll(/[\r\n]/g, "");
							    prevResp = prevResp.substring(0, prevResp.length-2);
							    prevResp = "{" + prevResp + "}";
							    prevResp = JSON.parse(prevResp);
							    //console.dir(prevResp.S2LR1f792pGT8l, {'maxArrayLength': null});
				                            console.log(prevResp);
							    resolve();
				                    });

			                        promise1.then(() => {
						         xhr = null;
							                          //Expected output: "Success!"
						});
                } else {
		    const promise1 = new Promise((resolve, reject) => {
			    console.log("XHR didn't work: " + xhr.status);
			    resolve();
		    });
			
			promise1.then(() => {
			  xhr = null;
			  // Expected output: "Success!"
			});
			
                    
                }
            }
        }
        xhr.ontimeout = function (){
            console.error("request timedout: ", xhr);
        }
	xhr.open("POST", "https://linkedearth.graphdb.mint.isi.edu/repositories/LiPDVerse3", false);
        //xhr.responseType = "text";
	xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
	xhr.setRequestHeader("Accept", "application/sparql-resuts+json");
	    //jsbody = 'query=' + parseSparql("query.sparql", parse=false)
	    jsbody = 'query=' + sparqlConstr(TSIDs);
	    //console.log(jsbody);
	xhr.send(jsbody);
    };

//sparqlConstr();
//parseSparql("query.sparql", parse=true)
sendQuery();

