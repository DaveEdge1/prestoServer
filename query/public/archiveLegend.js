var colorPal = {"Borehole":"#FFD600","MolluskShell":"#7b03fc","GlacierIce":"#86CDFA","GroundIce":"#ff6db6","Coral":"#FF8B00",
 "FluvialSediment":"#4169E0","LakeSediment":"#8f8fa1","MarineSediment":"#8A4513","Speleothem":"#FF1492","Midden":"#824E2B",
 "Peat":"#8A9A5B","Sclerosponge":"#D2042D","Shoreline":"#40826D","Wood":"#32CC32","TerrestrialSediment":"#d2b48c", "Documents": "#000000"}
var shapePal = {"Borehole":"square","MolluskShell":"triangle","GlacierIce":"snowflake","GroundIce":"snowflake","Coral":"triangle-down",
 "FluvialSediment":"circle","LakeSediment":"circle","MarineSediment":"circle","Speleothem":"square","Midden":"diamond",
 "Peat":"triangle-down","Sclerosponge":"triangle-down","Shoreline":"diamond","Wood":"triangle","TerrestrialSediment":"circle", "Documents": "star-5"}

var glacierIce = L.icon({
    iconUrl: 'http://143.198.98.66:86/glacierIce.png',

    iconSize:     [10, 10], // size of the icon
    iconAnchor:   [2, 2], // point of the icon which will correspond to marker's location
    popupAnchor:  [2, 2] // point from which the popup should open relative to the iconAnchor
});
var groundIce = L.icon({
    iconUrl: 'http://143.198.98.66:86//groundIce.png',

    iconSize:     [10, 10], // size of the icon
    iconAnchor:   [2, 2], // point of the icon which will correspond to marker's location
    popupAnchor:  [2, 2] // point from which the popup should open relative to the iconAnchor
});
var glacierIceOpac = L.icon({
    iconUrl: 'http://143.198.98.66:86/glacierIceOpac.png',

    iconSize:     [10, 10], // size of the icon
    iconAnchor:   [2, 2], // point of the icon which will correspond to marker's location
    popupAnchor:  [2, 2] // point from which the popup should open relative to the iconAnchor
});
var groundIceOpac = L.icon({
    iconUrl: 'http://143.198.98.66:86//groundIceOpac.png',

    iconSize:     [10, 10], // size of the icon
    iconAnchor:   [2, 2], // point of the icon which will correspond to marker's location
    popupAnchor:  [2, 2] // point from which the popup should open relative to the iconAnchor
});

const legend = L.control.Legend({
            position: "topright",
	    title: "Archive Type",
            collapsed: false,
            symbolWidth: 12,
	    symbolHeight: 12,
            opacity: 1,
            column: 1,
            legends: [{
                label: "Borehole",
                type: "polygon",
                sides: "4",
		color: "#FFD600",
		fillColor: "#FFD600",
    		weight: 2
            }, {
    label: "Coral",
    type: "polygonR",
    sides: 3,
    color: "#FF8B00",
    fillColor: "#FF8B00",
    weight: 2
}, {
    label: "FluvialSediment",
    type: "circle",
    radius: 6,
    color: "#4169E0",
    fillColor: "#4169E0",
    weight: 2
}, {
    label: "GlacierIce",
    type: "image",
    url: "/glacierIce.png"
}, {
    label: "GroundIce",
    type: "image",
    url: "/groundIce.png"
}, {
    label: "LakeSediment",
    type: "circle",
    radius: 6,
    color: "#8f8fa1",
    fillColor: "#8f8fa1",
    weight: 2
}, {
    label: "MarineSediment",
    type: "circle",
    radius: 6,
    color: "#8A4513",
    fillColor: "#8A4513",
    weight: 2
}, {
    label: "Midden",
    type: "polygonR",
    sides: 4,
    color: "#824E2B",
    fillColor: "#824E2B",
    weight: 2
}, {
    label: "MolluskShell",
    type: "polygon",
    sides: 3,
    color: "#7b03fc",
    fillColor: "#7b03fc",
    weight: 2
}, {
    label: "Peat",
    type: "polygonR",
    sides: 3,
    color: "#8A9A5B",
    fillColor: "#8A9A5B",
    weight: 2
}, {
    label: "Sclerosponge",
    type: "polygonR",
    sides: 3,
    color: "#D2042D",
    fillColor: "#D2042D",
    weight: 2
}, {
    label: "Shoreline",
    type: "polygonR",
    sides: 4,
    color: "#40826D",
    fillColor: "#40826D",
    weight: 2
}, {
    label: "Speleothem",
    type: "polygon",
    sides: 4,
    color: "#FF1492",
    fillColor: "#FF1492",
    weight: 2
}, {
    label: "TerrestrialSediment",
    type: "circle",
    radius: 6,
    color: "#d2b48c",
    fillColor: "#d2b48c",
    weight: 2
}, {
    label: "Wood",
    type: "polygon",
    sides: 3,
    color: "#32CC32",
    fillColor: "#32CC32",
    weight: 2
}, {
    label: "Documents",
    type: "star",
    sides: "5",
    color: "black",
    fillColor: "black",
    weight: 2
}, {
    label: "*Other*",
    type: "polygonR",
    sides: "4",
    color: "black",
    fillColor: "black",
    weight: 2
}]
        })
