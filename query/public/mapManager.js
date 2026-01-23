/**
 * MapManager - Shared map functionality for Presto query forms
 *
 * Provides unified map initialization, projection switching, and legend management
 * across all query forms (download.html, holocene_da.html, temp12k.html)
 *
 * @module MapManager
 */

(function(window) {
   'use strict';

   // Module state
   var state = {
      currentProjection: 'mollweide',
      map: null,
      tiles: null,
      layerGroup: null,
      legend: null,
      legendRadioControl: null,
      boundaryLayerControl: null,
      prevResp: {},
      inRectCount: 0,
      legendMode: 'archiveType',
      originalUpdatePoints: null,
      config: {
         defaultProjection: 'mollweide',
         enabledProjections: ['standard', 'mollweide', 'arctic', 'antarctic'],
         enabledLegendModes: ['archiveType', 'interpVar', 'proxy'],
         enableDynamicLegend: true,
         enableSouthernOceanBoundaries: true
      }
   };

   // Regular expression for parsing
   var regExp = /\(([^)]+)\)/;

   // Top 15 most common interpretation variables (cached from database query)
   var top15InterpVars = [
      "temperature",
      "precipitation",
      "effectivePrecipitation",
      "temperature|precipitationIsotope",
      "growingDegreeDays",
      "temperature|temperature|seawaterIsotope",
      "precipitation|precipitationIsotope",
      "precipitationIsotope",
      "seaIce",
      "salinity|seawaterIsotope",
      "streamflow",
      "upwelling",
      "effectivePrecipitation|effectivePrecipitation",
      "temperature|seawaterIsotope",
      "salinity"
   ];

   // Archive type legend entries (full list)
   var allLegendEntries = {
      "Borehole": {
         label: "Borehole",
         type: "polygon",
         sides: "4",
         color: "#FFD600",
         fillColor: "#FFD600",
         weight: 2
      },
      "Coral": {
         label: "Coral",
         type: "polygonR",
         sides: 3,
         color: "#FF8B00",
         fillColor: "#FF8B00",
         weight: 2
      },
      "FluvialSediment": {
         label: "FluvialSediment",
         type: "circle",
         radius: 6,
         color: "#4169E0",
         fillColor: "#4169E0",
         weight: 2
      },
      "GlacierIce": {
         label: "GlacierIce",
         type: "image",
         url: "/query/glacierIce.png"
      },
      "GroundIce": {
         label: "GroundIce",
         type: "image",
         url: "/query/groundIce.png"
      },
      "LakeSediment": {
         label: "LakeSediment",
         type: "circle",
         radius: 6,
         color: "#8f8fa1",
         fillColor: "#8f8fa1",
         weight: 2
      },
      "MarineSediment": {
         label: "MarineSediment",
         type: "circle",
         radius: 6,
         color: "#8A4513",
         fillColor: "#8A4513",
         weight: 2
      },
      "Midden": {
         label: "Midden",
         type: "polygonR",
         sides: 4,
         color: "#824E2B",
         fillColor: "#824E2B",
         weight: 2
      },
      "MolluskShell": {
         label: "MolluskShell",
         type: "polygon",
         sides: 3,
         color: "#7b03fc",
         fillColor: "#7b03fc",
         weight: 2
      },
      "Peat": {
         label: "Peat",
         type: "polygonR",
         sides: 3,
         color: "#8A9A5B",
         fillColor: "#8A9A5B",
         weight: 2
      },
      "Sclerosponge": {
         label: "Sclerosponge",
         type: "polygonR",
         sides: 3,
         color: "#D2042D",
         fillColor: "#D2042D",
         weight: 2
      },
      "Shoreline": {
         label: "Shoreline",
         type: "polygonR",
         sides: 4,
         color: "#40826D",
         fillColor: "#40826D",
         weight: 2
      },
      "Speleothem": {
         label: "Speleothem",
         type: "polygon",
         sides: 4,
         color: "#FF1492",
         fillColor: "#FF1492",
         weight: 2
      },
      "TerrestrialSediment": {
         label: "TerrestrialSediment",
         type: "circle",
         radius: 6,
         color: "#d2b48c",
         fillColor: "#d2b48c",
         weight: 2
      },
      "Wood": {
         label: "Wood",
         type: "polygon",
         sides: 3,
         color: "#32CC32",
         fillColor: "#32CC32",
         weight: 2
      },
      "Documents": {
         label: "Documents",
         type: "star",
         sides: "5",
         color: "black",
         fillColor: "black",
         weight: 2
      },
      "*Other*": {
         label: "*Other*",
         type: "polygonR",
         sides: "4",
         color: "black",
         fillColor: "black",
         weight: 2
      }
   };

   // Interpretation variable legend entries (top 15 + Other)
   var allInterpVarEntries = {
      "temperature": {
         label: "temperature",
         type: "polygon",
         sides: "4",
         color: "#FFD600",
         fillColor: "#FFD600",
         weight: 2
      },
      "precipitation": {
         label: "precipitation",
         type: "polygonR",
         sides: 3,
         color: "#FF8B00",
         fillColor: "#FF8B00",
         weight: 2
      },
      "effectivePrecipitation": {
         label: "effectivePrecipitation",
         type: "circle",
         radius: 6,
         color: "#4169E0",
         fillColor: "#4169E0",
         weight: 2
      },
      "temperature|precipitationIsotope": {
         label: "temp|precipIsotope",
         type: "circle",
         radius: 6,
         color: "#FF0000",
         fillColor: "#FF0000",
         weight: 2
      },
      "growingDegreeDays": {
         label: "growingDegreeDays",
         type: "circle",
         radius: 6,
         color: "#8A4513",
         fillColor: "#8A4513",
         weight: 2
      },
      "temperature|temperature|seawaterIsotope": {
         label: "temp|temp|seawaterIso",
         type: "polygonR",
         sides: 4,
         color: "#824E2B",
         fillColor: "#824E2B",
         weight: 2
      },
      "precipitation|precipitationIsotope": {
         label: "precip|precipIsotope",
         type: "polygon",
         sides: 3,
         color: "#7b03fc",
         fillColor: "#7b03fc",
         weight: 2
      },
      "precipitationIsotope": {
         label: "precipitationIsotope",
         type: "polygonR",
         sides: 3,
         color: "#8A9A5B",
         fillColor: "#8A9A5B",
         weight: 2
      },
      "seaIce": {
         label: "seaIce",
         type: "polygonR",
         sides: 3,
         color: "#D2042D",
         fillColor: "#D2042D",
         weight: 2
      },
      "salinity|seawaterIsotope": {
         label: "salinity|seawaterIso",
         type: "polygonR",
         sides: 4,
         color: "#40826D",
         fillColor: "#40826D",
         weight: 2
      },
      "streamflow": {
         label: "streamflow",
         type: "polygon",
         sides: 4,
         color: "#FF1492",
         fillColor: "#FF1492",
         weight: 2
      },
      "upwelling": {
         label: "upwelling",
         type: "circle",
         radius: 6,
         color: "#d2b48c",
         fillColor: "#d2b48c",
         weight: 2
      },
      "effectivePrecipitation|effectivePrecipitation": {
         label: "effectPrecip|effectPrecip",
         type: "polygon",
         sides: 3,
         color: "#32CC32",
         fillColor: "#32CC32",
         weight: 2
      },
      "temperature|seawaterIsotope": {
         label: "temp|seawaterIsotope",
         type: "star",
         sides: "5",
         color: "#1E90FF",
         fillColor: "#1E90FF",
         weight: 2
      },
      "salinity": {
         label: "salinity",
         type: "polygonR",
         sides: "4",
         color: "#9370DB",
         fillColor: "#9370DB",
         weight: 2
      },
      "*Other*": {
         label: "*Other*",
         type: "polygonR",
         sides: "4",
         color: "#808080",
         fillColor: "#808080",
         weight: 2
      }
   };

   // Proxy legend entries (top 10 common proxies)
   var allProxyEntries = {
      "d18O": { label: "d18O", type: "polygon", sides: "4", color: "#FFD600", fillColor: "#FFD600", weight: 2 },
      "Mg/Ca": { label: "Mg/Ca", type: "polygonR", sides: 3, color: "#FF8B00", fillColor: "#FF8B00", weight: 2 },
      "pollen": { label: "pollen", type: "circle", radius: 6, color: "#4169E0", fillColor: "#4169E0", weight: 2 },
      "chironomid": { label: "chironomid", type: "circle", radius: 6, color: "#8A4513", fillColor: "#8A4513", weight: 2 },
      "alkenone": { label: "alkenone", type: "polygonR", sides: 4, color: "#FF0000", fillColor: "#FF0000", weight: 2 },
      "ring width": { label: "ring width", type: "polygon", sides: 3, color: "#32CC32", fillColor: "#32CC32", weight: 2 },
      "diatom": { label: "diatom", type: "polygonR", sides: 3, color: "#8A9A5B", fillColor: "#8A9A5B", weight: 2 },
      "TEX86": { label: "TEX86", type: "polygonR", sides: 4, color: "#D2042D", fillColor: "#D2042D", weight: 2 },
      "charcoal": { label: "charcoal", type: "polygon", sides: 4, color: "#40826D", fillColor: "#40826D", weight: 2 },
      "BSi": { label: "BSi", type: "star", sides: "5", color: "#1E90FF", fillColor: "#1E90FF", weight: 2 },
      "*Other*": { label: "*Other*", type: "polygonR", sides: "4", color: "#808080", fillColor: "#808080", weight: 2 }
   };

   // Projection configurations
   var projectionConfigs = {
      standard: {
         crs: L.CRS.EPSG3857,
         center: [0, 0],
         zoom: 2,
         minZoom: 1,
         maxZoom: 18,
         tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
         tileOptions: {
            maxZoom: 18,
            minZoom: 1
         },
         bounds: [[-90, -180], [90, 180]]
      },
      mollweide: {
         crs: null, // Will be set from mollweideCRS
         center: [0, 0],
         zoom: 3,
         minZoom: 0,
         maxZoom: 7,
         tileLayer: 'http://localhost:8080/tiles_bluemarble/{z}/{x}/{y}.png',
         tileOptions: {
            tms: true,
            tileSize: 256,
            noWrap: true,
            attribution: 'Blue Marble'
         },
         bounds: [[-85, -180], [85, 180]]
      },
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
               bounds: L.bounds([[-7164272.94227734580636, -7164101.30468036048114], [7164101.30468036048114, 7164272.94227734580636]])
            }
         ),
         center: [-90, 0],
         zoom: 2,
         minZoom: 0,
         maxZoom: 7,
         tileLayer: 'http://localhost:8080/tiles_bluemarble_3031/{z}/{x}/{y}.png',
         tileOptions: {
            attribution: 'Blue Marble',
            tileSize: 256,
            tms: true
         },
         bounds: [[-90, -180], [-30, 180]]
      },
      arctic: {
         crs: new L.Proj.CRS('EPSG:3995',
            '+proj=stere +lat_0=90 +lat_ts=71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +datum=WGS84 +units=m +no_defs',
            {
               origin: [-7164272.99398840591311, -7164308.91092761978507],
               resolutions: [
                  83754.61155490233796,
                  41877.30577745116898,
                  20938.65288872558449,
                  10469.32644436279224,
                  5234.66322218139612,
                  2617.33161109069806,
                  1308.66580554534903,
                  654.33290277267452
               ],
               bounds: L.bounds([[-7164272.99398840591311, -7164308.91092761978507], [7164308.91092761978507, 7164272.99398840591311]])
            }
         ),
         center: [90, 0],
         zoom: 2,
         minZoom: 0,
         maxZoom: 7,
         tileLayer: 'http://localhost:8080/tiles_bluemarble_3995/{z}/{x}/{y}.png',
         tileOptions: {
            attribution: 'Blue Marble',
            tileSize: 256,
            tms: true
         },
         bounds: [[30, -180], [90, 180]]
      }
   };

   /**
    * Calculate top 10 most common proxies from visible data
    * @private
    */
   function _calculateTopProxies(data, rectCoord) {
      var proxyCounts = {};

      data.forEach(function(item) {
         var lat = item.geo_latitude;
         var lon = item.geo_longitude;
         var isVisible = lat >= rectCoord.South && lat <= rectCoord.North &&
                        lon >= rectCoord.West && lon <= rectCoord.East;

         if (isVisible && item.paleoData_proxy) {
            var proxies = Array.isArray(item.paleoData_proxy)
               ? item.paleoData_proxy
               : [item.paleoData_proxy];

            proxies.forEach(function(proxy) {
               var proxyValue = Array.isArray(proxy) ? proxy[0] : proxy;
               if (proxyValue && proxyValue !== '') {
                  var normalized = proxyValue.toString().trim();
                  proxyCounts[normalized] = (proxyCounts[normalized] || 0) + 1;
               }
            });
         }
      });

      var sortedProxies = Object.keys(proxyCounts)
         .sort(function(a, b) { return proxyCounts[b] - proxyCounts[a]; })
         .slice(0, 10);

      console.log('Top 10 proxies:', sortedProxies);
      return sortedProxies;
   }

   /**
    * Get or dynamically create legend entry for a proxy
    * @private
    */
   function _getProxyLegendEntry(proxyName) {
      if (allProxyEntries[proxyName]) {
         return allProxyEntries[proxyName];
      }

      // Dynamic entry for rare proxies
      var dynamicColors = ["#FFD600", "#FF8B00", "#4169E0", "#8A4513", "#FF0000"];
      var dynamicShapes = ["square", "circle", "diamond", "triangle"];
      var index = Object.keys(allProxyEntries).length;

      return {
         label: proxyName,
         type: dynamicShapes[index % dynamicShapes.length],
         sides: "4",
         color: dynamicColors[index % dynamicColors.length],
         fillColor: dynamicColors[index % dynamicColors.length],
         weight: 2
      };
   }

   /**
    * Create legend mode radio button control
    * @private
    */
   function _addLegendModeControl() {
      if (state.legendRadioControl) return; // Already created

      var LegendControl = L.Control.extend({
         options: {
            position: 'topright'
         },
         onAdd: function(map) {
            var container = L.DomUtil.create('div', 'leaflet-control-layers leaflet-control');
            container.style.background = 'white';
            container.style.padding = '10px';
            container.style.borderRadius = '4px';
            container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';

            // Build radio buttons HTML based on enabled modes
            var radioHtml = '<div style="margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 8px;">';

            if (state.config.enabledLegendModes.indexOf('archiveType') !== -1) {
               radioHtml += '<label style="display: block; margin: 2px 0; cursor: pointer; font-size: 12px;">' +
                  '<input type="radio" name="legendType" value="archiveType" ' +
                  (state.legendMode === 'archiveType' ? 'checked' : '') + '> Archive Type</label>';
            }

            if (state.config.enabledLegendModes.indexOf('interpVar') !== -1) {
               radioHtml += '<label style="display: block; margin: 2px 0; cursor: pointer; font-size: 12px;">' +
                  '<input type="radio" name="legendType" value="interpVar" ' +
                  (state.legendMode === 'interpVar' ? 'checked' : '') + '> Interp. Variable</label>';
            }

            if (state.config.enabledLegendModes.indexOf('proxy') !== -1) {
               radioHtml += '<label style="display: block; margin: 2px 0; cursor: pointer; font-size: 12px;">' +
                  '<input type="radio" name="legendType" value="proxy" ' +
                  (state.legendMode === 'proxy' ? 'checked' : '') + '> Proxy</label>';
            }

            radioHtml += '</div>';

            container.innerHTML = radioHtml;

            // Add change event listeners
            var radios = container.querySelectorAll('input[name="legendType"]');
            radios.forEach(function(radio) {
               L.DomEvent.on(radio, 'change', function(e) {
                  state.legendMode = e.target.value;
                  window.legendMode = e.target.value; // Expose to global for compatibility
                  console.log('Legend mode changed to:', state.legendMode);
                  MapManager.updateLegend();
                  // Redraw markers with new coloring
                  if (state.originalUpdatePoints && state.prevResp) {
                     state.originalUpdatePoints(state.prevResp);
                  }
               });
               // Prevent map interactions when clicking on radio buttons
               L.DomEvent.disableClickPropagation(radio);
            });

            // Prevent map panning when dragging legend
            L.DomEvent.disableClickPropagation(container);

            return container;
         }
      });

      state.legendRadioControl = new LegendControl();
      if (state.map) {
         state.map.addControl(state.legendRadioControl);
      }
   }

   /**
    * Add projection selector control to map
    * @private
    */
   function _addProjectionControl() {
      var ProjectionControl = L.Control.extend({
         options: {
            position: 'topleft'
         },
         onAdd: function(map) {
            var container = L.DomUtil.create('div', 'leaflet-control-projection collapsed');

            var radioHtml = '<div class="projection-title">Map Projection</div>' +
               '<div class="projection-options">';

            // Add enabled projections
            if (state.config.enabledProjections.indexOf('mollweide') !== -1) {
               radioHtml += '<label><input type="radio" name="projection" value="mollweide" ' +
                  (state.currentProjection === 'mollweide' ? 'checked' : '') + '> Mollweide (Equal Area)</label>';
            }
            if (state.config.enabledProjections.indexOf('standard') !== -1) {
               radioHtml += '<label><input type="radio" name="projection" value="standard" ' +
                  (state.currentProjection === 'standard' ? 'checked' : '') + '> Standard (Web Mercator)</label>';
            }
            if (state.config.enabledProjections.indexOf('arctic') !== -1) {
               radioHtml += '<label><input type="radio" name="projection" value="arctic" ' +
                  (state.currentProjection === 'arctic' ? 'checked' : '') + '> Arctic Polar</label>';
            }
            if (state.config.enabledProjections.indexOf('antarctic') !== -1) {
               radioHtml += '<label><input type="radio" name="projection" value="antarctic" ' +
                  (state.currentProjection === 'antarctic' ? 'checked' : '') + '> Antarctic Polar</label>';
            }

            radioHtml += '</div>';
            container.innerHTML = radioHtml;

            // Toggle collapsed state when clicking the title
            var title = container.querySelector('.projection-title');
            L.DomEvent.on(title, 'click', function() {
               if (container.classList.contains('collapsed')) {
                  container.classList.remove('collapsed');
               } else {
                  container.classList.add('collapsed');
               }
            });

            // Handle projection changes
            var radios = container.querySelectorAll('input[type="radio"]');
            radios.forEach(function(radio) {
               L.DomEvent.on(radio, 'change', function() {
                  console.log('Projection changed to: ' + this.value);
                  if (this.checked) {
                     MapManager.switchProjection(this.value);
                  }
               });
            });

            // Prevent map interactions when clicking on control
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);

            return container;
         }
      });

      state.map.addControl(new ProjectionControl());
   }

   /**
    * Add Southern Ocean boundary layers for Antarctic projection
    * @private
    */
   function _addSouthernOceanBoundaries() {
      if (!state.config.enableSouthernOceanBoundaries) return;
      if (typeof BoundaryCoords === 'undefined') {
         console.warn('BoundaryCoords not loaded, skipping Southern Ocean boundaries');
         return;
      }

      console.log('Adding Southern Ocean boundary layers');

      // Convert coordinate arrays to L.latLng format
      var pointListBoundary = BoundaryCoords.points.map(function(p) { return L.latLng(p[0], p[1]); });
      var pointListSACCF = SACCFCoords.points.map(function(p) { return L.latLng(p[0], p[1]); });
      var pointListPF = PFCoords.points.map(function(p) { return L.latLng(p[0], p[1]); });
      var pointListSTF = STFCoords.points.map(function(p) { return L.latLng(p[0], p[1]); });
      var pointListSAF = SAFCoords.points.map(function(p) { return L.latLng(p[0], p[1]); });

      // Create polyline layers
      var Boundary = L.polyline(pointListBoundary, {
         color: '#fcba03',
         weight: 3,
         opacity: 0.5,
         smoothFactor: 1
      });
      var SACCF = L.polyline(pointListSACCF, {
         color: '#fc2c03',
         weight: 3,
         opacity: 0.5,
         smoothFactor: 1
      });
      var PF = L.polyline(pointListPF, {
         color: '#6bfc03',
         weight: 3,
         opacity: 0.5,
         smoothFactor: 1
      });
      var STF = L.polyline(pointListSTF, {
         color: '#6f03fc',
         weight: 3,
         opacity: 0.5,
         smoothFactor: 1
      });
      var SAF = L.polyline(pointListSAF, {
         color: '#df03fc',
         weight: 3,
         opacity: 0.5,
         smoothFactor: 1
      });

      // Create layer control for boundaries
      var boundaryOverlays = {
         "Boundary": Boundary,
         "SACCF": SACCF,
         "PF": PF,
         "SAF": SAF,
         "STF": STF
      };

      state.boundaryLayerControl = L.control.layers(null, boundaryOverlays, {
         collapsed: false,
         position: 'bottomright'
      }).addTo(state.map);

      console.log('Southern Ocean boundary layers added');
   }

   // Public API
   var MapManager = {
      /**
       * Initialize MapManager with configuration options
       * @param {Object} options - Configuration options
       */
      init: function(options) {
         if (options) {
            Object.assign(state.config, options);
         }

         // Set default projection from config
         if (state.config.defaultProjection) {
            state.currentProjection = state.config.defaultProjection;
         }

         // Set default legend mode from enabled modes
         if (state.config.enabledLegendModes.length > 0) {
            state.legendMode = state.config.enabledLegendModes[0];
         }

         console.log('MapManager initialized with config:', state.config);
      },

      /**
       * Create and initialize map
       * @param {string} containerId - ID of the map container element
       * @param {string} projectionType - Initial projection type
       */
      createMap: function(containerId, projectionType) {
         console.log('createMap called with projection: ' + projectionType);

         projectionType = projectionType || state.currentProjection;
         state.currentProjection = projectionType;

         // Set Mollweide CRS from loaded mollweide-crs.js file
         if (projectionType === 'mollweide') {
            if (typeof mollweideCRS === 'undefined') {
               console.error('mollweideCRS not loaded from mollweide-crs.js!');
               return;
            }
            if (projectionConfigs.mollweide.crs === null) {
               projectionConfigs.mollweide.crs = mollweideCRS;
               console.log('Mollweide CRS loaded:', mollweideCRS);
            }
         }

         var config = projectionConfigs[projectionType];

         if (!config) {
            console.error('No configuration found for projection: ' + projectionType);
            return;
         }

         // Remove existing map if any
         if (state.map) {
            this.destroyMap();
         }

         // Add or remove polar-projection class for CSS styling
         var mapContainer = document.getElementById(containerId);
         if (projectionType === 'arctic' || projectionType === 'antarctic') {
            mapContainer.classList.add('polar-projection');
         } else {
            mapContainer.classList.remove('polar-projection');
         }

         // Create new map
         console.log('Creating map with zoom level:', config.zoom, 'center:', config.center);
         state.map = L.map(containerId, {
            crs: config.crs,
            center: config.center,
            zoom: config.zoom,
            minZoom: config.minZoom,
            maxZoom: config.maxZoom,
            attributionControl: false
         });

         // Add tile layer
         state.tiles = L.tileLayer(config.tileLayer, config.tileOptions).addTo(state.map);

         // Add layer group for points
         state.layerGroup = L.layerGroup().addTo(state.map);

         // Remove any existing rectangles from the map (safety check)
         state.map.eachLayer(function(layer) {
            if (layer instanceof L.Rectangle) {
               state.map.removeLayer(layer);
               console.log('Removed existing rectangle from map');
            }
         });

         // Add projection selector control
         _addProjectionControl();

         // Update form inputs to match projection bounds
         var bounds = config.bounds;
         if (document.getElementById("lat_min")) {
            document.getElementById("lat_min").value = bounds[0][0];
            document.getElementById("lon_min").value = bounds[0][1];
            document.getElementById("lat_max").value = bounds[1][0];
            document.getElementById("lon_max").value = bounds[1][1];
         }

         console.log('Set bounding box to:', bounds[0][0], bounds[0][1], 'to', bounds[1][0], bounds[1][1]);

         // Update coordinate filter checkbox based on projection
         if (document.getElementById('coordsOn')) {
            if (projectionType === 'standard' || projectionType === 'mollweide') {
               // Standard/Mollweide projection: keep existing state
            } else {
               // Polar projections: enable coordinate filtering by default
               document.getElementById('coordsOn').checked = true;
               if (document.getElementById('coordsDiv')) {
                  document.getElementById('coordsDiv').style.visibility = 'visible';
               }
               if (typeof filters1 !== 'undefined') {
                  filters1['coords'] = 'true';
               }
            }
         }

         console.log('Map CRS:', state.map.options.crs);
         console.log('Map initialized with center:', config.center, 'zoom:', config.zoom);
         console.log('Projection type:', projectionType);

         // Add Southern Ocean boundary layers for Antarctic projection
         if (projectionType === 'antarctic') {
            _addSouthernOceanBoundaries();
         }

         // Expose map and layerGroup to global for compatibility
         window.map = state.map;
         window.layerGroup = state.layerGroup;

         // Force a slight delay to ensure map is fully initialized before adding points
         var self = this;
         setTimeout(function() {
            // Reload data if we had previous data
            if (state.prevResp && Object.keys(state.prevResp).length > 0) {
               console.log('Reloading', Object.keys(state.prevResp).length, 'previous data points');
               console.log('Current map CRS when adding points:', state.map.options.crs);
               if (typeof updatePoints !== 'undefined') {
                  updatePoints(state.prevResp);
               }
            }

            // Final safety check: remove any rectangles that might have been added
            state.map.eachLayer(function(layer) {
               if (layer instanceof L.Rectangle) {
                  state.map.removeLayer(layer);
                  console.warn('WARNING: Found and removed a rectangle after initialization!');
               }
            });
            console.log('Rectangle removal check complete');
         }, 100);
      },

      /**
       * Destroy the current map instance
       */
      destroyMap: function() {
         if (!state.map) return;

         console.log('Removing existing map');

         // Remove legend control first if it exists
         if (state.legend) {
            state.map.removeControl(state.legend);
            state.legend = null;
         }

         // Remove boundary layer control if it exists
         if (state.boundaryLayerControl) {
            state.map.removeControl(state.boundaryLayerControl);
            state.boundaryLayerControl = null;
         }

         // Clear layer references
         if (state.tiles) {
            state.tiles = null;
         }
         if (state.layerGroup) {
            state.layerGroup = null;
         }

         // Remove map and clear container
         var mapContainer = state.map.getContainer();
         state.map.remove();
         state.map = null;

         // Clear the map container to ensure all DOM elements are removed
         if (mapContainer) {
            mapContainer.innerHTML = '';
         }
      },

      /**
       * Switch to a different projection
       * @param {string} projectionType - Projection type to switch to
       */
      switchProjection: function(projectionType) {
         console.log('Switching projection to:', projectionType);
         state.currentProjection = projectionType;

         try {
            this.createMap('map', projectionType);
            console.log('Map reinitialized with projection:', projectionType);
         } catch(e) {
            console.error('Error initializing map with projection ' + projectionType + ':', e);
         }
      },

      /**
       * Set the legend mode
       * @param {string} mode - Legend mode ('archiveType', 'interpVar', 'proxy')
       */
      setLegendMode: function(mode) {
         state.legendMode = mode;
         window.legendMode = mode; // Expose to global for compatibility
         this.updateLegend();
      },

      /**
       * Update legend based on visible data types
       */
      updateLegend: function() {
         if (!state.config.enableDynamicLegend) return;
         if (!state.prevResp || !state.prevResp.length) return;

         // Debug: log first item to see property names
         if (state.prevResp.length > 0) {
            console.log('Sample data item:', state.prevResp[0]);
            console.log('interp_Vars value:', state.prevResp[0].interp_Vars);
         }

         var visibleTypes = new Set();

         // Get coordinate bounds from form inputs
         var rectCoord = {
            "South": +(document.getElementById("lat_min") ? document.getElementById("lat_min").value : -90) || -90,
            "West": +(document.getElementById("lon_min") ? document.getElementById("lon_min").value : -180) || -180,
            "North": +(document.getElementById("lat_max") ? document.getElementById("lat_max").value : 90) || 90,
            "East": +(document.getElementById("lon_max") ? document.getElementById("lon_max").value : 180) || 180
         };

         var legendEntries = [];
         var legendTitle = "";
         var legendEntrySource = null;

         if (state.legendMode === 'archiveType') {
            // Collect unique visible archive types
            state.prevResp.forEach(function(item) {
               var lat = item.geo_latitude;
               var lon = item.geo_longitude;
               var isVisible = lat >= rectCoord.South && lat <= rectCoord.North &&
                              lon >= rectCoord.West && lon <= rectCoord.East;

               if (isVisible && item.archiveType) {
                  visibleTypes.add(item.archiveType);
               }
            });

            legendEntrySource = allLegendEntries;
            legendTitle = "Archive Type";
         } else if (state.legendMode === 'interpVar') {
            // Collect unique visible interpretation variables
            state.prevResp.forEach(function(item) {
               var lat = item.geo_latitude;
               var lon = item.geo_longitude;
               var isVisible = lat >= rectCoord.South && lat <= rectCoord.North &&
                              lon >= rectCoord.West && lon <= rectCoord.East;

               if (isVisible && item.interp_Vars) {
                  var interpVar = item.interp_Vars;
                  // Map to top 15 or "Other"
                  if (top15InterpVars.indexOf(interpVar) === -1) {
                     interpVar = "*Other*";
                  }
                  visibleTypes.add(interpVar);
               }
            });

            console.log('Visible interp vars:', Array.from(visibleTypes));
            legendEntrySource = allInterpVarEntries;
            legendTitle = "Interpretation Variable";
         } else if (state.legendMode === 'proxy') {
            var currentTop10 = _calculateTopProxies(state.prevResp, rectCoord);

            state.prevResp.forEach(function(item) {
               var lat = item.geo_latitude;
               var lon = item.geo_longitude;
               var isVisible = lat >= rectCoord.South && lat <= rectCoord.North &&
                              lon >= rectCoord.West && lon <= rectCoord.East;

               if (isVisible && item.paleoData_proxy) {
                  var proxies = Array.isArray(item.paleoData_proxy)
                     ? item.paleoData_proxy
                     : [item.paleoData_proxy];

                  proxies.forEach(function(proxy) {
                     var proxyValue = Array.isArray(proxy) ? proxy[0] : proxy;
                     if (proxyValue && proxyValue !== '') {
                        var normalized = proxyValue.toString().trim();
                        if (currentTop10.indexOf(normalized) !== -1) {
                           visibleTypes.add(normalized);
                        } else {
                           visibleTypes.add("*Other*");
                        }
                     }
                  });
               }
            });

            legendEntrySource = allProxyEntries;
            legendTitle = "Proxy Type";
         }

         // Build legend entries for visible types only
         visibleTypes.forEach(function(type) {
            var entry;
            if (state.legendMode === 'proxy') {
               entry = _getProxyLegendEntry(type);
            } else {
               entry = legendEntrySource[type];
            }
            if (entry) {
               legendEntries.push(entry);
            }
         });

         console.log('Legend entries count:', legendEntries.length);

         // Create radio control if it doesn't exist
         if (state.config.enabledLegendModes.length > 1) {
            _addLegendModeControl();
         }

         // Remove existing legend
         if (state.legend && state.map) {
            state.map.removeControl(state.legend);
            state.legend = null;
         }

         // Add updated legend with only visible types
         if (legendEntries.length > 0 && state.map) {
            state.legend = L.control.Legend({
               position: "topright",
               title: legendTitle,
               collapsed: false,
               symbolWidth: 12,
               symbolHeight: 12,
               opacity: 1,
               column: 1,
               legends: legendEntries
            }).addTo(state.map);
         }
      },

      /**
       * Wrap the original updatePoints function to add legend integration
       * @param {Function} originalFunc - The original updatePoints function
       * @returns {Function} Wrapped function
       */
      wrapUpdatePoints: function(originalFunc) {
         state.originalUpdatePoints = originalFunc;

         return function wrappedUpdatePoints(coords) {
            console.log('updatePoints called with', coords.length, 'points');
            console.log('Current projection:', state.currentProjection);
            console.log('Current map CRS:', state.map ? state.map.options.crs.code : 'no map');

            // For polar projections, verify coordinate transformation
            if (state.currentProjection !== 'standard' && coords.length > 0) {
               var sampleCoord = coords[0];
               console.log('Sample coordinate (lat/lon):', sampleCoord.geo_latitude, sampleCoord.geo_longitude);

               // Test coordinate transformation
               if (state.map && state.map.options.crs.code) {
                  var testLatLng = L.latLng(sampleCoord.geo_latitude, sampleCoord.geo_longitude);
                  var testPoint = state.map.latLngToLayerPoint(testLatLng);
                  console.log('Test transformation - LatLng:', testLatLng, '-> LayerPoint:', testPoint);
               }
            }

            // Store response for legend updates and projection switching
            state.prevResp = coords;
            window.prevResp = coords; // Expose to global for compatibility

            // Call original function (shows all points with opacity filtering)
            if (state.originalUpdatePoints) {
               state.originalUpdatePoints(coords);
            }

            // After updatePoints runs, fix the dataset count if coordinate filtering is enabled
            if (document.getElementById('coordsOn') && document.getElementById('coordsOn').checked) {
               // Get current rectangle bounds
               var latMin = +(document.getElementById('lat_min') ? document.getElementById('lat_min').value : -90);
               var latMax = +(document.getElementById('lat_max') ? document.getElementById('lat_max').value : 90);
               var lonMin = +(document.getElementById('lon_min') ? document.getElementById('lon_min').value : -180);
               var lonMax = +(document.getElementById('lon_max') ? document.getElementById('lon_max').value : 180);

               // Count datasets within bounds
               var inBoundsCount = coords.filter(function(point) {
                  var lat = +point.geo_latitude;
                  var lon = +point.geo_longitude;
                  return lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax;
               }).length;

               // Update the display to show correct count
               if (document.getElementById("datasetCount") && typeof inRectCount !== 'undefined') {
                  document.getElementById("datasetCount").innerHTML = "Total datasets in query: " + inBoundsCount + " (" + inRectCount + " unique locations)";
               }

               console.log('Coordinate filtering: showing', coords.length, 'total datasets, but', inBoundsCount, 'are within bounds');
            }

            // Update legend to show only visible archive types
            MapManager.updateLegend();
         };
      },

      /**
       * Refresh markers with new data
       * @param {Array} data - Array of data points
       */
      refreshMarkers: function(data) {
         state.prevResp = data;
         if (typeof updatePoints !== 'undefined') {
            updatePoints(data);
         }
         this.updateLegend();
      },

      // Expose state properties for compatibility and debugging
      get map() { return state.map; },
      get legendMode() { return state.legendMode; },
      get currentProjection() { return state.currentProjection; }
   };

   // Workaround for 1px lines appearing in some browsers due to fractional transforms
   // https://github.com/Leaflet/Leaflet/issues/3575
   (function () {
      if (typeof L !== 'undefined' && L.GridLayer && L.GridLayer.prototype._initTile) {
         var originalInitTile = L.GridLayer.prototype._initTile;
         L.GridLayer.include({
            _initTile: function (tile) {
               originalInitTile.call(this, tile);
               var tileSize = this.getTileSize();
               tile.style.width = tileSize.x + 1 + 'px';
               tile.style.height = tileSize.y + 1 + 'px';
            }
         });
      }
   })();

   // Expose MapManager to global scope
   window.MapManager = MapManager;

   // Expose critical globals for compatibility
   Object.defineProperty(window, 'legendMode', {
      get: function() { return state.legendMode; },
      set: function(value) { state.legendMode = value; }
   });

})(window);
