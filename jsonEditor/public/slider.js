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
	if (mapMax == 180) {
		var lonMin = Math.round(rect.x/3-180)
		var lonMax = Math.round((rect.x+rect.w)/3-180)
	} else if (mapMax == 360) {
		var lonMin = Math.round(rect.x/3)
		var lonMax = Math.round((rect.x+rect.w)/3)
	}

	document.getElementById("lat_max").value = latMax
	document.getElementById("lat_min").value = latMin
	document.getElementById("lon_max").value = lonMax
	document.getElementById("lon_min").value = lonMin

	document.getElementById("mapStuff").innerText = 'mapMax = ' + mapMax + ' xmin = ' + rect.x + ', width = ' + rect.w + ', ymax = ' + rect.y + ', height = ' + rect.h + '\n' 
		+ 'latMax = ' + latMax + ', latMin = ' + latMin + ', lonMax = ' + lonMax + ', lonMin = ' + lonMin
	ctx.globalCompositeOperation = 'xor';
	ctx.beginPath();
	ctx.arc(posHandle.x, posHandle.y, handlesSize, 0, 2 * Math.PI);
	ctx.fill();
	ctx.globalCompositeOperation = 'source-over';
    }
}

function updateRect(maxOfMap) {
	mapMax = maxOfMap;
	if (mapMax == 180) {
		var xmin = Math.round(Math.round(document.getElementById("lon_min").value) + 180)*3
		var width = ((Math.round(document.getElementById("lon_max").value) + 180) * 3) - xmin
	} else if (mapMax == 360) {
		var xmin = Math.round(Math.round(document.getElementById("lon_min").value))*3
		var width = ((Math.round(document.getElementById("lon_max").value)) * 3) - xmin
	}
	var ymax = Math.round(((90*3) - Math.round(document.getElementById("lat_max").value)*3))
	var height = Math.round(270 - (ymax + Math.round(document.getElementById("lat_min").value)*3))
	rect.x = xmin
	rect.y = ymax
	rect.h = height
	rect.w = width
	//document.getElementById("mapStuff").innerText = 'xmin = ' + xmin + ', width = ' + width + ', ymax = ' + ymax + ', height = ' + height + '\n' + 'lon_min = ' + document.getElementById("lon_min").value + ' lat_min = ' + document.getElementById("lat_min").value

	draw()
}

init();

