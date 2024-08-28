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
