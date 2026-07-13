# Map Tiles Workflow Guide

This guide explains how to add new map tile layers to the Presto query interface and align them correctly with dataset markers.

## Table of Contents
- [Overview](#overview)
- [Generating Tiles with gdal2tiles.py](#generating-tiles-with-gdal2tilespy)
- [Understanding tilemapresource.xml](#understanding-tilemapresourcexml)
- [Configuring Leaflet Projections](#configuring-leaflet-projections)
- [Testing and Verification](#testing-and-verification)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Presto query interface uses Leaflet with custom projections to display dataset markers on various map backgrounds. Each projection requires:

1. **Tile images** - Pre-rendered map tiles at multiple zoom levels
2. **Tile metadata** - XML file describing the projection and tile parameters
3. **Leaflet CRS configuration** - JavaScript code to transform lat/lon coordinates to projected coordinates
4. **Projection bounds** - Geographic limits for the map view

---

## Generating Tiles with gdal2tiles.py

### Step 1: Prepare Your Source Image

Ensure you have a georeferenced raster image (GeoTIFF, PNG with world file, etc.) in the desired projection.

### Step 2: Generate Tiles

Use `gdal2tiles.py` from GDAL to generate the tile pyramid:

```bash
gdal2tiles.py --profile=raster \
              --tilesize=256 \
              --zoom=0-7 \
              --resampling=lanczos \
              --processes=4 \
              input_image.tif \
              output_tiles_folder/
```

**Key parameters:**
- `--profile=raster` - Use for projected images (not geographic)
- `--tilesize=256` - Standard tile size (256x256 pixels)
- `--zoom=0-7` - Zoom levels to generate (0 = zoomed out, 7 = zoomed in)
- `--resampling=lanczos` - High-quality resampling algorithm
- `--processes=4` - Use multiple CPU cores for faster processing

**Example for Antarctic projection:**
```bash
gdal2tiles.py --profile=raster \
              --tilesize=256 \
              --zoom=0-7 \
              --resampling=lanczos \
              world.topo.200408_3031_alpha.tif \
              tiles_bluemarble_3031/
```

### Step 3: Verify Tile Output

After generation, you should have:
```
tiles_bluemarble_3031/
├── tilemapresource.xml    # Tile metadata (CRITICAL!)
├── 0/                      # Zoom level 0
│   └── 0/
│       └── 0.png
├── 1/                      # Zoom level 1
├── ...
└── 7/                      # Zoom level 7
```

---

## Understanding tilemapresource.xml

The `tilemapresource.xml` file contains critical metadata for configuring Leaflet.

### Example XML (Antarctic Polar Stereographic - EPSG:3031)

```xml
<?xml version="1.0" encoding="utf-8"?>
<TileMap version="1.0.0" tilemapservice="http://tms.osgeo.org/1.0.0">
  <Title>world.topo.200408_3031_alpha.tif</Title>
  <SRS>PROJCS["WGS 84 / Antarctic Polar Stereographic",...AUTHORITY["EPSG","3031"]]</SRS>
  <BoundingBox minx="-7164272.94227734580636"
               miny="-7164101.30468036048114"
               maxx="7164101.30468036048114"
               maxy="7164272.94227734580636"/>
  <Origin x="-7164272.94227734580636"
          y="-7164101.30468036048114"/>
  <TileFormat width="256" height="256" mime-type="image/png" extension="png"/>
  <TileSets profile="raster">
    <TileSet href="0" units-per-pixel="59223.45335864719527" order="0"/>
    <TileSet href="1" units-per-pixel="29611.72667932359764" order="1"/>
    <TileSet href="2" units-per-pixel="14805.86333966179882" order="2"/>
    <TileSet href="3" units-per-pixel="7402.93166983089941" order="3"/>
    <TileSet href="4" units-per-pixel="3701.46583491544970" order="4"/>
    <TileSet href="5" units-per-pixel="1850.73291745772485" order="5"/>
    <TileSet href="6" units-per-pixel="925.36645872886243" order="6"/>
    <TileSet href="7" units-per-pixel="462.68322936443121" order="7"/>
  </TileSets>
</TileMap>
```

### Key Fields to Extract

| Field | Description | Used For |
|-------|-------------|----------|
| `<SRS>` | Projection definition (Proj4/WKT) | Proj4 string in Leaflet CRS |
| `<Origin x="..." y="...">` | Top-left corner in projected coordinates | `origin` in Leaflet CRS config |
| `<BoundingBox>` | Extent of tiles in projected coordinates | `bounds` in Leaflet CRS config |
| `<TileSet units-per-pixel>` | Resolution at each zoom level | `resolutions` array in Leaflet |

**CRITICAL:** The `Origin` y-coordinate determines the tile indexing origin. For TMS (Tile Map Service) tiles, this is typically the **bottom-left** corner (negative Y value for southern hemisphere projections).

---

## Configuring Leaflet Projections

### Step 1: Extract Values from tilemapresource.xml

From the Antarctic example above:
- **EPSG Code:** `EPSG:3031`
- **Proj4 String:** `+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +datum=WGS84 +units=m +no_defs`
- **Origin:** `[-7164272.94227734580636, -7164101.30468036048114]`
- **Resolutions:** `[59223.45335864719527, 29611.72667932359764, ...]`
- **Bounds:** `L.bounds([[-7164272.94227734580636, -7164101.30468036048114], [7164101.30468036048114, 7164272.94227734580636]])`

### Step 2: Add Projection Configuration

Edit the HTML files (`download.html`, `downloadNew.html`, etc.) and add to the `projectionConfigs` object:

```javascript
var projectionConfigs = {
  standard: { /* ... */ },
  mollweide: { /* ... */ },

  // Add your new projection here
  antarctic: {
    crs: new L.Proj.CRS('EPSG:3031',
      '+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +datum=WGS84 +units=m +no_defs',
      {
        origin: [-7164272.94227734580636, -7164101.30468036048114],
        resolutions: [
          59223.45335864719527,
          29611.72667932359764,
          14805.86333966179882,
          7402.93166983089941,
          3701.46583491544970,
          1850.73291745772485,
          925.36645872886243,
          462.68322936443121
        ],
        bounds: L.bounds([
          [-7164272.94227734580636, -7164101.30468036048114],
          [7164101.30468036048114, 7164272.94227734580636]
        ])
      }
    ),
    center: [-90, 0],        // Lat/Lon center (South Pole)
    zoom: 2,                 // Initial zoom level
    minZoom: 0,
    maxZoom: 7,
    tileLayer: 'http://localhost:8080/tiles_bluemarble_3031/{z}/{x}/{y}.png',
    tileOptions: {
      attribution: 'Blue Marble',
      tileSize: 256,
      tms: true              // CRITICAL: Set to true for TMS tiles
    },
    bounds: [[-90, -180], [-30, 180]]  // Geographic bounds (lat/lon)
  }
};
```

### Step 3: Add Projection to Selector

In the projection control code, add the new option:

```javascript
container.innerHTML =
  '<div class="projection-title">Map Projection</div>' +
  '<div class="projection-options">' +
  '<label><input type="radio" name="projection" value="standard" checked> Standard (Web Mercator)</label>' +
  '<label><input type="radio" name="projection" value="mollweide"> Mollweide</label>' +
  '<label><input type="radio" name="projection" value="antarctic"> Antarctic Polar</label>' +  // NEW
  '<label><input type="radio" name="projection" value="arctic"> Arctic Polar</label>' +
  '</div>';
```

### Configuration Parameters Explained

| Parameter | Description | Example |
|-----------|-------------|---------|
| `crs` | Leaflet Proj4 CRS object | `new L.Proj.CRS('EPSG:3031', ...)` |
| `origin` | Top-left corner in projected coords | `[-7164272.94, -7164101.30]` |
| `resolutions` | Meters per pixel at each zoom | `[59223.45, 29611.73, ...]` |
| `bounds` (CRS) | Tile extent in projected coords | `L.bounds([...])` |
| `center` | Initial view center (lat/lon) | `[-90, 0]` |
| `zoom` | Initial zoom level | `2` |
| `minZoom` / `maxZoom` | Available zoom range | `0-7` |
| `tileLayer` | URL template for tiles | `http://.../{z}/{x}/{y}.png` |
| `tms` | Use TMS tile indexing | `true` |
| `bounds` (config) | Geographic extent (lat/lon) | `[[-90, -180], [-30, 180]]` |

---

## Testing and Verification

### Step 1: Deploy Changes

#### Option A: Copy to Running Container (Quick Test)
```bash
docker cp query/download.html prestoserver-presto-orchestrator-1:/root/presto/query/download.html
```

#### Option B: Rebuild Container (Permanent)
```bash
docker-compose build presto-orchestrator
docker-compose up -d presto-orchestrator
```

### Step 2: Test in Browser

1. Navigate to `http://localhost:81/query/download`
2. Open browser console (F12)
3. Switch to your new projection
4. Verify:
   - Tiles load correctly
   - Dataset markers appear in correct locations
   - No console errors

### Step 3: Verify Marker Alignment

Check console for transformation debugging:
```
updatePoints called with 7072 points
Current projection: antarctic
Current map CRS: EPSG:3031
Sample coordinate (lat/lon): -75.5 45.2
Test transformation - LatLng: -75.5, 45.2 -> LayerPoint: x, y
```

If markers are misaligned, check:
- Origin coordinates match `tilemapresource.xml`
- Resolutions array is correct
- `tms: true` is set for TMS tiles
- Proj4 string matches the projection

---

## Troubleshooting

### Problem: Tiles Don't Load

**Symptoms:** Gray tiles, 404 errors in console

**Solutions:**
1. Check tile server is running: `curl http://localhost:8080/tiles_bluemarble_3031/0/0/0.png`
2. Verify tileLayer URL template is correct
3. Check zoom levels exist in tile directory
4. Ensure CORS is enabled if tiles are on different domain

### Problem: Markers Appear in Wrong Location

**Symptoms:** Markers offset from actual positions, clusters in wrong areas

**Solutions:**
1. **Check Origin:** Most common issue. Origin Y coordinate must match `tilemapresource.xml`
   - Southern hemisphere projections typically have **negative Y origin**
   - Example: `[-7164272.94, -7164101.30]` (both negative for Antarctic)

2. **Verify TMS Setting:** Set `tms: true` if using TMS tiles (from gdal2tiles.py)

3. **Check Proj4 String:** Ensure all parameters match the projection
   - Use `+lat_0=-90` for Antarctic (not `-71`)
   - Include `+lat_ts=-71` for true scale latitude
   - Verify `+ellps=WGS84 +datum=WGS84`

4. **Validate Resolutions:** Copy exact values from `tilemapresource.xml`

### Problem: Tiles Appear Blurry or Shifted

**Symptoms:** Tiles don't align at grid boundaries

**Solutions:**
1. Ensure `tileSize: 256` matches actual tile size
2. Check `origin` is exactly from XML (don't round values)
3. Verify resolutions array order (should be descending)

### Problem: Map Won't Initialize

**Symptoms:** Blank map container, JavaScript errors

**Solutions:**
1. Check browser console for errors
2. Verify Proj4 library is loaded: `<script src="https://unpkg.com/proj4@2.9.0"></script>`
3. Verify Proj4Leaflet is loaded: `<script src="https://unpkg.com/proj4leaflet@1.0.2"></script>`
4. Ensure EPSG code is valid

---

## Quick Reference: Common Projections

### Antarctic Polar Stereographic (EPSG:3031)
```javascript
{
  proj4: '+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +datum=WGS84 +units=m +no_defs',
  center: [-90, 0],
  bounds: [[-90, -180], [-30, 180]]  // -90 to -30 latitude
}
```

### Arctic Polar Stereographic (EPSG:3413)
```javascript
{
  proj4: '+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +datum=WGS84 +units=m +no_defs',
  center: [90, 0],
  bounds: [[60, -180], [90, 180]]  // 60 to 90 latitude
}
```

### Mollweide (Custom)
```javascript
{
  proj4: '+proj=moll +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs',
  center: [0, 0],
  bounds: [[-85, -180], [85, 180]]
}
```

---

## Files to Update

When adding a new projection, update:

1. **query/query.html** - the unified query template (all recons share it; the
   old per-recon `download.html` / `temp12k.html` / `holocene_da.html` pages
   were removed in favor of this single template)
2. **query/public/mapManager.js** and **query/public/mollweide-crs.js** - the
   map/projection logic loaded by the template

Per-recon differences come from `pageConfig` in `presto/reconRegistry.json`, not
from separate HTML files.

---

## Checklist for Adding New Tiles

- [ ] Generate tiles with `gdal2tiles.py`
- [ ] Copy tiles to tile server directory
- [ ] Extract values from `tilemapresource.xml`
- [ ] Add projection config to JavaScript
- [ ] Add radio button to projection selector
- [ ] Test in browser
- [ ] Verify marker alignment
- [ ] Update all query HTML files
- [ ] Deploy to Docker container
- [ ] Document projection parameters

---

## Additional Resources

- [GDAL2Tiles Documentation](https://gdal.org/programs/gdal2tiles.html)
- [Leaflet CRS Documentation](https://leafletjs.com/reference.html#crs)
- [Proj4js Documentation](http://proj4js.org/)
- [Proj4Leaflet GitHub](https://github.com/kartena/Proj4Leaflet)
- [TMS Specification](https://wiki.osgeo.org/wiki/Tile_Map_Service_Specification)
- [EPSG Registry](https://epsg.io/)

---

## Notes

- **Always use exact values** from `tilemapresource.xml` - don't round or approximate
- **Test coordinate transformation** by examining console logs when switching projections
- **Origin Y coordinate** is the most critical parameter for marker alignment
- **TMS vs XYZ:** gdal2tiles.py generates TMS tiles by default (origin at bottom-left), so set `tms: true` in Leaflet
- **Geographic bounds** (in projection config) control where markers are shown, not tile bounds
- **Projected bounds** (in CRS config) define the tile coordinate system extent

---

*Last updated: January 2026*
*Based on Antarctic Polar Stereographic (EPSG:3031) implementation*
