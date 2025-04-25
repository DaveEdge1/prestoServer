$(function() {
    // Split function to separate terms by comma and optional space
    function split(val) {
        return val.split(/,\s*/);
    }
    // Extract the last term for autocomplete
    function extractLast(term) {
        return split(term).pop();
    }

    /**
     * General autocomplete initializer
     * @param {string} selector - jQuery selector for the input
     * @param {Array} dataSource - Array of autocomplete options
     */
    function setupAutocomplete(selector, dataSource) {
        $(selector)
            // Don't navigate away from the field on tab when selecting an item
            .bind("keydown", function(event) {
                if (event.keyCode === $.ui.keyCode.TAB &&
                    $(this).autocomplete("instance") &&
                    $(this).autocomplete("instance").menu.active) {
                    event.preventDefault();
                }
            })
            .autocomplete({
                minLength: 0,
                source: function(request, response) {
                    response(
                        $.ui.autocomplete.filter(
                            dataSource, extractLast(request.term)
                        )
                    );
                },
                focus: function() {
                    // Prevent value inserted on focus
                    return false;
                },
                select: function(event, ui) {
                    var terms = split(this.value);
                    // remove the current input
                    terms.pop();
                    // add the selected item
                    terms.push(ui.item.value);
                    // add placeholder to get the comma-and-space at the end
                    terms.push("");
                    this.value = terms.join(", ");
                    return false;
                }
            });
    }

    // Example usage for your elements
    setupAutocomplete("#proxy", proxylist);
    setupAutocomplete("variableName", variablelist);
    setupAutocomplete("archiveTypeIn", archivelist);
    setupAutocomplete("countryIn", countrylist);
    setupAutocomplete("continentIn", continentlist);
    setupAutocomplete("compilationIn", latestCompilations);
    setupAutocomplete("seasonality1", seasonalitylist);

});
function hideForm(){
	if (document.getElementById("archivedCompilation").checked){
		document.getElementById("queryForm").style.display = "none";
		document.getElementById("map").style.display = "none";
		document.getElementById("mapUpdateButton").style.display = "none";
		document.getElementById("InstructionBox").style.display = "none";
		document.getElementById("proceedButton").style.display = "none";
		document.getElementById("datasetCount").style.display = "none";
		document.getElementById("archivedCompilationGroup").style.display = "block";
		document.getElementById("archivedCompButton").style.display = "block";
		document.getElementById("compilationForm").style.display = "block";
	} else {
		document.getElementById("queryForm").style.display = "block";
		document.getElementById("map").style.display = "block";
		document.getElementById("mapUpdateButton").style.display = "block";
		document.getElementById("InstructionBox").style.display = "block";
		document.getElementById("proceedButton").style.display = "block";
		document.getElementById("datasetCount").style.display = "block";
		document.getElementById("archivedCompilationGroup").style.display = "none";
		document.getElementById("archivedCompButton").style.display = "none";
		document.getElementById("compilationForm").style.display = "none";
	}
}
	
    function getQueryVariable(variable)
    {
           var query = window.location.search.substring(1);
           var vars = query.split("&");
           for (var i=0;i<vars.length;i++) {
                   var pair = vars[i].split("=");
                   if(pair[0] == variable){
                     return pair[1];}
           }
           return(false);
    }

    function popQueryVariable(){
        document.getElementById('recon').value = getQueryVariable("recon");
        document.getElementById('user').value = getQueryVariable("user");
        document.getElementById('domain').value = getQueryVariable("domain");
        document.getElementById('uniqueID').value = getQueryVariable("uniqueID");
        document.getElementById('language').value = getQueryVariable("language");
        }
        async function transformToLabelValueArray() {
            //await loadCompilationJson(); // Ensures compilationJson is ready
          
            function getLatestVersion(key) {
              const versions = Array.isArray(compilationJson[key].versions)
                ? compilationJson[key].versions
                : [compilationJson[key].versions];
          
              const parsed = versions.map(v => v.split('_').map(Number));
              parsed.sort((a, b) => {
                for (let i = 0; i < 3; i++) {
                  if (a[i] !== b[i]) return b[i] - a[i];
                }
                return 0;
              });
          
              return parsed[0].join('_');
            }
          
            return Object.keys(compilationJson).map(key => {
              const latest = getLatestVersion(key);
              return {
                value: `${key}-${latest}`,
                label: key
              };
            });
          }
          function updateBoundingBox(){
            rect.editing.disable();
            var latMin = +document.getElementById("lat_min").value
            var latMax = +document.getElementById("lat_max").value
            if (latMin > latMax){
                if (latMin < 90){
                    latMax = latMin + .001
                    document.getElementById("lat_max").value = latMax
                } else {
                    latMin = latMax - .001
                    document.getElementById("lat_min").value = latMin
                }
            }
            var lonMin = +document.getElementById("lon_min").value
            var lonMax = +document.getElementById("lon_max").value
            if (lonMin > lonMax){
                if (lonMin < 180){
                    lonMax = lonMin + .001
                    document.getElementById("lon_max").value = lonMax
                } else {
                    lonMin = lonMax - .001
                    document.getElementById("lon_min").value = lonMin
                }
            }
            rect.setBounds([[latMin, lonMin], [latMax, lonMax]]);
            rect.editing.enable();
            return {"South":latMin,"West":lonMin,"North":latMax,"East":lonMax}
        }
        function chooseColor(archiveType){
            archiveType = archiveType.toString();
            var color1 = colorPal[archiveType]
            if (typeof color1 !== 'undefined'){
                return color1
            } else {
                //console.log(archiveType)
                return "black"
            }
        }
        function chooseShape(archiveType){
            archiveType = archiveType.toString();
            var shape1 = shapePal[archiveType]
            if (typeof shape1 !== 'undefined'){
                return shape1
            } else {
                //console.log(archiveType)
                return "diamond"
            }
        }
        function chooseOpacity(coords, rect1){
            //rectSW = regExp.exec(rect._bounds._southWest)[1]
            //rect1 = changeBoxCoord()
            var point = regExp.exec(coords)[1]
            var pointLat = dec4(point.split(',')[0])
            var pointLon = dec4(point.split(',')[1])
        
            if (+pointLat > +rect1.South && +pointLat < +rect1.North && +pointLon > +rect1.West && +pointLon < +rect1.East){
                inRectCount = inRectCount + 1
                return 0.8
            } else {
                return 0.1
            }
        }
        function changeBoxCoord(){
            var SW = regExp.exec(rect._bounds._southWest)[1]
            var South = dec4(SW.split(',')[0])
            var West = dec4(SW.split(',')[1])
            //var South = dec4(0)
            //var West = dec4(-90)
            var NE = regExp.exec(rect._bounds._northEast)[1]
            var North = dec4(NE.split(',')[0])
            var East = dec4(NE.split(',')[1])
            //var North = dec4(45)
            //var East = dec4(0)
            //var newCoords = South + ', ' + West + ', ' + North + ', ' + East
            var rectWidth = +(East-West)
            rect.editing.disable();
            if (North > 90){
                    rect.setBounds([[South, West], [90, East]]);
        
            }
            if (South < -90){
        
                    rect.setBounds([[-90, West], [North, East]]);
                
            }
            if (West < -360){
        
                    rect.setBounds([[South, -360], [North, East]]);
        
            }
            if (East > 360){
        
                    rect.setBounds([[South, West], [North, 360]]);
                
            }
            if (rectWidth > 360){
                if (West < -360){
                    var newWest = +(+East - 360)
                    rect.setBounds([[South, newWest], [North, East]]);
                } else {
                    var newEast = +(+West + 360)
                    rect.setBounds([[South, West], [North, newEast]]);
                }
                
            }
            
                
            document.getElementById("lat_min").value = South
            document.getElementById("lat_max").value = North
            document.getElementById("lon_min").value = West
            document.getElementById("lon_max").value = East
            rect.editing.enable();
            return {"South":South,"West":West,"North":North,"East":East}
        }
        function loadLatLon (a1){
            var x1 = a1.filter((arr, index, self) =>
            index === self.findIndex((t) => (t.geo_latitude === arr.geo_latitude && t.geo_longitude === arr.geo_longitude)))
            var geojson = {
            "name":"NewFeatureType",
            "type":"FeatureCollection",
            "features": [],
            };
        var numdata = +Object.values(x1).length
        var numPoints = +(numdata * 2)
            
          for (let i = 0; i < numPoints; i++) {
            if (i >= numdata){
                ii = i - numdata
            } else {
                ii = i
            }
            var ptLon = +Object.values(x1)[ii].geo_longitude
            if (i < numdata){
                lat = Object.values(x1)[ii].geo_latitude
                    lon = Object.values(x1)[ii].geo_longitude
            } else if (i >= numdata && ptLon < 0) {
                lat = Object.values(x1)[ii].geo_latitude
                    lon = (ptLon + 360)
            } else {
                lat = Object.values(x1)[ii].geo_latitude
                    lon = (ptLon - 360)
            }
            aType = Object.values(x1)[ii].archiveType
            dName = Object.values(x1)[ii].dataSetName
            dID = Object.values(x1)[ii].datasetId
            proxy1 = Object.values(x1)[ii].paleoData_proxy
            minAge = Object.values(x1)[ii].minAge
            maxAge = Object.values(x1)[ii].maxAge
            geojson.features.push({ "type": "Feature","geometry": {"type": "Point","coordinates": []},"properties": {"archiveType": [], "dataSetName": [], "paleoData_proxy": [], "minAge": [], "maxAge": [], "datasetId": []} });
            geojson.features[i].geometry.coordinates.push(lon,lat);
            geojson.features[i].properties.archiveType.push(aType);
            geojson.features[i].properties.dataSetName.push(dName);
            geojson.features[i].properties.datasetId.push(dID);
            geojson.features[i].properties.paleoData_proxy.push(proxy1);
            geojson.features[i].properties.minAge.push(minAge);
            geojson.features[i].properties.maxAge.push(maxAge);
          }
        
          return(geojson)
        }
        function updatePoints (coords){
            spinner.spin();
            inRectCount = 0;
            layerGroup.clearLayers();
            if (!document.getElementById("coordsOn").checked) {
                document.getElementById("lat_min").value = -90
                document.getElementById("lat_max").value = 90
                document.getElementById("lon_min").value = -180
                document.getElementById("lon_max").value = 180
                //rect = L.rectangle([[-90, 90], [-360, 360]], {fillOpacity:0});
                updateBoundingBox();
                rectCoord = {"South":-90,"West":-180,"North":90,"East":180};
                rect.editing.disable();
                
            } else {
                rect.editing.enable();
                rectCoord = changeBoxCoord();
            }
         L.geoJSON([loadLatLon(coords)], {
        
                        style : function(feature) {
                            return feature.properties && feature.properties.style;
                        },
        
                        onEachFeature: function (feature, layer) {
                    layer.bindPopup('<h1>'+feature.properties.dataSetName+'</h1><p><b>Archive Type: </b>'+feature.properties.archiveType+'<br><a href="https://lipdverse.org/data/'+feature.properties.datasetId+'" target="_blank">Dataset URL</a><br><b>Proxies: </b>'+feature.properties.paleoData_proxy+'<br><b>Mix/Max Age: </b>'+feature.properties.minAge+' / '+feature.properties.maxAge+' yr BP</p><iframe src="https://lipdverse.org/data/pnImKbqSb45N6vABnwoD/1_0_13/paleoPlots.html" height="200" width="600" title="paleoData Plot"></iframe>', {
                           maxWidth : 600
                    });
                },
        /*
                    filter: function(feature, layer) {
                         return feature.properties.archiveType == 'Wood';
                    },
        */
                        pointToLayer : function(feature, latlng) {
                    var col1 = chooseColor(feature.properties.archiveType)
                    var aType = feature.properties.archiveType
                    var shape1 = chooseShape(feature.properties.archiveType)
                    var Opac1 = +chooseOpacity(latlng, rectCoord)
                    var radius1 = 4
                    if (aType == "Documents"){
                        radius1 = 6
                    }
                    if (aType == "GroundIce" && Opac1 == 0.8){
                        return L.marker(latlng, {
                            icon: groundIce
                        });
                    } else if (aType == "GlacierIce" && Opac1 == 0.8){
                        return L.marker(latlng, {
                            icon: glacierIce
                        });
                    } else if (aType == "GroundIce" && Opac1 == 0.1){
                        return L.marker(latlng, {
                            icon: groundIceOpac
                        });
                    } else if (aType == "GlacierIce" && Opac1 == 0.1){
                        return L.marker(latlng, {
                            icon: glacierIceOpac
                        });
                    } else {
                                    return L.shapeMarker(latlng, {
                            //icon: chooseIcon(feature.properties.archiveType)
                            
                                        radius : radius1,
                                        fillColor : col1,
                                        color : col1,
                                        weight : 1,
                            fillOpacity : Opac1,
                            shape : shape1,
                            opacity : 0.1
                            
                                    });
                    }
                        }
                    }).addTo(layerGroup);
            spinner.stop();
            document.getElementById("datasetCount").innerHTML = "Total datasets in query: " + inRectCount
        }
        function rmBlanks(val){
            if (val.length > 0) {
                val = split(val)
                val = val.filter(Boolean)
                    val = val.join( "," );
            }
        return val;
    }
        
    function qString(val1,name1){
        
        var x1 = rmBlanks(val1)
        
        if (x1.length == 0){
            return '';
        } else {
            return name1 + '=' + x1;
        }
    
    }
    arrayGrep = function (arr1, arr2, selectedString){
        var indices = [];
        for (var i=0; i < arr1.length; i++){
            if (arr1.at(i).includes(selectedString)){
            indices.push(i)
          }
        }
        var arr3 = indices.map(i => arr2[i]);
        arr3 = arr3.filter(n => n)
        arr3 = arr3.sort()
        return arr3.at(-1)
        }
        getAllMonths = function(startSpan,endSpan){
            var monthText = seasonality2.map(function(d) { return d.label; });
            var allMonths = [];
          startSpan=startSpan-1
          //var spanMax = (endSpan-startSpan)+1
          for (var i=startSpan; i < endSpan; i++){
            var startmonth = monthText[i]
            var monthSpan = endSpan - i
            for (var ii=0; ii < monthSpan; ii++){
              var endMonth = monthText[(ii+i)]
              if (startmonth==endMonth){
                allMonths.push(startmonth)
              } else {
                allMonths.push(startmonth + "-" + endMonth)
              }
            }
          }
          allMonths = allMonths.join(",")
          return(allMonths)
        }
        function params(useCoords=false){
            var x1 = rmBlanks(document.getElementById("archiveTypeIn").value)	    
            var x2 = rmBlanks(document.getElementById("variableName").value)
            qstring = '?'
            qstring = qstring + qString(document.getElementById("archiveTypeIn").value,document.getElementById("archiveTypeIn").name,false)
            qstring = qstring + '&' + qString(document.getElementById("variableName").value,document.getElementById("variableName").name,false)
            qstring = qstring + '&' + qString(document.getElementById("proxy").value,document.getElementById("proxy").name,false)
            qstring = qstring + '&' + qString(document.getElementById("countryIn").value,document.getElementById("countryIn").name,false)
            qstring = qstring + '&' + qString(document.getElementById("continentIn").value,document.getElementById("continentIn").name,false)
            qstring = qstring + '&' + qString(document.getElementById("compilationIn").value,document.getElementById("compilationIn").name,true)
            if (!JSON.parse(filters1['seasonality'])){
                qstring = qstring + '&' + qString(document.getElementById("seasonality1").value,document.getElementById("seasonality1").name,false)
            }
            if (useCoords=true){
                if (JSON.parse(filters1['coords'])){
                    qstring = qstring + '& geo_latitude < ' + document.getElementById("lat_max").value
                    qstring = qstring + '& geo_latitude > ' + document.getElementById("lat_min").value
                    qstring = qstring + '& geo_longitude < ' + document.getElementById("lon_max").value
                    qstring = qstring + '& geo_longitude > ' + document.getElementById("lon_min").value
                }
            }
            if (JSON.parse(filters1['ages'])){
                
                qstring = qstring + '& minAge < ' + document.getElementById("time_range_to_reconstruct_fromInput").value
                qstring = qstring + '& maxAge > ' + document.getElementById("time_range_to_reconstruct_toInput").value
            }
            if (JSON.parse(filters1['resolution'])){
                qstring = qstring + '& medianResolution < ' + document.getElementById("resolutionInput").value
            }
            if (JSON.parse(filters1['terrestrial'])){
                qstring = qstring + '& isTerrestrial=' + +document.getElementById("Terrestrial").checked
            }
            if (JSON.parse(filters1['seasonality'])){
                qstring = qstring + '& ' + document.getElementById("seasonality1").name + "=" + rmBlanks(document.getElementById("seasonality1").value + "," + getAllMonths(document.getElementById("months_range_fromSlider").value,document.getElementById("months_range_toSlider").value))
            }
            console.log("qstring from params(): " + qstring)
            return qstring;
        };
        sendQuery = function(){
            var param1 = params(useCoords=false)
            var xhr0 = new XMLHttpRequest();
                xhr0.timeout = 2000;
                xhr0.onreadystatechange = function(e){
                    //console.log(this);
                    if (xhr0.readyState === 4){
                        if (xhr0.status === 200){
                    const promise1 = new Promise((resolve, reject) => {
                        console.log("query: " + param1)
                        prevResp = updateRes(JSON.parse(xhr0.response));
                            
                        resolve();
                    });
                    promise1.then(() => {
                      updatePoints(prevResp)
                      xhr0 = null;
                      // Expected output: "Success!"
                    });
                        } else {
                    const promise1 = new Promise((resolve, reject) => {
                        console.log("XHR didn't work: " + xhr0.status);
                        resolve();
                    });
                    
                    promise1.then(() => {
                      xhr0 = null;
                      // Expected output: "Success!"
                    });
                    
                            
                        }
                    }
                }
                xhr0.ontimeout = function (){
                    console.error("request timedout: ", xhr0);
                }
                xhr0.open("get", "http://143.198.98.66:88/" + param1, /*async*/ true);
                // xhr.responseType = "text";
                xhr0.send();
            }
        

        
        postTSids = function(Body){
                var xhr7 = new XMLHttpRequest();
                //xhr.timeout = 2000;
                return new Promise((resolve, reject) => {
                    xhr7.onreadystatechange = (e) => {
                    if (xhr7.readyState !== 4) {
                        return;
                    }
                    if (xhr7.status === 200){
                        //console.log("time series: ");
                        //console.log(xhr.responseText);
                        resolve(xhr7.responseText);
                    } else {
                        var resp1 = "XHR didn't work: " + xhr7.status;
                        console.log(resp1);
                        resolve();
                    }
                };
                xhr7.open("post", "http://143.198.98.66:92/", /*async*/ true);
                xhr7.setRequestHeader("Content-type", "application/json");
                xhr7.send(Body);
                });
        }
            
        getTSIDs = function(){
            
                var xhr2 = new XMLHttpRequest();
                //xhr.timeout = 2000;
                return new Promise((resolve, reject) => {
                    if (document.getElementById("archivedCompilation").checked) {
                        resolve();
                    } else {
                            xhr2.onreadystatechange = (e) => {
                            if (xhr2.readyState !== 4) {
                                return;
                            }
                            if (xhr2.status === 200){
                                //console.log("TSIDs: ");
                                //console.log(xhr.responseText);
                                resolve(xhr2.responseText);
                            } else {
                                var resp1 = "XHR didn't work: " + xhr2.status;
                                console.log(resp1);
                                resolve();
                            }
                        };
                        xhr2.open("get", "http://143.198.98.66:88/TS" + params(useCoords=true), /*async*/ true);
                        xhr2.send();
                    }
                    });
        }
        
        retTimeSeries = function(TSIDs){
                var xhr3 = new XMLHttpRequest();
                //xhr.timeout = 2000;
                return new Promise((resolve, reject) => {
                    xhr3.onreadystatechange = (e) => {
                    if (xhr3.readyState !== 4) {
                        return;
                    }
                    if (xhr3.status === 200){
                        //console.log("time series: ");
                        //console.log(xhr.responseText);
                        resolve(xhr3.responseText);
                    } else {
                        //var resp1 = xhr.status;
                        console.log(xhr3.status);
                        resolve(xhr3.status);
                    }
                };
                xhr3.open("post", "http://143.198.98.66:89/sparql", /*async*/ true);
                xhr3.setRequestHeader("Content-type", "application/json");
                xhr3.send(TSIDs);
                });
        }
        
        function writeCSV(json1){
            console.log(json1)
            json1 = JSON.parse(JSON.parse(json1))
            //console.log(typeof json1)
            var keys1 = Object.keys(json1)
            /*
            if (keys1.length > 100){
                var alertText = "Preparing csv file with " + keys1.length + " records"
                alert(alertText);
            }
             */
            //console.log(keys1.length)
            var numKeys = keys1.length;
            var len1 = 0;
            var lenMax = 0;
            for (let i=0; i < numKeys; i++){
            len1 = Object.values(json1)[i].length
            if (len1 > lenMax){
            lenMax = len1
            }
            }
            //console.log(lenMax)
            
            var string1 = keys1.join(", ") + "\n"
            for (let j=0; j<lenMax; j++){
                for (var key of keys1){
                  var val1 = Object.values(json1[key])[j]
                if (typeof val1 === "undefined"){
                    string1 += ","
                } else {
                    string1 += val1 + ","
                }
              }
              string1 += "\n"
            }
            return string1
        }
        
        function downloadCurrentDocument(resp1) {
          var csvContent = encodeURI(writeCSV(resp1)),
              a = document.createElement('a'),
              e = new MouseEvent('click');
        
          a.download = 'PrestoTS.csv';
          a.href = 'data:text/csv;charset=utf-8,' + csvContent;
          a.dispatchEvent(e);
        }
        

            
        function grabCSV() {
            getTSIDs().then(reso => {
                var resoJSON = JSON.parse(reso);
                var IDs = resoJSON.map(function(d) { return d['paleoData_TSid']; })
                if (IDs.length > 300){
                    var alertText = "Sorry, " + IDs.length + " is too many records to compile here"
                    alert(alertText);
                } else {
                    console.log("Total time series: " + IDs.length);
                    var tsJSON = '{"TSIDs": ' + JSON.stringify(IDs) + '}'
                    var TS1 = retTimeSeries(tsJSON).then(resp1 => {
                    downloadCurrentDocument(resp1);
                    return true
                    });
                }
            });
        }
        function getColor(d) {
            return d > 1000 ? '#800026' :
                   d > 500  ? '#BD0026' :
                   d > 200  ? '#E31A1C' :
                   d > 100  ? '#FC4E2A' :
                   d > 50   ? '#FD8D3C' :
                   d > 20   ? '#FEB24C' :
                   d > 10   ? '#FED976' :
                              '#FFEDA0';
        }
            const compileLipds = function(Body) {
            return new Promise((resolve, reject) => {
                var xhr1 = new XMLHttpRequest();
        
                xhr1.onreadystatechange = () => {
                    if (xhr1.readyState !== 4) return;
        
                    if (xhr1.status === 200) {
                        resolve(xhr1.responseText);
                    } else {
                        console.error("XHR didn't work: " + xhr1.status);
                        reject(new Error("XHR failed with status " + xhr1.status));
                    }
                };
        
                xhr1.onerror = () => {
                    reject(new Error("XHR encountered a network error"));
                };
        
                xhr1.ontimeout = () => {
                    reject(new Error("XHR request timed out"));
                };
        
                xhr1.open("POST", "http://143.198.98.66:90/lipds", true);
                xhr1.setRequestHeader("Content-type", "application/json");
        
                xhr1.timeout = 5000; // Set a timeout (optional)
                
                xhr1.send(Body);
            });
        };
        function getLipds(loc1, lipdSource){
            return new Promise((resolve, reject) => {
                //alert(params(useCoords=true))
                getTSIDs().then(reso => {
                    if (lipdSource == 'TSIDs'){
                        var resoJSON = JSON.parse(reso);
                        var IDs = resoJSON.map(function(d) { return d['paleoData_TSid']; })
                        console.log("Total time series: " + IDs.length);
                        var tsJSON = '{"TSIDs": ' + JSON.stringify(IDs) + ',"recon":"' + document.getElementById('recon').value + '", "uniqueID":"' + document.getElementById('uniqueID').value + '", "language":"'  + document.getElementById('language').value + '"}'
                        console.log("json body sent to 'getLipds': " + tsJSON)
                        console.log("sending post TSids")
                        //postTSids(tsJSON);
                        var TSIDsArray = JSON.parse(tsJSON).TSIDs
                        var numTSids = TSIDsArray.length
                    } else {
                        const archivedCompURL = 'https://lipdverse.org/' + document.getElementById('archivedCompilationIn').value + '/' + document.getElementById('archivedCompilationVersionIn').value
                        var tsJSON = '{"compilation": "' + document.getElementById('archivedCompilationIn').value + '", "version": "' + document.getElementById('archivedCompilationVersionIn').value + '", "recon": "' + document.getElementById('recon').value + '", "uniqueID":"' + document.getElementById('uniqueID').value + '", "language":"'  + document.getElementById('language').value + '"}'
                        console.log("sending post for archived compilation: ", tsJSON)
                    }
                    compileLipds(tsJSON)
                        .then(response => {
                            console.log("Success:", response);
                        if (loc1 == "donwload"){
                            resolve("https://www.google.com")
                        } else {
                            var queryParams = params(useCoords=true)
                            queryParams = '&' + queryParams.substring(1);
                            queryParams = queryParams.replace(/\s/g, '');
                            resolve("http://143.198.98.66:85/querypath"+window.location.search+queryParams)
                        }
                        })
                        .catch(error => {
                            console.error("Error:", error.message);
                        alert("Error: failed to write data selection to server. Please start over.");
                        resolve("https://paleopresto.com/custom.html");
                        });
                });
            });
        }
