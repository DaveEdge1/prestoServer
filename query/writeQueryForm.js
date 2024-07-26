var fs = require('fs')
var YAML = require('yaml')
var bodyParser = require('body-parser')
const prompt = require('prompt-sync')();

var checkedText = function (boolVal){
	if (boolVal) {
		return ''
	} else {
		return 'checked'
	}
}

const compilation = function (hide, defaultChoice, tooltip) {
	if (defaultChoice == null){
		defaultChoice = ''
	}
	if (hide) {
		var html1 = String.raw`<input id="compilationIn" name="paleoData_mostRecentCompilations" type="hidden" value="` + defaultChoice + `">`
	} else {
		var html1 = String.raw`<div class="form-group"> ` + `\n`
		+ String.raw`<label style="font-size:20px; padding-right:10px; color:black" id="compilation_label" for="compilation">Compilation</label>` + `\n`
		+ String.raw`<div style= "vertical-align: middle; height: 20px;" class="hover-text">?` + `\n`
		+ String.raw`<span class="tooltip-text">` + tooltip + `</span>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<input style="width:80%;" name="paleoData_mostRecentCompilations" id="compilationIn" value="` + defaultChoice + `">` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<br>` + `\n`
	}
	return html1
}

const continent = function (hide, defaultChoice, tooltip) {
	if (defaultChoice == null){
		defaultChoice = ''
	}
	if (hide) {
		var html1 = String.raw`<input id="continentIn" name="continent" type="hidden" value="">` + `\n`
	} else {
		var html1 = String.raw`<div class="form-group"> ` + `\n`
		+ String.raw`<label style="font-size:20px; padding-right:10px; color:black" id="continentIn_label" for="continent">Continent (based on <a href="https://jakubnowosad.com/spData/reference/world.html"  target="_blank">these polygons</a>)</label>` + `\n`
		+ String.raw`<div style= "vertical-align: middle; height: 20px;" class="hover-text">?` + `\n`
		+ String.raw`<span class="tooltip-text">` + tooltip + `</span>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<input style="width:80%;" name="continent" id="continentIn" value="` + defaultChoice + `">` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<br>` + `\n`
	}
	return html1
}

const country = function (hide, defaultChoice, tooltip) {
	if (defaultChoice == null){
		defaultChoice = ''
	}
	if (hide) {
		var html1 = String.raw`<input id="countryIn" name="country" type="hidden" value="">` + `\n`
	} else {
		var html1 = String.raw`<div class="form-group"> ` + `\n`
		+ String.raw`<label style="font-size:20px; padding-right:10px; color:black" id="country_label" for="country">Country (based on <a href="https://jakubnowosad.com/spData/reference/world.html" target="_blank">these polygons</a>)</label>` + `\n`
		+ String.raw`<div style= "vertical-align: middle; height: 20px;" class="hover-text">?` + `\n`
		+ String.raw`<span class="tooltip-text">` + tooltip + `</span>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<input style="width:80%;" name="country" id="countryIn" value="` + defaultChoice + `">` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<br>` + `\n`
	}
	return html1
}

const archive = function (hide, defaultChoice, tooltip) {
	if (defaultChoice == null){
		defaultChoice = ''
	}
	if (hide) {
		var html1 = String.raw`<input name="archiveType" id="archiveTypeIn" type="hidden" value="">` + `\n`
	} else {
		var html1 = String.raw`<div class="form-group"> ` + `\n`
		+ String.raw`<label style="font-size:20px; padding-right:10px; color:black" id="archiveType_label" for="archiveType">Archive Type</label>` + `\n`
		+ String.raw`<div style= "vertical-align: middle; height: 20px;" class="hover-text">?` + `\n`
		+ String.raw`<span class="tooltip-text">` + tooltip + `</span>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<input style="width:80%;" name="archiveType" id="archiveTypeIn" value="` + defaultChoice + `">` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<br>` + `\n`
	}
	return html1
}

const variable = function (hide, defaultChoice, tooltip) {
	if (defaultChoice == null){
		defaultChoice = ''
	}
	if (hide) {
		var html1 = String.raw`<input name="paleoData_variableName" id="variableName" type="hidden" value="">` + `\n`
	} else {
		var html1 = String.raw`<div class="form-group"> ` + `\n`
		+ String.raw`<label style="font-size:20px; padding-right:10px; color:black" id="variableName_label" for="variableName">Variable Name</label>` + `\n`
		+ String.raw`<div style= "vertical-align: middle; height: 20px;" class="hover-text">?` + `\n`
		+ String.raw`<span class="tooltip-text">` + tooltip + `</span>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<input style="width:80%;" name="paleoData_variableName" id="variableName" value="` + defaultChoice + `">` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<br>` + `\n`
	}
	return html1
}

const proxy = function (hide, defaultChoice, tooltip) {
	if (defaultChoice == null){
		defaultChoice = ''
	}
	if (hide) {
		var html1 = String.raw`<input name="paleoData_proxy" id="proxy" type="hidden" value="">` + `\n`
	} else {
		var html1 = String.raw`<div class="form-group"> ` + `\n`
		+ String.raw`<label style="font-size:20px; padding-right:10px; color:black" id="proxy_label" for="proxy">Proxy</label>` + `\n`
		+ String.raw`<div style= "vertical-align: middle; height: 20px;" class="hover-text">?` + `\n`
		+ String.raw`<span class="tooltip-text">` + tooltip + `</span>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<input style="width:80%;" name="paleoData_proxy" id="proxy" value="` + defaultChoice + `">` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<br>` + `\n`
	}
	return html1
}

const coordBox = function (hide, defaultBounds, tooltip, offByDefault) {
	if (hide) {
		var html1 = String.raw`<input id="lat_min" name="coords" type="hidden" value="`+defaultBounds[0]+`">` + `\n`
		+ String.raw`<input id="lat_max" name="coords" type="hidden" value="`+defaultBounds[1]+`">` + `\n`
		+ String.raw`<input id="lon_min" name="coords" type="hidden" value="`+defaultBounds[2]+`">` + `\n`
		+ String.raw`<input id="lon_max" name="coords" type="hidden" value="`+defaultBounds[3]+`">` + `\n`
	} else {
		var html1 = String.raw`<div style="width: 10%; vertical-align: middle; float: left;">` + `\n`
		+ String.raw`	<br><br><br>` + `\n`
		+ String.raw`	<label id="coordsOn_label" for="coordsOn">Filter by coordinates</label>` + `\n`
		+ String.raw`	<br>` + `\n`
		+ String.raw`	<input class="form-check-input" type="checkbox" id="coordsOn" value="TRUE" onclick='updateFilters();' `+checkedText(offByDefault)+`>` + `\n`
		+ String.raw`	<br><br><br>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<div id="coordsDiv" style= "vertical-align: middle; height: 50px; visibility: hidden; display: inline-block;" class="">` + `\n`
		+ String.raw`<label style="font-size:20px; padding-right:10px; color:black" id="geo_proxy_coords_label">Coordinate bounds for assimilating proxies </label>` + `\n`
		+ String.raw`<div style= "vertical-align: middle; height: 20px;" class="hover-text">?` + `\n`
		+ String.raw`<span class="tooltip-text">` + tooltip + `</span>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<p style="color: red;">Note: This bounding box can also be adjusted using the draggable handles on the map</p>` + `\n`
		+ String.raw`<p style="color: red;">Note: The bounding box width is limited to 360 degrees</p>` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<label style="font-size:16px; margin-right:8px;">Latitude</label>` + `\n`
		+ String.raw`<input class="coord-input" type="number" name="geo_proxy_coords" id="lat_min" value="`+defaultBounds[0]+`" min="-90" max="90" step="1" onchange="updateBoundingBox();">` + `\n`
		+ String.raw`<label style="margin-right:8px;">min</label>` + `\n`
		+ String.raw`<input class="coord-input" type="number" name="geo_proxy_coords" id="lat_max" value="`+defaultBounds[1]+`" min="-90" max="90" step="0.001" onchange="updateBoundingBox();">` + `\n`
		+ String.raw`<label style="margin-right:30px;">max</label>` + `\n`
		+ String.raw`<label style="font-size:16px; margin-right:8px;">Longitude</label>` + `\n`
		+ String.raw`<input class="coord-input" type="number" name="geo_proxy_coords" id="lon_min" value="`+defaultBounds[2]+`" min="-180" max="180" step="0.001" onchange="updateBoundingBox();">` + `\n`
		+ String.raw`<label style="margin-right:8px;">min</label>` + `\n`
		+ String.raw`<input class="coord-input" type="number" name="geo_proxy_coords" id="lon_max" value="`+defaultBounds[3]+`" min="-180" max="180" step="0.001" onchange="updateBoundingBox();">` + `\n`
		+ String.raw`<label>max</label>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br><br><br><br><br><br><br><br><br>` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<br>` + `\n`
	}
	return html1
}

const seasonality = function (hide1, defaultChoice1, tooltip1, hide2, offByDefault2, defaultRange2, tooltip2) {
	console.log("defaultRange2: " + defaultRange2)
	if (defaultChoice1 == null){
		defaultChoice1 = ''
	}
	if (hide1) {
		var html1 = String.raw`<input name="interpretation1_seasonality" id="seasonality1" type="hidden">` + `\n`
	} else {
		var html1 = String.raw`<div class="form-group"> ` + `\n`
		+ String.raw`<label style="font-size:20px; padding-right:10px; color:black" id="seasonality_label" for="seasonality1">Seasonality</label>` + `\n`
		+ String.raw`<div style= "vertical-align: middle; height: 20px;" class="hover-text">?` + `\n`
		+ String.raw`<span class="tooltip-text">`+ tooltip1 +`</span>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<input style="width:80%;" name="interpretation1_seasonality" id="seasonality1" value="` + defaultChoice1 + `">` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<br>` + `\n`
	}
	if (hide2) {
		var html2 = String.raw`<input id="months_range_fromSlider" type="hidden" value="1">` + `\n`
		+ String.raw`<input id="months_range_toSlider" type="hidden" value="12">` + `\n`
	} else {
		var html2 = String.raw`<div style="width: 10%; vertical-align: middle; float: left;">` + `\n`
		+ String.raw`	<br><br><br>` + `\n`
		+ String.raw`	<label id="ageSliderOn_label" for="seasonMonthsOn">Filter by range of months</label>` + `\n`
		+ String.raw`	<br>` + `\n`
		+ String.raw`	<input class="form-check-input" type="checkbox" id="seasonMonthsOn" value="TRUE" onclick='updateFilters();' `+checkedText(offByDefault2)+`>` + `\n`
		+ String.raw`	<br><br><br>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<div id="monthSliderDiv" style= "vertical-align: middle; height: 50px; visibility: hidden; display: inline-block;" class="form-group">` + `\n`
		+ String.raw`<label style="font-size:20px; padding-right:10px; color:black" id="months_range_label" for="months_range">Range of months</label>` + `\n`
		+ String.raw`<div style= "vertical-align: middle; height: 20px;" class="hover-text">?` + `\n`
		+ String.raw`<span class="tooltip-text">`+ tooltip2 +`</span>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<div class="range_container">` + `\n`
		+ String.raw`<div class="sliders_control">` + `\n`
		+ String.raw`<input id="months_range_fromSlider" type="range" value="`+ defaultRange2[0] +`" min="1" max="24" step="1"/>` + `\n`
		+ String.raw`<input id="months_range_toSlider" type="range" value="`+ defaultRange2[1] +`" min="1" max="24" step="1"/>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<div class="form_control">` + `\n`
		+ String.raw`<div class="form_control_container">` + `\n`
		+ String.raw`<div class="form_control_container__time">Min</div>` + `\n`
		+ String.raw`<input class="form_control_container__time__input" name="months_range_text" type="text" value="Jan" id="months_range_fromInput_text" readonly="readonly"/>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<div class="form_control_container">` + `\n`
		+ String.raw`<div class="form_control_container__time">Max</div>` + `\n`
		+ String.raw`<input class="form_control_container__time__input" name="months_range_text" type="text" value="Dec" id="months_range_toInput_text" readonly="readonly"/>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br><br><br><br><br><br><br><br><br><br><br><br><br>` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<br>` + `\n`
	}
		
	return html1 + html2
}

const interval = function (hide, defaultRange, offByDefault, tooltip) {
	if (hide) {
		var html1 = String.raw`<input name="time_range_to_reconstruct" id="time_range_to_reconstruct_fromInput" value="" type="hidden">` + `\n`
		+ String.raw`<input name="time_range_to_reconstruct" id="time_range_to_reconstruct_toInput" value="" type="hidden">` + `\n`
	} else {
		var html1 = String.raw`<div style="width: 10%; vertical-align: middle; float: left;">` + `\n`
		+ String.raw`	<br><br><br>` + `\n`
		+ String.raw`	<label id="ageSliderOn_label" for="ageSliderOn">Filter by time interval</label>` + `\n`
		+ String.raw`	<br>` + `\n`
		+ String.raw`	<input class="form-check-input" type="checkbox" id="ageSliderOn" value="TRUE" onclick='updateFilters();' `+checkedText(offByDefault)+`>` + `\n`
		+ String.raw`	<br><br><br>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<div id="timeSliderDiv" style= "vertical-align: middle; height: 50px; visibility: hidden; display: inline-block;" class="form-group">` + `\n`
		+ String.raw`<label style="font-size:20px; padding-right:10px; color:black" id="time_range_to_reconstruct_label" for="time_range_to_reconstruct">Time interval of data coverage</label>` + `\n`
		+ String.raw`<div style= "vertical-align: middle; height: 20px;" class="hover-text">?` + `\n`
		+ String.raw`<span class="tooltip-text">`+ tooltip +`</span>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<div class="range_container">` + `\n`
		+ String.raw`<div class="sliders_control">` + `\n`
		+ String.raw`<input id="time_range_to_reconstruct_fromSlider" type="range" value="`+ defaultRange[0] +`" min="0" max="12000" step="600"/>` + `\n`
		+ String.raw`<input id="time_range_to_reconstruct_toSlider" type="range" value="`+ defaultRange[1] +`" min="0" max="12000" step="600"/>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<div class="form_control">` + `\n`
		+ String.raw`<div class="form_control_container">` + `\n`
		+ String.raw`<div class="form_control_container__time">Min</div>` + `\n`
		+ String.raw`<input class="form_control_container__time__input" name="time_range_to_reconstruct" type="number" id="time_range_to_reconstruct_fromInput" value="100" min="0" max="12000" step="1"/>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<div class="form_control_container">` + `\n`
		+ String.raw`<div class="form_control_container__time">Max</div>` + `\n`
		+ String.raw`<input class="form_control_container__time__input" name="time_range_to_reconstruct" type="number" id="time_range_to_reconstruct_toInput" value="600" min="0" max="12000" step="1"/>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br><br><br><br><br><br><br>` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<br>` + `\n`
	}
	return html1
}

const resolution = function (hide, defaultValue, offByDefault, tooltip) {
	if (hide) {
		var html1 = String.raw`<input id="resolutionInput" name="resolution" type = "hidden" value="">` + `\n`
	} else {
		var html1 = String.raw`<div style="width: 10%; vertical-align: middle; float: left;">` + `\n`
		+ String.raw`	<br><br><br>` + `\n`
		+ String.raw`	<label id="resolutionOn_label" for="resolutionOn">Filter by resolution</label>` + `\n`
		+ String.raw`	<br>` + `\n`
		+ String.raw`	<input class="form-check-input" type="checkbox" id="resolutionOn" value="TRUE" onclick='updateFilters();' `+checkedText(offByDefault)+`>` + `\n`
		+ String.raw`	<br><br><br>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<div id="resolutionDiv" style= "vertical-align: middle; height: 50px; visibility: hidden; display: inline-block;" class="form-group">` + `\n`
		+ String.raw`<label style="font-size:20px; padding-right:10px; color:black" id="resolution_label" for="resolution">Resolution</label>` + `\n`
		+ String.raw`<div style: "vertical-align: middle; height: 50px;" class="hover-text">?` + `\n`
		+ String.raw`<span class="tooltip-text">` + tooltip + `</span>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<div class="range_container">` + `\n`
		+ String.raw`<div class="sliders_control">` + `\n`
		+ String.raw`<input id="resolutionSlider" type="range" value="`+ defaultValue +`" min="1" max="1000" step="1"/>` + `\n`
		+ String.raw`<br>` + `\n`
		+ String.raw`<input type="number" id="resolutionInput" name="resolution" value="100" min="1" max="1000" step="1"/>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br><br><br><br><br><br><br>` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<br>` + `\n`
	}
	return html1
}

const terrestrial = function (hide, defaultSelection, offByDefault, tooltip) {
	if (defaultSelection.toLowerCase() == 'terrestrial'){
		var checked1 = 'checked'
		var checked2 = ''
	} else {
		var checked1 = ''
		var checked2 = 'checked'
	}
	if (hide) {
		var html1 = String.raw`<input id="Terrestrial" name="isTerrestrial" type="hidden" value="1" checked>` + `\n`
		+ String.raw`<input type="radio" id="Marine" name="isTerrestrial" value="0">` + `\n`
	} else {
		var html1 = String.raw`<div style="width: 10%; vertical-align: middle; float: left;">` + `\n`
		+ String.raw`	<br><br><br>` + `\n`
		+ String.raw`	<label id="isTerrestrialOn_label" for="isTerrestrialOn">Filter by Land/Sea</label>` + `\n`
		+ String.raw`	<br>` + `\n`
		+ String.raw`	<input class="form-check-input" type="checkbox" id="isTerrestrialOn" value="TRUE" onclick='updateFilters();' `+checkedText(offByDefault)+`>` + `\n`
		+ String.raw`	<br><br><br>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<div id="isTerrestrialDiv" style= "vertical-align: middle; height: 50px; visibility: hidden; display: inline-block;" class="form-group">` + `\n`
		+ String.raw`<label style="font-size:20px; padding-right:10px; color:black" id="isTerrestrial_label">Terrestrial or Marine (based on <a href="https://jakubnowosad.com/spData/reference/world.html" target="_blank">these polygons</a>)</label>` + `\n`
		+ String.raw`<div style: "vertical-align: middle; height: 50px;" class="hover-text">?` + `\n`
		+ String.raw`<span class="tooltip-text">` + tooltip + `</span>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<div class="radio_container">` + `\n`
		+ String.raw`<div class="radio_control">` + `\n`
		+ String.raw`<input type="radio" id="Terrestrial" name="isTerrestrial" value="1" `+checked1+`>` + `\n`
		+ String.raw`<label for="Terrestrial">Terrestrial</label><br>` + `\n`
		+ String.raw`<input type="radio" id="Marine" name="isTerrestrial" value="0" `+checked2+`>` + `\n`
		+ String.raw`<label for="Marine">Marine</label><br>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`</div>` + `\n`
		+ String.raw`<br><br><br><br><br><br><br>` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<hr class="solid">` + `\n`
		+ String.raw`<br>` + `\n`
	}
	return html1
}

const configs = function (recon) {
    const s = fs.readFileSync('/root/presto/query/' + recon + '.yml','utf8');
    const ret = YAML.parse(s)
    var allHTML = ''

    for (var key1 in Object.keys(ret)) {
	const ii = Object.keys(ret)[key1]
	console.log('key: ' + ii)
	allHTML = allHTML + groupHTML(ii, ret[ii].Explanation) + paramHTML(ret, ii) + String.raw`</div>` + `\n`
    }
    return allHTML
}

const groupHTML = function(key, desc) {
	if (desc == null){
		var descNew = ''
	} else {
		var descNew = desc
	}
	
	const formGroup = String.raw`<button type="button" class="collapsible">` + YAML.stringify(key) + `</button>` + `\n`
	+ String.raw`<div class="content">` + `\n`
	+ String.raw`<br>` + `\n`
	+ `<p>` + descNew + `</p>` + `\n`
	+ String.raw`<br>` + `\n`

	return formGroup
}

const hasdropdown = ["compilation", "continent", "country", "seasonality", "variable", "archive", "proxy"]


const paramHTML = function(ret, ii) {

	var param = ret[ii]

	var paramStuff = ''

	for (kk in param) {
		if (kk == 'Explanation') {
		    console.log('param: ' + kk)
		} else {
			if (hasdropdown.includes(kk)) {
				var param1 = eval(kk + '(ret[ii][kk].hide, ret[ii][kk].defaultChoice, ret[ii][kk].tooltip)')
			} else if (kk == 'seasonality') {
				console.log("all keys: " + Object.keys(ret[ii][kk]))
				console.log("defaultRange2: " + ret[ii][kk].defaultRange2)
				var param1 = eval(kk + '(ret[ii][kk].hide1, ret[ii][kk].defaultChoice1, ret[ii][kk].tooltip1, ret[ii][kk].hide2, ret[ii][kk].offByDefault2, ret[ii][kk].defaultRange2, ret[ii][kk].tooltip2)')
			} else if (kk == 'coordBox'){
				var param1 = eval(kk + '(ret[ii][kk].hide, ret[ii][kk].defaultBounds, ret[ii][kk].tooltip, ret[ii][kk].offByDefault)')
			} else if (kk == 'interval'){
				var param1 = eval(kk + '(ret[ii][kk].hide, ret[ii][kk].defaultRange, ret[ii][kk].offByDefault, ret[ii][kk].tooltip)')
			} else if (kk == 'resolution'){
				var param1 = eval(kk + '(ret[ii][kk].hide, ret[ii][kk].defaultValue, ret[ii][kk].offByDefault, ret[ii][kk].tooltip)')
			} else if (kk == 'terrestrial'){
				var param1 = eval(kk + '(ret[ii][kk].hide, ret[ii][kk].defaultSelection, ret[ii][kk].offByDefault, ret[ii][kk].tooltip)')
			}
		    try {
			if (typeof param1 == 'string'){
			    paramStuff = paramStuff + param1
			}
			} catch (e) {
			    console.log('eval: ' + e.message)
			}
		}
	}
	return paramStuff
}

reconTitle = function(recon){
	var reconTitles = fs.readFileSync("/root/presto/jsonEditor/reconTitles.json")
	var titlesJSON = JSON.parse(reconTitles)
	console.log(titlesJSON[recon])
	console.log(titlesJSON, recon)
	return(titlesJSON[recon])
}

const recon = prompt('Which recon are we writing a form for?');
console.log(`Okay, writing new form for ${recon}`);
console.log(configs(recon))

