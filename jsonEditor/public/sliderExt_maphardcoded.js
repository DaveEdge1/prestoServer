//Credit to Predrag Davidovic for the dual slider: "https://medium.com/@predragdavidovic10/native-dual-range-slider-html-css-javascript-91e778134816"
const color1 = '#896A67'
const color2 = '#C6C6C6'
function controlFromInput(fromSlider, fromInput, toInput, controlSlider) {
	    const [from, to] = getParsed(fromInput, toInput);
	    fillSlider(fromInput, toInput, '#C6C6C6', color1, controlSlider);
	    if (from > to) {
		            fromSlider.value = to;
		            fromInput.value = to;
		        } else {
				        fromSlider.value = from;
				    }
}
    
function controlToInput(toSlider, fromInput, toInput, controlSlider) {
	    const [from, to] = getParsed(fromInput, toInput);
	    fillSlider(fromInput, toInput, '#C6C6C6', color1, controlSlider);
	    setToggleAccessible(toInput);
	    if (from <= to) {
		            toSlider.value = to;
		            toInput.value = to;
		        } else {
				        toInput.value = from;
				    }
}

function controlFromSlider(fromSlider, toSlider, fromInput) {
	  const [from, to] = getParsed(fromSlider, toSlider);
	  fillSlider(fromSlider, toSlider, '#C6C6C6', color1, toSlider);
	  if (from > to) {
		      fromSlider.value = to;
		      fromInput.value = to;
		    } else {
			        fromInput.value = from;
			      }
}

function controlToSlider(fromSlider, toSlider, toInput) {
	  const [from, to] = getParsed(fromSlider, toSlider);
	  fillSlider(fromSlider, toSlider, '#C6C6C6', color1, toSlider);
	  setToggleAccessible(toSlider);
	  if (from <= to) {
		      toSlider.value = to;
		      toInput.value = to;
		    } else {
			        toInput.value = from;
			        toSlider.value = from;
			      }
}

function getParsed(currentFrom, currentTo) {
	  const from = parseInt(currentFrom.value, 10);
	  const to = parseInt(currentTo.value, 10);
	  return [from, to];
}

function fillSlider(from, to, sliderColor, rangeColor, controlSlider) {
	    const rangeDistance = to.max-to.min;
	    const fromPosition = from.value - to.min;
	    const toPosition = to.value - to.min;
	    controlSlider.style.background = `linear-gradient(
	          to right,
		        ${sliderColor} 0%,
			      ${sliderColor} ${(fromPosition)/(rangeDistance)*100}%,
			            ${rangeColor} ${((fromPosition)/(rangeDistance))*100}%,
				          ${rangeColor} ${(toPosition)/(rangeDistance)*100}%, 
					        ${sliderColor} ${(toPosition)/(rangeDistance)*100}%, 
						      ${sliderColor} 100%)`;
}

function fillSingleSlider(controlSlider) {
	            const rangeDistance = controlSlider.max-controlSlider.min
	            controlSlider.style.background = `linear-gradient(
			    to right,
			    ${color1} 0%,
			    ${color1} ${(controlSlider.value)/(rangeDistance)*100}%,
		            ${color2} ${(controlSlider.value)/(rangeDistance)*100}%,
		            ${color2} 100%)`;
}								      

function setToggleAccessible(currentTarget) {
	  //const toSlider = document.getelementById('time_range_to_reconstruct_toSilder');
	  if (Number(currentTarget.value) <= 0 ) {
		      currentTarget.style.zIndex = 2;
		    } else {
			        currentTarget.style.zIndex = 0;
			      }
}

function changeInput(slider, input) {
	 fillSingleSlider(slider)
         input.value = slider.value
}

function changeSlider(input, slider) {
	slider.value = input.value
	fillSingleSlider(slider)
}

const advAll = document.querySelectorAll('.form-group-advanced');

var val1 = 0;

function showAdv() {
	//document.getElementById("advCheck").value = 0;
	//document.getElementById("advancedShow").innerHTML = val1
         if (Boolean(document.getElementById("advCheck").checked)) {
             //document.getElementById("advancedShow").innerHTML = document.getElementById("advCheck").checked
	     //document.getElementById("advancedShow").innerHTML = "TRUE"
	     advAll.forEach(adv1 => {
	        adv1.style.display = 'block';
	        })
	 } else {
	     //document.getElementById("advancedShow").innerHTML = document.getElementById("advCheck").checked
	     //document.getElementById("advancedShow").innerHTML = "FALSE"
	     advAll.forEach(adv1 => {
	        adv1.style.display = 'none';
	     })
	 }
}

