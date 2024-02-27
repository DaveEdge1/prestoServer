//Credit to Predrag Davidovic for the dual slider: "https://medium.com/@predragdavidovic10/native-dual-range-slider-html-css-javascript-91e778134816"
const seasonality2 = [{"value":1,"label":"Jan"},{"value":2,"label":"Feb"},{"value":3,"label":"Mar"},{"value":4,"label":"Apr"},{"value":5,"label":"May"},{"value":6,"label":"Jun"},{"value":7,"label":"Jul"},{"value":8,"label":"Aug"},{"value":9,"label":"Sep"},{"value":10,"label":"Oct"},{"value":11,"label":"Nov"},{"value":12,"label":"Dec"},{"value":13,"label":"Jan"},{"value":14,"label":"Feb"},{"value":15,"label":"Mar"},{"value":16,"label":"Apr"},{"value":17,"label":"May"},{"value":18,"label":"Jun"},{"value":19,"label":"Jul"},{"value":20,"label":"Aug"},{"value":21,"label":"Sep"},{"value":22,"label":"Oct"},{"value":23,"label":"Nov"},{"value":24,"label":"Dec"}] 

const allNumeric = seasonality2.map(function(d) { return d.value; });
const monthText = seasonality2.map(function(d) { return d.label; });

const color1 = '#896A67'
const color2 = '#C6C6C6'
var mapMax = 0;
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

function seasonalityFromSlider(fromSlider, toSlider, fromInput) {
	  const [from, to] = getParsed(fromSlider, toSlider);
	  if (from < (to-11)) {
		fromSlider.value = to-11;
		fromInput.value = monthText[allNumeric[to-12]-1];
	  	fillSlider((to-11), toSlider, '#C6C6C6', color1, toSlider);
		setToggleAccessible((to-11));
	  } else {
		fillSlider(fromSlider, toSlider, '#C6C6C6', color1, toSlider);
		if (from > to) {
			fromSlider.value = to;
			fromInput.value = monthText[allNumeric[to-1]-1];
		} else {
			fromInput.value = monthText[allNumeric[from-1]-1];
		}
	  }
}

function seasonalityToSlider(fromSlider, toSlider, toInput) {
	  const [from, to] = getParsed(fromSlider, toSlider);
	  if ((from+11) < to) {
	  	fillSlider(fromSlider, (from+11), '#C6C6C6', color1, toSlider);
	  	//setToggleAccessible((from+11));
		toSlider.value = (from+11);
		toInput.value = monthText[allNumeric[from+11]-1];
	  } else {
		fillSlider(fromSlider, to, '#C6C6C6', color1, toSlider);
	  	setToggleAccessible(to);
	  	if (from <= to) {
			toSlider.value = to;
			toInput.value = monthText[allNumeric[to-1]-1];
		 } else {
			toInput.value = monthText[allNumeric[from-1]-1];
			toSlider.value = from;
		 }
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
	  //const toSlider = document.getelementById('time_range_to_reconstruct_toSlider');
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


var val1 = 0;


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
	        if (i==0) {
			                coll[i].click()
			        }
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

const months_range_fromSlider = document.getElementById("months_range_fromSlider");
const months_range_toSlider = document.getElementById("months_range_toSlider");
const months_range_fromInput = document.getElementById("months_range_fromInput_text");
const months_range_toInput = document.getElementById("months_range_toInput_text");
fillSlider(months_range_fromSlider, months_range_toSlider, "#C6C6C6", "#896A67", months_range_toSlider);
setToggleAccessible(months_range_toSlider);
months_range_fromSlider.oninput = () => seasonalityFromSlider(months_range_fromSlider, months_range_toSlider, months_range_fromInput);
months_range_toSlider.oninput = () => seasonalityToSlider(months_range_fromSlider, months_range_toSlider, months_range_toInput);

const time_range_to_reconstruct_fromSlider = document.getElementById("time_range_to_reconstruct_fromSlider");
const time_range_to_reconstruct_toSlider = document.getElementById("time_range_to_reconstruct_toSlider");
const time_range_to_reconstruct_fromInput = document.getElementById("time_range_to_reconstruct_fromInput");
const time_range_to_reconstruct_toInput = document.getElementById("time_range_to_reconstruct_toInput");
fillSlider(time_range_to_reconstruct_fromSlider, time_range_to_reconstruct_toSlider, "#C6C6C6", "#896A67", time_range_to_reconstruct_toSlider);
setToggleAccessible(time_range_to_reconstruct_toSlider);
time_range_to_reconstruct_fromSlider.oninput = () => controlFromSlider(time_range_to_reconstruct_fromSlider, time_range_to_reconstruct_toSlider, time_range_to_reconstruct_fromInput);
time_range_to_reconstruct_toSlider.oninput = () => controlToSlider(time_range_to_reconstruct_fromSlider, time_range_to_reconstruct_toSlider, time_range_to_reconstruct_toInput);
time_range_to_reconstruct_fromInput.onchange = () => controlFromInput(time_range_to_reconstruct_fromSlider, time_range_to_reconstruct_fromInput, time_range_to_reconstruct_toInput, time_range_to_reconstruct_toSlider);
time_range_to_reconstruct_toInput.onchange = () => controlToInput(time_range_to_reconstruct_toSlider, time_range_to_reconstruct_fromInput, time_range_to_reconstruct_toInput, time_range_to_reconstruct_toSlider);
const resolutionmaxSlider = document.getElementById("resolutionSlider");
const resolutionmaxInput = document.getElementById("resolutionInput");
resolutionmaxSlider.oninput = () => changeInput(resolutionmaxSlider, resolutionmaxInput);
resolutionmaxInput.onchange = () => changeSlider(resolutionmaxInput, resolutionmaxSlider);
fillSingleSlider(resolutionmaxSlider)
