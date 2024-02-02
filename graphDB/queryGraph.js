// Parse a SPARQL query to a JSON object
var SparqlParser = require('sparqljs').Parser;
var fs = require('fs');
var SparqlGenerator = require('sparqljs').Generator;

let query1 = ""

parseSparql = function(sparqlFile){
	var query1 = fs.readFileSync(sparqlFile,'utf8')
	console.log("original sparql:")
	console.log(query1)
	var parser = new SparqlParser();
	var parsedQuery = parser.parse(query1);
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




    var xhr = new XMLHttpRequest();
    sendQuery = function(){
	xhr = new XMLHttpRequest();
        xhr.timeout = 2000;
        xhr.onreadystatechange = function(e){
            //console.log(this);
            if (xhr.readyState === 4){
                if (xhr.status === 200){
		    const promise1 = new Promise((resolve, reject) => {
			    console.log("ping mysql")
			    prevResp = updateRes(JSON.parse(xhr.response));
		            updatePoints(prevResp)
			    resolve();
		    });
			promise1.then(() => {
			  xhr = null;
			  // Expected output: "Success!"
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
        xhr.open("get", "http://143.198.98.66:88/" + params(), /*async*/ true);
        // xhr.responseType = "text";
        jsbody = '{"datasetId":"'+ dataString + '"}';
        console.log(jsbody);
	xhr.send(jsbody);
    }
