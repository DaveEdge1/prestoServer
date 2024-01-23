//Credit to Predrag Davidovic for the dual slider: "https://medium.com/@predragdavidovic10/native-dual-range-slider-html-css-javascript-91e778134816"
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

function getParsed(currentFrom, currentTo) {
	  const from = parseInt(currentFrom.value, 10);
	  const to = parseInt(currentTo.value, 10);
	  return [from, to];
}

function fillSlider(from, to, sliderColor, rangeColor, controlSlider) {
	console.log("to: " + to)
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
