var colorPal = {"Borehole":"#FFD600","MolluskShell":"#7b03fc","GlacierIce":"#86CDFA","GroundIce":"#ff6db6","Coral":"#FF8B00",
 "FluvialSediment":"#4169E0","LakeSediment":"#8f8fa1","MarineSediment":"#8A4513","Speleothem":"#FF1492","Midden":"#824E2B",
 "Peat":"#8A9A5B","Sclerosponge":"#D2042D","Shoreline":"#40826D","Wood":"#32CC32","TerrestrialSediment":"#d2b48c", "Documents": "#000000"}
var shapePal = {"Borehole":"square","MolluskShell":"triangle","GlacierIce":"snowflake","GroundIce":"snowflake","Coral":"triangle-down",
 "FluvialSediment":"circle","LakeSediment":"circle","MarineSediment":"circle","Speleothem":"square","Midden":"diamond",
 "Peat":"triangle-down","Sclerosponge":"triangle-down","Shoreline":"diamond","Wood":"triangle","TerrestrialSediment":"circle", "Documents": "star-5"}

var glacierIce = L.icon({
    iconUrl: '/query/glacierIce.png',

    iconSize:     [10, 10], // size of the icon
    iconAnchor:   [2, 2], // point of the icon which will correspond to marker's location
    popupAnchor:  [2, 2] // point from which the popup should open relative to the iconAnchor
});
var groundIce = L.icon({
    iconUrl: '/query/groundIce.png',

    iconSize:     [10, 10], // size of the icon
    iconAnchor:   [2, 2], // point of the icon which will correspond to marker's location
    popupAnchor:  [2, 2] // point from which the popup should open relative to the iconAnchor
});
var glacierIceOpac = L.icon({
    iconUrl: '/query/glacierIceOpac.png',

    iconSize:     [10, 10], // size of the icon
    iconAnchor:   [2, 2], // point of the icon which will correspond to marker's location
    popupAnchor:  [2, 2] // point from which the popup should open relative to the iconAnchor
});
var groundIceOpac = L.icon({
    iconUrl: '/query/groundIceOpac.png',

    iconSize:     [10, 10], // size of the icon
    iconAnchor:   [2, 2], // point of the icon which will correspond to marker's location
    popupAnchor:  [2, 2] // point from which the popup should open relative to the iconAnchor
});


