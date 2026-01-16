var colorPal = {"Borehole":"#FFD600","MolluskShell":"#7b03fc","GlacierIce":"#86CDFA","GroundIce":"#ff6db6","Coral":"#FF8B00",
 "FluvialSediment":"#4169E0","LakeSediment":"#8f8fa1","MarineSediment":"#8A4513","Speleothem":"#FF1492","Midden":"#824E2B",
 "Peat":"#8A9A5B","Sclerosponge":"#D2042D","Shoreline":"#40826D","Wood":"#32CC32","TerrestrialSediment":"#d2b48c", "Documents": "#000000"}
var shapePal = {"Borehole":"square","MolluskShell":"triangle","GlacierIce":"snowflake","GroundIce":"snowflake","Coral":"triangle-down",
 "FluvialSediment":"circle","LakeSediment":"circle","MarineSediment":"circle","Speleothem":"square","Midden":"diamond",
 "Peat":"triangle-down","Sclerosponge":"triangle-down","Shoreline":"diamond","Wood":"triangle","TerrestrialSediment":"circle", "Documents": "star-5"}

// Interpretation variable color and shape palettes (top 15 + Other)
var interpVarColorPal = {
   "temperature": "#FFD600",
   "precipitation": "#FF8B00",
   "effectivePrecipitation": "#4169E0",
   "temperature|precipitationIsotope": "#FF0000",
   "growingDegreeDays": "#8A4513",
   "temperature|temperature|seawaterIsotope": "#824E2B",
   "precipitation|precipitationIsotope": "#7b03fc",
   "precipitationIsotope": "#8A9A5B",
   "seaIce": "#D2042D",
   "salinity|seawaterIsotope": "#40826D",
   "streamflow": "#FF1492",
   "upwelling": "#d2b48c",
   "effectivePrecipitation|effectivePrecipitation": "#32CC32",
   "temperature|seawaterIsotope": "#1E90FF",
   "salinity": "#9370DB",
   "*Other*": "#808080"
};

var interpVarShapePal = {
   "temperature": "square",
   "precipitation": "triangle-down",
   "effectivePrecipitation": "circle",
   "temperature|precipitationIsotope": "circle",
   "growingDegreeDays": "circle",
   "temperature|temperature|seawaterIsotope": "diamond",
   "precipitation|precipitationIsotope": "triangle",
   "precipitationIsotope": "triangle-down",
   "seaIce": "triangle-down",
   "salinity|seawaterIsotope": "diamond",
   "streamflow": "square",
   "upwelling": "circle",
   "effectivePrecipitation|effectivePrecipitation": "triangle",
   "temperature|seawaterIsotope": "star-5",
   "salinity": "diamond",
   "*Other*": "diamond"
};

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


