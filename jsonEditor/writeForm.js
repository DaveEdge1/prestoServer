var fs = require('fs')
var YAML = require('yaml')
var bodyParser = require('body-parser')
const prompt = require('prompt-sync')();

reconTitle = function(recon){
	var reconTitles = fs.readFileSync("/root/presto/jsonEditor/reconTitles.json")
	var titlesJSON = JSON.parse(reconTitles)
	console.log(titlesJSON[recon])
	console.log(titlesJSON, recon)
	return(titlesJSON[recon])
}

var jsExt = fs.readFileSync("/root/presto/jsonEditor/public/slider.js", function (err, data) {   
	    if (err) throw err;   console.log(data); 
	  });

var htmlHeader = fs.readFileSync("/root/presto/jsonEditor/public/header.txt", function (err, data) {
	            if (err) throw err;   console.log(data);
	          });

var htmlFooter = fs.readFileSync("/root/presto/jsonEditor/public/footer.txt", function (err, data) {
	            if (err) throw err;   console.log(data);
	          });

var buildJS = function(a, b, c, d){
	                jsExt =jsExt
	                + 'const ' + a + ' = document.getElementById("' + a + '");\n'
	                + 'const ' + b + ' = document.getElementById("' + b + '");\n'
	                + 'const ' + c + ' = document.getElementById("' + c + '");\n'
	                + 'const ' + d + ' = document.getElementById("' + d + '");\n'
	                + 'fillSlider(' + a + ', ' + b + ', "#C6C6C6", "#896A67", ' + b + ');\n'
	                + 'setToggleAccessible(' + b + ');\n'

	                + a + '.oninput = () => controlFromSlider(' + a + ', ' + b + ', ' + c + ');\n'
	                + b + '.oninput = () => controlToSlider(' + a + ', ' + b + ', ' + d + ');\n'
	                + c + '.onchange = () => controlFromInput(' + a + ', ' + c + ', ' + d + ', ' + b + ');\n'
	                + d + '.onchange = () => controlToInput(' + b + ', ' + c + ', ' + d + ', ' + b + ');\n'
	        return(jsExt)
}

jsExt2 = '';

var buildJS2 = function(a, b){
	                        jsExt2 = jsExt2
	                        + 'const ' + a + ' = document.getElementById("' + a + '");\n'
	                        + 'const ' + b + ' = document.getElementById("' + b + '");\n'
	                        + a + '.oninput = () => changeInput(' + a + ', ' + b + ');\n'
	                        + b + '.onchange = () => changeSlider(' + b + ', ' + a + ');\n'
	                        + 'fillSingleSlider(' + a + ')\n'
	                return(jsExt2)
}

jsExt3 = '';

buildJS3 = function(id) {
	jsExt3 = jsExt3
	+ 'var ' + id + '_checkCycle = 0;\n'
	+ 'function ' + id + '_incrementCheckCycle(){\n'
	+ id + '_checkCycle = ' + id + '_checkCycle+1;\n'
	+ 'return (' + id + '_checkCycle);\n'
	+ '}\n'
	return (jsExt3)
}

jsExt4 = '';

buildJS4 = function(mapNum, mapMax) {
	jsExt4 = jsExt4
	+ 'updateRect(' + mapNum + ', '  + mapMax + ')\n'
	return(jsExt4)
}

const configs = function (recon) {
    const s = fs.readFileSync('/root/presto/prestoForm/' + recon + '/configs.yml','utf8');
    return YAML.parse(s)
}

const formIntro = function (recon) {
	const z = fs.readFileSync('/root/presto/prestoForm/' + recon + '/formIntro.txt','utf8');
	return (z)
}

