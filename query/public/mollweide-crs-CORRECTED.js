// CORRECTED Mollweide Projection CRS Definition for Leaflet with proj4leaflet
// Based on ACTUAL gdal2tiles output from tilemapresource.xml
// ESRI:54009 - World Mollweide projection

// Proj4 definition string for Mollweide
const mollweideProj4 = '+proj=moll +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +type=crs';

// CRITICAL: gdal2tiles with -p raster creates TMS tiles (origin at bottom-left)
// These are the ACTUAL values from tilemapresource.xml

// Create the Mollweide CRS for Leaflet
const mollweideCRS = new L.Proj.CRS('ESRI:54009', mollweideProj4, {
  // TMS origin is at BOTTOM-LEFT corner (not top-left!)
  origin: [-18040090.191, -9020395.842],  // Bottom-left corner in Mollweide meters

  // ACTUAL resolutions from gdal2tiles output (units-per-pixel from tilemapresource.xml)
  resolutions: [
    191236.173,    // Zoom level 0
    95618.087,     // Zoom level 1
    47809.043,     // Zoom level 2
    23904.522,     // Zoom level 3
    11952.261,     // Zoom level 4
    5976.130       // Zoom level 5
  ],

  // ACTUAL bounds from gdal2tiles
  bounds: L.bounds(
    [[-18040090.191, -9020395.842],  // Bottom-left (xmin, ymin)
     [18040050.172, 9020047.848]]    // Top-right (xmax, ymax)
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
//   maxZoom: 5
// });
//
// L.tileLayer('http://localhost:8080/tiles_mollweide/{z}/{x}/{y}.png', {
//   tms: true,              // CRITICAL: Enables TMS tile addressing (y from bottom)
//   tileSize: 256,
//   noWrap: true,
//   attribution: 'ETOPO 2022 - NOAA NCEI'
// }).addTo(map);

// EXPLANATION OF CORRECTIONS:
//
// 1. ORIGIN: Changed from top-left to BOTTOM-LEFT
//    - Old (wrong): [-18040095.70, 9020047.85]  (top-left)
//    - New (correct): [-18040090.191, -9020395.842]  (bottom-left)
//    - gdal2tiles -p raster uses TMS standard (origin at bottom-left)
//
// 2. RESOLUTIONS: Updated to ACTUAL values from gdal2tiles
//    - Old (wrong): Manually calculated [140937.5, 70468.75, ...]
//    - New (correct): From tilemapresource.xml [191236.173, 95618.087, ...]
//    - gdal2tiles calculates based on fitting image into tile grid
//
// 3. BOUNDS: Updated to ACTUAL computed bounds
//    - Slightly different due to actual data extent vs theoretical
//
// 4. TMS FLAG: Must add tms: true to L.tileLayer options
//    - TMS: Y increases upward (tile 0,0 at bottom-left)
//    - XYZ: Y increases downward (tile 0,0 at top-left)
//    - gdal2tiles -p raster produces TMS tiles by default