var coll = document.getElementsByClassName("collapsible");
var i;

for (i = 0; i < coll.length; i++) {
	          coll[i].addEventListener("click", function() {
			                        this.classList.toggle("active");
			                        var content = this.nextElementSibling;
			                        if (content.style.display === "block") {
							                                    content.style.display = "none";
							                                  } else {
												                                                  content.style.display = "block";
												                                                }
			                      });
}

function uncheckAll(divid, checkCycle) {
	                    var checks = document.querySelectorAll('#' + divid + ' input[type="checkbox"]');
	                    for(var i =0; i< checks.length;i++){
				                    var check = checks[i];
				                    if(!check.disabled){
							                        if (checkCycle % 2 == 0){
											                    check.checked = true;
											                    } else {
														                        check.checked = false;
														                        }
							                    }
				                }
	        }
const time_range_to_reconstruct_fromSilder = document.getElementById("time_range_to_reconstruct_fromSilder");
const time_range_to_reconstruct_toSilder = document.getElementById("time_range_to_reconstruct_toSilder");
const time_range_to_reconstruct_fromInput = document.getElementById("time_range_to_reconstruct_fromInput");
const time_range_to_reconstruct_toInput = document.getElementById("time_range_to_reconstruct_toInput");
fillSlider(time_range_to_reconstruct_fromSilder, time_range_to_reconstruct_toSilder, "#C6C6C6", "#896A67", time_range_to_reconstruct_toSilder);
setToggleAccessible(time_range_to_reconstruct_toSilder);
time_range_to_reconstruct_fromSilder.oninput = () => controlFromSlider(time_range_to_reconstruct_fromSilder, time_range_to_reconstruct_toSilder, time_range_to_reconstruct_fromInput);
time_range_to_reconstruct_toSilder.oninput = () => controlToSlider(time_range_to_reconstruct_fromSilder, time_range_to_reconstruct_toSilder, time_range_to_reconstruct_toInput);
time_range_to_reconstruct_fromInput.onchange = () => controlFromInput(time_range_to_reconstruct_fromSilder, time_range_to_reconstruct_fromInput, time_range_to_reconstruct_toInput, time_range_to_reconstruct_toSilder);
time_range_to_reconstruct_toInput.onchange = () => controlToInput(time_range_to_reconstruct_toSilder, time_range_to_reconstruct_fromInput, time_range_to_reconstruct_toInput, time_range_to_reconstruct_toSilder);
const time_reference_fromSilder = document.getElementById("time_reference_fromSilder");
const time_reference_toSilder = document.getElementById("time_reference_toSilder");
const time_reference_fromInput = document.getElementById("time_reference_fromInput");
const time_reference_toInput = document.getElementById("time_reference_toInput");
fillSlider(time_reference_fromSilder, time_reference_toSilder, "#C6C6C6", "#896A67", time_reference_toSilder);
setToggleAccessible(time_reference_toSilder);
time_reference_fromSilder.oninput = () => controlFromSlider(time_reference_fromSilder, time_reference_toSilder, time_reference_fromInput);
time_reference_toSilder.oninput = () => controlToSlider(time_reference_fromSilder, time_reference_toSilder, time_reference_toInput);
time_reference_fromInput.onchange = () => controlFromInput(time_reference_fromSilder, time_reference_fromInput, time_reference_toInput, time_reference_toSilder);
time_reference_toInput.onchange = () => controlToInput(time_reference_toSilder, time_reference_fromInput, time_reference_toInput, time_reference_toSilder);
const time_model_interval_fromSilder = document.getElementById("time_model_interval_fromSilder");
const time_model_interval_toSilder = document.getElementById("time_model_interval_toSilder");
const time_model_interval_fromInput = document.getElementById("time_model_interval_fromInput");
const time_model_interval_toInput = document.getElementById("time_model_interval_toInput");
fillSlider(time_model_interval_fromSilder, time_model_interval_toSilder, "#C6C6C6", "#896A67", time_model_interval_toSilder);
setToggleAccessible(time_model_interval_toSilder);
time_model_interval_fromSilder.oninput = () => controlFromSlider(time_model_interval_fromSilder, time_model_interval_toSilder, time_model_interval_fromInput);
time_model_interval_toSilder.oninput = () => controlToSlider(time_model_interval_fromSilder, time_model_interval_toSilder, time_model_interval_toInput);
time_model_interval_fromInput.onchange = () => controlFromInput(time_model_interval_fromSilder, time_model_interval_fromInput, time_model_interval_toInput, time_model_interval_toSilder);
time_model_interval_toInput.onchange = () => controlToInput(time_model_interval_toSilder, time_model_interval_fromInput, time_model_interval_toInput, time_model_interval_toSilder);
const geo_proxy_lat_fromSilder = document.getElementById("geo_proxy_lat_fromSilder");
const geo_proxy_lat_toSilder = document.getElementById("geo_proxy_lat_toSilder");
const geo_proxy_lat_fromInput = document.getElementById("geo_proxy_lat_fromInput");
const geo_proxy_lat_toInput = document.getElementById("geo_proxy_lat_toInput");
fillSlider(geo_proxy_lat_fromSilder, geo_proxy_lat_toSilder, "#C6C6C6", "#896A67", geo_proxy_lat_toSilder);
setToggleAccessible(geo_proxy_lat_toSilder);
geo_proxy_lat_fromSilder.oninput = () => controlFromSlider(geo_proxy_lat_fromSilder, geo_proxy_lat_toSilder, geo_proxy_lat_fromInput);
geo_proxy_lat_toSilder.oninput = () => controlToSlider(geo_proxy_lat_fromSilder, geo_proxy_lat_toSilder, geo_proxy_lat_toInput);
geo_proxy_lat_fromInput.onchange = () => controlFromInput(geo_proxy_lat_fromSilder, geo_proxy_lat_fromInput, geo_proxy_lat_toInput, geo_proxy_lat_toSilder);
geo_proxy_lat_toInput.onchange = () => controlToInput(geo_proxy_lat_toSilder, geo_proxy_lat_fromInput, geo_proxy_lat_toInput, geo_proxy_lat_toSilder);
const geo_proxy_lon_fromSilder = document.getElementById("geo_proxy_lon_fromSilder");
const geo_proxy_lon_toSilder = document.getElementById("geo_proxy_lon_toSilder");
const geo_proxy_lon_fromInput = document.getElementById("geo_proxy_lon_fromInput");
const geo_proxy_lon_toInput = document.getElementById("geo_proxy_lon_toInput");
fillSlider(geo_proxy_lon_fromSilder, geo_proxy_lon_toSilder, "#C6C6C6", "#896A67", geo_proxy_lon_toSilder);
setToggleAccessible(geo_proxy_lon_toSilder);
geo_proxy_lon_fromSilder.oninput = () => controlFromSlider(geo_proxy_lon_fromSilder, geo_proxy_lon_toSilder, geo_proxy_lon_fromInput);
geo_proxy_lon_toSilder.oninput = () => controlToSlider(geo_proxy_lon_fromSilder, geo_proxy_lon_toSilder, geo_proxy_lon_toInput);
geo_proxy_lon_fromInput.onchange = () => controlFromInput(geo_proxy_lon_fromSilder, geo_proxy_lon_fromInput, geo_proxy_lon_toInput, geo_proxy_lon_toSilder);
geo_proxy_lon_toInput.onchange = () => controlToInput(geo_proxy_lon_toSilder, geo_proxy_lon_fromInput, geo_proxy_lon_toInput, geo_proxy_lon_toSilder);
const time_resolutionSilder = document.getElementById("time_resolutionSilder");
const time_resolutionInput = document.getElementById("time_resolutionInput");
time_resolutionSilder.oninput = () => changeInput(time_resolutionSilder, time_resolutionInput);
time_resolutionInput.onchange = () => changeSlider(time_resolutionInput, time_resolutionSilder);
fillSingleSlider(time_resolutionSilder)
const time_resolution_maxSilder = document.getElementById("time_resolution_maxSilder");
const time_resolution_maxInput = document.getElementById("time_resolution_maxInput");
time_resolution_maxSilder.oninput = () => changeInput(time_resolution_maxSilder, time_resolution_maxInput);
time_resolution_maxInput.onchange = () => changeSlider(time_resolution_maxInput, time_resolution_maxSilder);
fillSingleSlider(time_resolution_maxSilder)
const prior_time_windowSilder = document.getElementById("prior_time_windowSilder");
const prior_time_windowInput = document.getElementById("prior_time_windowInput");
prior_time_windowSilder.oninput = () => changeInput(prior_time_windowSilder, prior_time_windowInput);
prior_time_windowInput.onchange = () => changeSlider(prior_time_windowInput, prior_time_windowSilder);
fillSingleSlider(prior_time_windowSilder)
const prior_percentageSilder = document.getElementById("prior_percentageSilder");
const prior_percentageInput = document.getElementById("prior_percentageInput");
prior_percentageSilder.oninput = () => changeInput(prior_percentageSilder, prior_percentageInput);
prior_percentageInput.onchange = () => changeSlider(prior_percentageInput, prior_percentageSilder);
fillSingleSlider(prior_percentageSilder)
const prior_seedSilder = document.getElementById("prior_seedSilder");
const prior_seedInput = document.getElementById("prior_seedInput");
prior_seedSilder.oninput = () => changeInput(prior_seedSilder, prior_seedInput);
prior_seedInput.onchange = () => changeSlider(prior_seedInput, prior_seedSilder);
fillSingleSlider(prior_seedSilder)
const proxy_seedSilder = document.getElementById("proxy_seedSilder");
const proxy_seedInput = document.getElementById("proxy_seedInput");
proxy_seedSilder.oninput = () => changeInput(proxy_seedSilder, proxy_seedInput);
proxy_seedInput.onchange = () => changeSlider(proxy_seedInput, proxy_seedSilder);
fillSingleSlider(proxy_seedSilder)
var recon_target_variable_checkCycle = 0;
function recon_target_variable_incrementCheckCycle(){
recon_target_variable_checkCycle = recon_target_variable_checkCycle+1;
return (recon_target_variable_checkCycle);
}
var prior_models_checkCycle = 0;
function prior_models_incrementCheckCycle(){
prior_models_checkCycle = prior_models_checkCycle+1;
return (prior_models_checkCycle);
}
var proxy_seasonality_checkCycle = 0;
function proxy_seasonality_incrementCheckCycle(){
proxy_seasonality_checkCycle = proxy_seasonality_checkCycle+1;
return (proxy_seasonality_checkCycle);
}
var proxy_archives_checkCycle = 0;
function proxy_archives_incrementCheckCycle(){
proxy_archives_checkCycle = proxy_archives_checkCycle+1;
return (proxy_archives_checkCycle);
}
var proxy_datasets_checkCycle = 0;
function proxy_datasets_incrementCheckCycle(){
proxy_datasets_checkCycle = proxy_datasets_checkCycle+1;
return (proxy_datasets_checkCycle);
}
var canvas = document.getElementById('canvas'),
	    ctx = canvas.getContext('2d'),
	    rect = {
		            x: 150,
		            y: 100,
		            w: 123,
		            h: 58
		        },
	    handlesSize = 40,
	    currentHandle = false,
	    drag = false;