//write the html for list keys
function allOpts(defaults, opts, inType, id1) {
	var options = ''
	for (var opt in opts){
	   options = options
           + '<div class=check-item>\n'
	   if (defaults === null){
	      options = options
	      + '<input name="'+id1+'" class="' + inType + '-1" type="' + inType + '" value="' + opts[opt] + '" id = "' + opts[opt] + '">\n'
           }
	   else if (defaults.indexOf(opts[opt]) >= 0){
	      options = options
	      + '<input name="'+id1+'" class="' + inType + '-1" type="' + inType + '" value="' + opts[opt] + '" checked id = "' + opts[opt] + '">\n'
	   }else{
	      options = options
	      + '<input name="'+id1+'" class="' + inType + '-1" type="' + inType + '" value="' + opts[opt] + '" id = "' + opts[opt] + '">\n'
	   }
	   options = options
	   + '<label style="font-size:14px;" for="' + opts[opt] + '">' + opts[opt] + '</label>\n'
	   + '</div>\n'
        }
	return (options);
}

function urlHTML (url1) {
	var urlHTML1 = ''
	if (url1 === null){
		               } else {
				 urlHTML1 = urlHTML1
				 + '<div>\n'
				 + '<a class="a-URL" target="_blank" href=' + url1 + '>more info</a>\n'
				 + '</div>\n'
				 + '<br>\n'
			       }
	return(urlHTML1)

}

function stepLen(max, min, numSteps) {
	  var num = max - min;
	  var stop = num/2;
	  var arr = [];
	  var arr0 = [];
	  var arrDiff = [];
	  for (var i = 2; i <= stop; i += 1) {
		  if ((num % i) == 0) {
		        arr.push(num / i);
			arr0.push(i);
		  }
	  }
	  for (let z = 0; z < arr.length; z++) {
		  arrDiff.push(Math.abs(numSteps-arr0[z]))
	  }
	var indexNearest20 = arrDiff.indexOf(Math.min(...arrDiff))

	  return arr[indexNearest20];
	//return(Math.min(...arrDiff));
}