const dropdowns = function(recon) {
    console.log('start dropdowns')
	
    var archivelist = [{"value":"Borehole","label":"Borehole, borehole"},{"value":"Coral","label":"Coral, coral"},{"value":"FluvialSediment","label":"Creek, Fluvial, FluvialSediment, River, Stream, "},{"value":"GlacierIce","label":"GlacierIce, ice cores"},{"value":"GroundIce","label":"GroundIce, bulk ice"},{"value":"LakeSediment","label":"Lagoon, Lake, Lake Sediment, LakeSediment, "},{"value":"MarineSediment","label":"Marine, MarineSediment, Delta, Marine Sediment, Ocean, "},{"value":"Midden","label":"Midden, "},{"value":"MolluskShell","label":"MolluskShells, bivalve, MolluskShell"},{"value":"Other","label":"Marl, Meadow, Archaeological, Coast, Farmland, Forest, Sediment, Spring, Valley, , Other"},{"value":"Peat","label":"Wetland, Bog, Fen, Marsh, Mire, Peat, Swamp, peat"},{"value":"Sclerosponge","label":"Sclerosponge, sclerosponge"},{"value":"Shoreline","label":"LakeDeposit, LakeDeposits, Shoreline, lake levels"},{"value":"Speleothem","label":"Cave, Speleothem, speleothems"},{"value":"TerrestrialSediment","label":"Paleosol, Dune, Loess, TerrestrialSediment, Terrestrial Sediment, "},{"value":"Wood","label":"Wood, tree ring, tree"}]
    var variablelist = [{"value":"10Be","label":"10Be"},{"value":"230Th/232Th","label":"230Th/232Th"},{"value":"230Th/238U","label":"230Th/238U"},{"value":"232Th","label":"232Th"},{"value":"238U","label":"238U"},{"value":"uncertaintyHigh50","label":"uncertaintyHigh50,50% confidence interval upper bound,0.25_quantile_dust_flux,Precip dD 75 CI,0.75_quantile_dust_flux"},{"value":"uncertaintyLow1s","label":"uncertaintyLow1s,68% confidence interval lower bound,age_y_bp-1s,Q0.16,Q0.16, ice volume adjusted,Q0.16, ice volume and vegetation adjusted,dDP_1s_lower,deltaT - 1 sigma,precip_1s_lower,p-SD,P-SD,T.MinusSD,T-SD,Temperature 1 sigma range low"},{"value":"uncertainty1s","label":"uncertainty1s,68% confidence interval margin of error,C23 stdev,stdev C24,C31 δ13C std dev,C31 δ13C Std Dev,C31d13Csd,C33 δ13C Std Dev,C29 d13C std dev,C31 d13C std dev,C29 δD std dev,dD std dev,C23 δD std dev,C24 d2H stdev,C25 δD std dev,C29 δD Std Dev,C29 δD std dev [±],C31 δD std dev,C31 δD Std Dev,C33 δD Std Dev,C29 dD std dev,StDev C28 dD,d excess stdev,MBTsd,Mg_Ca_sd,MAP1-sigma,precipitation std,precipitation std (with H-set),WMT1-sigma,U371sigmaUncertainty-,CBTsd,stdev weighted average,SD_anomaly,std,stdDev,stdDev___,SE,SD,stdevC24,stdevC26,stdevC28,from_68,2H_dino_1sig,to_68,stdevC25,stdevC27,stdevC29,stdevC31,sd,C30 dD std dev,C31 dD std dev,C25 stdev,stdev C26,C27 stdev,stdev C28,C29 stdev,d13C_C31_sd,C29 δ13C std dev,C29 δ13C Std Dev,C29 δ13C std dev [±]"},{"value":"uncertaintyHigh1s","label":"uncertaintyHigh1s,68% confidence interval upper bound,age_y_bp+1s,Q0.84,Q0.84, ice volume adjusted,Q0.84, ice volume and vegetation adjusted,dDP_1s_upper,deltaT + 1 sigma,p+SD,P+SD,precip_1s_uppper,T+SD,Temperature 1 sigma range high,T.PlusSD,precip_1s_upper"},{"value":"Rb87/Sr86","label":"Rb87/Sr86,87Rb/86Sr,Rb/Sr"},{"value":"uncertaintyLow90","label":"uncertaintyLow90,90% confidence interval lower bound,age_5thpercentile,age_95thpercentile,age97.5"},{"value":"uncertaintyHigh90","label":"uncertaintyHigh90,90% confidence interval upper bound,pcpanomCI95"},{"value":"uncertaintyLow95","label":"uncertaintyLow95,95% confidence interval lower bound,lowerErr2,pcpanomCI5,age_2.5,age2.5,age_calBP95-,95LowerAge,age95ConfMin,minAge95,d13C_2.5,d18O_2.5,Q0.025,Q0.025, ice volume adjusted,Q0.025, ice volume and vegetation adjusted,Precip dD 25 CI,0.025_quantile_dust_flux,lower95"},{"value":"uncertainty2s","label":"uncertainty2s,95% confidence interval margin of error,MAP2-sigma,WMT2-sigma,from_95,2 sigma,to_95"},{"value":"uncertaintyHigh95","label":"uncertaintyHigh95,95% confidence interval upper bound,age_97.5,age_calBP95+,95UpperAge,age95conMax,max_age_95,maxAge95,d13C_97.5,d18O_97.5,Q0.975,Q0.975, ice volume adjusted,Q0.975, ice volume and vegetation adjusted,0.975_quantile_dust_flux,upper95"},{"value":"accumulation","label":"accumulation,accumulation rate,Accumulation rate ice (kg/m2/yr),acc,Accumulation,Ice Accumulation"},{"value":"age","label":"age,ageMedian,ageOriginal,ageMedianBacon,agelinInterp,ageBchron,agecopRa,ageDuplicate,ageStalAge,ageBacon,agelinReg,ageOxCal,Age,medianAge,ageEnsemble,ageMarine09,Median cal age,SHCal04Age,age_alt,age_Calibrated,Age_original,ageOther,ageRounded,IntCal09Age,Marine09,varveCountedAgeAD0x2FBC,varveCountedAgeKa"},{"value":"Uk37","label":"Uk37,alkenone unsaturation index Uk37,UK37-SFS Values,UK37,sumUK37"},{"value":"Uk37'","label":"Uk37',alkenone unsaturation index Uk37 prime,UK'37"},{"value":"aluminum","label":"aluminum,Al,AlProp,Al peak area"},{"value":"Al2O3","label":"Al2O3,aluminum oxide,AL2O3"},{"value":"ammonium","label":"ammonium,NH4_"},{"value":"amps","label":"amps,ampere,Amps"},{"value":"ARM/IRM","label":"ARM/IRM,anhysteretic remanent magnetization/isothermal remanent magnetization,arm_irm"},{"value":"aragonite","label":"aragonite,Aragonite"},{"value":"arsenic","label":"arsenic,ppm As,As"},{"value":"ARSTAN","label":"ARSTAN,ARSTAN chronology method,ARS"},{"value":"ACL","label":"ACL,average chain length,AverageChainLength20to30,AverageChainLength20to32,ACL (27-33),ACL25-35,ACL27-31,ACLC22-30,Average Chain Length"},{"value":"RBAR","label":"RBAR,average correlation coefficient,RBar"},{"value":"barium","label":"barium,Ba,Ba (ppm),ppm Ba,Ba peak area"},{"value":"Ba/Al","label":"Ba/Al,barium/aluminum,ppmBa/%Al"},{"value":"Ba/Ca","label":"Ba/Ca,barium/calcium,Ba_Ca,log_BaCa,BaCa"},{"value":"beryllium","label":"beryllium,ppm Be"},{"value":"BSi","label":"BSi,biogenic silica,Bsi_3pt,Bsi_Raw,Inferred BSi,BioSi"},{"value":"boron","label":"boron,B"},{"value":"BIT","label":"BIT,branched and isoprenoid tetraether index,BITindex,BITindex-3pt"},{"value":"brGDGT-Ia","label":"brGDGT-Ia,branched glycerol dialkyl glycerol tetraether,brGDGTIa,Ia"},{"value":"brGDGT-Ib","label":"brGDGT-Ib,branched glycerol dialkyl glycerol tetraether,brGDGTIb,Ib,br1020,Br1020"},{"value":"brGDGT-Ic","label":"brGDGT-Ic,branched glycerol dialkyl glycerol tetraether,Ic"},{"value":"brGDGT-IIa5me","label":"brGDGT-IIa5me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIa,brGDGTIia,IIa,br1036,Br1036"},{"value":"brGDGT-IIa6me","label":"brGDGT-IIa6me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIa',IIa'"},{"value":"brGDGT-IIb5me","label":"brGDGT-IIb5me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIb,brGDGTIib,IIb"},{"value":"brGDGT-IIb6me","label":"brGDGT-IIb6me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIb',IIb'"},{"value":"brGDGT-IIc5me","label":"brGDGT-IIc5me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIc,IIc"},{"value":"brGDGT-IIc6me","label":"brGDGT-IIc6me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIc',IIc'"},{"value":"brGDGT-IIIa5me","label":"brGDGT-IIIa5me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIIa,brGDGTIIIa,IIIa,br1050,Br1050"},{"value":"brGDGT-IIIa6me","label":"brGDGT-IIIa6me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIIa',IIIa'"},{"value":"brGDGT-IIIb5me","label":"brGDGT-IIIb5me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIIb,brGDGTIIIb,IIIb,br1048,Br1048"},{"value":"brGDGT-IIIb6me","label":"brGDGT-IIIb6me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIIb',IIIb'"},{"value":"brGDGT-IIIc5me","label":"brGDGT-IIIc5me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIIc,IIIc"},{"value":"brGDGT-IIIc6me","label":"brGDGT-IIIc6me,branched glycerol dialkyl glycerol tetraether,brGDGT-IIIc',IIIc'"},{"value":"bromine","label":"bromine,Br"},{"value":"C20n-alkanoicAcid","label":"C20n-alkanoicAcid,C20 n-alkanoic acid,C20 n,C20FAMEconcentration,C20 concentration,C20 FAME Concentration,C20concentration,C20n,C20SEM,C20 SEM,C20n-alkenoicAcid"},{"value":"C21n-alkanoicAcid","label":"C21n-alkanoicAcid,C21 n-alkanoic acid,C21FAMEconcentration,C21 concentration,C21 FAME Concentration"},{"value":"C22n-alkanoicAcid","label":"C22n-alkanoicAcid,C22 n-alkanoic acid,C22 n,C22FAMEconcentration,C22 FAME Concentration,C22concentration,C22n,C22SEM,C22 SEM"},{"value":"C23n-alkanoicAcid","label":"C23n-alkanoicAcid,C23 n-alkanoic acid,C23FAMEconcentration,C23 concentration,C23 FAME Concentration,C23 n,C23C31"},{"value":"C24n-alkanoicAcid","label":"C24n-alkanoicAcid,C24 n-alkanoic acid,nC24,C24 n,C24FAMEconcentration,C24 FAME Concentration,C24concentration,C24n,C24SEM,C24 concentration,C24 SEM,n C24"},{"value":"C25n-alkanoicAcid","label":"C25n-alkanoicAcid,C25 n-alkanoic acid,C25FAMEconcentration,C25 concentration,C25 FAME Concentration,C25 n"},{"value":"C26n-alkanoicAcid","label":"C26n-alkanoicAcid,C26 n-alkanoic acid,nC26,C26 n,C26FAMEconcentration,C26 FAME Concentration,C26concentration,C26n,C26OH0x2F0x28C26OH0x2BC290x29,C26SEM,C26 concentration,C26 SEM,n C26"},{"value":"C27n-alkanoicAcid","label":"C27n-alkanoicAcid,C27 n-alkanoic acid,C27FAMEconcentration,C27 concentration,C27 FAME Concentration,C27 n"},{"value":"C28n-alkanoicAcid","label":"C28n-alkanoicAcid,C28 n-alkanoic acid,nC28,C28 n,C28FAMEconcentration,n-C28,n C28,C28 FAME Concentration,C28concentration,C28n,C28SEM,nC28_err,nC28_rep,C28 concentration,C28 SEM"},{"value":"C29n-alkanoicAcid","label":"C29n-alkanoicAcid,C29 n-alkanoic acid,C29FAMEconcentration,C29 concentration,C29 FAME Concentration,C29 n"},{"value":"C30n-alkanoicAcid","label":"C30n-alkanoicAcid,C30 n-alkanoic acid,C30 n,C30FAMEconcentration,C30 FAME Concentration,C30concentration,C30n,C30SEM,nC30_rep,C30 concentration,C30 SEM"},{"value":"C31n-alkanoicAcid","label":"C31n-alkanoicAcid,C31 n-alkanoic acid,C31FAMEconcentration,C31 concentration,C32FAMEconcentration"},{"value":"C37Alkenone","label":"C37Alkenone,C37 alkenone,C37.concentration,totalC37"},{"value":"C37:2Alkenone","label":"C37:2Alkenone,C37:2 alkenone,C37:2"},{"value":"C37:3aAlkenone","label":"C37:3aAlkenone,C37:3 alkenone,C37:3a"},{"value":"C37:3bAlkenone","label":"C37:3bAlkenone,C37:3 alkenone,C37:3b"},{"value":"C37:4Alkenone","label":"C37:4Alkenone,C37:4 alkenone,C370x3A4,C34:4"},{"value":"cadmium","label":"cadmium,Cd,Cd MAR (ug/cm2/ky),ppm Cd"},{"value":"calcificationRate","label":"calcificationRate,calcification rate,calcification"},{"value":"calcite","label":"calcite,Calcite"},{"value":"calcium","label":"calcium,Ca,CaProp,% Ca-detr,% Ca-ex,Ca peak area,Ca__,Ca  peak area"},{"value":"CaCO3","label":"CaCO3,calcium carbonate,% CaCO3-ex,CaCO3-IC"},{"value":"CaO","label":"CaO,calcium oxide"},{"value":"Ca/K","label":"Ca/K,calcium/potassium"},{"value":"Ca/Sr","label":"Ca/Sr,calcium/strontium"},{"value":"Ca/Ti","label":"Ca/Ti,calcium/titanium,Ti/Ca,Ca/Ti-z"},{"value":"carbon","label":"carbon,C,% TC,% Total C,%_tc,x_C"},{"value":"CPI","label":"CPI,carbon preference index,CarbonPreferenceIndex20to30,CarbonPreferenceIndex20to32,CPI (27-33),CPI_25-33,CPI22-30"},{"value":"C/N","label":"C/N,carbon/nitrogen,molarCN,C_N,C/N organic"},{"value":"carbonate","label":"carbonate,% Carbonate,carb%"},{"value":"charcoal","label":"charcoal,chacoal_influx"},{"value":"chloride","label":"chloride"},{"value":"chlorin","label":"chlorin"},{"value":"chlorine","label":"chlorine,Cl,Cl_"},{"value":"chromium","label":"chromium,Cr,ppm Cr"},{"value":"circulationIndex","label":"circulationIndex,circulation index,GoE,GoF"},{"value":"clay","label":"clay,%_clay,Clay,x_Clay"},{"value":"cobalt","label":"cobalt,Co,ppm Co"},{"value":"elevation","label":"elevation,collection elevation,elevation sample,elevation a.s.l."},{"value":"concentration","label":"concentration,concentration unit,Concentration (C25-35),Friedel-3-ene concentration,Hop-17(21)-ene concentration"},{"value":"copper","label":"copper,ppm Cu"},{"value":"correction","label":"correction,corrected,hasAragoniteCorrection,hasAragoniteCorrectionComposite,Iso adjustment for ocean calibration,Years for ocean correction"},{"value":"correlationCoefficient","label":"correlationCoefficient,correlation coefficient,corrs"},{"value":"count","label":"count,abundance,Numbe_counted,number,Number_counted,numInZone,Slide count,Varve_number,count_analyses_B3,count_analyses_C2,count_analyses_C3,count_analyses_C5,count_analyses_C6,sampleDensity,total,Total_grains_counted,total_non_Chaetoceros_counted,total_xount,TotalAmmoniaBeccarii"},{"value":"sampleCount","label":"sampleCount,count,num_samples"},{"value":"CBT","label":"CBT,cyclization index of branched tetraethers"},{"value":"d13C","label":"d13C,delta 13C,d13CComposite,d13CPrecisionComposite,d13CStandardComposite,d13c_pachyderma,planktic.d13C,d13c_bulloides,d13c_sacculifer,d13c_ruber_pink,C29 δ13C,d13c_ruber,C31 δ13C,D13C,d13CPisid,C33 δ13C,d13C bulk calcite,d13C C18 FAME,d13C C18 FAME SEM,d13C C20 FAME,d13C C20 FAME SEM,d13C C21 alkane,d13C C21 alkane SEM,d13C C22 FAME,d13C C22 FAME SEM,d13C C23 alkane,d13C C23 alkane SEM,d13C C24 FAME,d13C C24 FAME SEM,d13C C25 alkane,d13C C25 alkane SEM,d13C C26 FAME,d13C C26 FAME SEM,d13C C27 alkane,d13C C27 alkane SEM,d13C C28 FAME,d13C C28 FAME SEM,d13C C29 alkane,d13C C29 alkane SEM,d13C C30 FAME,d13C C30 FAME SEM,d13C C31 alkane,d13C C31 alkane SEM,d13C C32 FAME,d13C C32 FAME SEM,d13C C33 alkane,d13C C33 alkane SEM,d13C C34 FAME,d13C C34 FAME SEM,d13C C35 alkane,d13C C35 alkane SEM,d13C carbonate,D13C_C30,d13C organic,d13C ostracod,d13C_C31,d13c_dutertrei,d13C_org,d13c_pachyderma_d,d13Ccarb,d13CleafwaxC27,d13CleafwaxC27err,d13CleafwaxC29,d13CleafwaxC29err,d13CleafwaxC31,d13CleafwaxC31err,d13CleafwaxC33,d13CleafwaxC33err,d13CMean,Friedel-3-ene d13C,Hop-17(21)-ene d13C,Bulk OM d13C,C21 d13C,C23 d13C,C25:2 d13C,C28 d13C vs. VPDB,C29 d13C,C31 d13C,CDR3_d13C,d13/12C,Taraxer-14-ene d13C,δ13C n-alkanes,δ13C n-alkanes std dev,d13C bulk,d13C C25,d13C C27,d13C C29,d13C C31,d13C VPDB,D13C_C28,D13C_FAME,d13Cwax,C13bulk,C25 d13C,C27 d13C,C31d13C_PDB"},{"value":"d15N","label":"d15N,delta 15N,d15N/14N,dN15,dN15_corrected,Bulk OM d15N"},{"value":"d18O","label":"d18O,delta 18O,D18OIVC,d18o_ruber,d18o_pachyderma,d18OComposite,planktic.d18O,d18o_bulloides,d18o_sacculifer,d18O_sw,d18O_annual,D18O,d18o_ruber_pink,d18o_dutertrei,d18o_pachyderma_d,d18O_sw_annual,d18o_inflata,d18O_PDB,d18o_obliquiloculata,d18O_SMOW,d18O_swcorr,d18Ocarb,d18OPisid,d18Osw-sl-g.rubw,bagd18O,d180_corrc,d18O  encrustation,d18O Avg,d18O bulk calcite,d18O carbonate,d18O carbonate corrected for dolomite,d18O Chironomid,d18O ostracod,d18O pore ice sw corr,d18O_210yr,d18o_acicula,d18o_crassaformis,d18O_Gb,d18o_mabahethi,d18o_marginata,d18o_menardii,d18o_peregrina,d18o_quinqueloba,d18o_ruber_lato,d18o_ruber_stricto,d18o_tumida,d18O_vPDB,d18OBsi,d18Odiatom,d18Og.rub,d18Omean,d18Osw-g.rub,d18OTerrestrialGastropods,d18Otr,d18Otr-,d18Otr+,G. ruber w δ18O [‰ PDB],Gbulloidesd18O,CDR3_d18O,dd18O5pt,Ndutertreid18O,nonReliabled18O,ruberD18,WR11_d18O,x18O,x18ORub_,δ18O,Chironomid d18O,d18O (Sea Level Corrected),D18O_corrected,d18O VPDB,d18O_Grass_leaf,d18O_Sphagnum,d18O_vp–sp,d18O chironomid,d18O Lake water,d18O pore ice,d18Osw"},{"value":"d234U","label":"d234U,delta 234U"},{"value":"d2H","label":"d2H,delta 2H,dD,C29 δD,dDwax_iv,C31 δD,dDP,d2H C29,C26 d2H,C30 d2H,d2H C27,dD_C31,dD_swcorr,bagdD,C22 d2H,C24 d2H,C25 d2H,C28 d2H,C28_dD,C29 dD,d2H C20,d2H C23,dDC29,dDC31,d2H avg,d2H C20 FAME,d2H C20 FAME SEM,d2H C21 alkane,d2H C21 alkane SEM,d2H C22 FAME,d2H C22 FAME SEM,d2H C23 alkane,d2H C23 alkane SEM,d2H C24 FAME,d2H C24 FAME SEM,d2H C25,d2H C25 alkane,d2H C25 alkane SEM,d2H C25 error,d2H C26 FAME,d2H C26 FAME SEM,d2H C27 alkane,d2H C27 alkane SEM,d2H C27 error,d2H C28 FAME,d2H C28 FAME SEM,d2H C29 alkane,d2H C29 alkane SEM,d2H C29 error,d2H C30 FAME,d2H C30 FAME SEM,d2H C31,d2H C31 alkane,d2H C31 alkane SEM,d2H C31 error,d2H C32 FAME,d2H C32 FAME SEM,d2H C33 alkane,d2H C33 alkane SEM,d2H pore ice,d2H pore ice sw corr,d2H_C16,d2H_C26,d2H_C28,d2H_C30,d2HC30,d2HleafwaxC29,d2HleafwaxC29err,d2HleafwaxC31,d2HleafwaxC31err,d2HleafwaxC33,d2HleafwaxC33err,d2Hsw,dD IV,dDwax_IVC,dD_C31_sd,dD_IVandbio,dD_IVonly,dD_iceVolCorrected,dDwax,dDwax Corrected,dDwax_corr,Friedel-3-ene d2H,Hop-17(21)-ene d2H,C20 d2H,C20 d2H SEM,C21 d2H,C22 d2H SEM,C23 δD,C25 δD,C26 d2H SEM,C27 d2H,C28 d2H SEM,C28_dDIV,C29 d2H,C29 δD Corrected,C29 δD ice volume adjusted,C29 δD ice volume and vegetation adjusted,C29-C31 δD,C30 d2H SEM,C30 dD,dD_C30,C30 dD IV corrected  (3°C),C30 dD IV corrected  (7°C),C31 d2H,C31dD,C31dDsd,C32 dD,C33 δD,nC28_dD,nC30_dD,Taraxer-14-ene d2H,δDaq,δDterr,C31 dD,d2H C22,d2H C25:2,d2H C30,d2H precip,dD_C29,Long chain n-acid avg d2H,Long Chain n-alkane avg d2H,Mid-chain n-acid avg d2H,Midchain n-alkane avg d2H,d2HC24,d2HC26,d2HC28,d2HC29,C20d2H,C22d2H,C23 d2H,C24d2H,C25:2 d2H,C26d2H,C28d2H,C30d2H,Dd,Precip d2H"},{"value":"reservoir","label":"reservoir,delta reservoir age"},{"value":"density","label":"density,Density"},{"value":"depth","label":"depth,depthComposite,Depth,depth_merged,depthice,depthwe,MidpointDepth,Depth blf,depthComp,Composite depth,compositeDepth,Composite Depth,Section depth,depth corrected,depth_cmbs,depth_core1,depth_corr_cm,depth_merge,Composite Depth in Core,Composite depth mid,Composite_depth,Depth_eventFree,cor_depth_cm,depthByCore,DrillHole Depth,mean depth,originalCoreDepth,Section Depth,Core depth,depth_core,Adjusted Depth,drive-depth"},{"value":"depthTop","label":"depthTop,depth at sample end,depth.top,depth_top_m,depth_top,Composite depth top,Section depth top,top,Top,Top Depth,topDepth,uncorrected_depth_top,top depth in section,Top_depth,logdepthtop,logdepthtop-EDC99,logdepttop"},{"value":"depthBottom","label":"depthBottom,depth at sample start,depth.bottom,depth_bot,bottomDepth,depth_bottom,bot,Bot,Bottom Depth,Composite depth bottom,Section depth bottom,uncorrected_depth_bot,bottom depth in section,Bottom_depth"},{"value":"deuteriumExcess","label":"deuteriumExcess,deuterium excess,d-excess,bagDexcess,d-excess_swcorr,deutEx,dxs,d-excess pore ice,d-excess pore ice sw corr,d-excess sw"},{"value":"diatom","label":"diatom,¾nthic,%fresh,%Indif.,%Saline,¾nth.dia,%plank.dia,%saline.dia,SumDiatoms"},{"value":"diatomCount","label":"diatomCount,diatom index,seaIceDiatoms,diatom_abundance,Diatoms_per_traverse"},{"value":"diatomRatio","label":"diatomRatio,diatom ratio"},{"value":"dolomite","label":"dolomite,% Dolomite,dolo-wt%"},{"value":"sedimentDry","label":"sedimentDry,dry sediment,clastic,clastic_flux,mass dry,mass dry >1mm,mass dry 106 to 1000 um,mass dry 63 to 106 um,massDry,massDry_1mm,dry sample mass,sedimentWeight"},{"value":"duration","label":"duration,duration unit,yearsPerSample"},{"value":"dust","label":"dust,DMAR,dustFlux,0.50_quantile_dust_flux"},{"value":"DWHI","label":"DWHI,ecosystem index"},{"value":"landscapeCover","label":"landscapeCover,ecosystem quantity,OpenVegetation___"},{"value":"percent","label":"percent,ecosystem quantity,WoodyCover___"},{"value":"ElNinoEvent","label":"ElNinoEvent,El Niño event,ENSO_events"},{"value":"PC1","label":"PC1,empirical orthogonal function,droughtIndex (PC1),P1,PC1gs,PCA1,Hz-ic1"},{"value":"PC2","label":"PC2,empirical orthogonal function,Hz-ic2,PCA2"},{"value":"PC3","label":"PC3,empirical orthogonal function,Hz-ic3"},{"value":"PC4","label":"PC4,empirical orthogonal function,Hz-ic4"},{"value":"PC5","label":"PC5,empirical orthogonal function,Hz-ic5"},{"value":"PC6","label":"PC6,empirical orthogonal function,Hz-ic6"},{"value":"equilibriumLineAltitude","label":"equilibriumLineAltitude,equilibrium line altitude,ELA,ELA_alt"},{"value":"eventLayer","label":"eventLayer,event layer,layer,layer_type"},{"value":"EPS","label":"EPS,expressed population signal"},{"value":"feldspar","label":"feldspar,feldspar group"},{"value":"fluorine","label":"fluorine,F_,F"},{"value":"foraminifera","label":"foraminifera,foraminifer,Foram"},{"value":"gamma","label":"gamma,gamma radiation"},{"value":"globigerinoidesBulloides","label":"globigerinoidesBulloides,Globigerinoides bulloides,G. bulloides"},{"value":"globigerinoidesRuber","label":"globigerinoidesRuber,Globigerinoides ruber,Gruber"},{"value":"GDGT","label":"GDGT,glycerol dialkyl glycerol tetraether,brGDGT"},{"value":"grainSize","label":"grainSize,grain size,<4 um,>63 um,GrainSizeMode,D50,<2 um,<2um,Grain size mean,<16 μm,250-31 um,63-4 um"},{"value":"lithics","label":"lithics,grain size,%_lithics,Lithic Flux,Lithics"},{"value":"grayscale","label":"grayscale,grayscale20lp_detrended,grey_scale"},{"value":"growing degree days","label":"growing degree days,GDD5"},{"value":"growthRate","label":"growthRate,growth rate,GrowthRate"},{"value":"humidificationIndex","label":"humidificationIndex,humidification index,HumidificationIndex,HIndex,Hindex"},{"value":"iceMelt","label":"iceMelt,ice melt,melt,ice_melt_fraction,meltLayerFrequency,meltLayers"},{"value":"IP25","label":"IP25,ice proxy with 25 carbon atoms,IP25_flux"},{"value":"iceRaftedDebris","label":"iceRaftedDebris,ice rafted debris,IRD"},{"value":"mineralogy","label":"mineralogy,identified mineral,mineral_flux,mineralogyComposite"},{"value":"inc/coh","label":"inc/coh,incoherent:coherent scattering,Inc/Coh"},{"value":"TIC","label":"TIC,inorganic carbon,% IC"},{"value":"ITCZ","label":"ITCZ,Intertropical Convergence Zone index,ITCZ_index"},{"value":"iron","label":"iron,Fe,Fe peak area,FeProp"},{"value":"Fe2O3","label":"Fe2O3,iron(III) oxide"},{"value":"Fe/Al","label":"Fe/Al,iron/aluminum"},{"value":"Fe/Ca","label":"Fe/Ca,iron/calcium,ln(Fe/Ca),FeCa_log,FeCa,log(Fe/Ca)"},{"value":"Fe/Mn","label":"Fe/Mn,iron/manganese"},{"value":"Fe/K","label":"Fe/K,iron/potassium,ln(Fe/K)"},{"value":"IRM","label":"IRM,isothermal remanent magnetization,irm,IRM_softFlux"},{"value":"lakeArea","label":"lakeArea,lake area"},{"value":"lakeLevel","label":"lakeLevel,lake level,depth.lake,lakeStatus,lakeLevelRelative,LakeDepth,LakeLevel_cm_,Lake Level,Lake Level a.s.l."},{"value":"lanthanum","label":"lanthanum,ppm La"},{"value":"MXD","label":"MXD,latewood density"},{"value":"latitude","label":"latitude,latitude sample"},{"value":"layerThickness","label":"layerThickness,layer thickness,eventLayerThick,Fld lay thick,Flood lay (annual),Flood lay (fall),Flood lay (spring),Flood lay (summer),Flood lay (winter),floodLayThick,debrisLayThick,Lamina_thickness,LaminaThickenss"},{"value":"lead","label":"lead,ppm Pb"},{"value":"LDI","label":"LDI,long-chain diol index"},{"value":"longitude","label":"longitude,longitude sample"},{"value":"LOI","label":"LOI,loss on ignition,LOI550,LOI950"},{"value":"magnesium","label":"magnesium,Mg,% Mg,%Mg,detrendMg,Mg__,MgDetrended"},{"value":"MgO","label":"MgO,magnesium oxide"},{"value":"Mg/Ca","label":"Mg/Ca,magnesium/calcium,mgca_pachyderma,mgca_bulloides,mgca_dutertrei,mgca_sacculifer,mgca_inflata,mgca_ruber_lato,mgca_ruber_pink,mgca_ruber_stricto,mgca_crassaformis,mgca_obliquiloculata,mgca_pachyderma_d,CDR3_MgCa,Mg/Ca Raw,MgCa,mgca_truncatulinoides,NdutertreiMg/Ca,mgca_ruber,Mg_Ca,log_MgCa,planktic.MgCa"},{"value":"MS","label":"MS,magnetic susceptibility,Avg_MS,AVG_MS_DRS1_2A_3_2B_4,MassMagSus,SI,Magnetic Susceptibility"},{"value":"manganese","label":"manganese,Mn,ppm Mn,% Mn"},{"value":"MnO","label":"MnO,manganese oxide"},{"value":"Mn/Fe","label":"Mn/Fe,manganese/iron,MnFe"},{"value":"Mn/Ti","label":"Mn/Ti,manganese/titanium,MnTi"},{"value":"MAR","label":"MAR,mass per area per time unit,Bulk MAR,bulkMAR,CordMAR,Mo MAR (ug/cm2/ky),massacum"},{"value":"MBT","label":"MBT,methylation index of branched tetraethers,MBT',MBT'5Me"},{"value":"AET/PET","label":"AET/PET,missing"},{"value":"Al/Ca","label":"Al/Ca,aluminum/calcium"},{"value":"Al/Si","label":"Al/Si,missing,ln(Al/Si)"},{"value":"Artemesia/Ambrosia","label":"Artemesia/Ambrosia,missing,ArtAmb"},{"value":"ash","label":"ash,missing"},{"value":"Ba/Sr","label":"Ba/Sr,missing"},{"value":"bubbleNumberDensity","label":"bubbleNumberDensity,missing"},{"value":"bulkDensity","label":"bulkDensity,missing,bulk density"},{"value":"C25_2n-alkanoicAcid","label":"C25_2n-alkanoicAcid,missing,C25:2 concentration"},{"value":"Cd/Mn","label":"Cd/Mn,missing,ppm Cd/% Mn"},{"value":"Ca/Mg","label":"Ca/Mg,missing"},{"value":"core","label":"core,missing,CoreName,Core ID,core name,DUNE_A,Core Name,Core Section,Core_number,CoreSect1H,originalCoreName,Stal.ID,Core name,Core"},{"value":"d2HUncertaintyHigh80","label":"d2HUncertaintyHigh80,missing,Precip dD 90 CI"},{"value":"d2HUncertaintyLow80","label":"d2HUncertaintyLow80,missing,Precip dD 10 CI"},{"value":"Dd2H","label":"Dd2H,missing,ΔδDterr-aq"},{"value":"deleteThis","label":"deleteThis,missing,average C26 C28,CAL,A,Calibrated,IMON1953/3,interval,SAUG/3,SETE/3,SFEV/3,SHIV/3,TETE/3,TFEV/3,THIV/3,hobdob,LazerProfiler,noID,RCS.ars,Unkown"},{"value":"deltaRelativeHumidity","label":"deltaRelativeHumidity,missing,∆RH_mid"},{"value":"deltaTemperature","label":"deltaTemperature,missing,deltaT"},{"value":"dryBulkDensity","label":"dryBulkDensity,missing,DBD,Dry Bulk Density,dbd,dry_bd,EstDryBD"},{"value":"epsilonC28C22","label":"epsilonC28C22,missing,Epsilon C28-C22,Epsilon28-22"},{"value":"epsilonC28C24","label":"epsilonC28C24,missing,Epsilon C28-C24"},{"value":"epsilonC29C23","label":"epsilonC29C23,missing,Epsilon C29-C23"},{"value":"Eu/Zr","label":"Eu/Zr,missing,Eu/Zr-z"},{"value":"event","label":"event,missing"},{"value":"facies","label":"facies,missing,lithology,Facies,lithologic unit"},{"value":"flood","label":"flood,missing,M-flood,M-flood 200 yr avg,M-flood 30 yr sum,P-flood,P-flood 200 yr avg,P-flood 30 yr sum,floods"},{"value":"GDGT-0/Cren","label":"GDGT-0/Cren,missing"},{"value":"glacierCoverage","label":"glacierCoverage,missing"},{"value":"hasGap","label":"hasGap,missing"},{"value":"hasHiatus","label":"hasHiatus,missing,hasHiatusComposite"},{"value":"hole","label":"hole,missing"},{"value":"isReliable","label":"isReliable,missing,ReliabIeYN1,reliable,ReliabIeYN2,reliable 1,reliable 2,reliable_1,reliable_2,reliable_3,reliable_4,Reliable?"},{"value":"JulianDay","label":"JulianDay,missing"},{"value":"K37","label":"K37,missing,K37s"},{"value":"lakeTrend","label":"lakeTrend,missing"},{"value":"lakeVolume","label":"lakeVolume,missing"},{"value":"Mn/Mo","label":"Mn/Mo,missing"},{"value":"N/C","label":"N/C,missing,NC"},{"value":"organicNitrogen","label":"organicNitrogen,missing,Norg"},{"value":"Picea/Artemisia","label":"Picea/Artemisia,missing,Picea/Artemesia"},{"value":"Picea/Pinus","label":"Picea/Pinus,missing"},{"value":"Pinus/Artemisia","label":"Pinus/Artemisia,missing"},{"value":"Poaceae/Ephedra","label":"Poaceae/Ephedra,missing"},{"value":"pollen","label":"pollen,missing,PinusTotal"},{"value":"R570/R630","label":"R570/R630,missing,R570_630"},{"value":"R650/R700","label":"R650/R700,missing,R650_700"},{"value":"RABD660670","label":"RABD660670,missing,R660_670,RABD660_670,RABD660;670 index"},{"value":"section","label":"section,missing,core_section,Section,section name,Sec label,Section [#],Section #,Section number"},{"value":"segmentLength","label":"segmentLength,missing,segment"},{"value":"sequence","label":"sequence,missing,Pollen Sequence"},{"value":"site","label":"site,missing,LakeName,Site,CoreSite,siteName,SiteName,Drilling project,Region,site/hole"},{"value":"siteCount","label":"siteCount,missing,#ofSites"},{"value":"TOC/TN","label":"TOC/TN,missing"},{"value":"totalCarbon","label":"totalCarbon,missing,TC"},{"value":"totalNitrogen","label":"totalNitrogen,missing,TN"},{"value":"treeCover","label":"treeCover,missing,TreeCover"},{"value":"wetBulkDensity","label":"wetBulkDensity,missing,WetBD"},{"value":"molybdenum","label":"molybdenum,Mo,Mo_xs,ppm Mo"},{"value":"CCA1","label":"CCA1,multivariate eigenvector-based variable,caaxis1"},{"value":"CCA2","label":"CCA2,multivariate eigenvector-based variable,caaxis2"},{"value":"needsToBeChanged","label":"needsToBeChanged,NA,BS,BS_COMX,BS_Landscape_Openness,Di,DryElements,E2Hterr-2Haq,Eaq-p,eSEP_PLS_C2,eSEP_WMAT,HC/G,HII (H-set),HII (N-set),HII std (H-set),HII std (N-set),HulunNuur,aridity,d13o_pachyderma,distance,10%max,10%min,20%max,20%min,30%max,30%min,50%max,50%min,80%max,80%min,C170x2D28,calibrated,CI,CMT,CT,JulT-eSEP,Laminae,PPexp,RRA,tempSource,TSAR5pt,water,WMT,thisShouldntBeEmpty,TS,Unit,unnamed,-,100yrSum,10YrRun.Avg.,A odd (25-35),Alkenones,Analogues,Analogues#,bag,Bag,bagDepth,benth,Benthic,Cal,CAST1,CAST2,CMT_max,CMT_min,CMTmax,CMTmin,D,d0x2800x2E10x29,d0x2800x2E50x29,d0x2800x2E90x29,DEC,dln,Intv0x2E,kyryr BP2,log[EM3/(EM1+EM2)],LORCA,lower band,LSR (cm/ky),Lyc.added,Mag0x2E,Mark add,Mark found,Mean consensus,Mean_anomaly,mineral,Minidiscus?,Mode,MoistElements,MST,n-Alkane,NE.ars,OEP,s,S52,stage,Taraxer-14-ene concentration,TCT,Th13C,thin-mid,TOTC,Ts,TSAR,TT,Water/relict ice age,x00x2E020xB5m0x2D30x2E890xB5m,x10000x2E010xB5m0x2D20000x2E000xB5m,x1250x2E000xB5m0x2D2490x2E990xB5m,x150x2E600xB5m0x2D300x2E990xB5m,x2500x2E000xB5m0x2D4990x2E990xB5m,x30x2E900xB5m0x2D70x2E790xB5m,x310x2E000xB5m0x2D620x2E490xB5m,x5000x2E000xB5m0x2D10000x2E000xB5m,x620x2E500xB5m0x2D1240x2E990xB5m,x70x2E800xB5m0x2D150x2E590xB5m,drive-type,EM1,EM2,EM3,EMI,IMI,MG0,MShellCrn,Reconstructed,thisShouldntBeEmpty1,WACLS,WACLS_total,WAINV,WAINV_total,WAPLS-2,U_xs"},{"value":"nickel","label":"nickel,ppm Ni"},{"value":"nitrate","label":"nitrate,NO3_"},{"value":"nitrogen","label":"nitrogen,N"},{"value":"notes","label":"notes,entityName,Commentregardingreliability1,CommentRegardingReliability,Commentregardingreliability2,BSi_regime,BSI_regime,CodeName,color,Commentregardingreliability3,Commentregardingreliability4,note,repeats,Reworked,notes_C5"},{"value":"organicCarbon","label":"organicCarbon,organic carbon,C_organic_flux,Corg dens,Acc Rate TOC,TOC,Corg,% OC,% Organic carbon,OC-MAR (g),OC-MAR (mg),TOC_flux,TOCmg,Organic carbon concentration,Total Organic Carbon"},{"value":"RAN15","label":"RAN15,organic compound index"},{"value":"organicMatter","label":"organicMatter,organic matter,OM,organic,%_tom,OM dens"},{"value":"oxygen","label":"oxygen,%O"},{"value":"Paq","label":"Paq,P-aqueous"},{"value":"peat","label":"peat,Peat,peatFlux"},{"value":"pH","label":"pH,pHsoil,soilPH"},{"value":"phosphorus","label":"phosphorus,%P"},{"value":"P/Ca","label":"P/Ca,phosphorus/calcium"},{"value":"totalPollen","label":"totalPollen,pollen,TotalPollen,TreePollen"},{"value":"potassium","label":"potassium,K_,K,KProp,%K,% K,K peak area"},{"value":"K2O","label":"K2O,potassium oxide"},{"value":"K/Al","label":"K/Al,potassium/aluminum,ln(K/Al)"},{"value":"precipitation","label":"precipitation,Pannom,Panom,Precipitation,MAP,P,precip51yr,precip5yr,precipitation (with H-set),precipobs,Summer precipitation,Annual Precipitation,Summer Precipitation,Winter Precipitation,Precip"},{"value":"effectivePrecipitation","label":"effectivePrecipitation,precipitation minus evaporation,effectiveMoisture,Moisture_index,waterBalance"},{"value":"productivity","label":"productivity"},{"value":"composite","label":"composite,proxy composite,hybrid,Hybrid"},{"value":"pyrite","label":"pyrite"},{"value":"quartz","label":"quartz"},{"value":"age14C","label":"age14C,radiocarbon year,c14age,C14age,radiocarbonDatesAD0x2FBC"},{"value":"material","label":"material,reconstruction material,Material"},{"value":"sedimentationRate","label":"sedimentationRate,redimentation rate,sedRate,sed rate,Mean Sedim rate,Sedim rate"},{"value":"reflectance","label":"reflectance,blueIntensity,redness,Brightness,X_radiograph_dark_layer,L,red_color_intensity_units"},{"value":"relativeHumidity","label":"relativeHumidity,relative humidity,RH"},{"value":"residualChronology","label":"residualChronology,residual chronology method,residual"},{"value":"ringWidth","label":"ringWidth,ring width,trsgi,TRW"},{"value":"rubidium","label":"rubidium,Rb,Rb peak area"},{"value":"salinity","label":"salinity,SAUG,SETE,SFEV,SHIV,logSalinity,sss,SSS"},{"value":"sampleID","label":"sampleID,sample identification,Sample,sisalSampleID,sisalSampleIDComposite,OriginalSampleID,Sample ID,plotName,label,ID,Lab ID,sample_code,sampleNumber,DateID,Lab Code,sambleID,Sample interval,Sample label,sample_number,sampleIDa,sampleIDb,sampleIDc,samples,smapleID,sample # in section,Sample Label,sample"},{"value":"sand","label":"sand,%_sand,x_Sand,Sand"},{"value":"scandium","label":"scandium,ppm Sc"},{"value":"seaIce","label":"seaIce,sea ice cover,IMON1953,Sea_Ice_conc,Sea_Ice_months"},{"value":"silicon","label":"silicon,Si,SiProp,norm Silicon,Si peak area"},{"value":"Si/Al","label":"Si/Al,silicon/aluminum"},{"value":"Si/Ti","label":"Si/Ti,silicon/aluminum,norm Si/Ti"},{"value":"silt","label":"silt,Silt,%_silt,x_Silt"},{"value":"sodium","label":"sodium,Na,Na_"},{"value":"Na2O","label":"Na2O,sodium oxide"},{"value":"solarIrradiance","label":"solarIrradiance,solar irradiance,SunFrac"},{"value":"zscore","label":"zscore,standard deviation unit,Z_score"},{"value":"cluster","label":"cluster,statistical variable,cluster2"},{"value":"index","label":"index,statistical variable,PLS-1,PLS-2,SM/IlliteChlorite"},{"value":"streamflow","label":"streamflow,discharge,FebQ,AprQ,AugQ,DecQ,JanQ,JulyQ,JuneQ,MarchQ,MayQ,NovQ,OctQ,SeptQ"},{"value":"strontium","label":"strontium,Sr,ppm Sr,SR,Sr (ppm),Sr peak area"},{"value":"Sr/Ca","label":"Sr/Ca,strontium/calcium,CDR3_SrCa,WR11_SrCa,SrCa,log_SrCa,Sr_Ca,SrCa_annual"},{"value":"SO4","label":"SO4,sulfate,SO4__"},{"value":"sulfate","label":"sulfate"},{"value":"sulfur","label":"sulfur,S,Sulfur,Sulphur"},{"value":"S/Ca","label":"S/Ca,sulfur/calcium"},{"value":"temperature","label":"temperature,temperature variable,t-source,temperatureComposite,nonReliabletemperature,Temperature,nonReliableTemperature,deep.temp,T anomaly,TETE,TFEV,THIV,JulTanom,JulTanomLoess,Pollen_T,SST_from_Uk37,Tanom,SST-d18O,APR,AUG,Feb,FRA06 Air Temperature,Ice_core_C,interpolatedTemperature,Jan,JUL,JUN,MAAT,MAT,MAY,MeanT,MSAT,MSAT Russell 2018,nonReliableTemperature 1,nonReliabletemperature 2,nonReliableTemperature_1,nonReliableTemperature_2,nonReliableTemperature_3,nonReliableTemperature_4,NOV,OCT,PLS_C2_temp,SBT,SEP,smoothedTemp,soilTemp,SST_amj,SST_from_planktic0x2Ed18O,SST_from_planktic0x2EMgCa,SST_LDI,subT,Temp Anom 10 CI,Temp Anom 25,Temp Anom 75,Temp Anom 90,Temp Anom Best,Temp Anom FOR15,Temp Anom FRA06,Temp Anom FRA06-TR,temp2,temp2s,tempAv0,tempAv8,temperature 1,temperature 2,temperature_1,temperature_2,temperature_3,temperature_4,temperaturer2,tempK,tempNoElevCorrection,tempNoSourceCorrection,tempPartialCorrect,tempSmooth5,SST,temp,Temp,Tsource"},{"value":"TEX86","label":"TEX86,tetraether index of 86 carbon atoms,tex86l"},{"value":"thickness","label":"thickness,thicknessComposite,Samp thick,sample_thickness,Thickness,Sample thickness"},{"value":"titanium","label":"titanium,Ti,Ti peak area,TiProp,Tiash,Titanium,% Ti,%Ti"},{"value":"TiO2","label":"TiO2,titanium dioxide"},{"value":"Ti/Al","label":"Ti/Al,titanium/aluminum"},{"value":"Ti/Ca","label":"Ti/Ca,titanium/calcium,ln(Ti/Ca),ln(ti/ca),log(Ti/Ca)"},{"value":"dinocyst","label":"dinocyst,total dinocysts,flux_dino"},{"value":"TDS","label":"TDS,total dissolved solids"},{"value":"uncertaintyLow","label":"uncertaintyLow,unspecified error lower bound,lowerErr,Acc min,ageMin,agelinInterpUncertaintyLow,ageBchronUncertaintyLow,agecopRaUncertaintyLow,ageYoung,ageStalAgeUncertaintyLow,ageBaconUncertaintyLow,agelinRegUncertaintyLow,ageOxCalUncertaintyLow,ageUncertaintyLow,age_min,cal_age_range_young,D18O-,D13C-,D18Oivc-,error_younger_age,Age_min,min age,min Age,minAge,age min,age_young,Chironomid d18O min,d18OUncertaintyLow,∆RH_lower,UncertaintyDust0x5B0x250x5D0x28Minus0x29,MinElevM,meltUncertaintyLow,lakeLevelMin,lakeLevelLo,Pmin,PanomMinUncertainty,PannomMinUncertainty,MAP_min,precip-,PannomMin,PanomMin,min RH,SAUG_i,SETE_i,SFEV_i,SHIV_i,IMON1953_i,TETE_i,TFEV_i,THIV_i,tempErrorLower,JAS-,MAT_min,MATmin,temperatureCold,WMT_min,WMTmin,TreeCover_min,errorLow,errorLow2,undertainty_minus,yearBottom,SunFracMin,yearTop"},{"value":"uncertaintyHigh","label":"uncertaintyHigh,unspecified error upper bound,SunFracMax,Acc max,ageOld,agelinInterpUncertaintyHigh,ageBchronUncertaintyHigh,agecopRaUncertaintyHigh,ageStalAgeUncertaintyHigh,ageBaconUncertaintyHigh,agelinRegUncertaintyHigh,ageOxCalUncertaintyHigh,ageUncertaintyHigh,AgeOld,age_max,cal_age_range_old,error_older_age,Age_max,max age,max Age,maxAge,age max,age_old,Chironomid d18O max,d18OUncertaintyHigh,D18O+,D13C+,D18Oivc+,∆RH_upper,UncertaintyDust0x5B0x250x5D0x28Plus0x29,MaxElevM,meltUncertaintyHigh,lakeLevelMax,lakeLevelHi,Pmax,PanomMaxUncertainty,PannomMaxUncertainty,MAP_max,precip+,PannomMax,PanomMax,max RH,SAUG_s,SETE_s,SFEV_s,SHIV_s,IMON1953_s,TETE_s,TFEV_s,THIV_s,tempErrorUpper,JAS+,MAT_max,MATmax,temperatureWarm,tempErrorPlus,WMT_max,WMTmax,TreeCover_max,ageMax,errorUp,errorUp2,uncertainty_plus,upper band,upperErr,upperErr2,year_old"},{"value":"uncertainty","label":"uncertainty,unspecified margin of error,C20 Total Unc,C22 Total Unc,C30 Total Unc,bubbleNumberDensityError,ageUncertainty,Age_uncertainty,Age, uncertainty (±),ageError,ageUncertaintyOther,d13CPrecision,d13CStandard,d13C Error,d13C std dev,13CleafwaxC29-33err,d13C_error,d18OPrecision,d18OStandard,d18OPrecisionComposite,d18OStandardComposite,d18OUncertainty,d18O_error,d18O error,d18O_Grass_leaf_error,d18O_Sphagnum_error,dDUncertainty,dD error,dD unc,nC30_err,d2HleafwaxC28err,DMAR_error,DMAR_uncertainty,Epsilon C28-C22 uncertainty,Epsilon28-22uncertainty,Epsilon C28-C24 uncertainty,Epsilon Uncertainty,lakeAreaError,lakeVolumeError,precipitationUncertainty,Annual Precipitation Error,Summer Precipitation Error,Winter Precipitation error,SrCaUncertainty,temperatureUncertainty,uncertainty.temperature,uncertainty_temperature,JAS_error,T_site_std,tempError,temperature_error,JASerror,UK_error,UK37_error,A_site_std,error,uncertainty_1,uncertainty_2,uncertainty_3,uncertainty_4,error1,error2,error3,err,range,TTerror,Calibration Error,C24 Total Unc,C26 Total Unc,C28 Total Unc"},{"value":"upwelling","label":"upwelling,Upwelling Index"},{"value":"uranium","label":"uranium,U"},{"value":"vanadium","label":"vanadium,ppm V"},{"value":"V/Al","label":"V/Al,vanadium/aluminum"},{"value":"varveThickness","label":"varveThickness,varve thickness,Varve thickness,Varve_width"},{"value":"volume","label":"volume,Samp vol"},{"value":"waterContent","label":"waterContent,water content"},{"value":"waterTableDepth","label":"waterTableDepth,water table depth,Water Table,Water Table Detrended,water wm,water_table_depth,Water_tableDepth"},{"value":"year","label":"year,Year,year start,age_CE,Recon0x2EDate,yearRounded,yearEnsemble,Year b2k"},{"value":"yttrium","label":"yttrium,ppm Y"},{"value":"zinc","label":"zinc,ppm Zn"},{"value":"zirconium","label":"zirconium,Zr,ppm Zr"},{"value":"Zr/Al","label":"Zr/Al,zirconium/aluminum"},{"value":"Zr/Rb","label":"Zr/Rb,zirconium/rubidium"},{"value":"acinocyclus.Curvatulus","label":"acinocyclus.Curvatulus,Acinocyclus. curvatulus"},{"value":"n-alkane","label":"n-alkane"},{"value":"n-alkaneRatio","label":"n-alkaneRatio,Norm33"},{"value":"ArtemesiaChenopodiumSar","label":"ArtemesiaChenopodiumSar,ArtChenoSar"},{"value":"Picea","label":"Picea"},{"value":"Artemisia","label":"Artemisia"},{"value":"Pinyon","label":"Pinyon"},{"value":"broadleavedWoodyCover","label":"broadleavedWoodyCover,BroadleavedWoodyCover___"},{"value":"Quercus","label":"Quercus"},{"value":"abies","label":"abies,Abies"},{"value":"actinocyclusCurvatulus","label":"actinocyclusCurvatulus,Actinocyclus_curvatulus"},{"value":"alnus","label":"alnus,Alnus"},{"value":"azpeitiaNodulifer","label":"azpeitiaNodulifer,Azpeitia_nodulifer"},{"value":"Compositae","label":"Compositae"},{"value":"Roperia_tesselata","label":"Roperia_tesselata,Roperia tesselata"},{"value":"Sequoia","label":"Sequoia"},{"value":"herbs","label":"herbs,Herbs___"},{"value":"Gramineae","label":"Gramineae"},{"value":"AustralocyprisRobusta","label":"AustralocyprisRobusta"},{"value":"Coscinodiscus_radiatus","label":"Coscinodiscus_radiatus"},{"value":"Cyperaceae","label":"Cyperaceae"},{"value":"Npachderma","label":"Npachderma"},{"value":"pachysin","label":"pachysin,percent_pachysin"},{"value":"Pinus","label":"Pinus"},{"value":"Pseudtsuga","label":"Pseudtsuga"},{"value":"Stephanopyxis","label":"Stephanopyxis"},{"value":"Tsuga_heterophylla","label":"Tsuga_heterophylla"},{"value":"Eukieffe","label":"Eukieffe"},{"value":"euplank","label":"euplank"},{"value":"F_curta_gp","label":"F_curta_gp,F_curta_gp_"},{"value":"Fir","label":"Fir"},{"value":"Fragilariopsis","label":"Fragilariopsis"},{"value":"Freshwater_planktic","label":"Freshwater_planktic"},{"value":"Foraminifera","label":"Foraminifera,G.sacculifer"},{"value":"hemidiscusCuneiformis","label":"hemidiscusCuneiformis,Hemidiscus cuneiformis,Hemidiscus_cuneiformis"},{"value":"Heterotr","label":"Heterotr"},{"value":"DiacyprisCompacta","label":"DiacyprisCompacta"},{"value":"A. octonarius","label":"A. octonarius,A_octonarius"},{"value":"A. tabularis","label":"A. tabularis,A_tabularis"},{"value":"actinocyclusOctonarius","label":"actinocyclusOctonarius,Actinocyclus_octonarius"},{"value":"actinoptychus","label":"actinoptychus,Actinoptychus,Actinoptychus spp."},{"value":"Actinoptychus_and_Paralia","label":"Actinoptychus_and_Paralia"},{"value":"Actinoptychus spp.","label":"Actinoptychus spp.,Actinoptychus_spp."},{"value":"Ailanthus","label":"Ailanthus"},{"value":"Dictyocha_acueata","label":"Dictyocha_acueata"},{"value":"Anadenanthera","label":"Anadenanthera"},{"value":"Artemesia","label":"Artemesia"},{"value":"ArtemisiaCount","label":"ArtemisiaCount"},{"value":"Az. tabularis","label":"Az. tabularis"},{"value":"Azpeitia nodulifer","label":"Azpeitia nodulifer"},{"value":"BorealShrubs","label":"BorealShrubs"},{"value":"BorealTrees","label":"BorealTrees"},{"value":"hygrophytes","label":"hygrophytes,Hygrophytes"},{"value":"CIA","label":"CIA,chemical index of alteration"},{"value":"Chaetoceros spores","label":"Chaetoceros spores"},{"value":"Chaetoceros_spores","label":"Chaetoceros_spores"},{"value":"Chaoboru","label":"Chaoboru"},{"value":"Chenopodiacaeae","label":"Chenopodiacaeae"},{"value":"Chenopodiaceae","label":"Chenopodiaceae"},{"value":"chironomid","label":"chironomid,Chironom"},{"value":"Chironomid_C","label":"Chironomid_C"},{"value":"rejected","label":"rejected"},{"value":"Compositeae","label":"Compositeae"},{"value":"conc_dino","label":"conc_dino"},{"value":"Corynone","label":"Corynone"},{"value":"Coscinodiscus_spp.","label":"Coscinodiscus_spp.,Coscinodiscus spp."},{"value":"Coscinodiscus_large","label":"Coscinodiscus_large"},{"value":"cloudiness","label":"cloudiness,oktas_r"},{"value":"Cricotop","label":"Cricotop"},{"value":"Cyclotella_spp.","label":"Cyclotella_spp.,Cyclotella spp.,Cyclotella_spp"},{"value":"D_aff_D_aculeata","label":"D_aff_D_aculeata"},{"value":"D_aspinosa","label":"D_aspinosa"},{"value":"D_calida","label":"D_calida"},{"value":"D_calida_ampliata","label":"D_calida_ampliata"},{"value":"D_perlaevis","label":"D_perlaevis"},{"value":"D_stapedia","label":"D_stapedia"},{"value":"Dc_stapedia_aspinosa","label":"Dc_stapedia_aspinosa"},{"value":"Delphineis","label":"Delphineis"},{"value":"Inaperturate","label":"Inaperturate"},{"value":"pollenRatio","label":"pollenRatio,((( null ))) AC Ratio? /// pollenRatio,A/C,A/C Ratio"},{"value":"Juyanze","label":"Juyanze"},{"value":"Misodendron","label":"Misodendron"},{"value":"needsToBeSplitIntoMultiples","label":"needsToBeSplitIntoMultiples,depth-range,depthRange,depth_range"},{"value":"MytilocyprisPraenuncia","label":"MytilocyprisPraenuncia"},{"value":"N_sicula","label":"N_sicula"},{"value":"NeedleleavedWoodyCover","label":"NeedleleavedWoodyCover,NeedleavedWoodyCoverStdDev___,NeedleleavedWoodyCover___"},{"value":"Neodenticula_seminae","label":"Neodenticula_seminae"},{"value":"Nitzschia_interruptestriata","label":"Nitzschia_interruptestriata"},{"value":"O_pulchra_(med)","label":"O_pulchra_(med)"},{"value":"O_pulchra_(small)","label":"O_pulchra_(small)"},{"value":"O_pulchra_(thick)","label":"O_pulchra_(thick)"},{"value":"Octactis_pulchra_(lrg)","label":"Octactis_pulchra_(lrg)"},{"value":"Oliverid","label":"Oliverid"},{"value":"Other_planktic","label":"Other_planktic"},{"value":"P. nitidum","label":"P. nitidum"},{"value":"Paraclad","label":"Paraclad"},{"value":"Paralia sulcata","label":"Paralia sulcata"},{"value":"Paralia_sucata","label":"Paralia_sucata"},{"value":"Pentaneu","label":"Pentaneu"},{"value":"Percent_fine_fraction","label":"Percent_fine_fraction"},{"value":"PiceaCount","label":"PiceaCount"},{"value":"PiceaPinus","label":"PiceaPinus"},{"value":"Pine","label":"Pine"},{"value":"Pinus/Artemesia","label":"Pinus/Artemesia,pinus/atremisia"},{"value":"PinusEdulisCount","label":"PinusEdulisCount"},{"value":"PinusTotalCount","label":"PinusTotalCount"},{"value":"aquaticPollen","label":"aquaticPollen,Pollen aquat"},{"value":"Pollen_conc","label":"Pollen_conc,Pollen conc"},{"value":"Pollen_fern_spores","label":"Pollen_fern_spores,Pollen fern spores"},{"value":"Pollen_herbs","label":"Pollen_herbs,Pollen herbs"},{"value":"Pollen_indet","label":"Pollen_indet,Pollen indet"},{"value":"pollen_sequence","label":"pollen_sequence,pollen sequence"},{"value":"Pollen_sequence","label":"Pollen_sequence,Pollen sequence"},{"value":"Pollen_trees+shrubs","label":"Pollen_trees+shrubs,Pollen trees+shrubs"},{"value":"pollen_count","label":"pollen_count"},{"value":"pollen_grains/gram","label":"pollen_grains/gram"},{"value":"Pollen_spores_Total","label":"Pollen_spores_Total,Pollen_spores_Total___"},{"value":"PollenConc","label":"PollenConc"},{"value":"pollenSum","label":"pollenSum"},{"value":"Procladi","label":"Procladi"},{"value":"Psectroc","label":"Psectroc"},{"value":"Pseudodi","label":"Pseudodi"},{"value":"Pseudoeunotia_doliolus","label":"Pseudoeunotia_doliolus"},{"value":"quercus_juniperus_cercocarpus","label":"quercus_juniperus_cercocarpus"},{"value":"ReticyprisHerbstii","label":"ReticyprisHerbstii"},{"value":"ReticyprisSp","label":"ReticyprisSp"},{"value":"Rhizosolenia","label":"Rhizosolenia"},{"value":"Score_Steppe","label":"Score_Steppe,Score_Steppe_"},{"value":"Score_Taiga","label":"Score_Taiga,Score_Taiga_"},{"value":"Score_Tundra","label":"Score_Tundra,Score_Tundra_"},{"value":"Sergenti","label":"Sergenti"},{"value":"Stephanopyxis_spp.","label":"Stephanopyxis_spp.,Stephanopyxis spp."},{"value":"Stictoch","label":"Stictoch"},{"value":"T_mertensianna","label":"T_mertensianna"},{"value":"T_oestrupii","label":"T_oestrupii"},{"value":"T_pacifica","label":"T_pacifica"},{"value":"T_spp","label":"T_spp"},{"value":"Tanytars","label":"Tanytars"},{"value":"Thalassiosira spp.","label":"Thalassiosira spp."},{"value":"Thalassiosira_excentrica","label":"Thalassiosira_excentrica"},{"value":"Thalassiothrix_longissima","label":"Thalassiothrix_longissima"},{"value":"Thronshrub","label":"Thronshrub"},{"value":"tycho","label":"tycho"},{"value":"V humeralis","label":"V humeralis"},{"value":"Zalutsch","label":"Zalutsch"},{"value":"Ephedra","label":"Ephedra"},{"value":"Poaceae","label":"Poaceae"}]
    var proxylist = [{"value":"10Be","label":"10Be"},{"value":"accumulation rate","label":"accumulation rate,sed accumulation"},{"value":"ACL","label":"ACL,average chain length"},{"value":"Al2O3","label":"Al2O3,aluminum oxide"},{"value":"Al/Ca","label":"Al/Ca,aluminum/calcium"},{"value":"Al/Si","label":"Al/Si,AlSi"},{"value":"alkenone","label":"alkenone,Alkenone"},{"value":"n-alkane","label":"n-alkane"},{"value":"amoeba","label":"amoeba,testate amoeba"},{"value":"Ba/Al","label":"Ba/Al,Barium/Aluminum"},{"value":"Ba/Ca","label":"Ba/Ca,barium/calcium,BaCa"},{"value":"Ba/Sr","label":"Ba/Sr"},{"value":"biomarker","label":"biomarker,C15 fatty alcohols,C37.concentration"},{"value":"BIT","label":"BIT,branched and isoprenoid tetraether index,BITindex"},{"value":"borehole","label":"borehole"},{"value":"BSi","label":"BSi,biogenic silica"},{"value":"bubble frequency","label":"bubble frequency"},{"value":"bulk density","label":"bulk density,gamma"},{"value":"bulk sediment","label":"bulk sediment,dry sediment,BulkSed"},{"value":"C/N","label":"C/N,carbon/nitrogen"},{"value":"Ca","label":"Ca,calcium"},{"value":"Ca/K","label":"Ca/K,calcium/potassium"},{"value":"Ca/Ti","label":"Ca/Ti,calcium/titanium"},{"value":"Ca/Mg","label":"Ca/Mg"},{"value":"CaCO3","label":"CaCO3,calcium carbonate"},{"value":"calcification rate","label":"calcification rate,calcification"},{"value":"calcite","label":"calcite"},{"value":"carbonate","label":"carbonate,authigenic carbonate,Carbonate content"},{"value":"CBT","label":"CBT,cyclization index of branched tetraethers"},{"value":"cellulose","label":"cellulose"},{"value":"charcoal","label":"charcoal"},{"value":"chironomid","label":"chironomid,midge,Chironomid"},{"value":"chlorophyll","label":"chlorophyll"},{"value":"chrysophyte assemblage","label":"chrysophyte assemblage,chrysophyte"},{"value":"cladoceran","label":"cladoceran,Cladocera"},{"value":"coccolithophore","label":"coccolithophore,coccolith"},{"value":"d13C","label":"d13C,delta 13C,d13Cwax"},{"value":"d15N","label":"d15N,delta 15N"},{"value":"d15N/d40Ar","label":"d15N/d40Ar,15N/40Ar fractionation,d15Nd40Ar"},{"value":"d18O","label":"d18O,delta 18O,cellulose d18O,delta18O,foram d18O"},{"value":"dD","label":"dD,delta 2H,d2H,dDwax,leaf wax,LeafWax,leafWax"},{"value":"deuterium excess","label":"deuterium excess,deterium excess,dx"},{"value":"diatom","label":"diatom"},{"value":"dinocyst","label":"dinocyst,dinoflagellate,dynocist MAT"},{"value":"dolomite","label":"dolomite,CaMg(CO3)2"},{"value":"dry bulk density","label":"dry bulk density,DBD"},{"value":"Eu/Zr","label":"Eu/Zr"},{"value":"Fe","label":"Fe,iron"},{"value":"Fe/Al","label":"Fe/Al,iron/aluminum"},{"value":"Fe/Ca","label":"Fe/Ca,FeCa"},{"value":"Fe/K","label":"Fe/K,iron/potassium"},{"value":"Fe/Mn","label":"Fe/Mn,iron/manganese"},{"value":"foraminifera","label":"foraminifera,foraminifer,benthic foraminifers,N. dutertrei,planktonic foraminifera,planktonic foraminifera, transfer function,Uvigerina mediterranea,G. bulloides"},{"value":"GDGT","label":"GDGT,glycerol dialkyl glycerol tetraether,brGDGT"},{"value":"grain size","label":"grain size,particle size"},{"value":"HBI","label":"HBI,highly-branched isoprenoid alkene"},{"value":"historical","label":"historical,Documentary,historic"},{"value":"humification","label":"humification,humification index"},{"value":"ice accumulation","label":"ice accumulation,Ice Accumulation"},{"value":"ice melt","label":"ice melt,melt,melt layer"},{"value":"inorganic carbon","label":"inorganic carbon,TIC"},{"value":"IP25","label":"IP25,ice proxy with 25 carbon atoms"},{"value":"K/Al","label":"K/Al,potassium/aluminum"},{"value":"lake level","label":"lake level,Lake stratigraphy and radiocarbon dating of macrofossils,lakeLevel,lakelevel,LakeStatus"},{"value":"latewood cellulose","label":"latewood cellulose,late-wood cellulose"},{"value":"LDI","label":"LDI,long-chain diol index,long chain diol"},{"value":"macrofossils","label":"macrofossils,plant macrofossils"},{"value":"magnetic","label":"magnetic,ARM/IRM,IRM"},{"value":"magnetic susceptibility","label":"magnetic susceptibility,Magnetic Susceptibility,MS"},{"value":"mass accumulation rate","label":"mass accumulation rate,mass per area per time unit,MAR"},{"value":"maximum latewood density","label":"maximum latewood density,latewood density,delta Density,MXD"},{"value":"Mg","label":"Mg,magnesium"},{"value":"Mg/Ca","label":"Mg/Ca,magnesium/calcium,foram Mg/Ca,Foram Mg/Ca,MgCa"},{"value":"Mn/Fe","label":"Mn/Fe,manganese/iron,MnFe"},{"value":"Mn/Ti","label":"Mn/Ti,manganese/titanium,MnTi"},{"value":"multiproxy","label":"multiproxy,multiple proxies,Ti,Ca,K,pore ice d2H and d18O,hybrid,Hybrid Grain Size,hybrid-ice,hybrid-lake"},{"value":"deleteMe","label":"deleteMe,PCA,((( calcium carbonate ))) accumulation /// null,3-OH-Fatty Acids,Age,CAS,coral,element,Element Ratio,ice,isotope,isotope diffusion,MG0,middle-wood cellulose,mineral,mineralogy,percent,sediment,Sediment,TDS,trace element / CA,TraceElement, ,u Cluster 2"},{"value":"CIA","label":"CIA,Chemical Index of Alteration"},{"value":"ostracod","label":"ostracod"},{"value":"P-aqueous","label":"P-aqueous,Paq"},{"value":"peat ash","label":"peat ash"},{"value":"pH","label":"pH"},{"value":"pollen","label":"pollen,aquatic palynomorphs"},{"value":"radiolaria","label":"radiolaria,radiolarian"},{"value":"Rb","label":"Rb,rubidium"},{"value":"Rb/Sr","label":"Rb/Sr"},{"value":"reflectance","label":"reflectance"},{"value":"ring width","label":"ring width,TRW"},{"value":"RIAN","label":"RIAN"},{"value":"sedimentation rate","label":"sedimentation rate,Sedimentation rate"},{"value":"Sr","label":"Sr,strontium"},{"value":"Sr/Ca","label":"Sr/Ca,strontium/calcium,Ca/Sr,Coral Sr/Ca,SrCa"},{"value":"stratigraphy","label":"stratigraphy,Minerogenic layers,Plant detrital layers,Stratigraphy"},{"value":"sulfur","label":"sulfur,S"},{"value":"TEX86","label":"TEX86,tetraether index of 86 carbon atoms"},{"value":"Ti","label":"Ti,titanium"},{"value":"Ti/Al","label":"Ti/Al,titanium/aluminum"},{"value":"Ti/Ca","label":"Ti/Ca,titanium/calcium,ln(ti/ca),Ti/CA,TiCa"},{"value":"TOC","label":"TOC,organic carbon,LOI"},{"value":"total nitrogen","label":"total nitrogen,TN"},{"value":"varve thickness","label":"varve thickness,varve,Varve,varve property,varves"}]
    var continentlist = [{"value":"Africa","label":"Africa"},{"value":"Antarctica","label":"Antarctica"},{"value":"Asia","label":"Asia"},{"value":"Australia","label":"Australia"},{"value":"Europe","label":"Europe"},{"value":"North America","label":"North America"},{"value":"South America","label":"South America"}]
    var countrylist = [{"value":"Afghanistan","label":"Afghanistan"},{"value":"Aland","label":"Aland"},{"value":"Albania","label":"Albania"},{"value":"Algeria","label":"Algeria"},{"value":"Antarctica","label":"Antarctica"},{"value":"Argentina","label":"Argentina"},{"value":"Armenia","label":"Armenia"},{"value":"Australia","label":"Australia"},{"value":"Austria","label":"Austria"},{"value":"Belarus","label":"Belarus"},{"value":"Belgium","label":"Belgium"},{"value":"Belize","label":"Belize"},{"value":"Bermuda","label":"Bermuda"},{"value":"Bhutan","label":"Bhutan"},{"value":"Bolivia","label":"Bolivia"},{"value":"Botswana","label":"Botswana"},{"value":"Brazil","label":"Brazil"},{"value":"Bulgaria","label":"Bulgaria"},{"value":"Burundi","label":"Burundi"},{"value":"Canada","label":"Canada"},{"value":"Cayman Islands","label":"Cayman Islands"},{"value":"Chad","label":"Chad"},{"value":"Chile","label":"Chile"},{"value":"China","label":"China"},{"value":"Colombia","label":"Colombia"},{"value":"Cook Islands","label":"Cook Islands"},{"value":"Costa Rica","label":"Costa Rica"},{"value":"Cuba","label":"Cuba"},{"value":"Czech Republic","label":"Czech Republic"},{"value":"Democratic Republic of the Congo","label":"Democratic Republic of the Congo"},{"value":"Denmark","label":"Denmark"},{"value":"Djibouti","label":"Djibouti"},{"value":"Dominican Republic","label":"Dominican Republic"},{"value":"Ecuador","label":"Ecuador"},{"value":"Egypt","label":"Egypt"},{"value":"Estonia","label":"Estonia"},{"value":"Ethiopia","label":"Ethiopia"},{"value":"Faroe Islands","label":"Faroe Islands"},{"value":"Finland","label":"Finland"},{"value":"France","label":"France"},{"value":"French Polynesia","label":"French Polynesia"},{"value":"Georgia","label":"Georgia"},{"value":"Germany","label":"Germany"},{"value":"Ghana","label":"Ghana"},{"value":"Greece","label":"Greece"},{"value":"Greenland","label":"Greenland"},{"value":"Guam","label":"Guam"},{"value":"Guatemala","label":"Guatemala"},{"value":"Haiti","label":"Haiti"},{"value":"Hungary","label":"Hungary"},{"value":"Iceland","label":"Iceland"},{"value":"India","label":"India"},{"value":"Indonesia","label":"Indonesia"},{"value":"Iran","label":"Iran"},{"value":"Ireland","label":"Ireland"},{"value":"Israel","label":"Israel"},{"value":"Italy","label":"Italy"},{"value":"Jamaica","label":"Jamaica"},{"value":"Japan","label":"Japan"},{"value":"Jordan","label":"Jordan"},{"value":"Kazakhstan","label":"Kazakhstan"},{"value":"Kenya","label":"Kenya"},{"value":"Kyrgyzstan","label":"Kyrgyzstan"},{"value":"Laos","label":"Laos"},{"value":"Lebanon","label":"Lebanon"},{"value":"Libya","label":"Libya"},{"value":"Lithuania","label":"Lithuania"},{"value":"Luxembourg","label":"Luxembourg"},{"value":"Macedonia","label":"Macedonia"},{"value":"Madagascar","label":"Madagascar"},{"value":"Malawi","label":"Malawi"},{"value":"Malaysia","label":"Malaysia"},{"value":"Mali","label":"Mali"},{"value":"Malta","label":"Malta"},{"value":"Mauritania","label":"Mauritania"},{"value":"Mexico","label":"Mexico"},{"value":"Mongolia","label":"Mongolia"},{"value":"Morocco","label":"Morocco"},{"value":"Namibia","label":"Namibia"},{"value":"Nauru","label":"Nauru"},{"value":"Nepal","label":"Nepal"},{"value":"Netherlands","label":"Netherlands"},{"value":"New Zealand","label":"New Zealand"},{"value":"Nicaragua","label":"Nicaragua"},{"value":"Niger","label":"Niger"},{"value":"Nigeria","label":"Nigeria"},{"value":"Norway","label":"Norway"},{"value":"Oman","label":"Oman"},{"value":"Pakistan","label":"Pakistan"},{"value":"Papua New Guinea","label":"Papua New Guinea"},{"value":"Peru","label":"Peru"},{"value":"Poland","label":"Poland"},{"value":"Portugal","label":"Portugal"},{"value":"Romania","label":"Romania"},{"value":"Russia","label":"Russia"},{"value":"Saudi Arabia","label":"Saudi Arabia"},{"value":"Senegal","label":"Senegal"},{"value":"Seychelles","label":"Seychelles"},{"value":"Slovakia","label":"Slovakia"},{"value":"Slovenia","label":"Slovenia"},{"value":"South Africa","label":"South Africa"},{"value":"South Korea","label":"South Korea"},{"value":"South Sudan","label":"South Sudan"},{"value":"Spain","label":"Spain"},{"value":"Sudan","label":"Sudan"},{"value":"Sweden","label":"Sweden"},{"value":"Switzerland","label":"Switzerland"},{"value":"Syria","label":"Syria"},{"value":"Taiwan","label":"Taiwan"},{"value":"Tajikistan","label":"Tajikistan"},{"value":"Thailand","label":"Thailand"},{"value":"The Bahamas","label":"The Bahamas"},{"value":"Togo","label":"Togo"},{"value":"Tunisia","label":"Tunisia"},{"value":"Turkey","label":"Turkey"},{"value":"Uganda","label":"Uganda"},{"value":"Ukraine","label":"Ukraine"},{"value":"United Kingdom","label":"United Kingdom"},{"value":"United Republic of Tanzania","label":"United Republic of Tanzania"},{"value":"United States of America","label":"United States of America"},{"value":"Uzbekistan","label":"Uzbekistan"},{"value":"Vanuatu","label":"Vanuatu"},{"value":"Venezuela","label":"Venezuela"},{"value":"Vietnam","label":"Vietnam"},{"value":"West Bank","label":"West Bank"},{"value":"Western Sahara","label":"Western Sahara"},{"value":"Yemen","label":"Yemen"},{"value":"Zambia","label":"Zambia"}]
    var compilationlist = [{"value":"iso2k","label":"iso2k-*latest*"},{"value":"iso2k-1_0_0","label":"iso2k-1_0_0"},{"value":"iso2k-1_0_1","label":"iso2k-1_0_1"},{"value":"Pages2kTemperature","label":"Pages2kTemperature-*latest*"},{"value":"Pages2kTemperature-2_1_2","label":"Pages2kTemperature-2_1_2"},{"value":"SISAL","label":"SISAL-*latest*"},{"value":"SISAL-LiPD-2_0_0","label":"SISAL-LiPD-2_0_0"},{"value":"SISAL-LiPD-2_0_1","label":"SISAL-LiPD-2_0_1"},{"value":"Temp12k","label":"Temp12k-*latest*"},{"value":"Temp12k-1_0_1","label":"Temp12k-1_0_1"},{"value":"Temp12k-1_0_2","label":"Temp12k-1_0_2"},{"value":"Temp12k-1_1_0","label":"Temp12k-1_1_0"},{"value":"Temp12k-1_2_0","label":"Temp12k-1_2_0"},{"value":"wNAm","label":"wNAm-*latest*"},{"value":"wNAm-0_15_1","label":"wNAm-0_15_1"},{"value":"wNAm-0_3_0","label":"wNAm-0_3_0"},{"value":"wNAm-0_6_0","label":"wNAm-0_6_0"},{"value":"wNAm-1_0_0","label":"wNAm-1_0_0"}]
    var seasonalitylist = [{"value":"Annual","label":"Annual"},{"value":"Growing Season","label":"Growing Season"},{"value":"Warmest Month","label":"Warmest Month"},{"value":"Coldest Month","label":"Coldest Month"},{"value":"Wet Season","label":"Wet Season"},{"value":"Winter","label":"Winter"},{"value":"Spring","label":"Spring"},{"value":"Summer","label":"Summer"},{"value":"Fall","label":"Fall"},{"value":"subannual","label":"subannual"}]

    var dropdownHTML = String.raw``
    const s = fs.readFileSync('/root/presto/query/' + recon + '.yml','utf8');
    const ret = YAML.parse(s)
    for (var key1 in Object.keys(ret)) {
	const ii = Object.keys(ret)[key1]
	var groups = ret[ii]
	console.log('key1: ' + key1)
	console.log('key: ' + ii)
	console.log('list: ' + ret[ii].options)
	for (var key2 in groups) {
		const iii = ret[ii][key2]
		console.log('key2: ' + key2)
		console.log('iii: ' + iii)
		if (hasdropdown.includes(key2)){
		    console.log('dropdown key: ' + hasdropdown.includes(key2))
		    console.log('key2 keys: ' + JSON.stringify(ret[ii][key2]))
		    console.log('All choices?: ' + ret[ii][key2].options)
		    if (ret[ii][key2].options != "All") {
			dropdownHTML = dropdownHTML + String.raw`var ` + key2 + String.raw`list = [`
			for (gg in ret[ii][key2].options) {
				console.log('option: ' + gg)
				dropdownHTML = dropdownHTML + String.raw`{"value":"` + gg + `","label":"` + gg + `"},` + `\n`
			}
			dropdownHTML = dropdownHTML.substring(0, dropdownHTML.length - 1) + `"]` + `\n`
		    } else {
			dropdownHTML = dropdownHTML + `\n` + String.raw`var ` + key2 + String.raw`list = ` + JSON.stringify(eval(key2 + 'list')) + `\n`
		    }
	        }
	}
    }
    return dropdownHTML
}
	

