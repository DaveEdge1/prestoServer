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
