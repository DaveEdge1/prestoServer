// Parse a SPARQL query to a JSON object
var SparqlParser = require('sparqljs').Parser;
var fs = require('fs');
var SparqlGenerator = require('sparqljs').Generator;
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

//var request = require('request');
//var querystring = require('querystring');

let query1 = ""

parseSparql = function(sparqlFile, parse=false){
	var query1 = fs.readFileSync(sparqlFile,'utf8')
	console.log("original sparql:")
	console.log(query1)

	if (parse == true){
		var parser = new SparqlParser();
		var parsedQuery = parser.parse(query1);
	} else {
		var parsedQuery = encodeURI(query1);
		console.log("URI: ")
		console.log(parsedQuery)
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
				                            //console.log(xhr.responseText);
							    prevResp = xhr.responseText.split(/\r\n/);
							    console.log(prevResp) 
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
        //xhr.open("get", "https://linkedearth.graphdb.mint.isi.edu/repositories/LiPDVerse3?" + "query=PREFIX+le%3A+%3Chttp%3A%2F%2Flinked.earth%2Fontology%23%3E%0D%0A%0D%0A++++SELECT+%3Fvalues%0D%0A++++WHERE+%7B%0D%0A+++++++%3Fds+a+le%3ADataset+.%0D%0A++++%09%3Fds+le%3AincludesPaleoData+%3Fdata+.%0D%0A++++++++%3Fdata+le%3AfoundInMeasurementTable+%3Ftable+.%0D%0A++++++++%3Ftable+le%3AincludesVariable+%3Fvar+.%0D%0A%09%3Fvar+le%3AhasVariableID+%3FhasVariableID+.%0D%0A%09%09FILTER+%28regex%28%3FhasVariableID%2C+%22Asia_163%22%29+%7C%7C+regex%28%3FhasVariableID%2C+%22Asia_022%22%29%29+.%0D%0A%09%3Fvar+le%3AhasValues+%3Fvalues+.%0D%0A++++%09%0D%0A++++%0D%0A++++%0D%0A%7D%0D%0ALIMIT+100%0D%0A", /*async*/ false);
        //xhr.responseType = "text";
	xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        //jsbody = {"query=PREFIX+le%3A+%3Chttp%3A%2F%2Flinked.earth%2Fontology%23%3E%0D%0A%0D%0A++++SELECT+%3Fvalues%0D%0A++++WHERE+%7B%0D%0A+++++++%3Fds+a+le%3ADataset+.%0D%0A++++%09%3Fds+le%3AincludesPaleoData+%3Fdata+.%0D%0A++++++++%3Fdata+le%3AfoundInMeasurementTable+%3Ftable+.%0D%0A++++++++%3Ftable+le%3AincludesVariable+%3Fvar+.%0D%0A%09%3Fvar+le%3AhasVariableID+%3FhasVariableID+.%0D%0A%09%09FILTER+%28regex%28%3FhasVariableID%2C+%22Asia_163%22%29+%7C%7C+regex%28%3FhasVariableID%2C+%22Asia_022%22%29%29+.%0D%0A%09%3Fvar+le%3AhasValues+%3Fvalues+.%0D%0A++++%09%0D%0A++++%0D%0A++++%0D%0A%7D%0D%0ALIMIT+100%0D%0A"};
        jsbody = 'query=' + "PREFIX%20le%3A%20%3Chttp%3A%2F%2Flinked.earth%2Fontology%23%3E%0A%0A%20%20%20%20SELECT%20%3Fvalues%0A%20%20%20%20WHERE%20%7B%0A%20%20%20%20%20%20%20%20%3Fds%20a%20le%3ADataset%20.%0A%20%20%20%20%20%20%20%20%3Fds%20le%3AincludesPaleoData%20%3Fdata%20.%0A%20%20%20%20%20%20%20%20%3Fdata%20le%3AfoundInMeasurementTable%20%3Ftable%20.%0A%20%20%20%20%20%20%20%20%3Ftable%20le%3AincludesVariable%20%3Fvar%20.%0A%20%20%20%20%20%20%20%20%3Fvar%20le%3AhasVariableID%20%3FhasVariableID%20.%0A%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20%20FILTER%20%28regex%28%3FhasVariableID%2C%20%22Asia_163%22%29%20%7C%7C%20regex%28%3FhasVariableID%2C%20%22Asia_022%22%29%29%20.%0A%20%20%20%20%20%20%20%20%3Fvar%20le%3AhasValues%20%3Fvalues%20.%0A%0A%0A%0A%7D%0ALIMIT%20100";
	    jsbody = 'query=' + parseSparql("query.sparql", parse=false)
	    //console.log(jsbody);
	xhr.send(jsbody);
    };
sendQuery();
//
//var myquery2 = querystring.stringify({query: 'PREFIX le: <http://linked.earth/ontology#> SELECT ?values WHERE { ?ds a le:Dataset . ?ds le:includesPaleoData ?data . ?data le:foundInMeasurementTable ?table . ?table le:includesVariable ?var . ?var le:hasVariableID ?hasVariableID . FILTER (regex(?hasVariableID, "Asia_163") || regex(?hasVariableID, "Asia_022")) . ?var le:hasValues ?values . } LIMIT 100'})

//request.get({header: "application/x-www-form-urlencoded", url:'https://linkedearth.graphdb.mint.isi.edu/repositories/LiPDVerse3'+ myquery2 }, function (error, response, body) {
//	  if (!error && response.statusCode == 200) {
//		     // Show the HTML for the Google homepage.
//		  console.log('successful update');
//		  console.log(body);
//		    } 
//		      else
//		        {
//		           console.log(response.statusCode)
//		              console.warn(error);
//		                }
//		               });