const htmlString = String.raw`<!DOCTYPE html>` + `\n`
+ String.raw`<html>` + `\n`
+ String.raw`<head>` + `\n`
+ String.raw`    <meta charset="utf-8" />` + `\n`
+ String.raw`    <title>Autocomplete Lipdverse Query</title>` + `\n`
+ String.raw`    <meta name="viewport" content="width=device-width, initial-scale=1">` + `\n`
+ String.raw`    <meta name="robots" content="noindex">` + `\n`
+ String.raw` <link rel="stylesheet" href="//code.jquery.com/ui/1.11.0/themes/smoothness/jquery-ui.css">` + `\n`
+ String.raw`     <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css"` + `\n`
+ String.raw`        integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A=="` + `\n`
+ String.raw`        crossorigin="" />` + `\n`
+ String.raw`	<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css">` + `\n`
+ String.raw`	<link rel="stylesheet" href="/style.default.css" id="theme-stylesheet">` + `\n`
+ String.raw`    <!--link rel="stylesheet" href="https://unpkg.com/@bopen/leaflet-area-selection@0.6.1/dist/index.css" /-->` + `\n`
+ String.raw`	<link rel="stylesheet" href="/leaflet.legend.css">` + `\n`
+ String.raw`	<link rel="stylesheet" href="/spinner.css">` + `\n`
+ String.raw`    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"` + `\n`
+ String.raw`        integrity="sha512-XQoYMqMTK8LvdxXYG3nZ448hOEQiglfqkJs1NOQV44cWnUrBc8PkAOcXy20w0vlaXaVUearIOBhiXZ5V3ynxwA=="` + `\n`
+ String.raw`        crossorigin=""></script>` + `\n`
+ String.raw`	<link rel="stylesheet" href="/slider.css">` + `\n`
+ String.raw`` + `\n`
+ String.raw`	<script src="https://cdn.jsdelivr.net/npm/js-base64@3.7.6/base64.min.js"></script>` + `\n`
+ String.raw`	<!--script src="leaflet-src.js"></script-->` + `\n`
+ String.raw`	<script src="/Leaflet.draw.js"></script>` + `\n`
+ String.raw`	<script src="/Leaflet.Draw.Event.js"></script>` + `\n`
+ String.raw`	<script src="/TouchEvents.js"></script>` + `\n`
+ String.raw`	<script src="/Edit.SimpleShape.js"></script>` + `\n`
+ String.raw`	<script src="/Edit.Rectangle.js"></script>` + `\n`
+ String.raw`	` + `\n`
+ String.raw`	<script src="/leaflet-svg-shape-markers.min.js"></script>` + `\n`
+ String.raw`	<script src="/leaflet.legend.js"></script>` + `\n`
+ String.raw`	<script src="/spin.js"></script>` + `\n`
+ String.raw`` + `\n`
+ String.raw`	<script language="javascript" type="text/javascript" src="/data_forge.js"></script>` + `\n`
+ String.raw`` + `\n`
+ String.raw`	<!--script type="text/javascript">` + `\n`
+ String.raw`		const urlParams = new URLSearchParams(window.location.search);` + `\n`
+ String.raw`		//var params1 = ''` + `\n`
+ String.raw`		var jsonPath = "/" + urlParams.get('recon') + "_params.json"` + `\n`
+ String.raw`		async function grabParams() {` + `\n`
+ String.raw`	  		const response = await fetch(jsonPath);` + `\n`
+ String.raw`	  		let params1 = await response.json();` + `\n`
+ String.raw`	  		//console.log("params1: " + Object.keys(params1));` + `\n`
+ String.raw`			return params1` + `\n`
+ String.raw`		}` + `\n`
+ String.raw`		fetch(jsonPath)` + `\n`
+ String.raw`		     .then(function(res){` + `\n`
+ String.raw`		         return res.json()` + `\n`
+ String.raw`		     })` + `\n`
+ String.raw`		     .then(function(data){` + `\n`
+ String.raw`			     console.log("data: " + JSON.stringify(data))` + `\n`
+ String.raw`			     params1 = data` + `\n`
+ String.raw`		     })` + `\n`
+ String.raw`		` + `\n`
+ String.raw`	</script-->` + `\n`
+ String.raw`	` + `\n`
+ String.raw`    <!--script src="https://unpkg.com/@bopen/leaflet-area-selection@0.6.1/dist/index.umd.js"></script-->` + `\n`
+ String.raw`` + `\n`
+ String.raw`	<style>` + `\n`
+ String.raw`		html, body {` + `\n`
+ String.raw`		  height: 100%;` + `\n`
+ String.raw`		  margin: 0;` + `\n`
+ String.raw`		  padding: 0;` + `\n`
+ String.raw`		}` + `\n`
+ String.raw`` + `\n`
+ String.raw`		.leaflet-container {` + `\n`
+ String.raw`			display: block;` + `\n`
+ String.raw`			position: relative;` + `\n`
+ String.raw`  			margin-left: auto;` + `\n`
+ String.raw`  			margin-right: auto;` + `\n`
+ String.raw`			height: auto;` + `\n`
+ String.raw`			width: auto;` + `\n`
+ String.raw`			max-width: 90%;` + `\n`
+ String.raw`			max-height: 100%;` + `\n`
+ String.raw`		}` + `\n`
+ String.raw`	</style>` + `\n`
+ String.raw`</head>` + `\n`
+ String.raw`<body>` + `\n`
+ String.raw`<div class="wide" id="all">` + `\n`
+ String.raw`<div class="top-bar py-0" id="topBar" style="background: #555"></div>` + `\n`
+ String.raw`<!-- Navbar Sticky-->` + `\n`
+ String.raw`<header class="nav-holder make-sticky">` + `\n`
+ String.raw`<div class="navbar navbar-light bg-white navbar-expand-lg py-0" id="navbar">` + `\n`
+ String.raw`<div class="container py-3 py-lg-0 px-lg-0">` + `\n`
+ String.raw`<!-- Navbar brand--><a class="navbar-brand" href="https://paleopresto.com/"><img class="d-none d-md-inline-block" src="/img/logo.png" alt="Universal logo"><img class="d-inline-block d-md-none" src="/img/logo-small.png" alt="Universal logo"><span class="sr-only">Universal - go to homepage</span></a> <!-- TODO: Update the logo. -->` + `\n`
+ String.raw`<!-- Navbar toggler-->` + `\n`
+ String.raw`<button class="navbar-toggler text-primary border-primary" type="button" data-bs-toggle="collapse" data-bs-target="#navigationCollapse" aria-controls="navigationCollapse" aria-expanded="false" aria-label="Toggle navigation"><span class="sr-only">Toggle navigation</span><i class="fas fa-align-justify"></i></button>` + `\n`
+ String.raw`<!-- Collapsed Navigation    -->` + `\n`
+ String.raw`<div class="collapse navbar-collapse" id="navigationCollapse">` + `\n`
+ String.raw`<ul class="navbar-nav ms-auto mb-2 mb-lg-0">` + `\n`
+ String.raw`<a class="nav-link" href="https://paleopresto.com/">Home</a>` + `\n`
+ String.raw`<!-- megamenu [features]-->` + `\n`
+ String.raw`<li class="nav-item dropdown"><a class="nav-link dropdown-toggle" id="featuresMegamenu" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">Reconstructions</a>` + `\n`
+ String.raw`<ul class="dropdown-menu megamenu p-4" aria-labelledby="featuresMegamenu">` + `\n`
+ String.raw`<li class="nav-item"><a class="nav-link-sub py-2 text-uppercase" href="https://paleopresto.com/holocene.html">Holocene</a></li>` + `\n`
+ String.raw`<li class="nav-item"><a class="nav-link-sub py-2 text-uppercase" href="https://paleopresto.com/common_era.html">Common Era</a></li>` + `\n`
+ String.raw`</ul>` + `\n`
+ String.raw`</li>` + `\n`
+ String.raw`<!-- megamenu [portfolio]-->` + `\n`
+ String.raw`<a class="nav-link" href="https://paleopresto.com/analysis.html">Analysis</a>` + `\n`
+ String.raw`<a class="nav-link" href="https://paleopresto.com/custom.html">Custom</a>` + `\n`
+ String.raw`<a class="nav-link" href="https://paleopresto.com/about.html">About Us</a>` + `\n`
+ String.raw`</ul>` + `\n`
+ String.raw`</div>` + `\n`
+ String.raw`</div>` + `\n`
+ String.raw`</div>` + `\n`
+ String.raw`</header>` + `\n`
+ String.raw`<!-- HEADING BREADCRUMB-->` + `\n`
+ String.raw`<section class="bg-pentagon py-4">` + `\n`
+ String.raw`<div class="container py-3">` + `\n`
+ String.raw`<div class="row d-flex align-items-center gy-4">` + `\n`
+ String.raw`<div class="col-md-7">` + `\n`
+ String.raw`<h1 class="h2 mb-0 text-uppercase">Custom Reconstructions</h1>` + `\n`
+ String.raw`</div>` + `\n`
+ String.raw`<div class="col-md-5">` + `\n`
+ String.raw`<!-- Breadcrumb-->` + `\n`
+ String.raw`<ol class="text-sm justify-content-start justify-content-lg-end mb-0 breadcrumb undefined">` + `\n`
+ String.raw`<li class="breadcrumb-item"><a class="text-uppercase" href="https://paleopresto.com/">Home</a></li>` + `\n`
+ String.raw`<li class="breadcrumb-item text-uppercase active">Custom Reconstructions</li>` + `\n`
+ String.raw`</ol>` + `\n`
+ String.raw`</div>` + `\n`
+ String.raw`</div>` + `\n`
+ String.raw`</div>` + `\n`
+ String.raw`</section>` + `\n`
+ String.raw`<script src="//code.jquery.com/jquery-1.10.2.js"></script>` + `\n`
+ String.raw`<script src="//code.jquery.com/ui/1.11.0/jquery-ui.js"></script>` + `\n`
+ String.raw`<!-- <form id="queryParams" method="" action="/lipdVerse"> -->` + `\n`
+ String.raw`<!--Selected labels:    ` + `\n`
+ String.raw`<input type="hidden" id="labels">` + `\n`
+ String.raw`<br>` + `\n`
+ String.raw`Selected values:    ` + `\n`
+ String.raw`<pre id="values" name="archiveType"></pre>   ` + `\n`
+ String.raw`</div-->` + `\n`
+ String.raw`<br><br>` + `\n`
+ String.raw`` + `\n`
+ String.raw`<h1 style="text-align: center; font-size:40px"><img src="/img/lipdverse_logo_text.png" alt="LiPDverse Logo" width="200" height="45"> Query</h1>` + `\n`
+ String.raw`<br><br>` + `\n`
+ String.raw`  <!-- </form> -->` + `\n`
+ String.raw`<div class="leaflet-container" id="map" style="width: 1200px; height: 700px;"></div>` + `\n`
+ String.raw`<br>` + `\n`
+ String.raw`<div style="width: 1200px; margin: auto; border-width:3px; border-style:groove; border-color:#899877; border-radius: 10px;"><p style="text-align: center; font-size:14px; margin-left: 10px; margin-right: 10px; margin-top: 10px; margin-bottom: 10px;" id="Instructions">The map above offers a preview of the data returned by the LiPDverse Query. Each point represents a dataset with one or more paleoclimate proxy time series. Provide queries below and click <b>Update Map</b> to view available data. When you are satisfied with your query, click <b>Submit</b> at the bottom of the page to continue.</p></div>` + `\n`
+ String.raw`<br>` + `\n`
+ String.raw`<div><p style="text-align: center; font-size:16px;" id="datasetCount"></p></div>` + `\n`
+ String.raw`<br>` + `\n`
+ String.raw`<input id="recon" name="recon" type="hidden" value="">` + `\n`
+ String.raw`<input id="user" name="user" type="hidden" value="">` + `\n`
+ String.raw`<input id="domain" name="domain" type="hidden" value="">` + `\n`
+ String.raw`<input id="uniqueID" name="uniqueID" type="hidden" value="">` + `\n`
+ String.raw`<input id="language" name="language" type="hidden" value="">` + `\n`
+ String.raw`<script>` + `\n`
+ String.raw`    function getQueryVariable(variable)` + `\n`
+ String.raw`    {` + `\n`
+ String.raw`           var query = window.location.search.substring(1);` + `\n`
+ String.raw`           var vars = query.split("&");` + `\n`
+ String.raw`           for (var i=0;i<vars.length;i++) {` + `\n`
+ String.raw`                   var pair = vars[i].split("=");` + `\n`
+ String.raw`                   if(pair[0] == variable){` + `\n`
+ String.raw`                     return pair[1];}` + `\n`
+ String.raw`           }` + `\n`
+ String.raw`           return(false);` + `\n`
+ String.raw`    }` + `\n`
+ String.raw`</script>` + `\n`
+ String.raw`<script>` + `\n`
+ String.raw`    function popQueryVariable(){` + `\n`
+ String.raw`    document.getElementById('recon').value = getQueryVariable("recon");` + `\n`
+ String.raw`    document.getElementById('user').value = getQueryVariable("user");` + `\n`
+ String.raw`    document.getElementById('domain').value = getQueryVariable("domain");` + `\n`
+ String.raw`    document.getElementById('uniqueID').value = getQueryVariable("uniqueID");` + `\n`
+ String.raw`    document.getElementById('language').value = getQueryVariable("language");` + `\n`
+ String.raw`    }` + `\n`
+ String.raw`</script>` + `\n`
+ String.raw`<script>` + `\n`
+ String.raw`popQueryVariable()` + `\n`
+ String.raw`</script>` + `\n`
+ String.raw`` + `\n`
+ String.raw`<!--div id="iframediv" style="width: 1200px; margin: auto;">` + `\n`
+ String.raw`	<img id="dataAvail" alt="data Availability Plot" src="" />` + `\n`
+ String.raw`</div-->` + `\n`
+ String.raw`<br>` + `\n`
+ String.raw`<div class="button-submit">` + `\n`
+ String.raw`<button style="height:30px; width:150px; font-size:13px" id="get-repos" onclick="sendQuery()" class="btn btn-primary">Update Map</button>` + `\n`
+ String.raw`</div>` + `\n`
+ String.raw`<br>` + `\n`
+ String.raw`<br>` + `\n`
+ String.raw`<span id="response"></span>` + `\n`
+ String.raw`<br>` + `\n`
+ String.raw`<form style="max-width: 90%; display: block; margin-left: auto; margin-right: auto;" id="queryForm" onsubmit="sendQuery()">` + `\n`
+ configs(recon)
+ String.raw`</form>` + `\n`
+ String.raw`<br><br>` + `\n`
+ String.raw`<!--div>` + `\n`
+ String.raw`	<button style="font-size: 16px;" type="button" onclick="getAvailPlot()">Make Plot</button>` + `\n`
+ String.raw`</div-->` + `\n`
+ String.raw`<div class="button-submit">` + `\n`
+ String.raw`	<button class="btn btn-primary" style="font-size: 13px;height:30px; width:250px; " type="button" onclick="grabCSV()">Download Time Series (csv)</button>` + `\n`
+ String.raw`</div>` + `\n`
+ String.raw`<br><br>` + `\n`
+ String.raw`<div class="button-submit">` + `\n`
+ String.raw`	<button id="proceedButton" class="btn btn-primary" style="font-size: 18px;height:45px; width:400px; " type="button" onclick="getLipds()">Use selected Proxies</button>` + `\n`
+ String.raw`</div>` + `\n`
+ String.raw`` + `\n`
+ String.raw`<div>` + `\n`
+ String.raw`	<p id="timeSeries"></p>` + `\n`
+ String.raw`</div>` + `\n`
+ String.raw`<br><br><br><br>` + `\n`
+ String.raw`<script src="/slider.js"></script>` + `\n`
+ String.raw`</body>` + `\n`
+ String.raw`        <footer>` + `\n`
+ String.raw`        <!-- COPYRIGHTS                -->` + `\n`
+ String.raw`        <div class="bg-dark py-5">` + `\n`
+ String.raw`          <div class="container">` + `\n`
+ String.raw`            <div class="row align-items-cenrer gy-3 text-center">` + `\n`
+ String.raw`              <div class="col-md-6 text-md-start">` + `\n`
+ String.raw`                <p class="mb-0 text-sm text-gray-500">&copy; 2023. The Presto Team </p>` + `\n`
+ String.raw`              </div>` + `\n`
+ String.raw`              <div class="col-md-6 text text-md-end">` + `\n`
+ String.raw`                <p class="mb-0 text-sm text-gray-500">Template designed by  <a href="https://bootstrapious.com" target="_blank">Bootstrapious</a></p>` + `\n`
+ String.raw`                <!-- Please do not remove the backlink to us unless you purchase the Attribution-free License at https://bootstrapious.com/attribution-free-license. Thank you.-->` + `\n`
+ String.raw`              </div>` + `\n`
+ String.raw`            </div>` + `\n`
+ String.raw`          </div>` + `\n`
+ String.raw`        </div>` + `\n`
+ String.raw`      </footer>` + `\n`
+ String.raw`` + `\n`
+ String.raw`<script>` + `\n`
+ String.raw`var opts = {` + `\n`
+ String.raw`  lines: 13, // The number of lines to draw` + `\n`
+ String.raw`  length: 38, // The length of each line` + `\n`
+ String.raw`  width: 17, // The line thickness` + `\n`
+ String.raw`  radius: 45, // The radius of the inner circle` + `\n`
+ String.raw`  scale: 1, // Scales overall size of the spinner` + `\n`
+ String.raw`  corners: 1, // Corner roundness (0..1)` + `\n`
+ String.raw`  speed: 2, // Rounds per second` + `\n`
+ String.raw`  rotate: 0, // The rotation offset` + `\n`
+ String.raw`  animation: 'spinner-line-fade-quick', // The CSS animation name for the lines` + `\n`
+ String.raw`  direction: 1, // 1: clockwise, -1: counterclockwise` + `\n`
+ String.raw`  color: '#ffffff', // CSS color or array of colors` + `\n`
+ String.raw`  fadeColor: 'transparent', // CSS color or array of colors` + `\n`
+ String.raw`  top: '50%', // Top position relative to parent` + `\n`
+ String.raw`  left: '50%', // Left position relative to parent` + `\n`
+ String.raw`  shadow: '0 0 1px transparent', // Box-shadow for the lines` + `\n`
+ String.raw`  zIndex: 2000000000, // The z-index (defaults to 2e9)` + `\n`
+ String.raw`  className: 'spinner', // The CSS class to assign to the spinner` + `\n`
+ String.raw`  position: 'absolute', // Element positioning` + `\n`
+ String.raw`};` + `\n`
+ String.raw`` + `\n`
+ String.raw`` + `\n`
+ String.raw`var target = document.getElementById('map');` + `\n`
+ String.raw`var spinner = new Spinner(opts).spin(target);` + `\n`
+ String.raw`	` + `\n`
+ String.raw`let filters1 = JSON.parse('{"ages":"' + document.getElementById("ageSliderOn").checked + '", "coords":"' + document.getElementById("coordsOn").checked + '", "seasonality":"' + document.getElementById("seasonMonthsOn").checked + '", "terrestrial":"' + document.getElementById("isTerrestrialOn").checked + '", "resolution":"' + document.getElementById("resolutionOn").checked + '"}')` + `\n`
+ String.raw`function updateFilters(){` + `\n`
+ String.raw`	if (document.getElementById("ageSliderOn").checked){` + `\n`
+ String.raw`		document.getElementById("timeSliderDiv").style.visibility = "visible";` + `\n`
+ String.raw`		filters1['ages'] = 'true'` + `\n`
+ String.raw`	} ` + `\n`
+ String.raw`	if (!document.getElementById("ageSliderOn").checked) {` + `\n`
+ String.raw`		document.getElementById("timeSliderDiv").style.visibility = "hidden";` + `\n`
+ String.raw`		filters1['ages'] = 'false'` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	if (document.getElementById("coordsOn").checked){` + `\n`
+ String.raw`		document.getElementById("coordsDiv").style.visibility = "visible";` + `\n`
+ String.raw`		filters1['coords'] = 'true'` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	if (!document.getElementById("coordsOn").checked) {` + `\n`
+ String.raw`		document.getElementById("coordsDiv").style.visibility = "hidden";` + `\n`
+ String.raw`		filters1['coords'] = 'false'` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	if (document.getElementById("resolutionOn").checked){` + `\n`
+ String.raw`		document.getElementById("resolutionDiv").style.visibility = "visible";` + `\n`
+ String.raw`		filters1['resolution'] = 'true'` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	if (!document.getElementById("resolutionOn").checked) {` + `\n`
+ String.raw`		document.getElementById("resolutionDiv").style.visibility = "hidden";` + `\n`
+ String.raw`		filters1['resolution'] = 'false'` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	if (document.getElementById("isTerrestrialOn").checked){` + `\n`
+ String.raw`		document.getElementById("isTerrestrialDiv").style.visibility = "visible";` + `\n`
+ String.raw`		filters1['terrestrial'] = 'true'` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	if (!document.getElementById("isTerrestrialOn").checked) {` + `\n`
+ String.raw`		document.getElementById("isTerrestrialDiv").style.visibility = "hidden";` + `\n`
+ String.raw`		filters1['terrestrial'] = 'false'` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	if (document.getElementById("seasonMonthsOn").checked){` + `\n`
+ String.raw`		document.getElementById("monthSliderDiv").style.visibility = "visible";` + `\n`
+ String.raw`		filters1['seasonality'] = 'true'` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	if (!document.getElementById("seasonMonthsOn").checked) {` + `\n`
+ String.raw`		document.getElementById("monthSliderDiv").style.visibility = "hidden";` + `\n`
+ String.raw`		filters1['seasonality'] = 'false'` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	sendQuery();` + `\n`
+ String.raw`	return(filters1)` + `\n`
+ String.raw`}` + `\n`
+ String.raw`` + `\n`
+ String.raw`//initiate leaflet map` + `\n`
+ String.raw`var map = L.map('map', {attributionControl: false}).setView([0, 0], 1);` + `\n`
+ String.raw`var tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {` + `\n`
+ String.raw`    maxZoom: 18,` + `\n`
+ String.raw`	minZoom: 1` + `\n`
+ String.raw`}).addTo(map);` + `\n`
+ String.raw`var colorPal = {"Borehole":"#FFD600","MolluskShell":"#7b03fc","GlacierIce":"#86CDFA","GroundIce":"#ff6db6","Coral":"#FF8B00",` + `\n`
+ String.raw` "FluvialSediment":"#4169E0","LakeSediment":"#8f8fa1","MarineSediment":"#8A4513","Speleothem":"#FF1492","Midden":"#824E2B",` + `\n`
+ String.raw` "Peat":"#8A9A5B","Sclerosponge":"#D2042D","Shoreline":"#40826D","Wood":"#32CC32","TerrestrialSediment":"#d2b48c"}` + `\n`
+ String.raw`var shapePal = {"Borehole":"square","MolluskShell":"triangle","GlacierIce":"snowflake","GroundIce":"snowflake","Coral":"triangle-down",` + `\n`
+ String.raw` "FluvialSediment":"circle","LakeSediment":"circle","MarineSediment":"circle","Speleothem":"square","Midden":"diamond",` + `\n`
+ String.raw` "Peat":"triangle-down","Sclerosponge":"triangle-down","Shoreline":"diamond","Wood":"triangle","TerrestrialSediment":"circle"}` + `\n`
+ String.raw`//initiate leaflet rectangle` + `\n`
+ String.raw`let rect = L.rectangle([[-90, -180], [90, 180]], { color: "#ff7800", opacity:0.1, fill: "#ff7800", fillOpacity:0.1, draggable: true });` + `\n`
+ String.raw`map.addLayer(rect);` + `\n`
+ String.raw`/*` + `\n`
+ String.raw`var southWest = L.latLng(-100, -360),` + `\n`
+ String.raw`northEast = L.latLng(100, 360);` + `\n`
+ String.raw`var bounds = L.latLngBounds(southWest, northEast);` + `\n`
+ String.raw`` + `\n`
+ String.raw`map.setMaxBounds(bounds);` + `\n`
+ String.raw`map.on('drag', function() {` + `\n`
+ String.raw`    map.panInsideBounds(bounds, { animate: false });` + `\n`
+ String.raw`});` + `\n`
+ String.raw`*/` + `\n`
+ String.raw`function updateBoundingBox(){` + `\n`
+ String.raw`	rect.editing.disable();` + `\n`
+ String.raw`	var latMin = +document.getElementById("lat_min").value` + `\n`
+ String.raw`	var latMax = +document.getElementById("lat_max").value` + `\n`
+ String.raw`	if (latMin > latMax){` + `\n`
+ String.raw`		if (latMin < 90){` + `\n`
+ String.raw`			latMax = latMin + .001` + `\n`
+ String.raw`			document.getElementById("lat_max").value = latMax` + `\n`
+ String.raw`		} else {` + `\n`
+ String.raw`			latMin = latMax - .001` + `\n`
+ String.raw`			document.getElementById("lat_min").value = latMin` + `\n`
+ String.raw`		}` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	var lonMin = +document.getElementById("lon_min").value` + `\n`
+ String.raw`	var lonMax = +document.getElementById("lon_max").value` + `\n`
+ String.raw`	if (lonMin > lonMax){` + `\n`
+ String.raw`		if (lonMin < 180){` + `\n`
+ String.raw`			lonMax = lonMin + .001` + `\n`
+ String.raw`			document.getElementById("lon_max").value = lonMax` + `\n`
+ String.raw`		} else {` + `\n`
+ String.raw`			lonMin = lonMax - .001` + `\n`
+ String.raw`			document.getElementById("lon_min").value = lonMin` + `\n`
+ String.raw`		}` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	rect.setBounds([[latMin, lonMin], [latMax, lonMax]]);` + `\n`
+ String.raw`	rect.editing.enable();` + `\n`
+ String.raw`}` + `\n`
+ String.raw`	` + `\n`
+ String.raw`//add layer for points` + `\n`
+ String.raw`var layerGroup = L.layerGroup().addTo(map);` + `\n`
+ String.raw`` + `\n`
+ String.raw`` + `\n`
+ String.raw`function chooseColor(archiveType){` + `\n`
+ String.raw`	archiveType = archiveType.toString();` + `\n`
+ String.raw`	var color1 = colorPal[archiveType]` + `\n`
+ String.raw`	if (typeof color1 !== 'undefined'){` + `\n`
+ String.raw`		return color1` + `\n`
+ String.raw`	} else {` + `\n`
+ String.raw`		//console.log(archiveType)` + `\n`
+ String.raw`		return "black"` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`}` + `\n`
+ String.raw`function chooseShape(archiveType){` + `\n`
+ String.raw`	archiveType = archiveType.toString();` + `\n`
+ String.raw`	var shape1 = shapePal[archiveType]` + `\n`
+ String.raw`	if (typeof shape1 !== 'undefined'){` + `\n`
+ String.raw`		return shape1` + `\n`
+ String.raw`	} else {` + `\n`
+ String.raw`		//console.log(archiveType)` + `\n`
+ String.raw`		return "diamond"` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`}` + `\n`
+ String.raw`var regExp = /\(([^)]+)\)/;` + `\n`
+ String.raw`function dec4(x) {` + `\n`
+ String.raw`  return Number.parseFloat(x).toFixed(4);` + `\n`
+ String.raw`}` + `\n`
+ String.raw`` + `\n`
+ String.raw`function chooseOpacity(coords, rect1){` + `\n`
+ String.raw`	//rectSW = regExp.exec(rect._bounds._southWest)[1]` + `\n`
+ String.raw`	//rect1 = changeBoxCoord()` + `\n`
+ String.raw`	var point = regExp.exec(coords)[1]` + `\n`
+ String.raw`	var pointLat = dec4(point.split(',')[0])` + `\n`
+ String.raw`	var pointLon = dec4(point.split(',')[1])` + `\n`
+ String.raw`` + `\n`
+ String.raw`	if (+pointLat > +rect1.South && +pointLat < +rect1.North && +pointLon > +rect1.West && +pointLon < +rect1.East){` + `\n`
+ String.raw`		inRectCount = inRectCount + 1` + `\n`
+ String.raw`		return 0.8` + `\n`
+ String.raw`	} else {` + `\n`
+ String.raw`		return 0.1` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`}` + `\n`
+ String.raw`` + `\n`
+ String.raw`//regex helper` + `\n`
+ String.raw`` + `\n`
+ String.raw`//extract leaflet rectangle coords` + `\n`
+ String.raw`function changeBoxCoord(){` + `\n`
+ String.raw`	var SW = regExp.exec(rect._bounds._southWest)[1]` + `\n`
+ String.raw`	var South = dec4(SW.split(',')[0])` + `\n`
+ String.raw`	var West = dec4(SW.split(',')[1])` + `\n`
+ String.raw`	//var South = dec4(0)` + `\n`
+ String.raw`	//var West = dec4(-90)` + `\n`
+ String.raw`	var NE = regExp.exec(rect._bounds._northEast)[1]` + `\n`
+ String.raw`	var North = dec4(NE.split(',')[0])` + `\n`
+ String.raw`	var East = dec4(NE.split(',')[1])` + `\n`
+ String.raw`	//var North = dec4(45)` + `\n`
+ String.raw`	//var East = dec4(0)` + `\n`
+ String.raw`	//var newCoords = South + ', ' + West + ', ' + North + ', ' + East` + `\n`
+ String.raw`	var rectWidth = +(East-West)` + `\n`
+ String.raw`	rect.editing.disable();` + `\n`
+ String.raw`	if (North > 90){` + `\n`
+ String.raw`			rect.setBounds([[South, West], [90, East]]);` + `\n`
+ String.raw`` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	if (South < -90){` + `\n`
+ String.raw`` + `\n`
+ String.raw`			rect.setBounds([[-90, West], [North, East]]);` + `\n`
+ String.raw`		` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	if (West < -360){` + `\n`
+ String.raw`` + `\n`
+ String.raw`			rect.setBounds([[South, -360], [North, East]]);` + `\n`
+ String.raw`` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	if (East > 360){` + `\n`
+ String.raw`` + `\n`
+ String.raw`			rect.setBounds([[South, West], [North, 360]]);` + `\n`
+ String.raw`		` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	if (rectWidth > 360){` + `\n`
+ String.raw`		if (West < -360){` + `\n`
+ String.raw`			var newWest = +(+East - 360)` + `\n`
+ String.raw`			rect.setBounds([[South, newWest], [North, East]]);` + `\n`
+ String.raw`		} else {` + `\n`
+ String.raw`			var newEast = +(+West + 360)` + `\n`
+ String.raw`			rect.setBounds([[South, West], [North, newEast]]);` + `\n`
+ String.raw`		}` + `\n`
+ String.raw`		` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	` + `\n`
+ String.raw`		` + `\n`
+ String.raw`	document.getElementById("lat_min").value = South` + `\n`
+ String.raw`	document.getElementById("lat_max").value = North` + `\n`
+ String.raw`	document.getElementById("lon_min").value = West` + `\n`
+ String.raw`	document.getElementById("lon_max").value = East` + `\n`
+ String.raw`	rect.editing.enable();` + `\n`
+ String.raw`	return {"South":South,"West":West,"North":North,"East":East}` + `\n`
+ String.raw`}` + `\n`
+ String.raw`` + `\n`
+ String.raw`` + `\n`
+ String.raw`</script>` + `\n`
+ String.raw`` + `\n`
+ String.raw`<script>` + `\n`
+ String.raw`//var latLon = [{"dataSetName":"TR04EVLI","archiveType":"Wood","geo_latitude":10,"geo_longitude":-85},{"dataSetName":"TR04EVLI","archiveType":"Wood","geo_latitude":10,"geo_longitude":-85},{"dataSetName":"TR04EVLI","archiveType":"Wood","geo_latitude":10,"geo_longitude":-85},{"dataSetName":"TR06TRBO","archiveType":"Wood","geo_latitude":36.62,"geo_longitude":74.98},{"dataSetName":"TR06TRBO","archiveType":"Wood","geo_latitude":36.62,"geo_longitude":74.98},{"dataSetName":"TR07RECA","archiveType":"Wood","geo_latitude":46.35,"geo_longitude":8.6},{"dataSetName":"TR07RECA","archiveType":"Wood","geo_latitude":46.35,"geo_longitude":8.6},{"dataSetName":"TR07REVI","archiveType":"Wood","geo_latitude":46.5,"geo_longitude":8.77},{"dataSetName":"TR07REVI","archiveType":"Wood","geo_latitude":46.5,"geo_longitude":8.77},{"dataSetName":"TR08HORA","archiveType":"Wood","geo_latitude":68.1,"geo_longitude":60},{"dataSetName":"TR08HORA","archiveType":"Wood","geo_latitude":68.1,"geo_longitude":60},{"dataSetName":"TR08THCO","archiveType":"Wood","geo_latitude":52.5,"geo_longitude":-118},{"dataSetName":"TR08THCO","archiveType":"Wood","geo_latitude":52.5,"geo_longitude":-118},{"dataSetName":"TR08THCO","archiveType":"Wood","geo_latitude":52.5,"geo_longitude":-118},{"dataSetName":"TR08THCO","archiveType":"Wood","geo_latitude":52.5,"geo_longitude":-118},{"dataSetName":"TR08VOOL","archiveType":"Wood","geo_latitude":53.2833,"geo_longitude":107.6333},{"dataSetName":"TR08VOOL","archiveType":"Wood","geo_latitude":53.2833,"geo_longitude":107.6333},{"dataSetName":"TR10ANMO","archiveType":"Wood","geo_latitude":10.2,"geo_longitude":-85.35},{"dataSetName":"TR10ANMO","archiveType":"Wood","geo_latitude":10.2,"geo_longitude":-85.35},{"dataSetName":"TR10ANMO","archiveType":"Wood","geo_latitude":10.2,"geo_longitude":-85.35},{"dataSetName":"TR11BAPU","archiveType":"Wood","geo_latitude":-12.6,"geo_longitude":-69.2},{"dataSetName":"TR11BAPU","archiveType":"Wood","geo_latitude":-12.6,"geo_longitude":-69.2},{"dataSetName":"TR11BAPU","archiveType":"Wood","geo_latitude":-12.6,"geo_longitude":-69.2},{"dataSetName":"TR11BAVO","archiveType":"Wood","geo_latitude":-22,"geo_longitude":-66},{"dataSetName":"TR11BAVO","archiveType":"Wood","geo_latitude":-22,"geo_longitude":-66},{"dataSetName":"TR11BAVO","archiveType":"Wood","geo_latitude":-22,"geo_longitude":-66},{"dataSetName":"TR11GRTP","archiveType":"Wood","geo_latitude":30.3083,"geo_longitude":91.5167},{"dataSetName":"TR11GRTP","archiveType":"Wood","geo_latitude":30.3083,"geo_longitude":91.5167},{"dataSetName":"TR11MAJA","archiveType":"Wood","geo_latitude":19.08,"geo_longitude":82.33},{"dataSetName":"TR11MAJA","archiveType":"Wood","geo_latitude":19.08,"geo_longitude":82.33},{"dataSetName":"TR11MAJA","archiveType":"Wood","geo_latitude":19.08,"geo_longitude":82.33},{"dataSetName":"TR11MAJA","archiveType":"Wood","geo_latitude":19.08,"geo_longitude":82.33},{"dataSetName":"TR11MAPE","archiveType":"Wood","geo_latitude":10.43,"geo_longitude":76.93},{"dataSetName":"TR11MAPE","archiveType":"Wood","geo_latitude":10.43,"geo_longitude":76.93},{"dataSetName":"TR11MAPE","archiveType":"Wood","geo_latitude":10.43,"geo_longitude":76.93},{"dataSetName":"TR11SAHU00","archiveType":"Wood","geo_latitude":29.85,"geo_longitude":81.93},{"dataSetName":"TR11SAHU00","archiveType":"Wood","geo_latitude":29.85,"geo_longitude":81.93},{"dataSetName":"TR11SIMO","archiveType":"Wood","geo_latitude":50.23,"geo_longitude":89.04},{"dataSetName":"TR11SIMO","archiveType":"Wood","geo_latitude":50.23,"geo_longitude":89.04},{"dataSetName":"TR11XUPH","archiveType":"Wood","geo_latitude":19.9,"geo_longitude":101.2},{"dataSetName":"TR11XUPH","archiveType":"Wood","geo_latitude":19.9,"geo_longitude":101.2},{"dataSetName":"TR11XUPH","archiveType":"Wood","geo_latitude":19.9,"geo_longitude":101.2},{"dataSetName":"TR11XUPH","archiveType":"Wood","geo_latitude":19.9,"geo_longitude":101.2},{"dataSetName":"TR11XUPH","archiveType":"Wood","geo_latitude":19.9,"geo_longitude":101.2},{"dataSetName":"TR11XUPH","archiveType":"Wood","geo_latitude":19.9,"geo_longitude":101.2},{"dataSetName":"TR11XUPH","archiveType":"Wood","geo_latitude":19.9,"geo_longitude":101.2},{"dataSetName":"TR11XUPH","archiveType":"Wood","geo_latitude":19.9,"geo_longitude":101.2},{"dataSetName":"TR11XUPH","archiveType":"Wood","geo_latitude":19.9,"geo_longitude":101.2},{"dataSetName":"TR12BECO","archiveType":"Wood","geo_latitude":38.8,"geo_longitude":-105},{"dataSetName":"TR12BECO","archiveType":"Wood","geo_latitude":38.8,"geo_longitude":-105},{"dataSetName":"TR12BRBO","archiveType":"Wood","geo_latitude":-11.4,"geo_longitude":-68.716},{"dataSetName":"TR12BRBO","archiveType":"Wood","geo_latitude":-11.4,"geo_longitude":-68.716},{"dataSetName":"TR12SAMU","archiveType":"Wood","geo_latitude":21.67,"geo_longitude":104.1},{"dataSetName":"TR12SAMU","archiveType":"Wood","geo_latitude":21.67,"geo_longitude":104.1},{"dataSetName":"TR12SAMU","archiveType":"Wood","geo_latitude":21.67,"geo_longitude":104.1},{"dataSetName":"TR12SAMU","archiveType":"Wood","geo_latitude":21.67,"geo_longitude":104.1},{"dataSetName":"TR12SAMU","archiveType":"Wood","geo_latitude":21.67,"geo_longitude":104.1},{"dataSetName":"TR12SAMU","archiveType":"Wood","geo_latitude":21.67,"geo_longitude":104.1},{"dataSetName":"TR12SAMU","archiveType":"Wood","geo_latitude":21.67,"geo_longitude":104.1},{"dataSetName":"TR12SAMU","archiveType":"Wood","geo_latitude":21.67,"geo_longitude":104.1},{"dataSetName":"TR13BROA","archiveType":"Wood","geo_latitude":16.65,"geo_longitude":-95},{"dataSetName":"TR13BROA","archiveType":"Wood","geo_latitude":16.65,"geo_longitude":-95},{"dataSetName":"TR13JOAR","archiveType":"Wood","geo_latitude":40.875,"geo_longitude":-124.0683},{"dataSetName":"TR13JOAR","archiveType":"Wood","geo_latitude":40.875,"geo_longitude":-124.0683},{"dataSetName":"TR13JOAR","archiveType":"Wood","geo_latitude":40.875,"geo_longitude":-124.0683},{"dataSetName":"TR13JOAR","archiveType":"Wood","geo_latitude":40.875,"geo_longitude":-124.0683},{"dataSetName":"TR13JOAR","archiveType":"Wood","geo_latitude":40.875,"geo_longitude":-124.0683},{"dataSetName":"TR13JOAR","archiveType":"Wood","geo_latitude":40.875,"geo_longitude":-124.0683},{"dataSetName":"TR13JOAR","archiveType":"Wood","geo_latitude":40.875,"geo_longitude":-124.0683},{"dataSetName":"TR13JOJS","archiveType":"Wood","geo_latitude":41.7883,"geo_longitude":-124.0767},{"dataSetName":"TR13JOJS","archiveType":"Wood","geo_latitude":41.7883,"geo_longitude":-124.0767},{"dataSetName":"TR13JOJS","archiveType":"Wood","geo_latitude":41.7883,"geo_longitude":-124.0767},{"dataSetName":"TR13JOJS","archiveType":"Wood","geo_latitude":41.7883,"geo_longitude":-124.0767},{"dataSetName":"TR13JOJS","archiveType":"Wood","geo_latitude":41.7883,"geo_longitude":-124.0767},{"dataSetName":"TR13JOJS","archiveType":"Wood","geo_latitude":41.7883,"geo_longitude":-124.0767},{"dataSetName":"TR13JOJS","archiveType":"Wood","geo_latitude":41.7883,"geo_longitude":-124.0767},{"dataSetName":"TR13JOPC","archiveType":"Wood","geo_latitude":41.4567,"geo_longitude":-124.0467},{"dataSetName":"TR13JOPC","archiveType":"Wood","geo_latitude":41.4567,"geo_longitude":-124.0467},{"dataSetName":"TR13JOPC","archiveType":"Wood","geo_latitude":41.4567,"geo_longitude":-124.0467},{"dataSetName":"TR13JOPC","archiveType":"Wood","geo_latitude":41.4567,"geo_longitude":-124.0467},{"dataSetName":"TR13JOPC","archiveType":"Wood","geo_latitude":41.4567,"geo_longitude":-124.0467},{"dataSetName":"TR13JOPC","archiveType":"Wood","geo_latitude":41.4567,"geo_longitude":-124.0467},{"dataSetName":"TR13JOPC","archiveType":"Wood","geo_latitude":41.4567,"geo_longitude":-124.0467},{"dataSetName":"TR13JOPC","archiveType":"Wood","geo_latitude":41.4567,"geo_longitude":-124.0467},{"dataSetName":"TR13JOPC","archiveType":"Wood","geo_latitude":41.4567,"geo_longitude":-124.0467},{"dataSetName":"TR13POMA","archiveType":"Wood","geo_latitude":68.4,"geo_longitude":-133.8},{"dataSetName":"TR13POMA","archiveType":"Wood","geo_latitude":68.4,"geo_longitude":-133.8},{"dataSetName":"TR13SAWA00","archiveType":"Wood","geo_latitude":27.983,"geo_longitude":90},{"dataSetName":"TR13SAWA00","archiveType":"Wood","geo_latitude":27.983,"geo_longitude":90},{"dataSetName":"TR13SIKO","archiveType":"Wood","geo_latitude":49,"geo_longitude":86},{"dataSetName":"TR13SIKO","archiveType":"Wood","geo_latitude":49,"geo_longitude":86},{"dataSetName":"TR13SITA","archiveType":"Wood","geo_latitude":72,"geo_longitude":100},{"dataSetName":"TR13SITA","archiveType":"Wood","geo_latitude":72,"geo_longitude":100},{"dataSetName":"TR14KOSP","archiveType":"Wood","geo_latitude":42.6411,"geo_longitude":1.0025},{"dataSetName":"TR14KOSP","archiveType":"Wood","geo_latitude":42.6411,"geo_longitude":1.0025},{"dataSetName":"TR15BABO","archiveType":"Wood","geo_latitude":-10.0833,"geo_longitude":-66.3},{"dataSetName":"TR15BABO","archiveType":"Wood","geo_latitude":-10.0833,"geo_longitude":-66.3},{"dataSetName":"TR15NACA","archiveType":"Wood","geo_latitude":54.56,"geo_longitude":-71.2},{"dataSetName":"TR15NACA","archiveType":"Wood","geo_latitude":54.56,"geo_longitude":-71.2},{"dataSetName":"TR15YOLL","archiveType":"Wood","geo_latitude":52.2217,"geo_longitude":-4.228},{"dataSetName":"TR15YOLL","archiveType":"Wood","geo_latitude":52.2217,"geo_longitude":-4.228},{"dataSetName":"TR15YONW","archiveType":"Wood","geo_latitude":51.8399,"geo_longitude":-4.1515},{"dataSetName":"TR15YONW","archiveType":"Wood","geo_latitude":51.8399,"geo_longitude":-4.1515},{"dataSetName":"TR16LAAN","archiveType":"Wood","geo_latitude":45.7333,"geo_longitude":0.3},{"dataSetName":"TR16LAAN","archiveType":"Wood","geo_latitude":45.7333,"geo_longitude":0.3},{"dataSetName":"TR16LAFO","archiveType":"Wood","geo_latitude":48.3833,"geo_longitude":2.6667},{"dataSetName":"TR16LAFO","archiveType":"Wood","geo_latitude":48.3833,"geo_longitude":2.6667},{"dataSetName":"TR16WEMI","archiveType":"Wood","geo_latitude":29.45,"geo_longitude":96.43},{"dataSetName":"TR16WEMI","archiveType":"Wood","geo_latitude":29.45,"geo_longitude":96.43},{"dataSetName":"TR16WEXI","archiveType":"Wood","geo_latitude":30.42,"geo_longitude":95.07},{"dataSetName":"TR16WEXI","archiveType":"Wood","geo_latitude":30.42,"geo_longitude":95.07},{"dataSetName":"TR17EDSW","archiveType":"Wood","geo_latitude":57.815,"geo_longitude":15.26},{"dataSetName":"TR17EDSW","archiveType":"Wood","geo_latitude":57.815,"geo_longitude":15.26},{"dataSetName":"TR17GRTP","archiveType":"Wood","geo_latitude":31.15,"geo_longitude":97.033},{"dataSetName":"TR17GRTP","archiveType":"Wood","geo_latitude":31.15,"geo_longitude":97.033},{"dataSetName":"TR17SAMA","archiveType":"Wood","geo_latitude":32.2167,"geo_longitude":77.2167},{"dataSetName":"TR17SAMA","archiveType":"Wood","geo_latitude":32.2167,"geo_longitude":77.2167},{"dataSetName":"TR18GRPM","archiveType":"Wood","geo_latitude":-50.5167,"geo_longitude":-70.1167},{"dataSetName":"TR18GRPM","archiveType":"Wood","geo_latitude":-50.5167,"geo_longitude":-70.1167},{"dataSetName":"TR18XUGA00","archiveType":"Wood","geo_latitude":28.183,"geo_longitude":85.183},{"dataSetName":"TR18XUGA00","archiveType":"Wood","geo_latitude":28.183,"geo_longitude":85.183},{"dataSetName":"TR18XUJA00","archiveType":"Wood","geo_latitude":29.633,"geo_longitude":79.85},{"dataSetName":"TR18XUJA00","archiveType":"Wood","geo_latitude":29.633,"geo_longitude":79.85},{"dataSetName":"TR19LEBR","archiveType":"Wood","geo_latitude":41.4,"geo_longitude":-74.0167},{"dataSetName":"TR19LEBR","archiveType":"Wood","geo_latitude":41.4,"geo_longitude":-74.0167},{"dataSetName":"TR19LEBR","archiveType":"Wood","geo_latitude":41.4,"geo_longitude":-74.0167},{"dataSetName":"TR19LECR","archiveType":"Wood","geo_latitude":37.0667,"geo_longitude":-89.6},{"dataSetName":"TR19LECR","archiveType":"Wood","geo_latitude":37.0667,"geo_longitude":-89.6},{"dataSetName":"TR19LEFC","archiveType":"Wood","geo_latitude":34.6667,"geo_longitude":-84.1833},{"dataSetName":"TR19LEFC","archiveType":"Wood","geo_latitude":34.6667,"geo_longitude":-84.1833},{"dataSetName":"TR19LEFC","archiveType":"Wood","geo_latitude":34.6667,"geo_longitude":-84.1833},{"dataSetName":"TR19LEOU","archiveType":"Wood","geo_latitude":34.6833,"geo_longitude":-94.6333},{"dataSetName":"TR19LEOU","archiveType":"Wood","geo_latitude":34.6833,"geo_longitude":-94.6333},{"dataSetName":"Arc-Avam-Taimyr.Briffa.2008","archiveType":"Wood","geo_latitude":72,"geo_longitude":101},{"dataSetName":"Arc-Avam-Taimyr.Briffa.2008","archiveType":"Wood","geo_latitude":72,"geo_longitude":101},{"dataSetName":"Arc-Forfjorddalen.McCarroll.2013","archiveType":"Wood","geo_latitude":68.73,"geo_longitude":15.73},{"dataSetName":"Arc-Forfjorddalen.McCarroll.2013","archiveType":"Wood","geo_latitude":68.73,"geo_longitude":15.73},{"dataSetName":"Arc-GulfofAlaska.Wilson.2014","archiveType":"Wood","geo_latitude":61.03,"geo_longitude":-146.59},{"dataSetName":"Arc-GulfofAlaska.Wilson.2014","archiveType":"Wood","geo_latitude":61.03,"geo_longitude":-146.59},{"dataSetName":"Arc-Jamtland.Wilson.2016","archiveType":"Wood","geo_latitude":63.2475,"geo_longitude":13.3375},{"dataSetName":"Arc-Jamtland.Wilson.2016","archiveType":"Wood","geo_latitude":63.2475,"geo_longitude":13.3375},{"dataSetName":"Arc-LenaRiver.McDonald.1998","archiveType":"Wood","geo_latitude":70.67,"geo_longitude":125.87},{"dataSetName":"Arc-LenaRiver.McDonald.1998","archiveType":"Wood","geo_latitude":70.67,"geo_longitude":125.87},{"dataSetName":"Arc-MackenzieDelta.Porter.2013","archiveType":"Wood","geo_latitude":68.625,"geo_longitude":-133.87},{"dataSetName":"Arc-MackenzieDelta.Porter.2013","archiveType":"Wood","geo_latitude":68.625,"geo_longitude":-133.87},{"dataSetName":"Arc-MackenzieDelta.Porter.2013","archiveType":"Wood","geo_latitude":68.625,"geo_longitude":-133.87},{"dataSetName":"Arc-MackenzieDelta.Porter.2013","archiveType":"Wood","geo_latitude":68.625,"geo_longitude":-133.87},{"dataSetName":"Arc-MackenzieDelta.Porter.2013","archiveType":"Wood","geo_latitude":68.625,"geo_longitude":-133.87},{"dataSetName":"Arc-MackenzieDelta.Porter.2013","archiveType":"Wood","geo_latitude":68.625,"geo_longitude":-133.87},{"dataSetName":"Arc-MackenzieDelta.Porter.2013","archiveType":"Wood","geo_latitude":68.625,"geo_longitude":-133.87},{"dataSetName":"Arc-MackenzieDelta.Porter.2013","archiveType":"Wood","geo_latitude":68.625,"geo_longitude":-133.87},{"dataSetName":"Arc-PolarUrals.Wilson.2015","archiveType":"Wood","geo_latitude":66.9,"geo_longitude":65.6},{"dataSetName":"Arc-PolarUrals.Wilson.2015","archiveType":"Wood","geo_latitude":66.9,"geo_longitude":65.6},{"dataSetName":"Arc-Yukon.D'Arrigo.2006","archiveType":"Wood","geo_latitude":67.9,"geo_longitude":-140.7},{"dataSetName":"Arc-Yukon.D'Arrigo.2006","archiveType":"Wood","geo_latitude":67.9,"geo_longitude":-140.7},{"dataSetName":"Asi-AltaiAktru.Cook.2005","archiveType":"Wood","geo_latitude":50.08,"geo_longitude":87.77},{"dataSetName":"Asi-AltaiAktru.Cook.2005","archiveType":"Wood","geo_latitude":50.08,"geo_longitude":87.77},{"dataSetName":"Asi-AltaiDjasator.Cook.2011","archiveType":"Wood","geo_latitude":49.62,"geo_longitude":88.1},{"dataSetName":"Asi-AltaiDjasator.Cook.2011","archiveType":"Wood","geo_latitude":49.62,"geo_longitude":88.1},{"dataSetName":"Asi-AltaiJablonsky.Cook.2000","archiveType":"Wood","geo_latitude":50.87,"geo_longitude":85.23},{"dataSetName":"Asi-AltaiJablonsky.Cook.2000","archiveType":"Wood","geo_latitude":50.87,"geo_longitude":85.23},{"dataSetName":"Asi-AltaiKorumdu.Cook.2005","archiveType":"Wood","geo_latitude":50.14,"geo_longitude":87.72},{"dataSetName":"Asi-AltaiKorumdu.Cook.2005","archiveType":"Wood","geo_latitude":50.14,"geo_longitude":87.72},{"dataSetName":"Asi-AltaiKuraisky.Cook.2011","archiveType":"Wood","geo_latitude":50.3,"geo_longitude":87.83},{"dataSetName":"Asi-AltaiKuraisky.Cook.2011","archiveType":"Wood","geo_latitude":50.3,"geo_longitude":87.83},{"dataSetName":"Asi-AltaiKuraiskySteppe.Cook.2011","archiveType":"Wood","geo_latitude":50.27,"geo_longitude":87.83},{"dataSetName":"Asi-AltaiKuraiskySteppe.Cook.2011","archiveType":"Wood","geo_latitude":50.27,"geo_longitude":87.83},{"dataSetName":"Asi-AltaiSamakhaSteppe.Cook.2011","archiveType":"Wood","geo_latitude":49.72,"geo_longitude":87.28},{"dataSetName":"Asi-AltaiSamakhaSteppe.Cook.2011","archiveType":"Wood","geo_latitude":49.72,"geo_longitude":87.28},{"dataSetName":"Asi-AltaiTjute.Cook.2011","archiveType":"Wood","geo_latitude":50.12,"geo_longitude":87.92},{"dataSetName":"Asi-AltaiTjute.Cook.2011","archiveType":"Wood","geo_latitude":50.12,"geo_longitude":87.92},{"dataSetName":"Asi-AltaiUlaganValley.Cook.2011","archiveType":"Wood","geo_latitude":50.68,"geo_longitude":87.97},{"dataSetName":"Asi-AltaiUlaganValley.Cook.2011","archiveType":"Wood","geo_latitude":50.68,"geo_longitude":87.97},{"dataSetName":"Asi-AltaiUstUlaganLake.Cook.2005","archiveType":"Wood","geo_latitude":50.48,"geo_longitude":87.67},{"dataSetName":"Asi-AltaiUstUlaganLake.Cook.2005","archiveType":"Wood","geo_latitude":50.48,"geo_longitude":87.67},{"dataSetName":"Asi-BARELC.PAGES2k.2013","archiveType":"Wood","geo_latitude":33.75,"geo_longitude":107.8},{"dataSetName":"Asi-BARELC.PAGES2k.2013","archiveType":"Wood","geo_latitude":33.75,"geo_longitude":107.8},{"dataSetName":"Asi-BHUTSP.PAGES2k.2013","archiveType":"Wood","geo_latitude":27.45,"geo_longitude":90},{"dataSetName":"Asi-BHUTSP.PAGES2k.2013","archiveType":"Wood","geo_latitude":27.45,"geo_longitude":90},{"dataSetName":"Asi-BHUTTD.PAGES2k.2013","archiveType":"Wood","geo_latitude":27.67,"geo_longitude":90.72},{"dataSetName":"Asi-BHUTTD.PAGES2k.2013","archiveType":"Wood","geo_latitude":27.67,"geo_longitude":90.72},{"dataSetName":"Asi-BT001.Cook.2010","archiveType":"Wood","geo_latitude":27.58,"geo_longitude":90.65},{"dataSetName":"Asi-BT001.Cook.2010","archiveType":"Wood","geo_latitude":27.58,"geo_longitude":90.65},{"dataSetName":"Asi-BT002.Cook.2010","archiveType":"Wood","geo_latitude":27.67,"geo_longitude":90.73},{"dataSetName":"Asi-BT002.Cook.2010","archiveType":"Wood","geo_latitude":27.67,"geo_longitude":90.73},{"dataSetName":"Asi-BT003.Cook.2010","archiveType":"Wood","geo_latitude":27.7,"geo_longitude":90.77},{"dataSetName":"Asi-BT003.Cook.2010","archiveType":"Wood","geo_latitude":27.7,"geo_longitude":90.77},{"dataSetName":"Asi-BT004.Cook.2010","archiveType":"Wood","geo_latitude":27.7,"geo_longitude":90.68},{"dataSetName":"Asi-BT004.Cook.2010","archiveType":"Wood","geo_latitude":27.7,"geo_longitude":90.68},{"dataSetName":"Asi-BT005.Cook.2010","archiveType":"Wood","geo_latitude":27.45,"geo_longitude":90.15},{"dataSetName":"Asi-BT005.Cook.2010","archiveType":"Wood","geo_latitude":27.45,"geo_longitude":90.15},{"dataSetName":"Asi-BT006.Cook.2010","archiveType":"Wood","geo_latitude":27.63,"geo_longitude":90.13},{"dataSetName":"Asi-BT006.Cook.2010","archiveType":"Wood","geo_latitude":27.63,"geo_longitude":90.13},{"dataSetName":"Asi-BT008.Cook.2010","archiveType":"Wood","geo_latitude":27.58,"geo_longitude":90.65},{"dataSetName":"Asi-BT008.Cook.2010","archiveType":"Wood","geo_latitude":27.58,"geo_longitude":90.65},{"dataSetName":"Asi-BT009.Cook.2010","archiveType":"Wood","geo_latitude":27.42,"geo_longitude":90.97},{"dataSetName":"Asi-BT009.Cook.2010","archiveType":"Wood","geo_latitude":27.42,"geo_longitude":90.97},{"dataSetName":"Asi-BT010.Cook.2010","archiveType":"Wood","geo_latitude":27.25,"geo_longitude":89.38},{"dataSetName":"Asi-BT010.Cook.2010","archiveType":"Wood","geo_latitude":27.25,"geo_longitude":89.38},{"dataSetName":"Asi-BT011.Cook.2010","archiveType":"Wood","geo_latitude":27.45,"geo_longitude":90.15},{"dataSetName":"Asi-BT011.Cook.2010","archiveType":"Wood","geo_latitude":27.45,"geo_longitude":90.15},{"dataSetName":"Delingha.Yang.2021","archiveType":"Wood","geo_latitude":37.48,"geo_longitude":97.78},{"dataSetName":"Delingha.Yang.2021","archiveType":"Wood","geo_latitude":37.48,"geo_longitude":97.78},{"dataSetName":"Delingha.Yang.2021","archiveType":"Wood","geo_latitude":37.48,"geo_longitude":97.78},{"dataSetName":"Delingha.Yang.2021","archiveType":"Wood","geo_latitude":37.48,"geo_longitude":97.78},{"dataSetName":"Delingha.Yang.2021","archiveType":"Wood","geo_latitude":37.48,"geo_longitude":97.78},{"dataSetName":"Delingha.Yang.2021","archiveType":"Wood","geo_latitude":37.48,"geo_longitude":97.78},{"dataSetName":"Delingha.Yang.2021","archiveType":"Wood","geo_latitude":37.48,"geo_longitude":97.78},{"dataSetName":"Delingha.Yang.2021","archiveType":"Wood","geo_latitude":37.48,"geo_longitude":97.78},{"dataSetName":"Delingha.Yang.2021","archiveType":"Wood","geo_latitude":37.48,"geo_longitude":97.78},{"dataSetName":"FinnishLapland.Helama.2022","archiveType":"Wood","geo_latitude":68.665,"geo_longitude":24.93},{"dataSetName":"FinnishLapland.Helama.2022","archiveType":"Wood","geo_latitude":68.665,"geo_longitude":24.93},{"dataSetName":"Gaglioti.NorthSlope.2017","archiveType":"Wood","geo_latitude":69.5,"geo_longitude":-155},{"dataSetName":"Gaglioti.NorthSlope.2017","archiveType":"Wood","geo_latitude":69.5,"geo_longitude":-155},{"dataSetName":"Gaglioti.NorthSlope.2017","archiveType":"Wood","geo_latitude":69.5,"geo_longitude":-155},{"dataSetName":"Gaglioti.NorthSlope.2017","archiveType":"Wood","geo_latitude":69.5,"geo_longitude":-155},{"dataSetName":"Gaglioti.NorthSlope.2017","archiveType":"Wood","geo_latitude":69.5,"geo_longitude":-155},{"dataSetName":"Gaglioti.NorthSlope.2017","archiveType":"Wood","geo_latitude":69.5,"geo_longitude":-155},{"dataSetName":"Gaglioti.NorthSlope.2017","archiveType":"Wood","geo_latitude":69.5,"geo_longitude":-155},{"dataSetName":"Gaglioti.NorthSlope.2017","archiveType":"Wood","geo_latitude":69.5,"geo_longitude":-155},{"dataSetName":"GreatBasin.Salzer.2014","archiveType":"Wood","geo_latitude":38,"geo_longitude":-116.5},{"dataSetName":"GreatBasin.Salzer.2014","archiveType":"Wood","geo_latitude":38,"geo_longitude":-116.5},{"dataSetName":"GreatBasin.Salzer.2014","archiveType":"Wood","geo_latitude":38,"geo_longitude":-116.5},{"dataSetName":"GreatBasin.Salzer.2014","archiveType":"Wood","geo_latitude":38,"geo_longitude":-116.5},{"dataSetName":"GreatBasin.Salzer.2014","archiveType":"Wood","geo_latitude":38,"geo_longitude":-116.5},{"dataSetName":"Lapland.Helama.2009","archiveType":"Wood","geo_latitude":69,"geo_longitude":25},{"dataSetName":"Lapland.Helama.2009","archiveType":"Wood","geo_latitude":69,"geo_longitude":25},{"dataSetName":"NevadaPrecip.Hughes.1996","archiveType":"Wood","geo_latitude":37.8,"geo_longitude":-115.8},{"dataSetName":"NevadaPrecip.Hughes.1996","archiveType":"Wood","geo_latitude":37.8,"geo_longitude":-115.8},{"dataSetName":"NevadaPrecip.Hughes.1996","archiveType":"Wood","geo_latitude":37.8,"geo_longitude":-115.8},{"dataSetName":"Tornetrask.Grudd.2002","archiveType":"Wood","geo_latitude":68,"geo_longitude":20},{"dataSetName":"Tornetrask.Grudd.2002","archiveType":"Wood","geo_latitude":68,"geo_longitude":20}]` + `\n`
+ String.raw`` + `\n`
+ String.raw`` + `\n`
+ String.raw`function loadLatLon (a1){` + `\n`
+ String.raw`	var x1 = a1.filter((arr, index, self) =>` + `\n`
+ String.raw`    index === self.findIndex((t) => (t.geo_latitude === arr.geo_latitude && t.geo_longitude === arr.geo_longitude)))` + `\n`
+ String.raw`	var geojson = {` + `\n`
+ String.raw`    "name":"NewFeatureType",` + `\n`
+ String.raw`    "type":"FeatureCollection",` + `\n`
+ String.raw`    "features": [],` + `\n`
+ String.raw`	};` + `\n`
+ String.raw`var numdata = +Object.values(x1).length` + `\n`
+ String.raw`var numPoints = +(numdata * 2)` + `\n`
+ String.raw`	` + `\n`
+ String.raw`  for (let i = 0; i < numPoints; i++) {` + `\n`
+ String.raw`    if (i >= numdata){` + `\n`
+ String.raw`	    ii = i - numdata` + `\n`
+ String.raw`    } else {` + `\n`
+ String.raw`	    ii = i` + `\n`
+ String.raw`    }` + `\n`
+ String.raw`    var ptLon = +Object.values(x1)[ii].geo_longitude` + `\n`
+ String.raw`    if (i < numdata){` + `\n`
+ String.raw`	    lat = Object.values(x1)[ii].geo_latitude` + `\n`
+ String.raw`    	    lon = Object.values(x1)[ii].geo_longitude` + `\n`
+ String.raw`    } else if (i >= numdata && ptLon < 0) {` + `\n`
+ String.raw`	    lat = Object.values(x1)[ii].geo_latitude` + `\n`
+ String.raw`    	    lon = (ptLon + 360)` + `\n`
+ String.raw`    } else {` + `\n`
+ String.raw`	    lat = Object.values(x1)[ii].geo_latitude` + `\n`
+ String.raw`    	    lon = (ptLon - 360)` + `\n`
+ String.raw`    }` + `\n`
+ String.raw`    aType = Object.values(x1)[ii].archiveType` + `\n`
+ String.raw`    dName = Object.values(x1)[ii].dataSetName` + `\n`
+ String.raw`    dID = Object.values(x1)[ii].datasetId` + `\n`
+ String.raw`    proxy1 = Object.values(x1)[ii].paleoData_proxy` + `\n`
+ String.raw`    minAge = Object.values(x1)[ii].minAge` + `\n`
+ String.raw`    maxAge = Object.values(x1)[ii].maxAge` + `\n`
+ String.raw`    geojson.features.push({ "type": "Feature","geometry": {"type": "Point","coordinates": []},"properties": {"archiveType": [], "dataSetName": [], "paleoData_proxy": [], "minAge": [], "maxAge": [], "datasetId": []} });` + `\n`
+ String.raw`    geojson.features[i].geometry.coordinates.push(lon,lat);` + `\n`
+ String.raw`    geojson.features[i].properties.archiveType.push(aType);` + `\n`
+ String.raw`    geojson.features[i].properties.dataSetName.push(dName);` + `\n`
+ String.raw`    geojson.features[i].properties.datasetId.push(dID);` + `\n`
+ String.raw`    geojson.features[i].properties.paleoData_proxy.push(proxy1);` + `\n`
+ String.raw`    geojson.features[i].properties.minAge.push(minAge);` + `\n`
+ String.raw`    geojson.features[i].properties.maxAge.push(maxAge);` + `\n`
+ String.raw`  }` + `\n`
+ String.raw`` + `\n`
+ String.raw`  return(geojson)` + `\n`
+ String.raw`}` + `\n`
+ String.raw`let inRectCount = 0;` + `\n`
+ String.raw`` + `\n`
+ String.raw`var glacierIce = L.icon({` + `\n`
+ String.raw`    iconUrl: 'http://143.198.98.66:86/glacierIce.png',` + `\n`
+ String.raw`` + `\n`
+ String.raw`    iconSize:     [10, 10], // size of the icon` + `\n`
+ String.raw`    iconAnchor:   [2, 2], // point of the icon which will correspond to marker's location` + `\n`
+ String.raw`    popupAnchor:  [2, 2] // point from which the popup should open relative to the iconAnchor` + `\n`
+ String.raw`});` + `\n`
+ String.raw`var groundIce = L.icon({` + `\n`
+ String.raw`    iconUrl: 'http://143.198.98.66:86//groundIce.png',` + `\n`
+ String.raw`` + `\n`
+ String.raw`    iconSize:     [10, 10], // size of the icon` + `\n`
+ String.raw`    iconAnchor:   [2, 2], // point of the icon which will correspond to marker's location` + `\n`
+ String.raw`    popupAnchor:  [2, 2] // point from which the popup should open relative to the iconAnchor` + `\n`
+ String.raw`});` + `\n`
+ String.raw`var glacierIceOpac = L.icon({` + `\n`
+ String.raw`    iconUrl: 'http://143.198.98.66:86/glacierIceOpac.png',` + `\n`
+ String.raw`` + `\n`
+ String.raw`    iconSize:     [10, 10], // size of the icon` + `\n`
+ String.raw`    iconAnchor:   [2, 2], // point of the icon which will correspond to marker's location` + `\n`
+ String.raw`    popupAnchor:  [2, 2] // point from which the popup should open relative to the iconAnchor` + `\n`
+ String.raw`});` + `\n`
+ String.raw`var groundIceOpac = L.icon({` + `\n`
+ String.raw`    iconUrl: 'http://143.198.98.66:86//groundIceOpac.png',` + `\n`
+ String.raw`` + `\n`
+ String.raw`    iconSize:     [10, 10], // size of the icon` + `\n`
+ String.raw`    iconAnchor:   [2, 2], // point of the icon which will correspond to marker's location` + `\n`
+ String.raw`    popupAnchor:  [2, 2] // point from which the popup should open relative to the iconAnchor` + `\n`
+ String.raw`});` + `\n`
+ String.raw`//let AllPoints = {};` + `\n`
+ String.raw`function updatePoints (coords){` + `\n`
+ String.raw`	spinner.spin();` + `\n`
+ String.raw`	inRectCount = 0;` + `\n`
+ String.raw`	layerGroup.clearLayers();` + `\n`
+ String.raw`	if (!document.getElementById("coordsOn").checked) {` + `\n`
+ String.raw`		document.getElementById("lat_min").value = -90` + `\n`
+ String.raw`		document.getElementById("lat_max").value = 90` + `\n`
+ String.raw`		document.getElementById("lon_min").value = -180` + `\n`
+ String.raw`		document.getElementById("lon_max").value = 180` + `\n`
+ String.raw`		//rect = L.rectangle([[-90, 90], [-360, 360]], {fillOpacity:0});` + `\n`
+ String.raw`		updateBoundingBox();` + `\n`
+ String.raw`		rectCoord = {"South":-90,"West":-180,"North":90,"East":180};` + `\n`
+ String.raw`		rect.editing.disable();` + `\n`
+ String.raw`		` + `\n`
+ String.raw`	} else {` + `\n`
+ String.raw`		rect.editing.enable();` + `\n`
+ String.raw`		rectCoord = changeBoxCoord();` + `\n`
+ String.raw`	}` + `\n`
+ String.raw` L.geoJSON([loadLatLon(coords)], {` + `\n`
+ String.raw`` + `\n`
+ String.raw`                style : function(feature) {` + `\n`
+ String.raw`                    return feature.properties && feature.properties.style;` + `\n`
+ String.raw`                },` + `\n`
+ String.raw`` + `\n`
+ String.raw`                onEachFeature: function (feature, layer) {` + `\n`
+ String.raw`		    layer.bindPopup('<h1>'+feature.properties.dataSetName+'</h1><p><b>Archive Type: </b>'+feature.properties.archiveType+'<br><a href="https://lipdverse.org/data/'+feature.properties.datasetId+'" target="_blank">Dataset URL</a><br><b>Proxies: </b>'+feature.properties.paleoData_proxy+'<br><b>Mix/Max Age: </b>'+feature.properties.minAge+' / '+feature.properties.maxAge+' yr BP</p><iframe src="https://lipdverse.org/data/pnImKbqSb45N6vABnwoD/1_0_13/paleoPlots.html" height="200" width="600" title="paleoData Plot"></iframe>', {` + `\n`
+ String.raw`				   maxWidth : 600` + `\n`
+ String.raw`		    });` + `\n`
+ String.raw`		},` + `\n`
+ String.raw`/*` + `\n`
+ String.raw`	        filter: function(feature, layer) {` + `\n`
+ String.raw`     			return feature.properties.archiveType == 'Wood';` + `\n`
+ String.raw`    		},` + `\n`
+ String.raw`*/` + `\n`
+ String.raw`                pointToLayer : function(feature, latlng) {` + `\n`
+ String.raw`			var col1 = chooseColor(feature.properties.archiveType)` + `\n`
+ String.raw`			var aType = feature.properties.archiveType` + `\n`
+ String.raw`			var shape1 = chooseShape(feature.properties.archiveType)` + `\n`
+ String.raw`			var Opac1 = +chooseOpacity(latlng, rectCoord)` + `\n`
+ String.raw`			if (aType == "GroundIce" && Opac1 == 0.8){` + `\n`
+ String.raw`				return L.marker(latlng, {` + `\n`
+ String.raw`					icon: groundIce` + `\n`
+ String.raw`				});` + `\n`
+ String.raw`			} else if (aType == "GlacierIce" && Opac1 == 0.8){` + `\n`
+ String.raw`				return L.marker(latlng, {` + `\n`
+ String.raw`					icon: glacierIce` + `\n`
+ String.raw`				});` + `\n`
+ String.raw`			} else if (aType == "GroundIce" && Opac1 == 0.1){` + `\n`
+ String.raw`				return L.marker(latlng, {` + `\n`
+ String.raw`					icon: groundIceOpac` + `\n`
+ String.raw`				});` + `\n`
+ String.raw`			} else if (aType == "GlacierIce" && Opac1 == 0.1){` + `\n`
+ String.raw`				return L.marker(latlng, {` + `\n`
+ String.raw`					icon: glacierIceOpac` + `\n`
+ String.raw`				});` + `\n`
+ String.raw`			} else {` + `\n`
+ String.raw`		                    return L.shapeMarker(latlng, {` + `\n`
+ String.raw`					//icon: chooseIcon(feature.properties.archiveType)` + `\n`
+ String.raw`					` + `\n`
+ String.raw`		                        radius : 4,` + `\n`
+ String.raw`		                        fillColor : col1,` + `\n`
+ String.raw`		                        color : col1,` + `\n`
+ String.raw`		                        weight : 1,` + `\n`
+ String.raw`					fillOpacity : Opac1,` + `\n`
+ String.raw`					shape : shape1,` + `\n`
+ String.raw`					opacity : 0.1` + `\n`
+ String.raw`					` + `\n`
+ String.raw`		                    });` + `\n`
+ String.raw`			}` + `\n`
+ String.raw`                }` + `\n`
+ String.raw`            }).addTo(layerGroup);` + `\n`
+ String.raw`	spinner.stop();` + `\n`
+ String.raw`	document.getElementById("datasetCount").innerHTML = "Total datasets in query: " + inRectCount` + `\n`
+ String.raw`}` + `\n`
+ String.raw`` + `\n`
+ dropdowns(recon)
+ String.raw`` + `\n`
+ String.raw`$(function() {` + `\n`
+ String.raw`function split( val ) {` + `\n`
+ String.raw`return val.split( /,\s*/ );` + `\n`
+ String.raw`}` + `\n`
+ String.raw`function extractLast( term ) {` + `\n`
+ String.raw`return split( term ).pop();` + `\n`
+ String.raw`}` + `\n`
+ String.raw`     ` + `\n`
+ String.raw`$( "#proxy" )` + `\n`
+ String.raw` // don't navigate away from the field on tab when selecting an item` + `\n`
+ String.raw`.bind( "keydown", function( event ) {` + `\n`
+ String.raw`if ( event.keyCode === $.ui.keyCode.TAB &&` + `\n`
+ String.raw`$( this ).autocomplete( "instance" ).menu.active ) {` + `\n`
+ String.raw`event.preventDefault();` + `\n`
+ String.raw`}` + `\n`
+ String.raw`})` + `\n`
+ String.raw`.autocomplete({` + `\n`
+ String.raw`minLength: 0,` + `\n`
+ String.raw`source: function( request, response ) {` + `\n`
+ String.raw`// delegate back to autocomplete, but extract the last term` + `\n`
+ String.raw`response( $.ui.autocomplete.filter(` + `\n`
+ String.raw`proxylist, extractLast( request.term ) ) );` + `\n`
+ String.raw`},` + `\n`
+ String.raw`` + `\n`
+ String.raw`//    source:projects,    ` + `\n`
+ String.raw`focus: function() {` + `\n`
+ String.raw`// prevent value inserted on focus` + `\n`
+ String.raw`return false;` + `\n`
+ String.raw`},` + `\n`
+ String.raw`select: function( event, ui ) {` + `\n`
+ String.raw`var terms = split( this.value );` + `\n`
+ String.raw`// remove the current input` + `\n`
+ String.raw`terms.pop();` + `\n`
+ String.raw`// add the selected item` + `\n`
+ String.raw`terms.push( ui.item.value );` + `\n`
+ String.raw`// add placeholder to get the comma-and-space at the end` + `\n`
+ String.raw`terms.push( "" );` + `\n`
+ String.raw`this.value = terms.join( "," );` + `\n`
+ String.raw`return false;` + `\n`
+ String.raw`}` + `\n`
+ String.raw`});` + `\n`
+ String.raw`});` + `\n`
+ String.raw`	` + `\n`
+ String.raw`$(function() {` + `\n`
+ String.raw`function split( val ) {` + `\n`
+ String.raw`return val.split( /,\s*/ );` + `\n`
+ String.raw`}` + `\n`
+ String.raw`function extractLast( term ) {` + `\n`
+ String.raw`return split( term ).pop();` + `\n`
+ String.raw`}` + `\n`
+ String.raw`     ` + `\n`
+ String.raw`$( "#variableName" )` + `\n`
+ String.raw` // don't navigate away from the field on tab when selecting an item` + `\n`
+ String.raw`.bind( "keydown", function( event ) {` + `\n`
+ String.raw`if ( event.keyCode === $.ui.keyCode.TAB &&` + `\n`
+ String.raw`$( this ).autocomplete( "instance" ).menu.active ) {` + `\n`
+ String.raw`event.preventDefault();` + `\n`
+ String.raw`}` + `\n`
+ String.raw`})` + `\n`
+ String.raw`.autocomplete({` + `\n`
+ String.raw`minLength: 0,` + `\n`
+ String.raw`source: function( request, response ) {` + `\n`
+ String.raw`// delegate back to autocomplete, but extract the last term` + `\n`
+ String.raw`response( $.ui.autocomplete.filter(` + `\n`
+ String.raw`variablelist, extractLast( request.term ) ) );` + `\n`
+ String.raw`},` + `\n`
+ String.raw`` + `\n`
+ String.raw`//    source:projects,    ` + `\n`
+ String.raw`focus: function() {` + `\n`
+ String.raw`// prevent value inserted on focus` + `\n`
+ String.raw`return false;` + `\n`
+ String.raw`},` + `\n`
+ String.raw`select: function( event, ui ) {` + `\n`
+ String.raw`var terms = split( this.value );` + `\n`
+ String.raw`// remove the current input` + `\n`
+ String.raw`terms.pop();` + `\n`
+ String.raw`// add the selected item` + `\n`
+ String.raw`terms.push( ui.item.value );` + `\n`
+ String.raw`// add placeholder to get the comma-and-space at the end` + `\n`
+ String.raw`terms.push( "" );` + `\n`
+ String.raw`this.value = terms.join( "," );` + `\n`
+ String.raw`return false;` + `\n`
+ String.raw`}` + `\n`
+ String.raw`});` + `\n`
+ String.raw`});` + `\n`
+ String.raw`	` + `\n`
+ String.raw` $(function() {` + `\n`
+ String.raw`function split( val ) {` + `\n`
+ String.raw`return val.split( /,\s*/ );` + `\n`
+ String.raw`}` + `\n`
+ String.raw`function extractLast( term ) {` + `\n`
+ String.raw`return split( term ).pop();` + `\n`
+ String.raw`}` + `\n`
+ String.raw`     ` + `\n`
+ String.raw`$( "#archiveTypeIn" )` + `\n`
+ String.raw` // don't navigate away from the field on tab when selecting an item` + `\n`
+ String.raw`.bind( "keydown", function( event ) {` + `\n`
+ String.raw`if ( event.keyCode === $.ui.keyCode.TAB &&` + `\n`
+ String.raw`$( this ).autocomplete( "instance" ).menu.active ) {` + `\n`
+ String.raw`event.preventDefault();` + `\n`
+ String.raw`}` + `\n`
+ String.raw`})` + `\n`
+ String.raw`.autocomplete({` + `\n`
+ String.raw`minLength: 0,` + `\n`
+ String.raw`source: function( request, response ) {` + `\n`
+ String.raw`// delegate back to autocomplete, but extract the last term` + `\n`
+ String.raw`response( $.ui.autocomplete.filter(` + `\n`
+ String.raw`archivelist, extractLast( request.term ) ) );` + `\n`
+ String.raw`},` + `\n`
+ String.raw`` + `\n`
+ String.raw`//    source:projects,    ` + `\n`
+ String.raw`focus: function() {` + `\n`
+ String.raw`// prevent value inserted on focus` + `\n`
+ String.raw`return false;` + `\n`
+ String.raw`},` + `\n`
+ String.raw`select: function( event, ui ) {` + `\n`
+ String.raw`var terms = split( this.value );` + `\n`
+ String.raw`// remove the current input` + `\n`
+ String.raw`terms.pop();` + `\n`
+ String.raw`// add the selected item` + `\n`
+ String.raw`terms.push( ui.item.value );` + `\n`
+ String.raw`// add placeholder to get the comma-and-space at the end` + `\n`
+ String.raw`terms.push( "" );` + `\n`
+ String.raw`this.value = terms.join( "," );` + `\n`
+ String.raw`return false;` + `\n`
+ String.raw`}` + `\n`
+ String.raw`});` + `\n`
+ String.raw`});` + `\n`
+ String.raw`` + `\n`
+ String.raw` $(function() {` + `\n`
+ String.raw`function split( val ) {` + `\n`
+ String.raw`return val.split( /,\s*/ );` + `\n`
+ String.raw`}` + `\n`
+ String.raw`function extractLast( term ) {` + `\n`
+ String.raw`return split( term ).pop();` + `\n`
+ String.raw`}` + `\n`
+ String.raw`     ` + `\n`
+ String.raw`$( "#countryIn" )` + `\n`
+ String.raw` // don't navigate away from the field on tab when selecting an item` + `\n`
+ String.raw`.bind( "keydown", function( event ) {` + `\n`
+ String.raw`if ( event.keyCode === $.ui.keyCode.TAB &&` + `\n`
+ String.raw`$( this ).autocomplete( "instance" ).menu.active ) {` + `\n`
+ String.raw`event.preventDefault();` + `\n`
+ String.raw`}` + `\n`
+ String.raw`})` + `\n`
+ String.raw`.autocomplete({` + `\n`
+ String.raw`minLength: 0,` + `\n`
+ String.raw`source: function( request, response ) {` + `\n`
+ String.raw`// delegate back to autocomplete, but extract the last term` + `\n`
+ String.raw`response( $.ui.autocomplete.filter(` + `\n`
+ String.raw`countrylist, extractLast( request.term ) ) );` + `\n`
+ String.raw`},` + `\n`
+ String.raw`` + `\n`
+ String.raw`//    source:projects,    ` + `\n`
+ String.raw`focus: function() {` + `\n`
+ String.raw`// prevent value inserted on focus` + `\n`
+ String.raw`return false;` + `\n`
+ String.raw`},` + `\n`
+ String.raw`select: function( event, ui ) {` + `\n`
+ String.raw`var terms = split( this.value );` + `\n`
+ String.raw`// remove the current input` + `\n`
+ String.raw`terms.pop();` + `\n`
+ String.raw`// add the selected item` + `\n`
+ String.raw`terms.push( ui.item.value );` + `\n`
+ String.raw`// add placeholder to get the comma-and-space at the end` + `\n`
+ String.raw`terms.push( "" );` + `\n`
+ String.raw`this.value = terms.join( "," );` + `\n`
+ String.raw`return false;` + `\n`
+ String.raw`}` + `\n`
+ String.raw`});` + `\n`
+ String.raw`});` + `\n`
+ String.raw`` + `\n`
+ String.raw` $(function() {` + `\n`
+ String.raw`function split( val ) {` + `\n`
+ String.raw`return val.split( /,\s*/ );` + `\n`
+ String.raw`}` + `\n`
+ String.raw`function extractLast( term ) {` + `\n`
+ String.raw`return split( term ).pop();` + `\n`
+ String.raw`}` + `\n`
+ String.raw`     ` + `\n`
+ String.raw`$( "#continentIn" )` + `\n`
+ String.raw` // don't navigate away from the field on tab when selecting an item` + `\n`
+ String.raw`.bind( "keydown", function( event ) {` + `\n`
+ String.raw`if ( event.keyCode === $.ui.keyCode.TAB &&` + `\n`
+ String.raw`$( this ).autocomplete( "instance" ).menu.active ) {` + `\n`
+ String.raw`event.preventDefault();` + `\n`
+ String.raw`}` + `\n`
+ String.raw`})` + `\n`
+ String.raw`.autocomplete({` + `\n`
+ String.raw`minLength: 0,` + `\n`
+ String.raw`source: function( request, response ) {` + `\n`
+ String.raw`// delegate back to autocomplete, but extract the last term` + `\n`
+ String.raw`response( $.ui.autocomplete.filter(` + `\n`
+ String.raw`continentlist, extractLast( request.term ) ) );` + `\n`
+ String.raw`},` + `\n`
+ String.raw`` + `\n`
+ String.raw`//    source:projects,    ` + `\n`
+ String.raw`focus: function() {` + `\n`
+ String.raw`// prevent value inserted on focus` + `\n`
+ String.raw`return false;` + `\n`
+ String.raw`},` + `\n`
+ String.raw`select: function( event, ui ) {` + `\n`
+ String.raw`var terms = split( this.value );` + `\n`
+ String.raw`// remove the current input` + `\n`
+ String.raw`terms.pop();` + `\n`
+ String.raw`// add the selected item` + `\n`
+ String.raw`terms.push( ui.item.value );` + `\n`
+ String.raw`// add placeholder to get the comma-and-space at the end` + `\n`
+ String.raw`terms.push( "" );` + `\n`
+ String.raw`this.value = terms.join( "," );` + `\n`
+ String.raw`return false;` + `\n`
+ String.raw`}` + `\n`
+ String.raw`});` + `\n`
+ String.raw`});` + `\n`
+ String.raw`` + `\n`
+ String.raw` $(function() {` + `\n`
+ String.raw`function split( val ) {` + `\n`
+ String.raw`return val.split( /,\s*/ );` + `\n`
+ String.raw`}` + `\n`
+ String.raw`function extractLast( term ) {` + `\n`
+ String.raw`return split( term ).pop();` + `\n`
+ String.raw`}` + `\n`
+ String.raw`	` + `\n`
+ String.raw`$( "#compilationIn" )` + `\n`
+ String.raw` // don't navigate away from the field on tab when selecting an item` + `\n`
+ String.raw`.bind( "keydown", function( event ) {` + `\n`
+ String.raw`if ( event.keyCode === $.ui.keyCode.TAB &&` + `\n`
+ String.raw`$( this ).autocomplete( "instance" ).menu.active ) {` + `\n`
+ String.raw`event.preventDefault();` + `\n`
+ String.raw`}` + `\n`
+ String.raw`})` + `\n`
+ String.raw`.autocomplete({` + `\n`
+ String.raw`minLength: 0,` + `\n`
+ String.raw`source: function( request, response ) {` + `\n`
+ String.raw`// delegate back to autocomplete, but extract the last term` + `\n`
+ String.raw`response( $.ui.autocomplete.filter(` + `\n`
+ String.raw`compilationlist, extractLast( request.term ) ) );` + `\n`
+ String.raw`},` + `\n`
+ String.raw`` + `\n`
+ String.raw`//    source:projects,    ` + `\n`
+ String.raw`focus: function() {` + `\n`
+ String.raw`// prevent value inserted on focus` + `\n`
+ String.raw`return false;` + `\n`
+ String.raw`},` + `\n`
+ String.raw`select: function( event, ui ) {` + `\n`
+ String.raw`var terms = split( this.value );` + `\n`
+ String.raw`// remove the current input` + `\n`
+ String.raw`terms.pop();` + `\n`
+ String.raw`// add the selected item` + `\n`
+ String.raw`terms.push( ui.item.value );` + `\n`
+ String.raw`// add placeholder to get the comma-and-space at the end` + `\n`
+ String.raw`terms.push( "" );` + `\n`
+ String.raw`this.value = terms.join( "," );` + `\n`
+ String.raw`return false;` + `\n`
+ String.raw`}` + `\n`
+ String.raw`});` + `\n`
+ String.raw`});` + `\n`
+ String.raw`` + `\n`
+ String.raw`` + `\n`
+ String.raw` $(function() {` + `\n`
+ String.raw`function split( val ) {` + `\n`
+ String.raw`return val.split( /,\s*/ );` + `\n`
+ String.raw`}` + `\n`
+ String.raw`function extractLast( term ) {` + `\n`
+ String.raw`return split( term ).pop();` + `\n`
+ String.raw`}` + `\n`
+ String.raw`     ` + `\n`
+ String.raw`$( "#seasonality1" )` + `\n`
+ String.raw` // don't navigate away from the field on tab when selecting an item` + `\n`
+ String.raw`.bind( "keydown", function( event ) {` + `\n`
+ String.raw`if ( event.keyCode === $.ui.keyCode.TAB &&` + `\n`
+ String.raw`$( this ).autocomplete( "instance" ).menu.active ) {` + `\n`
+ String.raw`event.preventDefault();` + `\n`
+ String.raw`}` + `\n`
+ String.raw`})` + `\n`
+ String.raw`.autocomplete({` + `\n`
+ String.raw`minLength: 0,` + `\n`
+ String.raw`source: function( request, response ) {` + `\n`
+ String.raw`// delegate back to autocomplete, but extract the last term` + `\n`
+ String.raw`response( $.ui.autocomplete.filter(` + `\n`
+ String.raw`seasonalitylist, extractLast( request.term ) ) );` + `\n`
+ String.raw`},` + `\n`
+ String.raw`` + `\n`
+ String.raw`//    source:projects,    ` + `\n`
+ String.raw`focus: function() {` + `\n`
+ String.raw`// prevent value inserted on focus` + `\n`
+ String.raw`return false;` + `\n`
+ String.raw`},` + `\n`
+ String.raw`select: function( event, ui ) {` + `\n`
+ String.raw`var terms = split( this.value );` + `\n`
+ String.raw`// remove the current input` + `\n`
+ String.raw`terms.pop();` + `\n`
+ String.raw`// add the selected item` + `\n`
+ String.raw`terms.push( ui.item.value );` + `\n`
+ String.raw`// add placeholder to get the comma-and-space at the end` + `\n`
+ String.raw`terms.push( "" );` + `\n`
+ String.raw`this.value = terms.join( "," );` + `\n`
+ String.raw`return false;` + `\n`
+ String.raw`}` + `\n`
+ String.raw`});` + `\n`
+ String.raw`});` + `\n`
+ String.raw`	` + `\n`
+ String.raw`function split( val ) {` + `\n`
+ String.raw`return val.split( /,\s*/ );` + `\n`
+ String.raw`}` + `\n`
+ String.raw`function rmBlanksCompilation(val){` + `\n`
+ String.raw`	    if (val.length > 0) {` + `\n`
+ String.raw`		    val = split(val)` + `\n`
+ String.raw`		    val = val.filter(Boolean)` + `\n`
+ String.raw`		    val = val.map(element => grabLatest(element))` + `\n`
+ String.raw`	    	    val = val.join( "," );` + `\n`
+ String.raw`	    }` + `\n`
+ String.raw`	return val;` + `\n`
+ String.raw`}` + `\n`
+ String.raw`function rmBlanks(val){` + `\n`
+ String.raw`	    if (val.length > 0) {` + `\n`
+ String.raw`		    val = split(val)` + `\n`
+ String.raw`		    val = val.filter(Boolean)` + `\n`
+ String.raw`	    	    val = val.join( "," );` + `\n`
+ String.raw`	    }` + `\n`
+ String.raw`	return val;` + `\n`
+ String.raw`}` + `\n`
+ String.raw`	` + `\n`
+ String.raw`function qString(val1,name1,isCompilation){` + `\n`
+ String.raw`	if (isCompilation){` + `\n`
+ String.raw`		var x1 = rmBlanksCompilation(val1)` + `\n`
+ String.raw`	} else {` + `\n`
+ String.raw`		var x1 = rmBlanks(val1)` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	if (x1.length == 0){` + `\n`
+ String.raw`		return '';` + `\n`
+ String.raw`	} else {` + `\n`
+ String.raw`	    return name1 + '=' + x1;` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`` + `\n`
+ String.raw`}` + `\n`
+ String.raw`</script>` + `\n`
+ String.raw`<script>` + `\n`
+ String.raw`var compVals = compilationlist.map(function(d) { return d.value })` + `\n`
+ String.raw`//console.log(compVals)` + `\n`
+ String.raw`host2 = compVals.map(function(aa) {` + `\n`
+ String.raw`    var splitup = aa.split("-")` + `\n`
+ String.raw`    var indexLast = splitup.length - 1` + `\n`
+ String.raw`    if (indexLast == 0){` + `\n`
+ String.raw`    	return null` + `\n`
+ String.raw`    } else{` + `\n`
+ String.raw`    	return splitup[indexLast]` + `\n`
+ String.raw`    }` + `\n`
+ String.raw`  })` + `\n`
+ String.raw`//console.log(host2)` + `\n`
+ String.raw`arrayGrep = function (arr1, arr2, selectedString){` + `\n`
+ String.raw`var indices = [];` + `\n`
+ String.raw`for (var i=0; i < arr1.length; i++){` + `\n`
+ String.raw`	if (arr1.at(i).includes(selectedString)){` + `\n`
+ String.raw`    indices.push(i)` + `\n`
+ String.raw`  }` + `\n`
+ String.raw`}` + `\n`
+ String.raw`var arr3 = indices.map(i => arr2[i]);` + `\n`
+ String.raw`arr3 = arr3.filter(n => n)` + `\n`
+ String.raw`arr3 = arr3.sort()` + `\n`
+ String.raw`return arr3.at(-1)` + `\n`
+ String.raw`}` + `\n`
+ String.raw`` + `\n`
+ String.raw`//if true, return the compilation versions` + `\n`
+ String.raw`grabLatest = function(selectedString){` + `\n`
+ String.raw`	//console.log("selectedString: " + selectedString)` + `\n`
+ String.raw`	//if pulling latest, return the compilation versions` + `\n`
+ String.raw`	//console.log("!!!test if getting latest!!!: " + Object.is(host2[compVals.indexOf(selectedString)],null))` + `\n`
+ String.raw`	if(Object.is(host2[compVals.indexOf(selectedString)],null)){` + `\n`
+ String.raw`		//console.log("recognized choice of LATEST compilation")` + `\n`
+ String.raw`		var ret1 = arrayGrep(compVals, compVals, selectedString)` + `\n`
+ String.raw`		//console.log("ret1: " + ret1)` + `\n`
+ String.raw`  		return ret1` + `\n`
+ String.raw`  	} else {` + `\n`
+ String.raw`  		//otherwise, preserve version entered` + `\n`
+ String.raw`  		return selectedString` + `\n`
+ String.raw`  }` + `\n`
+ String.raw`}` + `\n`
+ String.raw`getAllMonths = function(startSpan,endSpan){` + `\n`
+ String.raw`	var monthText = seasonality2.map(function(d) { return d.label; });` + `\n`
+ String.raw`	var allMonths = [];` + `\n`
+ String.raw`  startSpan=startSpan-1` + `\n`
+ String.raw`  //var spanMax = (endSpan-startSpan)+1` + `\n`
+ String.raw`  for (var i=startSpan; i < endSpan; i++){` + `\n`
+ String.raw`    var startmonth = monthText[i]` + `\n`
+ String.raw`    var monthSpan = endSpan - i` + `\n`
+ String.raw`    for (var ii=0; ii < monthSpan; ii++){` + `\n`
+ String.raw`      var endMonth = monthText[(ii+i)]` + `\n`
+ String.raw`      if (startmonth==endMonth){` + `\n`
+ String.raw`        allMonths.push(startmonth)` + `\n`
+ String.raw`      } else {` + `\n`
+ String.raw`        allMonths.push(startmonth + "-" + endMonth)` + `\n`
+ String.raw`      }` + `\n`
+ String.raw`    }` + `\n`
+ String.raw`  }` + `\n`
+ String.raw`  allMonths = allMonths.join(",")` + `\n`
+ String.raw`  return(allMonths)` + `\n`
+ String.raw`}` + `\n`
+ String.raw`//console.log(getAllMonths(5,10))` + `\n`
+ String.raw`    //send mySQL query to queryDB and show response` + `\n`
+ String.raw`    function params(useCoords=false){` + `\n`
+ String.raw`	    var x1 = rmBlanks(document.getElementById("archiveTypeIn").value)	    ` + `\n`
+ String.raw`	    var x2 = rmBlanks(document.getElementById("variableName").value)` + `\n`
+ String.raw`	    qstring = '?'` + `\n`
+ String.raw`	    qstring = qstring + qString(document.getElementById("archiveTypeIn").value,document.getElementById("archiveTypeIn").name,false)` + `\n`
+ String.raw`	    qstring = qstring + '&' + qString(document.getElementById("variableName").value,document.getElementById("variableName").name,false)` + `\n`
+ String.raw`	    qstring = qstring + '&' + qString(document.getElementById("proxy").value,document.getElementById("proxy").name,false)` + `\n`
+ String.raw`	    qstring = qstring + '&' + qString(document.getElementById("countryIn").value,document.getElementById("countryIn").name,false)` + `\n`
+ String.raw`	    qstring = qstring + '&' + qString(document.getElementById("continentIn").value,document.getElementById("continentIn").name,false)` + `\n`
+ String.raw`	    qstring = qstring + '&' + qString(document.getElementById("compilationIn").value,document.getElementById("compilationIn").name,true)` + `\n`
+ String.raw`	    if (!JSON.parse(filters1['seasonality'])){` + `\n`
+ String.raw`	    	qstring = qstring + '&' + qString(document.getElementById("seasonality1").value,document.getElementById("seasonality1").name,false)` + `\n`
+ String.raw`	    }` + `\n`
+ String.raw`	    if (useCoords=true){` + `\n`
+ String.raw`		    if (JSON.parse(filters1['coords'])){` + `\n`
+ String.raw`			    qstring = qstring + '& geo_latitude < ' + document.getElementById("lat_max").value` + `\n`
+ String.raw`			    qstring = qstring + '& geo_latitude > ' + document.getElementById("lat_min").value` + `\n`
+ String.raw`			    qstring = qstring + '& geo_longitude < ' + document.getElementById("lon_max").value` + `\n`
+ String.raw`			    qstring = qstring + '& geo_longitude > ' + document.getElementById("lon_min").value` + `\n`
+ String.raw`		    }` + `\n`
+ String.raw`	    }` + `\n`
+ String.raw`	    if (JSON.parse(filters1['ages'])){` + `\n`
+ String.raw`		    ` + `\n`
+ String.raw`		    qstring = qstring + '& minAge < ' + document.getElementById("time_range_to_reconstruct_fromInput").value` + `\n`
+ String.raw`		    qstring = qstring + '& maxAge > ' + document.getElementById("time_range_to_reconstruct_toInput").value` + `\n`
+ String.raw`	    }` + `\n`
+ String.raw`	    if (JSON.parse(filters1['resolution'])){` + `\n`
+ String.raw`	    	qstring = qstring + '& medianResolution < ' + document.getElementById("resolutionInput").value` + `\n`
+ String.raw`	    }` + `\n`
+ String.raw`	    if (JSON.parse(filters1['terrestrial'])){` + `\n`
+ String.raw`	    	qstring = qstring + '& isTerrestrial=' + +document.getElementById("Terrestrial").checked` + `\n`
+ String.raw`	    }` + `\n`
+ String.raw`	    if (JSON.parse(filters1['seasonality'])){` + `\n`
+ String.raw`		    qstring = qstring + '& ' + document.getElementById("seasonality1").name + "=" + rmBlanks(document.getElementById("seasonality1").value + "," + getAllMonths(document.getElementById("months_range_fromSlider").value,document.getElementById("months_range_toSlider").value))` + `\n`
+ String.raw`	    }` + `\n`
+ String.raw`	    //console.log(qstring)` + `\n`
+ String.raw`	    return qstring;` + `\n`
+ String.raw`    };` + `\n`
+ String.raw`    let prevResp = {};` + `\n`
+ String.raw`    updateRes = function(a1){` + `\n`
+ String.raw`	    return(a1)` + `\n`
+ String.raw`    }` + `\n`
+ String.raw`/*` + `\n`
+ String.raw`    getDatasetIds = function(resp){` + `\n`
+ String.raw`	    //console.log("Dataset IDs: ");` + `\n`
+ String.raw`	    //console.log(resp.length)` + `\n`
+ String.raw`	    var allIds = resp.map(function(d) { return d['datasetId']; });` + `\n`
+ String.raw`	    //console.log(allIds);` + `\n`
+ String.raw`	    let formData = new FormData({"datasetId":"02FdjjuIUmFedlZZi5cu,03eOxNMUzDCSVIFCSv10,0aKTjXiLVTdaErc7kgdD,0bwV9Qx7wW5DfaO34xz4,0Fu8raGb33rs9Vl3qUiV,0jq8riIobvRZQnR8Q4Xe,0JQU7qHx9jTMVDDqHa38"});` + `\n`
+ String.raw`	    return formData` + `\n`
+ String.raw`    }` + `\n`
+ String.raw`  */  ` + `\n`
+ String.raw`    //var xhr = new XMLHttpRequest();` + `\n`
+ String.raw`    sendQuery = function(){` + `\n`
+ String.raw`	var param1 = params(useCoords=false)` + `\n`
+ String.raw`	var xhr0 = new XMLHttpRequest();` + `\n`
+ String.raw`        xhr0.timeout = 2000;` + `\n`
+ String.raw`        xhr0.onreadystatechange = function(e){` + `\n`
+ String.raw`            //console.log(this);` + `\n`
+ String.raw`            if (xhr0.readyState === 4){` + `\n`
+ String.raw`                if (xhr0.status === 200){` + `\n`
+ String.raw`		    const promise1 = new Promise((resolve, reject) => {` + `\n`
+ String.raw`			    console.log("query: " + param1)` + `\n`
+ String.raw`			    prevResp = updateRes(JSON.parse(xhr0.response));` + `\n`
+ String.raw`		            ` + `\n`
+ String.raw`			    resolve();` + `\n`
+ String.raw`		    });` + `\n`
+ String.raw`			promise1.then(() => {` + `\n`
+ String.raw`			  updatePoints(prevResp)` + `\n`
+ String.raw`			  xhr0 = null;` + `\n`
+ String.raw`			  // Expected output: "Success!"` + `\n`
+ String.raw`			});` + `\n`
+ String.raw`                } else {` + `\n`
+ String.raw`		    const promise1 = new Promise((resolve, reject) => {` + `\n`
+ String.raw`			    console.log("XHR didn't work: " + xhr0.status);` + `\n`
+ String.raw`			    resolve();` + `\n`
+ String.raw`		    });` + `\n`
+ String.raw`			` + `\n`
+ String.raw`			promise1.then(() => {` + `\n`
+ String.raw`			  xhr0 = null;` + `\n`
+ String.raw`			  // Expected output: "Success!"` + `\n`
+ String.raw`			});` + `\n`
+ String.raw`			` + `\n`
+ String.raw`                    ` + `\n`
+ String.raw`                }` + `\n`
+ String.raw`            }` + `\n`
+ String.raw`        }` + `\n`
+ String.raw`        xhr0.ontimeout = function (){` + `\n`
+ String.raw`            console.error("request timedout: ", xhr0);` + `\n`
+ String.raw`        }` + `\n`
+ String.raw`        xhr0.open("get", "http://143.198.98.66:88/" + param1, /*async*/ true);` + `\n`
+ String.raw`        // xhr.responseType = "text";` + `\n`
+ String.raw`        xhr0.send();` + `\n`
+ String.raw`    }` + `\n`
+ String.raw`` + `\n`
+ String.raw`compileLipds = function(Body){` + `\n`
+ String.raw`	    var xhr1 = new XMLHttpRequest();` + `\n`
+ String.raw`	    //xhr.timeout = 2000;` + `\n`
+ String.raw`		return new Promise((resolve, reject) => {` + `\n`
+ String.raw`	    	xhr1.onreadystatechange = (e) => {` + `\n`
+ String.raw`			if (xhr1.readyState !== 4) {` + `\n`
+ String.raw`				return;` + `\n`
+ String.raw`			}` + `\n`
+ String.raw`			if (xhr1.status === 200){` + `\n`
+ String.raw`				//console.log("time series: ");` + `\n`
+ String.raw`				//console.log(xhr.responseText);` + `\n`
+ String.raw`				resolve(xhr1.responseText);` + `\n`
+ String.raw`			} else {` + `\n`
+ String.raw`				var resp1 = "XHR didn't work: " + xhr1.status;` + `\n`
+ String.raw`				console.log(resp1);` + `\n`
+ String.raw`				resolve();` + `\n`
+ String.raw`			}` + `\n`
+ String.raw`		};` + `\n`
+ String.raw`		xhr1.open("post", "http://143.198.98.66:90/lipds", /*async*/ true);` + `\n`
+ String.raw`		xhr1.setRequestHeader("Content-type", "application/json");` + `\n`
+ String.raw`		xhr1.send(Body);` + `\n`
+ String.raw`		});` + `\n`
+ String.raw`}` + `\n`
+ String.raw`` + `\n`
+ String.raw`postTSids = function(Body){` + `\n`
+ String.raw`	    var xhr7 = new XMLHttpRequest();` + `\n`
+ String.raw`	    //xhr.timeout = 2000;` + `\n`
+ String.raw`		return new Promise((resolve, reject) => {` + `\n`
+ String.raw`	    	xhr7.onreadystatechange = (e) => {` + `\n`
+ String.raw`			if (xhr7.readyState !== 4) {` + `\n`
+ String.raw`				return;` + `\n`
+ String.raw`			}` + `\n`
+ String.raw`			if (xhr7.status === 200){` + `\n`
+ String.raw`				//console.log("time series: ");` + `\n`
+ String.raw`				//console.log(xhr.responseText);` + `\n`
+ String.raw`				resolve(xhr7.responseText);` + `\n`
+ String.raw`			} else {` + `\n`
+ String.raw`				var resp1 = "XHR didn't work: " + xhr7.status;` + `\n`
+ String.raw`				console.log(resp1);` + `\n`
+ String.raw`				resolve();` + `\n`
+ String.raw`			}` + `\n`
+ String.raw`		};` + `\n`
+ String.raw`		xhr7.open("post", "http://143.198.98.66:92/", /*async*/ true);` + `\n`
+ String.raw`		xhr7.setRequestHeader("Content-type", "application/json");` + `\n`
+ String.raw`		xhr7.send(Body);` + `\n`
+ String.raw`		});` + `\n`
+ String.raw`}` + `\n`
+ String.raw`	` + `\n`
+ String.raw`getTSIDs = function(){` + `\n`
+ String.raw`	    var xhr2 = new XMLHttpRequest();` + `\n`
+ String.raw`	    //xhr.timeout = 2000;` + `\n`
+ String.raw`		return new Promise((resolve, reject) => {` + `\n`
+ String.raw`	    	xhr2.onreadystatechange = (e) => {` + `\n`
+ String.raw`			if (xhr2.readyState !== 4) {` + `\n`
+ String.raw`				return;` + `\n`
+ String.raw`			}` + `\n`
+ String.raw`			if (xhr2.status === 200){` + `\n`
+ String.raw`				//console.log("TSIDs: ");` + `\n`
+ String.raw`				//console.log(xhr.responseText);` + `\n`
+ String.raw`				resolve(xhr2.responseText);` + `\n`
+ String.raw`			} else {` + `\n`
+ String.raw`				var resp1 = "XHR didn't work: " + xhr2.status;` + `\n`
+ String.raw`				console.log(resp1);` + `\n`
+ String.raw`				resolve();` + `\n`
+ String.raw`			}` + `\n`
+ String.raw`		};` + `\n`
+ String.raw`		xhr2.open("get", "http://143.198.98.66:88/TS" + params(useCoords=true), /*async*/ true);` + `\n`
+ String.raw`		xhr2.send();` + `\n`
+ String.raw`		});` + `\n`
+ String.raw`}` + `\n`
+ String.raw`` + `\n`
+ String.raw`retTimeSeries = function(TSIDs){` + `\n`
+ String.raw`	    var xhr3 = new XMLHttpRequest();` + `\n`
+ String.raw`	    //xhr.timeout = 2000;` + `\n`
+ String.raw`		return new Promise((resolve, reject) => {` + `\n`
+ String.raw`	    	xhr3.onreadystatechange = (e) => {` + `\n`
+ String.raw`			if (xhr3.readyState !== 4) {` + `\n`
+ String.raw`				return;` + `\n`
+ String.raw`			}` + `\n`
+ String.raw`			if (xhr3.status === 200){` + `\n`
+ String.raw`				//console.log("time series: ");` + `\n`
+ String.raw`				//console.log(xhr.responseText);` + `\n`
+ String.raw`				resolve(xhr3.responseText);` + `\n`
+ String.raw`			} else {` + `\n`
+ String.raw`				//var resp1 = xhr.status;` + `\n`
+ String.raw`				console.log(xhr3.status);` + `\n`
+ String.raw`				resolve(xhr3.status);` + `\n`
+ String.raw`			}` + `\n`
+ String.raw`		};` + `\n`
+ String.raw`		xhr3.open("post", "http://143.198.98.66:89/sparql", /*async*/ true);` + `\n`
+ String.raw`		xhr3.setRequestHeader("Content-type", "application/json");` + `\n`
+ String.raw`		xhr3.send(TSIDs);` + `\n`
+ String.raw`		});` + `\n`
+ String.raw`}` + `\n`
+ String.raw`` + `\n`
+ String.raw`function writeCSV(json1){` + `\n`
+ String.raw`	console.log(json1)` + `\n`
+ String.raw`	json1 = JSON.parse(JSON.parse(json1))` + `\n`
+ String.raw`	//console.log(typeof json1)` + `\n`
+ String.raw`	var keys1 = Object.keys(json1)` + `\n`
+ String.raw`	/*` + `\n`
+ String.raw`	if (keys1.length > 100){` + `\n`
+ String.raw`		var alertText = "Preparing csv file with " + keys1.length + " records"` + `\n`
+ String.raw`		alert(alertText);` + `\n`
+ String.raw`	}` + `\n`
+ String.raw` 	*/` + `\n`
+ String.raw`	//console.log(keys1.length)` + `\n`
+ String.raw`	var numKeys = keys1.length;` + `\n`
+ String.raw`	var len1 = 0;` + `\n`
+ String.raw`	var lenMax = 0;` + `\n`
+ String.raw`	for (let i=0; i < numKeys; i++){` + `\n`
+ String.raw`	len1 = Object.values(json1)[i].length` + `\n`
+ String.raw`	if (len1 > lenMax){` + `\n`
+ String.raw`	lenMax = len1` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	//console.log(lenMax)` + `\n`
+ String.raw`	` + `\n`
+ String.raw`	var string1 = keys1.join(", ") + "\n"` + `\n`
+ String.raw`	for (let j=0; j<lenMax; j++){` + `\n`
+ String.raw`		for (var key of keys1){` + `\n`
+ String.raw`	  	var val1 = Object.values(json1[key])[j]` + `\n`
+ String.raw`	    if (typeof val1 === "undefined"){` + `\n`
+ String.raw`	    	string1 += ","` + `\n`
+ String.raw`	    } else {` + `\n`
+ String.raw`	    	string1 += val1 + ","` + `\n`
+ String.raw`	    }` + `\n`
+ String.raw`	  }` + `\n`
+ String.raw`	  string1 += "\n"` + `\n`
+ String.raw`	}` + `\n`
+ String.raw`	return string1` + `\n`
+ String.raw`}` + `\n`
+ String.raw`` + `\n`
+ String.raw`function downloadCurrentDocument(resp1) {` + `\n`
+ String.raw`  var csvContent = encodeURI(writeCSV(resp1)),` + `\n`
+ String.raw`      a = document.createElement('a'),` + `\n`
+ String.raw`      e = new MouseEvent('click');` + `\n`
+ String.raw`` + `\n`
+ String.raw`  a.download = 'PrestoTS.csv';` + `\n`
+ String.raw`  a.href = 'data:text/csv;charset=utf-8,' + csvContent;` + `\n`
+ String.raw`  a.dispatchEvent(e);` + `\n`
+ String.raw`}` + `\n`
+ String.raw`` + `\n`
+ String.raw`function getLipds(loc1){` + `\n`
+ String.raw`	return new Promise((resolve, reject) => {` + `\n`
+ String.raw`		//alert(params(useCoords=true))` + `\n`
+ String.raw`		getTSIDs().then(reso => {` + `\n`
+ String.raw`			var resoJSON = JSON.parse(reso);` + `\n`
+ String.raw`			var IDs = resoJSON.map(function(d) { return d['paleoData_TSid']; })` + `\n`
+ String.raw`			console.log("Total time series: " + IDs.length);` + `\n`
+ String.raw`			var tsJSON = '{"TSIDs": ' + JSON.stringify(IDs) + ',"uniqueID":"' + document.getElementById('uniqueID').value + '", "language":"'  + document.getElementById('language').value + '"}'` + `\n`
+ String.raw`			console.log("json body sent to 'getLipds': " + tsJSON)` + `\n`
+ String.raw`			console.log("sending post TSids")` + `\n`
+ String.raw`			postTSids(tsJSON);` + `\n`
+ String.raw`			var TSIDsArray = JSON.parse(tsJSON).TSIDs` + `\n`
+ String.raw`			var numTSids = TSIDsArray.length` + `\n`
+ String.raw`			alert('Proceeding with ' + numTSids + ' climate proxy time series')` + `\n`
+ String.raw`			compileLipds(tsJSON);` + `\n`
+ String.raw`			if (loc1 == "donwload"){` + `\n`
+ String.raw`				resolve("https://www.google.com")` + `\n`
+ String.raw`			} else if (loc1 == "reconstruct"){` + `\n`
+ String.raw`				var queryParams = params(useCoords=true)` + `\n`
+ String.raw`				queryParams = '&' + queryParams.substring(1);` + `\n`
+ String.raw`				queryParams = queryParams.replace(/\s/g, '');` + `\n`
+ String.raw`				resolve("http://143.198.98.66:85/"+window.location.search+queryParams)` + `\n`
+ String.raw`			} else {` + `\n`
+ String.raw`				resolve("https://paleopresto.com/")` + `\n`
+ String.raw`			}` + `\n`
+ String.raw`		});` + `\n`
+ String.raw`	});` + `\n`
+ String.raw`}` + `\n`
+ String.raw`	` + `\n`
+ String.raw`function grabCSV() {` + `\n`
+ String.raw`	getTSIDs().then(reso => {` + `\n`
+ String.raw`		var resoJSON = JSON.parse(reso);` + `\n`
+ String.raw`		var IDs = resoJSON.map(function(d) { return d['paleoData_TSid']; })` + `\n`
+ String.raw`		if (IDs.length > 300){` + `\n`
+ String.raw`			var alertText = "Sorry, " + IDs.length + " is too many records to compile here"` + `\n`
+ String.raw`			alert(alertText);` + `\n`
+ String.raw`		} else {` + `\n`
+ String.raw`			console.log("Total time series: " + IDs.length);` + `\n`
+ String.raw`			var tsJSON = '{"TSIDs": ' + JSON.stringify(IDs) + '}'` + `\n`
+ String.raw`			var TS1 = retTimeSeries(tsJSON).then(resp1 => {` + `\n`
+ String.raw`			downloadCurrentDocument(resp1);` + `\n`
+ String.raw`			return true` + `\n`
+ String.raw`			});` + `\n`
+ String.raw`		}` + `\n`
+ String.raw`	});` + `\n`
+ String.raw`}` + `\n`
+ String.raw`` + `\n`
+ String.raw`` + `\n`
+ String.raw`/*	` + `\n`
+ String.raw`let dsidArray = [];` + `\n`
+ String.raw`let dataString = ""` + `\n`
+ String.raw`let jsbody = '{"datasetId":""}';` + `\n`
+ String.raw`	getAvailPlot = function(){` + `\n`
+ String.raw`	xhr = new XMLHttpRequest();` + `\n`
+ String.raw`        xhr.timeout = 5000;` + `\n`
+ String.raw`        xhr.onreadystatechange = function(e){` + `\n`
+ String.raw`            //console.log(this);` + `\n`
+ String.raw`            if (xhr.readyState === 4){` + `\n`
+ String.raw`                if (xhr.status === 200){` + `\n`
+ String.raw`		    const promise1 = new Promise((resolve, reject) => {` + `\n`
+ String.raw`			    console.log("Changing image source")` + `\n`
+ String.raw`			    document.getElementById("iframediv").innerHTML = xhr.response;` + `\n`
+ String.raw`			    console.log("Changed")` + `\n`
+ String.raw`			    resolve();` + `\n`
+ String.raw`		    });` + `\n`
+ String.raw`			promise1.then(() => {` + `\n`
+ String.raw`			  xhr = null;` + `\n`
+ String.raw`			  // Expected output: "Success!"` + `\n`
+ String.raw`			});` + `\n`
+ String.raw`                } else {` + `\n`
+ String.raw`		    const promise1 = new Promise((resolve, reject) => {` + `\n`
+ String.raw`			    console.log("XHR didn't work: " + xhr.status);` + `\n`
+ String.raw`			    resolve();` + `\n`
+ String.raw`		    });` + `\n`
+ String.raw`			` + `\n`
+ String.raw`			promise1.then(() => {` + `\n`
+ String.raw`			  xhr = null;` + `\n`
+ String.raw`			  // Expected output: "Success!"` + `\n`
+ String.raw`			});` + `\n`
+ String.raw`			` + `\n`
+ String.raw`                    ` + `\n`
+ String.raw`                }` + `\n`
+ String.raw`            }` + `\n`
+ String.raw`        }` + `\n`
+ String.raw`        xhr.ontimeout = function (){` + `\n`
+ String.raw`            console.error("request timedout: ", xhr);` + `\n`
+ String.raw`        }` + `\n`
+ String.raw`	//let formData = new FormData([{"datasetId":"02FdjjuIUmFedlZZi5cu,03eOxNMUzDCSVIFCSv10,0aKTjXiLVTdaErc7kgdD,0bwV9Qx7wW5DfaO34xz4,0Fu8raGb33rs9Vl3qUiV,0jq8riIobvRZQnR8Q4Xe,0JQU7qHx9jTMVDDqHa38"}]); // creates an object, optionally fill from <form>` + `\n`
+ String.raw`	//formData.append(name, value); // appends a field` + `\n`
+ String.raw`        xhr.open("post", "http://146.190.152.170/date/", true);` + `\n`
+ String.raw`	xhr.setRequestHeader("Content-type", "application/json");` + `\n`
+ String.raw`	dsidArray = prevResp.map(function(d) { return d['datasetId']; })` + `\n`
+ String.raw`	dsidArray = dsidArray.map(function(e){` + `\n`
+ String.raw`  		return (e);` + `\n`
+ String.raw`	});` + `\n`
+ String.raw`` + `\n`
+ String.raw`	dataString = dsidArray.join(",");` + `\n`
+ String.raw`	console.log(dataString)` + `\n`
+ String.raw`        jsbody = '{"datasetId":"'+ dataString + '"}';` + `\n`
+ String.raw`        console.log(jsbody);` + `\n`
+ String.raw`	xhr.send(jsbody);` + `\n`
+ String.raw`    }*/` + `\n`
+ String.raw`//$getReposBtn.onclick = sendQuery();` + `\n`
+ String.raw`/*` + `\n`
+ String.raw`firstRun = function (){` + `\n`
+ String.raw`	//a1 = loadLatLon(prevResp);` + `\n`
+ String.raw`	b1 = sendQuery();` + `\n`
+ String.raw`	a1 = loadLatLon(b1);` + `\n`
+ String.raw`	updatePoints(b1);` + `\n`
+ String.raw`	return(a1)` + `\n`
+ String.raw`}` + `\n`
+ String.raw`AllPoints = firstRun();*/` + `\n`
+ String.raw`changeBoxCoord();` + `\n`
+ String.raw`	function getColor(d) {` + `\n`
+ String.raw`    return d > 1000 ? '#800026' :` + `\n`
+ String.raw`           d > 500  ? '#BD0026' :` + `\n`
+ String.raw`           d > 200  ? '#E31A1C' :` + `\n`
+ String.raw`           d > 100  ? '#FC4E2A' :` + `\n`
+ String.raw`           d > 50   ? '#FD8D3C' :` + `\n`
+ String.raw`           d > 20   ? '#FEB24C' :` + `\n`
+ String.raw`           d > 10   ? '#FED976' :` + `\n`
+ String.raw`                      '#FFEDA0';` + `\n`
+ String.raw`}` + `\n`
+ String.raw`const legend = L.control.Legend({` + `\n`
+ String.raw`            position: "bottomleft",` + `\n`
+ String.raw`	    //title: "Archive Type",` + `\n`
+ String.raw`            collapsed: false,` + `\n`
+ String.raw`            symbolWidth: 12,` + `\n`
+ String.raw`	    symbolHeight: 12,` + `\n`
+ String.raw`            opacity: 1,` + `\n`
+ String.raw`            column: 8,` + `\n`
+ String.raw`            legends: [{` + `\n`
+ String.raw`                label: "Borehole",` + `\n`
+ String.raw`                type: "polygon",` + `\n`
+ String.raw`                sides: "4",` + `\n`
+ String.raw`		color: "#FFD600",` + `\n`
+ String.raw`		fillColor: "#FFD600",` + `\n`
+ String.raw`    		weight: 2` + `\n`
+ String.raw`            }, {` + `\n`
+ String.raw`    label: "Coral",` + `\n`
+ String.raw`    type: "polygonR",` + `\n`
+ String.raw`    sides: 3,` + `\n`
+ String.raw`    color: "#FF8B00",` + `\n`
+ String.raw`    fillColor: "#FF8B00",` + `\n`
+ String.raw`    weight: 2` + `\n`
+ String.raw`}, {` + `\n`
+ String.raw`    label: "FluvialSediment",` + `\n`
+ String.raw`    type: "circle",` + `\n`
+ String.raw`    radius: 6,` + `\n`
+ String.raw`    color: "#4169E0",` + `\n`
+ String.raw`    fillColor: "#4169E0",` + `\n`
+ String.raw`    weight: 2` + `\n`
+ String.raw`}, {` + `\n`
+ String.raw`    label: "GlacierIce",` + `\n`
+ String.raw`    type: "image",` + `\n`
+ String.raw`    url: "/glacierIce.png"` + `\n`
+ String.raw`}, {` + `\n`
+ String.raw`    label: "GroundIce",` + `\n`
+ String.raw`    type: "image",` + `\n`
+ String.raw`    url: "/groundIce.png"` + `\n`
+ String.raw`}, {` + `\n`
+ String.raw`    label: "LakeSediment",` + `\n`
+ String.raw`    type: "circle",` + `\n`
+ String.raw`    radius: 6,` + `\n`
+ String.raw`    color: "#8f8fa1",` + `\n`
+ String.raw`    fillColor: "#8f8fa1",` + `\n`
+ String.raw`    weight: 2` + `\n`
+ String.raw`}, {` + `\n`
+ String.raw`    label: "MarineSediment",` + `\n`
+ String.raw`    type: "circle",` + `\n`
+ String.raw`    radius: 6,` + `\n`
+ String.raw`    color: "#8A4513",` + `\n`
+ String.raw`    fillColor: "#8A4513",` + `\n`
+ String.raw`    weight: 2` + `\n`
+ String.raw`}, {` + `\n`
+ String.raw`    label: "Midden",` + `\n`
+ String.raw`    type: "polygonR",` + `\n`
+ String.raw`    sides: 4,` + `\n`
+ String.raw`    color: "#824E2B",` + `\n`
+ String.raw`    fillColor: "#824E2B",` + `\n`
+ String.raw`    weight: 2` + `\n`
+ String.raw`}, {` + `\n`
+ String.raw`    label: "MolluskShell",` + `\n`
+ String.raw`    type: "polygon",` + `\n`
+ String.raw`    sides: 3,` + `\n`
+ String.raw`    color: "#7b03fc",` + `\n`
+ String.raw`    fillColor: "#7b03fc",` + `\n`
+ String.raw`    weight: 2` + `\n`
+ String.raw`}, {` + `\n`
+ String.raw`    label: "Peat",` + `\n`
+ String.raw`    type: "polygonR",` + `\n`
+ String.raw`    sides: 3,` + `\n`
+ String.raw`    color: "#8A9A5B",` + `\n`
+ String.raw`    fillColor: "#8A9A5B",` + `\n`
+ String.raw`    weight: 2` + `\n`
+ String.raw`}, {` + `\n`
+ String.raw`    label: "Sclerosponge",` + `\n`
+ String.raw`    type: "polygonR",` + `\n`
+ String.raw`    sides: 3,` + `\n`
+ String.raw`    color: "#D2042D",` + `\n`
+ String.raw`    fillColor: "#D2042D",` + `\n`
+ String.raw`    weight: 2` + `\n`
+ String.raw`}, {` + `\n`
+ String.raw`    label: "Shoreline",` + `\n`
+ String.raw`    type: "polygonR",` + `\n`
+ String.raw`    sides: 4,` + `\n`
+ String.raw`    color: "#40826D",` + `\n`
+ String.raw`    fillColor: "#40826D",` + `\n`
+ String.raw`    weight: 2` + `\n`
+ String.raw`}, {` + `\n`
+ String.raw`    label: "Speleothem",` + `\n`
+ String.raw`    type: "polygon",` + `\n`
+ String.raw`    sides: 4,` + `\n`
+ String.raw`    color: "#FF1492",` + `\n`
+ String.raw`    fillColor: "#FF1492",` + `\n`
+ String.raw`    weight: 2` + `\n`
+ String.raw`}, {` + `\n`
+ String.raw`    label: "TerrestrialSediment",` + `\n`
+ String.raw`    type: "circle",` + `\n`
+ String.raw`    radius: 6,` + `\n`
+ String.raw`    color: "#d2b48c",` + `\n`
+ String.raw`    fillColor: "#d2b48c",` + `\n`
+ String.raw`    weight: 2` + `\n`
+ String.raw`}, {` + `\n`
+ String.raw`    label: "Wood",` + `\n`
+ String.raw`    type: "polygon",` + `\n`
+ String.raw`    sides: 3,` + `\n`
+ String.raw`    color: "#32CC32",` + `\n`
+ String.raw`    fillColor: "#32CC32",` + `\n`
+ String.raw`    weight: 2` + `\n`
+ String.raw`}, {` + `\n`
+ String.raw`    label: "*Other*",` + `\n`
+ String.raw`    type: "polygonR",` + `\n`
+ String.raw`    sides: "4",` + `\n`
+ String.raw`    color: "black",` + `\n`
+ String.raw`    fillColor: "black",` + `\n`
+ String.raw`    weight: 2` + `\n`
+ String.raw`}]` + `\n`
+ String.raw`        }).addTo(map);` + `\n`
+ String.raw`` + `\n`
+ String.raw`` + `\n`
+ String.raw`var recon1 = document.getElementById('recon').value` + `\n`
+ String.raw`if (recon1 == 'false'){` + `\n`
+ String.raw`	//console.log("recon undefined, using downloads pathway")` + `\n`
+ String.raw`	document.getElementById('proceedButton').innerHTML = "Download selected Proxies"` + `\n`
+ String.raw`	document.getElementById('proceedButton').onclick = function () { getLipds('download').then(reso1 => location.href = reso1)};` + `\n`
+ String.raw`} else {` + `\n`
+ String.raw`	//console.log(recon1)` + `\n`
+ String.raw`	document.getElementById('proceedButton').innerHTML = "Use selected Proxies"` + `\n`
+ String.raw`	document.getElementById('proceedButton').onclick = function () { getLipds('reconstruct').then(reso1 => location.href = reso1)};` + `\n`
+ String.raw`}` + `\n`
+ String.raw`` + `\n`
+ String.raw`` + `\n`
+ String.raw`/*` + `\n`
+ String.raw`grabParams().then(reso => {` + `\n`
+ String.raw`	return new Promise((resolve, reject) => {` + `\n`
+ String.raw`		//for each parameter prescribed by the given recon, turn on the filter (if applicable) and alter the limits/options` + `\n`
+ String.raw`		var filterkeys = Object.keys(filters1)` + `\n`
+ String.raw`		console.log("filterkeys: " + filterkeys)` + `\n`
+ String.raw`		Object.keys(reso).forEach(function(key,index) {` + `\n`
+ String.raw`			console.log("key: " + key)` + `\n`
+ String.raw`			var findFilter =  filters1[key]` + `\n`
+ String.raw`			var inputId = key + 'In'` + `\n`
+ String.raw`			var inputFinder = document.getElementById(inputId)` + `\n`
+ String.raw`			console.log("findFilter: " + typeof findFilter)` + `\n`
+ String.raw`			console.log("inputFinder: " + inputFinder)` + `\n`
+ String.raw`			if (typeof findFilter != 'undefined'){` + `\n`
+ String.raw`				var docID = key+"On"` + `\n`
+ String.raw`				document.getElementById(docID).checked = 'true'` + `\n`
+ String.raw`				updateFilters();` + `\n`
+ String.raw`				if (typeof reso[key].value == 'number'){` + `\n`
+ String.raw`					var inputID = key + "Input"` + `\n`
+ String.raw`					var sliderID = key+"Slider"` + `\n`
+ String.raw`					document.getElementById(inputID).value = reso[key].default` + `\n`
+ String.raw`					document.getElementById(inputID).min = reso[key].limits[0]` + `\n`
+ String.raw`					document.getElementById(inputID).max = reso[key].limits[1]` + `\n`
+ String.raw`					document.getElementById(inputID).step = reso[key].precision` + `\n`
+ String.raw`					document.getElementById(sliderID).min = reso[key].limits[0]` + `\n`
+ String.raw`					document.getElementById(sliderID).max = reso[key].limits[1]` + `\n`
+ String.raw`					document.getElementById(sliderID).step = reso[key].precision` + `\n`
+ String.raw`					` + `\n`
+ String.raw`				}` + `\n`
+ String.raw`				resolve()` + `\n`
+ String.raw`			} else if (!(Object.is(inputFinder, undefined) || Object.is(inputFinder, null))){` + `\n`
+ String.raw`				document.getElementById(inputId).value = reso[key].default` + `\n`
+ String.raw`				resolve()` + `\n`
+ String.raw`			}` + `\n`
+ String.raw`		})` + `\n`
+ String.raw`	}).then(reso77 => sendQuery())` + `\n`
+ String.raw`});` + `\n`
+ String.raw`*/` + `\n`
+ String.raw`sendQuery()` + `\n`
+ String.raw`rect.on('edit', function() {` + `\n`
+ String.raw`  //setTimeout(function () {}, 100);` + `\n`
+ String.raw`  changeBoxCoord();` + `\n`
+ String.raw`  updatePoints(prevResp);` + `\n`
+ String.raw`});` + `\n`
+ String.raw`updateBoundingBox();` + `\n`
+ String.raw`</script>` + `\n`
+ String.raw`</html>`

fs.writeFile("/root/presto/query/" + recon  + ".html", htmlString, function(err) {
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