function dataTypeHTML (configJSON, key, id1) {
	var dataHTML = ''
	if (configJSON[key].data_type === 'free-form'){
		dataHTML = dataHTML
		+ '<input style="font-size:14px;" type="text" class="form-control" id="' + id1 + '" aria-describedby="emailHelp" value="' + configJSON[key].value + '" name="' + id1 + '">\n'
	} else if (configJSON[key].data_type === 'character'){
		                dataHTML = dataHTML
		                + '<div name="' + id1 + '" id="' + id1 + '" class="form-radio">\n'
		                + allOpts(configJSON[key].default, configJSON[key].options, 'radio', id1)
		                + '</div>\n'
		                + '<br>\n'
		                + '<br>\n'
		                + '<br>\n'
        } else if (configJSON[key].data_type === 'lat-lon'){
		var canvasHeight = 540
		if (configJSON[key].options[0] == "double"){
			var canvasHeight = 270
		}
		var mapLoc = '/SimpleWorld' + configJSON[key].options[0] + configJSON[key].options[1] + '.png'
		buildJS4(configJSON[key].options[0],configJSON[key].options[1]);
		console.log(key)
		console.log("mapMax: " + configJSON[key].options[1]);
		console.log("defaults: " + configJSON[key].default + " limits: " + configJSON[key].limits)
		dataHTML = dataHTML
		+ '<p style="color: red;">Hint: At the four corners of the map, you will find draggable handles<p>\n'
		+ '<div class="mapall-container">\n'
		+ '<canvas id="canvas" width="1080" height="' + canvasHeight + '" style="margin-right:10px; background: url(' + mapLoc + ')"></canvas>\n'
		+ '<div class="map-numeric">\n'
		+ '<label style="font-size:16px; margin-right:8px;">Latitude</label>\n'
		+ '<input style:"-moz-appearance: textfield;" class="coord-input" type="number" name="'+id1+'" id="lat_min" value="' + configJSON[key].default[0] + '" min="' + configJSON[key].limits[0] + '" max="' + configJSON[key].limits[1] + '" step="' + configJSON[key].precision + '" onchange="updateRect(' + configJSON[key].options[1] + ');">\n'
		+ '<label style="margin-right:8px;">min</label>\n'
		+ '<input class="coord-input" type="number" name="'+id1+'" id="lat_max" value="' + configJSON[key].default[1] + '" min="' + configJSON[key].limits[0] + '" max="' + configJSON[key].limits[1] + '" step="' + configJSON[key].precision + '" onchange="updateRect(' + configJSON[key].options[1] + ');">\n'
		+ '<label style="margin-right:30px;">max</label>\n'
		+ '<label style="font-size:16px; margin-right:8px;">Longitude</label>\n'
		+ '<input class="coord-input" type="number" name="'+id1+'" id="lon_min" value="' + configJSON[key].default[2] + '" min="' + configJSON[key].limits[2] + '" max="' + configJSON[key].limits[3] + '" step="' + configJSON[key].precision + '" onchange="updateRect(' + configJSON[key].options[1] + ');">\n'
		+ '<label style="margin-right:8px;">min</label>\n'
		+ '<input class="coord-input" type="number" name="'+id1+'" id="lon_max" value="' + configJSON[key].default[3] + '" min="' + configJSON[key].limits[2] + '" max="' + configJSON[key].limits[3] + '" step="' + configJSON[key].precision + '" onchange="updateRect(' + configJSON[key].options[1] + ');">\n'
		+ '<label>max</label>\n'
		+ '</div>\n'
		+ '</div>\n'
	} else if (configJSON[key].data_type === 'list'){
		buildJS3(id1);
	        dataHTML = dataHTML
	        + '<div name="' + id1 + '" id="' + id1 + '" class="form-check">\n'
	        + allOpts(configJSON[key].default, configJSON[key].options, 'checkbox', id1)
	        + '</div>\n'
		+ '<div class="checkall-container">\n'
		+ '<div class="checkAll">\n'
		+ '<input type="button" value="check/uncheck all" class="check-uncheck"  onclick="uncheckAll(\'' + id1 + '\', ' + id1 + '_incrementCheckCycle());" >\n'
		+ '</div>\n'
		+ '</div>\n'
		+ '<br>\n'
	} else if (configJSON[key].data_type === 'boolean') {
		if (Boolean(configJSON[key].default)){
			dataHTML = dataHTML
			+ '<div class="boolean_container">\n'
			+ '<input id="' + id1 + '" type = "radio" value="true" name="'+id1+'" checked>\n'
			+ '<label for="true">True</label><br>\n'
			+ '<input id="' + id1 + '" type = "radio" value="false" name="'+id1+'">\n'
			+ '<label for="false">False</label><br>\n'
			+ '</div>\n'
		} else {
			dataHTML = dataHTML
			+ '<div class="boolean_container">\n'
			+ '<input id="' + id1 + '" type = "radio" value="true" name="'+id1+'">\n'
			+ '<label for="true">True</label><br>\n'
			+ '<input id="' + id1 + '" type = "radio" value="false" name="'+id1+'" checked>\n'
			+ '<label for="false">False</label><br>\n'
			+ '</div>\n'
		}
	} else if (configJSON[key].data_type === 'numeric'){
	        var a2 = id1 + 'Silder';
	        var b2 = id1 + 'Input';
		var sliderStep = stepLen(configJSON[key].limits[1], configJSON[key].limits[0], 20)
	        buildJS2(a2, b2);
	        dataHTML = dataHTML
	        + '<div class="range_container">\n'
	        + '<div class="sliders_control">\n'
	        + '<input id="' + a2 + '" type="range" value="' + configJSON[key].default + '" min="' + configJSON[key].limits[0] + '" max="' + configJSON[key].limits[1] + '" step="' + sliderStep + '"/>\n'
	        + '<br>\n'
	        + '<input type="number" id="' + b2 + '" name="'+id1+'" value="' + configJSON[key].default + '" min="' + configJSON[key].limits[0] + '" max="' + configJSON[key].limits[1] + '" step="' + configJSON[key].precision + '"/>\n'
	        + '</div>\n'
	        + '</div>\n'
	} else if (configJSON[key].data_type === 'range'){
	        var a1 = id1 + '_fromSilder';
	        var b1 = id1 + '_toSilder';
	        var c1 = id1 + '_fromInput';
	        var d1 = id1 + '_toInput';
		var sliderStep = stepLen(configJSON[key].limits[1], configJSON[key].limits[0], 20)
	        buildJS(a1, b1, c1, d1);
	        dataHTML = dataHTML
	        + '<div class="range_container">\n'
	        + '<div class="sliders_control">\n'
	        + '<input id="' + a1 + '" type="range" value="' + configJSON[key].default[0] + '" min="' + configJSON[key].limits[0] + '" max="' + configJSON[key].limits[1] + '" step="' + sliderStep + '"/>\n'
	        + '<input id="' + b1 + '" type="range" value="' + configJSON[key].default[1] + '" min="' + configJSON[key].limits[0] + '" max="' + configJSON[key].limits[1] + '" step="' + sliderStep + '"/>\n'
	        + '</div>\n'
	        + '<br>\n'
	        + '<div class="form_control">\n'
	        + '<div class="form_control_container">\n'
	        + '<div class="form_control_container__time">Min</div>\n'
	        + '<input class="form_control_container__time__input" name="'+id1+'" type="number" id="' + c1 + '" value="' + configJSON[key].default[0] + '" min="' + configJSON[key].limits[0] + '" max="' + configJSON[key].limits[1] + '" step="' + configJSON[key].precision + '"/>\n'
	        + '</div>\n'
	        + '<div class="form_control_container">\n'
	        + '<div class="form_control_container__time">Max</div>\n'
	        + '<input class="form_control_container__time__input" name="'+id1+'" type="number" id="' + d1 + '" value="' + configJSON[key].default[1] + '" min="' + configJSON[key].limits[0] + '" max="' + configJSON[key].limits[1] + '" step="' + configJSON[key].precision + '"/>\n'
		+ '</div>\n'
	        + '</div>\n'
	        + '</div>\n'
	} else {
		console.log("data_type: " + configJSON[key].data_type + " not known")
	}
	return(dataHTML)
}

