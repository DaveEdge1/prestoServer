// Mollweide Projection CRS Definition for Blue Marble tiles
// Based on tilemapresource.xml from http://localhost:8080/tiles_bluemarble/
// ESRI:54009 - World Mollweide projection

// Proj4 definition string for Mollweide
const mollweideProj4 = '+proj=moll +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +type=crs';

// Values from tilemapresource.xml
// gdal2tiles with -p raster creates TMS tiles (origin at bottom-left)

// Create the Mollweide CRS for Leaflet
const mollweideCRS = new L.Proj.CRS('ESRI:54009', mollweideProj4, {
  // TMS origin is at BOTTOM-LEFT corner
  origin: [-18040090.19075199589133, -9020043.47272318601608],

  // Actual resolutions from tilemapresource.xml (units-per-pixel)
  resolutions: [
    213808.48972587782191,  // Zoom level 0
    106904.24486293891096,  // Zoom level 1
    53452.12243146945548,   // Zoom level 2
    26726.06121573472774,   // Zoom level 3
    13363.03060786736387,   // Zoom level 4
    6681.51530393368193,    // Zoom level 5
    3340.75765196684097,    // Zoom level 6
    1670.37882598342048     // Zoom level 7
  ],

  // Actual bounds from tilemapresource.xml
  bounds: L.bounds(
    [[-18040090.19075199589133, -9020043.47272318601608],  // Bottom-left (xmin, ymin)
     [18040092.45048988983035, 9020047.84789775684476]]    // Top-right (xmax, ymax)
  )
});

// Example usage with TMS tile layer:
// IMPORTANT: Add tms: true option for correct tile addressing!
//
// const map = L.map('map', {
//   crs: mollweideCRS,
//   center: [0, 0],
//   zoom: 1,
//   minZoom: 0,
//   maxZoom: 7
// });
//
// L.tileLayer('http://localhost:8080/tiles_bluemarble/{z}/{x}/{y}.png', {
//   tms: true,              // CRITICAL: Enables TMS tile addressing (y from bottom)
//   tileSize: 256,
//   noWrap: true,
//   attribution: 'Blue Marble'
// }).addTo(map);