function init() {
	    canvas.addEventListener('mousedown', mouseDown, false);
	    canvas.addEventListener('mouseup', mouseUp, false);
	    canvas.addEventListener('mousemove', mouseMove, false);
}

function point(x, y) {
	    return {
		            x: x,
		            y: y
		        };
}

function dist(p1, p2) {
	    return Math.sqrt((p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y));
}

function getHandle(mouse) {
	    if (dist(mouse, point(rect.x, rect.y)) <= handlesSize) return 'topleft';
	    if (dist(mouse, point(rect.x + rect.w, rect.y)) <= handlesSize) return 'topright';
	    if (dist(mouse, point(rect.x, rect.y + rect.h)) <= handlesSize) return 'bottomleft';
	    if (dist(mouse, point(rect.x + rect.w, rect.y + rect.h)) <= handlesSize) return 'bottomright';
	    if (dist(mouse, point(rect.x + rect.w / 2, rect.y)) <= handlesSize) return 'top';
	    if (dist(mouse, point(rect.x, rect.y + rect.h / 2)) <= handlesSize) return 'left';
	    if (dist(mouse, point(rect.x + rect.w / 2, rect.y + rect.h)) <= handlesSize) return 'bottom';
	    if (dist(mouse, point(rect.x + rect.w, rect.y + rect.h / 2)) <= handlesSize) return 'right';
	    return false;
}

