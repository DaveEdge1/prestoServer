# Critical Corrections to Projection Parameters

## What Was Wrong

The original `mollweide-crs.js` had **incorrect parameters** that were manually calculated rather than using the actual values from gdal2tiles output.

## Key Issues Found

### 1. **Wrong Origin Point**

**Incorrect (what I provided):**
```javascript
origin: [-18040095.70, 9020047.85]  // Top-left corner
```

**Correct (from tilemapresource.xml):**
```javascript
origin: [-18040090.191, -9020395.842]  // Bottom-left corner
```

**Why this matters:**
- `gdal2tiles -p raster` uses **TMS (Tile Map Service) standard**
- TMS origin is at **BOTTOM-LEFT**, not top-left
- Y-axis increases **upward** in TMS (opposite of XYZ/Google tiles)

---

### 2. **Wrong Resolutions**

**Incorrect (what I provided):**
```javascript
resolutions: [
  140937.5,      // Zoom 0
  70468.75,      // Zoom 1
  35234.375,     // Zoom 2
  17617.1875,    // Zoom 3
  8808.59375,    // Zoom 4
  4404.296875    // Zoom 5
]
```

**Correct (from tilemapresource.xml):**
```javascript
resolutions: [
  191236.173,    // Zoom 0
  95618.087,     // Zoom 1
  47809.043,     // Zoom 2
  23904.522,     // Zoom 3
  11952.261,     // Zoom 4
  5976.130       // Zoom 5
]
```

**Why these are different:**
- My calculation assumed the image would exactly fit a 256×128 tile at zoom 0
- gdal2tiles actually calculates resolutions based on:
  - Image dimensions (48,299 × 24,150 pixels)
  - Source pixel size (747m × 747m)
  - How it decides to tile the raster
- The actual zoom 0 has the entire world in **1 tile** (256×256), not a 256×128 tile

---

### 3. **Wrong Bounds (minor)**

**Incorrect:**
```javascript
bounds: L.bounds(
  [[-18040095.70, -9020047.85],
   [18040095.70, 9020047.85]]
)
```

**Correct:**
```javascript
bounds: L.bounds(
  [[-18040090.191, -9020395.842],
   [18040050.172, 9020047.848]]
)
```

**Why different:**
- Bounds from tilemapresource.xml are the actual computed extents
- Slightly different due to:
  - Actual data coverage vs. theoretical projection bounds
  - Rounding during reprojection
  - Edge handling in gdalwarp

---

### 4. **Missing TMS Flag**

**Critical addition needed in Leaflet:**
```javascript
L.tileLayer('http://localhost:8080/tiles_mollweide/{z}/{x}/{y}.png', {
  tms: true,  // MUST ADD THIS!
  tileSize: 256,
  noWrap: true,
  attribution: 'ETOPO 2022 - NOAA NCEI'
}).addTo(map);
```

**Without `tms: true`:**
- Leaflet assumes XYZ tile addressing (origin top-left, Y down)
- Tiles will appear upside-down or in wrong locations
- Map won't pan/zoom correctly

**With `tms: true`:**
- Leaflet uses TMS tile addressing (origin bottom-left, Y up)
- Matches how gdal2tiles generated the tiles
- Map displays correctly

---

## TMS vs XYZ Tile Addressing

### XYZ (Google/OSM Standard):
```
(0,0) at top-left
├─ X increases: left → right (eastward)
└─ Y increases: top → bottom (downward)

Example at zoom 1:
(0,0) | (1,0)
------+------
(0,1) | (1,1)
```

### TMS (Tile Map Service Standard):
```
(0,1) | (1,1)     ← Top row
------+------
(0,0) | (1,0)     ← Bottom row (origin)

├─ X increases: left → right (eastward)
└─ Y increases: bottom → top (upward)
```

**gdal2tiles -p raster** produces **TMS tiles** by default.

---

## How to Verify

### Check tilemapresource.xml
The file `tiles_mollweide/tilemapresource.xml` contains the authoritative values:

```xml
<Origin x="-18040090.19074699655175" y="-9020395.84162166714668"/>
<BoundingBox minx="-18040090.19..." miny="-9020395.84..."
             maxx="18040050.17..." maxy="9020047.84..."/>
<TileSets profile="raster">
  <TileSet href="0" units-per-pixel="191236.17327192431549" order="0"/>
  <TileSet href="1" units-per-pixel="95618.08663596215774" order="1"/>
  ...
</TileSets>
```

**Always use these values**, not manually calculated ones!

---

## Updated Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Mollweide ETOPO Tiles</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/proj4@2.9.0/dist/proj4.js"></script>
  <script src="https://unpkg.com/proj4leaflet@1.0.2/src/proj4leaflet.js"></script>
  <style>
    #map { height: 600px; }
  </style>
</head>
<body>
  <div id="map"></div>

  <script>
    // Mollweide proj4 definition
    const mollweideProj4 = '+proj=moll +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +type=crs';

    // CORRECTED CRS with actual values from tilemapresource.xml
    const mollweideCRS = new L.Proj.CRS('ESRI:54009', mollweideProj4, {
      origin: [-18040090.191, -9020395.842],
      resolutions: [
        191236.173, 95618.087, 47809.043,
        23904.522, 11952.261, 5976.130
      ],
      bounds: L.bounds(
        [[-18040090.191, -9020395.842],
         [18040050.172, 9020047.848]]
      )
    });

    // Create map
    const map = L.map('map', {
      crs: mollweideCRS,
      center: [0, 0],
      zoom: 1,
      minZoom: 0,
      maxZoom: 5
    });

    // Add tile layer with TMS flag
    L.tileLayer('http://localhost:8080/tiles_mollweide/{z}/{x}/{y}.png', {
      tms: true,  // CRITICAL for correct display
      tileSize: 256,
      noWrap: true,
      attribution: 'ETOPO 2022 - NOAA NCEI'
    }).addTo(map);
  </script>
</body>
</html>
```

---

## Resolution Calculation (How gdal2tiles Does It)

For `-p raster` profile at zoom 0:

1. **Source image**: 48,299 × 24,150 pixels
2. **Source pixel size**: ~747 meters/pixel
3. **Zoom 0 goal**: Fit entire image into tiles

At zoom 0, the entire raster spans:
- Width: 48,299 pixels
- Height: 24,150 pixels

If we want to fit this in **N tiles** at zoom 0, we calculate tiles needed:
- For 256×256 tiles at zoom 0:
  - Tiles wide: ceil(48299 / 256) = 189 tiles
  - Tiles tall: ceil(24150 / 256) = 95 tiles

**But wait!** Looking at our tiles, zoom 0 has only **1 tile** (0/0/0.png).

This means gdal2tiles heavily downsampled:
- Zoom 0: 48,299 pixels → 256 pixels (189× reduction)
- Resolution: 747 m/px × 189 ≈ 141,183 m/px

**Actual from tilemapresource.xml**: 191,236 m/px

The difference suggests gdal2tiles uses a slightly different calculation or rounding.

**Key takeaway**: Always use the values from `tilemapresource.xml`, don't calculate manually!

---

## Common Display Issues & Solutions

### Issue 1: Tiles appear upside-down
**Cause**: Missing `tms: true` flag
**Solution**: Add `tms: true` to L.tileLayer options

### Issue 2: Tiles in wrong location
**Cause**: Wrong origin or resolutions
**Solution**: Use exact values from tilemapresource.xml

### Issue 3: Map doesn't zoom/pan correctly
**Cause**: Incorrect CRS bounds or resolutions
**Solution**: Copy values exactly from tilemapresource.xml

### Issue 4: Tiles don't load at all
**Cause**: Tile server not running or wrong URL
**Solution**: Verify `docker-compose up -d` is running and test URL directly

---

## Files Updated

1. **mollweide-crs-CORRECTED.js** - Use this instead of mollweide-crs.js
2. **CORRECTIONS.md** - This file explaining what was wrong

## Action Items

1. ✅ Use `mollweide-crs-CORRECTED.js` with the actual values
2. ✅ Add `tms: true` to your L.tileLayer options
3. ✅ Reference tilemapresource.xml as the authoritative source
4. ✅ Test with the complete example HTML above

---

*These corrections are based on the actual gdal2tiles output in tilemapresource.xml*