function finishFormElementHTML() {
	var formEl = ''
	formEl = formEl
	+ '<br>\n'
	+ '<hr class="solid">\n'
	+ '<hr class="solid">\n'
	+ '<br>\n'
	+ '</div>\n'
	return(formEl)
}

function removeExperimental (configFile) {
	var newConfig = configFile;
	for (var key1 in configFile) {
		var configJSON = configFile[key1]
		            for (var key in configJSON) {
				    if (configJSON[key].complexity === 'experimental'){
					    newConfig[key1][key] = null;
				    }
				    else {
				    }
			    }
	}
	return (newConfig)
}

function checkAll (configCat) {
	var countNotNull = 0;
		for (key in configCat){
			if (configCat[key] == null){
			} else {
				countNotNull = countNotNull + 1;
			}
		
	}
	return(countNotNull)
}

const headings = function (key) {
	        const s = fs.readFileSync('/root/presto/jsonEditor/headings.json','utf8');
	        var keyval = JSON.parse(s)        
	        return keyval[key]
}

//write the html form
function writeBody (configJSON1) {
	var configJSON1 = removeExperimental(configJSON1)
	var body = ''
        for (var key1 in configJSON1) {
		if (checkAll(configJSON1[key1]) == 0){
		} else {
		body = body
	        + '<button type="button" class="collapsible">' + headings(key1) + '</button>\n'
		+ '<div class="content">\n'
		+ '<br>\n'
		+ '<br>\n'
          if (configJSON1.hasOwnProperty(key1)) {
	    var configJSON = configJSON1[key1]
            for (var key in configJSON) {
	      var id1 = key1 + "_" + key
	    if (configJSON[key] == null) {
	    } else {
	    if (configJSON[key].complexity === 'advanced'){
               body = body
	       + '<div class="form-group-advanced">\n'
	       + '<label style="font-size:20px; padding-right:10px; color:black" for="' + id1 +  '">' + configJSON[key].long_name + ' (advanced) </label>\n'
	       + '<div class="hover-text">?\n'
	       + '<span class="tooltip-text">' + configJSON[key].description + '</span>\n'
	       + '</div>\n'
	       + urlHTML(configJSON[key].URL)
	       + dataTypeHTML(configJSON, key, id1)
	       + finishFormElementHTML()
	    }else if (configJSON[key].complexity === 'experimental'){
	       //body = body
	       //+ '<div class="form-group-experimental">\n'
	       //+ '<label style="font-size:20px; padding-right:10px; color:#5B6057" for="' + key +  '">' + configJSON[key].long_name + ' (experimental) </label>\n'
	       //+ '<div class="hover-text">?\n'
	       //+ '<span class="tooltip-text">' + configJSON[key].description + '</span>\n'
	       //+ '</div>\n'
	       //+ urlHTML(configJSON[key].URL)
	       //+ dataTypeHTML(configJSON, key)
	       //+ finishFormElementHTML()
            }else{
	       body = body
	       + '<div style: "vertical-align: middle; height: 50px;" class="form-group"> \n'
	       + '<label style="font-size:20px; padding-right:10px; color:black" id="' + id1 + '_label" for="' + id1 +  '">' + configJSON[key].long_name + ' </label>\n'
	       + '<div style: "vertical-align: middle; height: 50px;" class="hover-text">?\n'
	       + '<span class="tooltip-text">' + configJSON[key].description + '</span>\n'
	       + '</div>\n'
	       + urlHTML(configJSON[key].URL)
	       + dataTypeHTML(configJSON, key, id1)
	       + finishFormElementHTML()
	       }
	    }
	  }
	  }
          body = body
	  + '</div>\n'
        }
	}
	return(body);
}