function mouseDown(e) {
	    if (currentHandle) drag = true;
	    draw();
}

function mouseUp() {
	    drag = false;
	    currentHandle = false;
	    draw();
}

function mouseMove(e) {
	    var previousHandle = currentHandle;
	    if (!drag) currentHandle = getHandle(point(e.pageX - this.offsetLeft, e.pageY - this.offsetTop));
	    if (currentHandle && drag) {
		            var mousePos = point(e.pageX - this.offsetLeft, e.pageY - this.offsetTop);
		            switch (currentHandle) {
				                case 'topleft':
					                    rect.w += rect.x - mousePos.x;
					                    rect.h += rect.y - mousePos.y;
					                    rect.x = mousePos.x;
					                    rect.y = mousePos.y;
					                    break;
					                case 'topright':
					                    rect.w = mousePos.x - rect.x;
					                    rect.h += rect.y - mousePos.y;
					                    rect.y = mousePos.y;
					                    break;
					                case 'bottomleft':
					                    rect.w += rect.x - mousePos.x;
					                    rect.x = mousePos.x;
					                    rect.h = mousePos.y - rect.y;
					                    break;
					                case 'bottomright':
					                    rect.w = mousePos.x - rect.x;
					                    rect.h = mousePos.y - rect.y;
					                    break;

					                case 'top':
					                    rect.h += rect.y - mousePos.y;
					                    rect.y = mousePos.y;
					                    break;

					                case 'left':
					                    rect.w += rect.x - mousePos.x;
					                    rect.x = mousePos.x;
					                    break;

					                case 'bottom':
					                    rect.h = mousePos.y - rect.y;
					                    break;

					                case 'right':
					                    rect.w = mousePos.x - rect.x;
					                    break;
					            }
		        }
	    if (drag || currentHandle != previousHandle) draw();
}

