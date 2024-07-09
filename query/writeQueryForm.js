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

const recon = prompt('Which recon are we writing a form for?');
console.log(`Okay, writing new form for ${recon}`);

const htmlString = 
'<!DOCTYPE html>\n' +
'<html>\n' +
'<head>\n' +
'    <meta charset="utf-8" />\n' +
'    <title>Autocomplete Lipdverse Query</title>\n' +
'    <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'    <meta name="robots" content="noindex">\n' +
'    <link rel="stylesheet" href="//code.jquery.com/ui/1.11.0/themes/smoothness/jquery-ui.css">\n' +
'    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A==" crossorigin="">\n' +
'    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css">\n' +
'    <link rel="stylesheet" href="/style.default.css" id="theme-stylesheet">\n' +
'    <!--link rel="stylesheet" href="https://unpkg.com/@bopen/leaflet-area-selection@0.6.1/dist/index.css" /-->\n' +
'    <link rel="stylesheet" href="/leaflet.legend.css">\n' +
'    <link rel="stylesheet" href="/spinner.css">\n' +
'    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js" integrity="sha512-XQoYMqMTK8LvdxXYG3nZ448hOEQiglfqkJs1NOQV44cWnUrBc8PkAOcXy20w0vlaXaVUearIOBhiXZ5V3ynxwA==" crossorigin=""></script>\n' +
'    <link rel="stylesheet" href="/slider.css">\n' +
'    <script src="https://cdn.jsdelivr.net/npm/js-base64@3.7.6/base64.min.js"></script>\n' +
'    <!--script src="leaflet-src.js"></script-->\n' +
'    <script src="/Leaflet.draw.js"></script>\n' +
'    <script src="/Leaflet.Draw.Event.js"></script>\n' +
'    <script src="/TouchEvents.js"></script>\n' +
'    <script src="/Edit.SimpleShape.js"></script>\n' +
'    <script src="/Edit.Rectangle.js"></script>\n' +
'    <script src="/leaflet-svg-shape-markers.min.js"></script>\n' +
'    <script src="/leaflet.legend.js"></script>\n' +
'    <script src="/spin.js"></script>\n' +
'    <script language="javascript" type="text/javascript" src="/data_forge.js"></script>\n' +
'    <script type="text/javascript">\n' +
'        const urlParams = new URLSearchParams(window.location.search);\n' +
'        //var params1 = ""\n' +
'        var jsonPath = "/" + urlParams.get("recon") + "_params.json"\n' +
'        async function grabParams() {\n' +
'            const response = await fetch(jsonPath);\n' +
'            let params1 = await response.json();\n' +
'            //console.log("params1: " + Object.keys(params1));\n' +
'            return params1\n' +
'        }\n' +
'        /*\n' +
'        fetch(jsonPath)\n' +
'             .then(function(res){\n' +
'                 return res.json()\n' +
'             })\n' +
'             .then(function(data){\n' +
'                 console.log("data: " + JSON.stringify(data))\n' +
'                 params1 = data\n' +
'             })\n' +
'*/\n' +
'    </script>\n' +
'    <!--script src="https://unpkg.com/@bopen/leaflet-area-selection@0.6.1/dist/index.umd.js"></script-->\n' +
'    <style>\n' +
'        html, body {\n' +
'          height: 100%;\n' +
'          margin: 0;\n' +
'          padding: 0;\n' +
'        }\n' +
'        .leaflet-container {\n' +
'            display: block;\n' +
'            position: relative;\n' +
'            margin-left: auto;\n' +
'            margin-right: auto;\n' +
'            height: auto;\n' +
'            width: auto;\n' +
'            max-width: 90%;\n' +
'            max-height: 100%;\n' +
'        }\n' +
'    </style>\n' +
'</head>\n' +
'<body>\n' +
'<div class="wide" id="all">\n' +
'<div class="top-bar py-0" id="topBar" style="background: #555"></div>\n' +
'<!-- Navbar Sticky-->\n' +
'<header class="nav-holder make-sticky">\n' +
'<div class="navbar navbar-light bg-white navbar-expand-lg py-0" id="navbar">\n' +
'<div class="container py-3 py-lg-0 px-lg-0">\n' +
'<!-- Navbar brand--><a class="navbar-brand" href="https://paleopresto.com/"><img class="d-none d-md-inline-block" src="/img/logo.png" alt="Universal logo"><img class="d-inline-block d-md-none" src="/img/logo-small.png" alt="Universal logo"><span class="sr-only">Universal - go to homepage</span></a> <!-- TODO: Update the logo. -->\n' +
'<!-- Navbar toggler-->\n' +
'<button class="navbar-toggler text-primary border-primary" type="button" data-bs-toggle="collapse" data-bs-target="#navigationCollapse" aria-controls="navigationCollapse" aria-expanded="false" aria-label="Toggle navigation"><span class="sr-only">Toggle navigation</span><i class="fas fa-align-justify"></i></button>\n' +
'<!-- Collapsed Navigation    -->\n' +
'<div class="collapse navbar-collapse" id="navigationCollapse">\n' +
'<ul class="navbar-nav ms-auto mb-2 mb-lg-0">\n' +
'    <a class="nav-link" href="https://paleopresto.com/">Home</a>\n' +
'    <!-- megamenu [features]-->\n' +
'    <li class="nav-item dropdown"><a class="nav-link dropdown-toggle" id="featuresMegamenu" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">Reconstructions</a>\n' +
'    <ul class="dropdown-menu megamenu p-4" aria-labelledby="featuresMegamenu">\n' +
'        <li class="nav-item"><a class="nav-link-sub py-2 text-uppercase" href="https://paleopresto.com/holocene.html">Holocene</a></li>\n' +
'        <li class="nav-item"><a class="nav-link-sub py-2 text-uppercase" href="https://paleopresto.com/common_era.html">Common Era</a></li>\n' +
'    </ul>\n' +
'    </li>\n' +
'    <!-- megamenu [portfolio]-->\n' +
'    <a class="nav-link" href="https://paleopresto.com/analysis.html">Analysis</a>\n' +
'    <a class="nav-link" href="https://paleopresto.com/custom.html">Custom</a>\n' +
'    <a class="nav-link" href="https://paleopresto.com/about.html">About Us</a>\n' +
'</ul>\n' +
'</div>\n' +
'</div>\n' +
'</div>\n' +
'</header>\n' +
'<!-- HEADING BREADCRUMB-->\n' +
'<section class="bg-pentagon py-4">\n' +
'<div class="container py-3">\n' +
'<div class="row d-flex align-items-center gy-4">\n' +
'<div class="col-md-7">\n' +
'<h1 class="h2 mb-0 text-uppercase">Custom Reconstructions</h1>\n' +
'</div>\n' +
'<div class="col-md-5">\n' +
'<!-- Breadcrumb-->\n' +
'<ol class="text-sm justify-content-start justify-content-lg-end mb-0 breadcrumb undefined">\n' +
'    <li class="breadcrumb-item"><a class="text-uppercase" href="https://paleopresto.com/">Home</a></li>\n' +
'    <li class="breadcrumb-item text-uppercase active">Custom Reconstructions</li>\n' +
'</ol>\n' +
'</div>\n' +
'</div>\n' +
'</div>\n' +
'</section>\n' +
'<div id="content">\n' +
'<div class="container py-4">\n' +
'<div class="row gy-4">\n' +
'<div class="col-md-12">\n' +
'<div class="block-header d-flex justify-content-between align-items-center">\n' +
'    <h3 class="text-uppercase mb-0">Lipdverse Autocomplete</h3>\n' +
'    <div class="old">v1.0.2</div>\n' +
'</div>\n' +
'<div class="block-body">\n' +
'<div class="row">\n' +
'    <div class="form-group col-md-12">\n' +
'        <label for="dataset">Lipdverse Dataset</label>\n' +
'        <input type="text" id="dataset" class="form-control">\n' +
'    </div>\n' +
'</div>\n' +
'<div class="row">\n' +
'    <div class="form-group col-md-12">\n' +
'        <label for="param">Parameter</label>\n' +
'        <input type="text" id="param" class="form-control">\n' +
'    </div>\n' +
'</div>\n' +
'<div class="row">\n' +
'    <div class="form-group col-md-12">\n' +
'        <label for="tlim">Time Limits (comma-separated, e.g., 1000,2000 CE)</label>\n' +
'        <input type="text" id="tlim" class="form-control">\n' +
'    </div>\n' +
'</div>\n' +
'<div class="row">\n' +
'    <div class="form-group col-md-12">\n' +
'        <label for="slim">Spatial Limits (comma-separated, e.g., -90,90,-180,180)</label>\n' +
'        <input type="text" id="slim" class="form-control">\n' +
'    </div>\n' +
'</div>\n' +
'<div class="row">\n' +
'    <div class="form-group col-md-12">\n' +
'        <label for="exp">Expression (leave empty for now)</label>\n' +
'        <input type="text" id="exp" class="form-control">\n' +
'    </div>\n' +
'</div>\n' +
'</div>\n' +
'</div>\n' +
'</div>\n' +
'</div>\n' +
'</div>\n' +
'</div>\n' +
'<div id="map" class="leaflet-container leaflet-touch leaflet-retina leaflet-fade-anim leaflet-grab leaflet-touch-drag leaflet-touch-zoom" style="position: relative; max-width: 90%; max-height: 100%;"></div>\n' +
'<footer class="main-footer">\n' +
'<div class="bg-pentagon py-4">\n' +
'<div class="container">\n' +
'<div class="row gy-4">\n' +
'<div class="col-md-4">\n' +
'<h4 class="text-uppercase">About Us</h4>\n' +
'<p>Nullam nec ipsum efficitur, malesuada odio id, iaculis erat.</p>\n' +
'<p>Fusce ut leo libero. Sed dictum eget ex in dictum.</p>\n' +
'</div>\n' +
'<div class="col-md-4">\n' +
'<h4 class="text-uppercase">Contact</h4>\n' +
'<ul class="list-unstyled">\n' +
'    <li>123 Some Street</li>\n' +
'    <li>City</li>\n' +
'    <li>Country</li>\n' +
'    <li>Email: <a href="mailto:info@somewhere.com">info@somewhere.com</a></li>\n' +
'</ul>\n' +
'</div>\n' +
'<div class="col-md-4">\n' +
'<h4 class="text-uppercase">Social Media</h4>\n' +
'<ul class="list-unstyled">\n' +
'    <li><a href="#">Facebook</a></li>\n' +
'    <li><a href="#">Twitter</a></li>\n' +
'    <li><a href="#">LinkedIn</a></li>\n' +
'</ul>\n' +
'</div>\n' +
'</div>\n' +
'</div>\n' +
'</div>\n' +
'</footer>\n' +
'</div>\n' +
'</body>\n' +
'</html>\n';


fs.writeFile("/root/presto/query/forms/" + recon  + ".html", htmlString, function(err) {
	    if(err) {
		            return console.log(err);
		        }
	    console.log("The " + recon + ".html file was saved!");
}); 


//fs.writeFile("/root/presto/jsonEditor/public/slider" + recon + ".js", jsExt + jsExt2 + jsExt3 + jsExt4, function(err) {
//	            if(err) {
//			                                return console.log(err);
//			                            }
//	            console.log("The slider" + recon + ".js file was saved!");
//});