function buildHtml(configs, recon) {

  return '<!DOCTYPE html>\n'
       + '<!--This html was generated by a script, writeForm.js, based on a yaml configuration file-->\n'
       + '<!--Credit to Predrag Davidovic for the dual slider: "https://medium.com/@predragdavidovic10/native-dual-range-slider-html-css-javascript-91e778134816"-->\n'
       + '<html lang="en">'
       + htmlHeader		
       + '<body>\n'
       + '<div class="wide" id="all">\n'
       + '<div class="top-bar py-0" id="topBar" style="background: #555"></div>\n'
       + '<!-- Navbar Sticky-->\n'
       + '<header class="nav-holder make-sticky">\n'
       + '<div class="navbar navbar-light bg-white navbar-expand-lg py-0" id="navbar">\n'
       + '<div class="container py-3 py-lg-0 px-lg-0">\n'
       + '<!-- Navbar brand--><a class="navbar-brand"><img class="d-none d-md-inline-block" src="/img/logo.png" alt="Universal logo"><img class="d-inline-block d-md-none" src="/img/logo-small.png" alt="Universal logo"><span class="sr-only">Universal - go to homepage</span></a> <!-- TODO: Update the logo. -->\n'//href="/"
       + '<!-- Navbar toggler-->\n'
       + '<button class="navbar-toggler text-primary border-primary" type="button" data-bs-toggle="collapse" data-bs-target="#navigationCollapse" aria-controls="navigationCollapse" aria-expanded="false" aria-label="Toggle navigation"><span class="sr-only">Toggle navigation</span><i class="fas fa-align-justify"></i></button>\n'
       + '<!-- Collapsed Navigation    -->\n'
       + '<div class="collapse navbar-collapse" id="navigationCollapse">\n'
       + '<ul class="navbar-nav ms-auto mb-2 mb-lg-0">\n'
       + '<a class="nav-link">Home</a>\n'//href="/"
       + '<!-- megamenu [features]-->\n'
       + '<li class="nav-item dropdown"><a class="nav-link dropdown-toggle" id="featuresMegamenu" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">Reconstructions</a>\n'
       + '<ul class="dropdown-menu megamenu p-4" aria-labelledby="featuresMegamenu">\n'
       + '<li class="nav-item"><a class="nav-link-sub py-2 text-uppercase">Holocene</a></li>\n'//href="holocene.html"
       + '<li class="nav-item"><a class="nav-link-sub py-2 text-uppercase">Common Era</a></li>\n'//href="common_era.html"
       + '</ul>\n'
       + '</li>\n'
       + '<!-- megamenu [portfolio]-->\n'
       + '<a class="nav-link">Analysis</a>\n'//href="analysis.html"
       + '<a class="nav-link">About Us</a>\n'//href="about.html"
       + '</ul>\n'
       + '</div>\n'
       + '</div>\n'
       + '</div>\n'
       + '</header>\n'
       + '<!-- HEADING BREADCRUMB-->\n'
       + '<section class="bg-pentagon py-4">\n'
       + '<div class="container py-3">\n'
       + '<div class="row d-flex align-items-center gy-4">\n'
       + '<div class="col-md-7">\n'
       + '<h1 class="h2 mb-0 text-uppercase">Custom Reconstrucions</h1>\n'
       + '</div>\n'
       + '<div class="col-md-5">\n'
       + '<!-- Breadcrumb-->\n'
       + '<ol class="text-sm justify-content-start justify-content-lg-end mb-0 breadcrumb undefined">\n'
       + '<li class="breadcrumb-item"><a class="text-uppercase">Home</a></li>\n'//href="/"
       + '<li class="breadcrumb-item text-uppercase active">Custom Reconstrucions</li>\n'
       + '</ol>\n'
       + '</div>\n'
       + '</div>\n'
       + '</div>\n'
       + '</section>\n'
       + '<div class="container">\n'
       + '<br>\n'
       + '<br>\n'
       + '<h1 style="font-size:30px; text-align:center">Customize ' + reconTitle(recon) + ' Parameters</h1>\n'
       + '<br>\n'
       + '<br>\n'
       + '<br>\n'
       + '<p style="font-size:16px">' + formIntro(recon) + '<p>\n'
       + '<br>\n'
       + '<br>\n'
       + '<form style="width:90%" id="formAd" name="formAd" onclick = "showAdv()" align="right">\n'
       + '<input style="margin-right:5px;" type="checkbox" name="display" id="advCheck" value=1>\n'
       + '<label for="advcheck">Show advanced options</label><br>\n'
       + '</form>\n'
       + '<br>\n'
       + '<br>\n'
       //+ '<form onSubmit="search();return false;" action="">\n'//action="/sendReconRequest" method="POST"
       + '<form id="paramsForm" method="POST" onsubmit="buildURL()">\n'
       + writeBody(configs) 
       + '<br>\n'
       + '<br>\n'
       + '<br>\n'
       + '<br>\n'
       + '<div class="button-submit">\n'
       + '<button style="height:50px; width:100px; font-size:20px" type="submit" class="btn btn-primary">Submit</button>\n'
       + '</div>\n'
       + '</form>\n'
       + '<script>\n'
       + 'function buildURL(){\n'
       + 'var urlParams = new URLSearchParams(window.location.search);\n'
       //+ 'document.getElementById('tableForm2').action = "/manualORdefault"\n'
       //+ 'document.getElementById("paramsForm").action = "/sendReconRequest?recon="
       + 'document.getElementById("paramsForm").action = "/sendReconRequest?recon=" + urlParams.get("recon") + "&uniqueID=" + urlParams.get("uniqueID") + "&user=" + urlParams.get("user") + "&domain=" + urlParams.get("domain")\n'
       + 'return confirm("Submit Custom Reconstruction request?");\n'
       + '}\n'
       + '</script>\n'
       + '<script>\n'
       + 'function val() {'
       + 'document.getElementById("abstract2").src = "/slider.css";'
       + '}\n'
       + '</script>\n'
       + '<script src="/slider' + recon + '.js"></script>\n'
       + '</div>\n'
       + '<br>\n'
       + '</body>\n'
       + htmlFooter
       + '</html>\n';

};

const recon = prompt('Which recon are we writing a form for?');
console.log(`Okay, writing new form for ${recon}`);

var html = buildHtml(configs(recon), recon);

fs.writeFile("/root/presto/jsonEditor/forms/" + recon  + ".html", html, function(err) {
	    if(err) {
		            return console.log(err);
		        }
	    console.log("The " + recon + ".html file was saved!");
}); 


fs.writeFile("/root/presto/jsonEditor/public/slider" + recon + ".js", jsExt + jsExt2 + jsExt3 + jsExt4, function(err) {
	            if(err) {
			                                return console.log(err);
			                            }
	            console.log("The slider" + recon + ".js file was saved!");
});


