function draw() {
	
	    //disable inversion of selection box
	    if (rect.w < 0){
		    rect.w = 0
	    }
	    if (rect.h < 0){
		    rect.h = 0
	    }


	    ctx.clearRect(0, 0, canvas.width, canvas.height);
	    ctx.fillStyle = "rgba(5, 5, 5, 0.3)";
	    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
	    if (currentHandle) {
		            var posHandle = point(0, 0);
		            switch (currentHandle) {
				                case 'topleft':
					                    posHandle.x = rect.x;
					                    posHandle.y = rect.y;
					                    break;
					                case 'topright':
					                    posHandle.x = rect.x + rect.w;
					                    posHandle.y = rect.y;
					                    break;
					                case 'bottomleft':
					                    posHandle.x = rect.x;
					                    posHandle.y = rect.y + rect.h;
					                    break;
					                case 'bottomright':
					                    posHandle.x = rect.x + rect.w;
					                    posHandle.y = rect.y + rect.h;
					                    break;
					                case 'top':
					                    posHandle.x = rect.x + rect.w / 2;
					                    posHandle.y = rect.y;
					                    break;
					                case 'left':
					                    posHandle.x = rect.x;
					                    posHandle.y = rect.y + rect.h / 2;
					                    break;
					                case 'bottom':
					                    posHandle.x = rect.x + rect.w / 2;
					                    posHandle.y = rect.y + rect.h;
					                    break;
					                case 'right':
					                    posHandle.x = rect.x + rect.w;
					                    posHandle.y = rect.y + rect.h / 2;
					                    break;
					            }
		    var latMin = Math.round(180-(rect.y+rect.h)/3-90)
		    var latMax = Math.round(90-rect.y/3)
		    var lonMin = Math.round(rect.x/3-180)
		    var lonMax = Math.round((rect.x+rect.w)/3-180)

		    document.getElementById("lat_max").value = latMax
		    document.getElementById("lat_min").value = latMin
		    document.getElementById("lon_max").value = lonMax
		    document.getElementById("lon_min").value = lonMin

		            ctx.globalCompositeOperation = 'xor';
		            ctx.beginPath();
		            ctx.arc(posHandle.x, posHandle.y, handlesSize, 0, 2 * Math.PI);
		            ctx.fill();
		            ctx.globalCompositeOperation = 'source-over';
		        }
}

function updateRect() {
	var xmin = Math.round(Math.round(document.getElementById("lon_min").value) + 180)*3
	var width = ((Math.round(document.getElementById("lon_max").value) + 180) * 3) - xmin
	var ymax = Math.round(((90*3) - Math.round(document.getElementById("lat_max").value)*3))
	var height = Math.round(270 - (ymax + Math.round(document.getElementById("lat_min").value)*3))
	//document.getElementById("coords").innerText =  "xmin: " + xmin + " width: " + width + " ymin: " + ymax + " height: " + height
	rect.x = xmin
	rect.y = ymax
	rect.h = height
	rect.w = width
	//handlesSize = Math.round(Math.sqrt(heigh*width)/20)
	draw()
}

init();
updateRect();
