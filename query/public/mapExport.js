/**
 * Map PNG Export — renders tiles + markers directly to canvas.
 * Shows a draggable/resizable selection rectangle (DOM overlay) on the map.
 * Reads the live legend from #belowMapLegend DOM.
 * Depends on: window.map (Leaflet), window.layerGroup, prevResp, filters1,
 *             chooseColor/chooseShape (queryHelpers.js)
 */

var MapExport = (function () {

  // Selection state (pixel coords relative to map container)
  var sel = { x: 0, y: 0, w: 0, h: 0 };
  var aspect = 1;         // locked w/h ratio, set when selection is created
  var selEl = null;       // the selection <div>
  var dimEls = [];        // four dimming <div>s (top/bottom/left/right)
  var handleEls = [];     // four corner resize handles [NW, NE, SW, SE]
  var active = false;

  // ── Gather active query filters as human-readable lines ──
  function getQueryLines() {
    var lines = [];
    var comp = document.getElementById('compilationIn').value.trim();
    if (comp) lines.push('Compilation: ' + comp);
    var at = document.getElementById('archiveTypeIn').value.trim().replace(/,\s*$/, '');
    if (at) lines.push('Archive Type: ' + at);
    var vn = document.getElementById('variableName').value.trim().replace(/,\s*$/, '');
    if (vn) lines.push('Variable Name: ' + vn);
    var px = document.getElementById('proxy').value.trim().replace(/,\s*$/, '');
    if (px) lines.push('Proxy: ' + px);
    var cont = document.getElementById('continentIn').value.trim().replace(/,\s*$/, '');
    if (cont) lines.push('Continent: ' + cont);
    var country = document.getElementById('countryIn').value.trim().replace(/,\s*$/, '');
    if (country) lines.push('Country: ' + country);
    var seas = document.getElementById('seasonality1').value.trim().replace(/,\s*$/, '');
    if (seas) lines.push('Seasonality: ' + seas);
    if (typeof filters1 !== 'undefined') {
      if (JSON.parse(filters1['coords'])) {
        lines.push('Lat: ' + document.getElementById('lat_min').value +
          ' to ' + document.getElementById('lat_max').value +
          ', Lon: ' + document.getElementById('lon_min').value +
          ' to ' + document.getElementById('lon_max').value);
      }
      if (JSON.parse(filters1['ages'])) {
        lines.push('Time: ' + document.getElementById('time_range_to_reconstruct_fromInput').value +
          ' \u2013 ' + document.getElementById('time_range_to_reconstruct_toInput').value + ' yr BP');
      }
      if (JSON.parse(filters1['resolution'])) {
        lines.push('Resolution < ' + document.getElementById('resolutionInput').value + ' yr');
      }
      if (filters1['minLength'] && JSON.parse(filters1['minLength'])) {
        lines.push('Min record length ≥ ' + document.getElementById('minLengthInput').value + ' yr');
      }
      if (JSON.parse(filters1['terrestrial'])) {
        lines.push(document.getElementById('Terrestrial').checked ? 'Terrestrial only' : 'Marine only');
      }
      if (JSON.parse(filters1['seasonality'])) {
        lines.push('Months: ' + document.getElementById('months_range_fromInput_text').value +
          ' \u2013 ' + document.getElementById('months_range_toInput_text').value);
      }
    }
    return lines;
  }

  // ── Gather data summary lines ──
  function getSummaryLines() {
    var lines = [];
    var dc = document.getElementById('datasetCount');
    if (dc && dc.innerText.trim()) {
      lines.push(dc.innerText.trim().replace(/\s*\u2014\s*/g, ' \u2014 '));
    }
    if (typeof prevResp !== 'undefined' && Array.isArray(prevResp) && prevResp.length > 0) {
      var counts = {};
      prevResp.forEach(function (d) { counts[d.archiveType || 'Unknown'] = (counts[d.archiveType || 'Unknown'] || 0) + 1; });
      var sorted = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
      lines.push('Archive breakdown: ' + sorted.map(function (k) { return k + ': ' + counts[k]; }).join(', '));
    }
    return lines;
  }

  // ── Read legend from Leaflet legend control DOM ──
  function readLegendFromDOM() {
    var container = document.querySelector('.leaflet-legend.leaflet-legend-expanded');
    if (!container) return { title: '', entries: [] };
    var titleEl = container.querySelector('.leaflet-legend-title');
    var title = titleEl ? titleEl.innerText.trim() : 'Legend';
    var items = container.querySelectorAll('.leaflet-legend-item');
    var entries = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var canvas = item.querySelector('canvas');
      var img = item.querySelector('img');
      var span = item.querySelector('span');
      var label = span ? span.innerText.trim() : '';
      if (canvas) entries.push({ label: label, canvas: canvas });
      else if (img) entries.push({ label: label, img: img });
    }
    return { title: title, entries: entries };
  }

  // ── Draw a shape symbol onto a canvas context ──
  function drawShape(ctx, x, y, size, shape, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    var r = size / 2;
    ctx.beginPath();
    switch (shape) {
      case 'circle':
        ctx.arc(x, y, r, 0, Math.PI * 2); break;
      case 'square':
        ctx.rect(x - r, y - r, size, size); break;
      case 'diamond':
        ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); break;
      case 'triangle': case 'triangle-up':
        ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r); ctx.lineTo(x - r, y + r); ctx.closePath(); break;
      case 'triangle-down':
        ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y - r); ctx.lineTo(x, y + r); ctx.closePath(); break;
      case 'star-5': case 'star':
        for (var ii = 0; ii < 5; ii++) {
          var oa = (ii * 72 - 90) * Math.PI / 180;
          var ia = ((ii * 72) + 36 - 90) * Math.PI / 180;
          if (ii === 0) ctx.moveTo(x + r * Math.cos(oa), y + r * Math.sin(oa));
          else ctx.lineTo(x + r * Math.cos(oa), y + r * Math.sin(oa));
          ctx.lineTo(x + r * 0.4 * Math.cos(ia), y + r * 0.4 * Math.sin(ia));
        }
        ctx.closePath(); break;
      case 'snowflake':
        for (var j = 0; j < 6; j++) {
          var a = j * 60 * Math.PI / 180;
          ctx.moveTo(x, y); ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
        }
        ctx.stroke(); return;
      default:
        ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  }

  // ── Collect tile <img> elements with their pixel positions ──
  function collectTiles(leafletMap) {
    var tilePane = leafletMap.getPane('tilePane');
    if (!tilePane) return [];
    var imgs = tilePane.querySelectorAll('img');
    var containerRect = leafletMap.getContainer().getBoundingClientRect();
    var tiles = [];
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (!img.complete || img.naturalWidth === 0) continue;
      var rect = img.getBoundingClientRect();
      tiles.push({ img: img, x: rect.left - containerRect.left, y: rect.top - containerRect.top, w: rect.width, h: rect.height });
    }
    return tiles;
  }

  // ── Collect markers from layerGroup with pixel positions ──
  function collectMarkers(leafletMap) {
    var markers = [];
    if (!window.layerGroup) return markers;
    window.layerGroup.eachLayer(function (layer) {
      if (layer.eachLayer) {
        layer.eachLayer(function (marker) { addMarker(marker); });
      } else { addMarker(layer); }
    });
    function addMarker(marker) {
      var latlng = marker.getLatLng ? marker.getLatLng() : null;
      if (!latlng) return;
      var pt = leafletMap.latLngToContainerPoint(latlng);
      var props = (marker.feature && marker.feature.properties) ? marker.feature.properties : {};
      var col = chooseColor(props.archiveType || '', props.interp_Vars || '', props.paleoData_proxy || '');
      var shape = chooseShape(props.archiveType || '', props.interp_Vars || '', props.paleoData_proxy || '');
      var radius = (props.archiveType === 'Documents') ? 6 : 4;
      markers.push({ x: pt.x, y: pt.y, color: col, shape: shape, radius: radius });
    }
    return markers;
  }

  // ── Re-fetch a tile image with CORS enabled ──
  function loadCORSImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  // ═══════════════════════════════════════════════════════
  // Selection overlay — pure DOM, no Leaflet layers
  // ═══════════════════════════════════════════════════════

  function getMapContainer() {
    return window.map ? window.map.getContainer() : null;
  }

  function createOverlayDiv(parent, css) {
    var div = document.createElement('div');
    div.style.cssText = 'position:absolute;pointer-events:none;z-index:800;' + (css || '');
    parent.appendChild(div);
    return div;
  }

  function showSelection() {
    removeSelection();
    var container = getMapContainer();
    if (!container) return;

    // Make container position:relative if not already
    var pos = window.getComputedStyle(container).position;
    if (pos === 'static') container.style.position = 'relative';

    var mapW = container.offsetWidth;
    var mapH = container.offsetHeight;

    // Default selection: 80% of the map, centered
    var inset = 0.1;
    sel.x = Math.round(mapW * inset);
    sel.y = Math.round(mapH * inset);
    sel.w = Math.round(mapW * (1 - 2 * inset));
    sel.h = Math.round(mapH * (1 - 2 * inset));
    aspect = sel.w / sel.h;

    // Four dim overlays (top, bottom, left, right)
    var dimCss = 'background:rgba(0,0,0,0.45);';
    for (var i = 0; i < 4; i++) {
      dimEls.push(createOverlayDiv(container, dimCss));
    }

    // Selection border
    selEl = document.createElement('div');
    selEl.style.cssText = 'position:absolute;z-index:801;border:2px dashed #2196F3;box-sizing:border-box;cursor:move;pointer-events:auto;';
    container.appendChild(selEl);

    // Resize handles at all four corners
    var cursors = ['nwse-resize', 'nesw-resize', 'nesw-resize', 'nwse-resize']; // NW, NE, SW, SE
    for (var h = 0; h < 4; h++) {
      var hEl = document.createElement('div');
      hEl.style.cssText = 'position:absolute;z-index:802;width:16px;height:16px;background:#2196F3;border:2px solid #fff;border-radius:2px;pointer-events:auto;box-shadow:0 0 4px rgba(0,0,0,0.4);cursor:' + cursors[h] + ';';
      container.appendChild(hEl);
      handleEls.push(hEl);
    }

    positionOverlay();
    attachDragHandlers(container);
    attachResizeHandlers(container);

    active = true;
  }

  function removeSelection() {
    if (selEl && selEl.parentNode) selEl.parentNode.removeChild(selEl);
    handleEls.forEach(function (h) { if (h.parentNode) h.parentNode.removeChild(h); });
    dimEls.forEach(function (d) { if (d.parentNode) d.parentNode.removeChild(d); });
    selEl = null;
    handleEls = [];
    dimEls = [];
    active = false;
  }

  function positionOverlay() {
    var container = getMapContainer();
    if (!container) return;
    var mapW = container.offsetWidth;
    var mapH = container.offsetHeight;

    // Clamp selection inside map
    sel.x = Math.max(0, Math.min(sel.x, mapW - 20));
    sel.y = Math.max(0, Math.min(sel.y, mapH - 20));
    sel.w = Math.max(20, Math.min(sel.w, mapW - sel.x));
    sel.h = Math.max(20, Math.min(sel.h, mapH - sel.y));

    var r = sel.x + sel.w;
    var b = sel.y + sel.h;

    // Top dim
    dimEls[0].style.top = '0'; dimEls[0].style.left = '0';
    dimEls[0].style.width = mapW + 'px'; dimEls[0].style.height = sel.y + 'px';
    // Bottom dim
    dimEls[1].style.top = b + 'px'; dimEls[1].style.left = '0';
    dimEls[1].style.width = mapW + 'px'; dimEls[1].style.height = (mapH - b) + 'px';
    // Left dim
    dimEls[2].style.top = sel.y + 'px'; dimEls[2].style.left = '0';
    dimEls[2].style.width = sel.x + 'px'; dimEls[2].style.height = sel.h + 'px';
    // Right dim
    dimEls[3].style.top = sel.y + 'px'; dimEls[3].style.left = r + 'px';
    dimEls[3].style.width = (mapW - r) + 'px'; dimEls[3].style.height = sel.h + 'px';

    // Selection border
    selEl.style.left = sel.x + 'px'; selEl.style.top = sel.y + 'px';
    selEl.style.width = sel.w + 'px'; selEl.style.height = sel.h + 'px';

    // Resize handles at four corners (NW, NE, SW, SE)
    if (handleEls.length === 4) {
      handleEls[0].style.left = (sel.x - 8) + 'px';           handleEls[0].style.top = (sel.y - 8) + 'px';
      handleEls[1].style.left = (sel.x + sel.w - 8) + 'px';   handleEls[1].style.top = (sel.y - 8) + 'px';
      handleEls[2].style.left = (sel.x - 8) + 'px';           handleEls[2].style.top = (sel.y + sel.h - 8) + 'px';
      handleEls[3].style.left = (sel.x + sel.w - 8) + 'px';   handleEls[3].style.top = (sel.y + sel.h - 8) + 'px';
    }
  }

  // ── Drag the selection rectangle ──
  function attachDragHandlers(container) {
    var dragging = false, startMX, startMY, startSel;

    selEl.addEventListener('mousedown', function (e) {
      e.preventDefault(); e.stopPropagation();
      dragging = true;
      startMX = e.clientX; startMY = e.clientY;
      startSel = { x: sel.x, y: sel.y };
      if (window.map) window.map.dragging.disable();
    });

    function onMove(e) {
      if (!dragging) return;
      sel.x = startSel.x + (e.clientX - startMX);
      sel.y = startSel.y + (e.clientY - startMY);
      positionOverlay();
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      if (window.map) window.map.dragging.enable();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);

    // Store cleanup refs so we can remove on teardown
    selEl._cleanup = function () {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }

  // ── Resize via corner handles (aspect-ratio locked) ──
  // Each handle anchors the opposite corner and scales from there.
  // handleIdx: 0=NW, 1=NE, 2=SW, 3=SE
  function attachResizeHandlers(container) {
    var cleanups = [];

    handleEls.forEach(function (hEl, idx) {
      var resizing = false, startMX, startMY, startSel;

      hEl.addEventListener('mousedown', function (e) {
        e.preventDefault(); e.stopPropagation();
        resizing = true;
        startMX = e.clientX; startMY = e.clientY;
        startSel = { x: sel.x, y: sel.y, w: sel.w, h: sel.h };
        if (window.map) window.map.dragging.disable();
      });

      function onMove(e) {
        if (!resizing) return;
        var dx = e.clientX - startMX;
        var dy = e.clientY - startMY;

        // Determine which edges move based on corner index
        var moveLeft = (idx === 0 || idx === 2);   // NW or SW
        var moveTop  = (idx === 0 || idx === 1);    // NW or NE

        // Compute new width from the horizontal drag direction
        var newW, newH, newX, newY;
        if (moveLeft) {
          newW = Math.max(40, startSel.w - dx);
        } else {
          newW = Math.max(40, startSel.w + dx);
        }
        // Derive height from aspect ratio
        newH = Math.round(newW / aspect);
        if (newH < 40) { newH = 40; newW = Math.round(newH * aspect); }

        // Anchor the opposite corner
        if (moveLeft) {
          newX = startSel.x + startSel.w - newW;
        } else {
          newX = startSel.x;
        }
        if (moveTop) {
          newY = startSel.y + startSel.h - newH;
        } else {
          newY = startSel.y;
        }

        sel.x = newX; sel.y = newY; sel.w = newW; sel.h = newH;
        positionOverlay();
      }

      function onUp() {
        if (!resizing) return;
        resizing = false;
        if (window.map) window.map.dragging.enable();
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      cleanups.push(function () {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      });
    });

    // Store all cleanups on the first handle for teardown
    handleEls[0]._cleanup = function () { cleanups.forEach(function (fn) { fn(); }); };
  }

  // ── Main export function ──
  function exportPNG(options) {
    var includeQuery = options.includeQuery !== false;
    var includeSummary = options.includeSummary !== false;
    var userTitle = (options.title || '').trim();
    var leafletMap = window.map;

    if (!leafletMap) { alert('Map not ready'); return; }

    if (!active || sel.w < 10 || sel.h < 10) {
      alert('No export area selected. Please open the Export panel first.');
      return;
    }

    var btn = document.getElementById('exportDownloadBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Rendering...'; }

    // Fixed output width; scale the selected region to fit
    var outputMapW = 1200;
    var fitScale = outputMapW / sel.w;
    var mapW = outputMapW;
    var mapH = Math.round(sel.h * fitScale);
    var selX = sel.x;
    var selY = sel.y;
    var selW = sel.w;
    var selH = sel.h;
    var scale = 2;

    var tiles = collectTiles(leafletMap);
    var markers = collectMarkers(leafletMap);
    var legend = readLegendFromDOM();

    var logoPromise = loadCORSImage('/query/img/lipdverse_logo_text.png');
    var tilePromises = tiles.map(function (t) {
      return loadCORSImage(t.img.src).then(function (corsImg) { t.corsImg = corsImg; return t; });
    });
    var legendImgPromises = legend.entries.filter(function (e) { return e.img; }).map(function (e) {
      return loadCORSImage(e.img.src).then(function (corsImg) { e.corsImg = corsImg; });
    });

    Promise.all([logoPromise].concat(tilePromises).concat(legendImgPromises)).then(function (results) {
      var logoImg = results[0];

      // Layout
      var pad = 24;
      var titleH = userTitle ? 52 : 0;

      var n = legend.entries.length;
      var cols = n > 0 ? Math.max(1, Math.min(5, Math.floor(n / 2))) : 5;
      var legEntryH = 24;
      var legRows = Math.ceil(n / cols);
      var legTitleH = legend.entries.length > 0 ? 28 : 0;
      var legBlockH = legend.entries.length > 0 ? legTitleH + legRows * legEntryH + 32 : 0;

      var queryLines = includeQuery ? getQueryLines() : [];
      var summaryLines = includeSummary ? getSummaryLines() : [];
      var textLineH = 24;
      var queryBlockH = queryLines.length > 0 ? (queryLines.length + 1) * textLineH + 16 : 0;
      var summaryBlockH = summaryLines.length > 0 ? (summaryLines.length + 1) * textLineH + 16 : 0;

      var footerH = 28;
      var contentW = mapW + pad * 2;
      var contentH = pad + titleH + mapH + legBlockH + queryBlockH + summaryBlockH + footerH + pad;

      var canvas = document.createElement('canvas');
      canvas.width = contentW * scale;
      canvas.height = contentH * scale;
      var ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, contentW, contentH);

      var y = pad;

      // ── Title ──
      if (userTitle) {
        ctx.fillStyle = '#000';
        ctx.font = 'bold 24px Arial';
        var titleW = ctx.measureText(userTitle).width;
        ctx.fillText(userTitle, pad + (mapW - titleW) / 2, y + 26);
        y += titleH;
      }

      // ── Tiles + Markers (offset so selection maps to canvas) ──
      var mapTop = y;
      ctx.save();
      ctx.beginPath();
      ctx.rect(pad, mapTop, mapW, mapH);
      ctx.clip();

      tiles.forEach(function (t) {
        if (t.corsImg) ctx.drawImage(t.corsImg,
          pad + (t.x - selX) * fitScale,
          mapTop + (t.y - selY) * fitScale,
          t.w * fitScale, t.h * fitScale);
      });

      markers.forEach(function (m) {
        drawShape(ctx,
          pad + (m.x - selX) * fitScale,
          mapTop + (m.y - selY) * fitScale,
          m.radius * 2 * fitScale, m.shape, m.color);
      });

      ctx.restore();
      y += mapH;

      // ── Legend ──
      if (legend.entries.length > 0) {
        y += 8;
        ctx.fillStyle = '#000';
        ctx.font = 'bold 16px Arial';
        var ltW = ctx.measureText(legend.title).width;
        ctx.fillText(legend.title, pad + (mapW - ltW) / 2, y + 18);
        y += legTitleH;

        ctx.font = '14px Arial';
        var maxLabelW = 0;
        legend.entries.forEach(function (entry) {
          var w = ctx.measureText(entry.label).width;
          if (w > maxLabelW) maxLabelW = w;
        });
        var colW = 26 + maxLabelW + 16;
        var gridW = cols * colW;
        var gridX = pad + (mapW - gridW) / 2;
        legend.entries.forEach(function (entry, i) {
          var col = i % cols;
          var row = Math.floor(i / cols);
          var ex = gridX + col * colW;
          var ey = y + row * legEntryH;
          if (entry.canvas) {
            ctx.drawImage(entry.canvas, ex + 4, ey, 18, 18);
          } else if (entry.corsImg) {
            ctx.drawImage(entry.corsImg, ex + 4, ey, 18, 18);
          } else if (entry.img) {
            ctx.drawImage(entry.img, ex + 4, ey, 18, 18);
          }
          ctx.fillStyle = '#333';
          ctx.font = '14px Arial';
          ctx.fillText(entry.label, ex + 26, ey + 13);
        });
        y += legRows * legEntryH + 32;
      }

      // ── Query text ──
      if (queryLines.length > 0) {
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#000';
        ctx.fillText('Query Applied', pad + 4, y + 16);
        y += textLineH;
        ctx.font = '15px Arial';
        ctx.fillStyle = '#333';
        queryLines.forEach(function (line) {
          ctx.fillText(line, pad + 12, y + 16);
          y += textLineH;
        });
        y += 8;
      }

      // ── Summary text ──
      if (summaryLines.length > 0) {
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#000';
        ctx.fillText('Data Summary', pad + 4, y + 16);
        y += textLineH;
        ctx.font = '15px Arial';
        ctx.fillStyle = '#333';
        summaryLines.forEach(function (line) {
          var maxTextW = mapW - 20;
          var words = line.split(', ');
          var chunk = '';
          words.forEach(function (w, wi) {
            var test = chunk + (wi > 0 ? ', ' : '') + w;
            if (ctx.measureText(test).width > maxTextW) {
              ctx.fillText(chunk, pad + 12, y + 16);
              y += textLineH;
              chunk = w;
            } else { chunk = test; }
          });
          if (chunk) { ctx.fillText(chunk, pad + 12, y + 16); y += textLineH; }
        });
      }

      // ── Footer: logo + "Query" left, date right ──
      y += 8;
      var footLogoH = 18;
      if (logoImg) {
        var logoAspect = logoImg.naturalWidth / logoImg.naturalHeight;
        var footLogoW = footLogoH * logoAspect;
        ctx.drawImage(logoImg, pad, y, footLogoW, footLogoH);
        ctx.fillStyle = '#555';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('Query', pad + footLogoW + 5, y + footLogoH - 3);
      }
      var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      var now = new Date();
      var dateStr = 'Date Accessed: ' + now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
      ctx.font = '13px Arial';
      ctx.fillStyle = '#555';
      var dateW = ctx.measureText(dateStr).width;
      ctx.fillText(dateStr, contentW - pad - dateW, y + footLogoH - 3);

      // ── Download ──
      canvas.toBlob(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'lipdverse_query_map.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (btn) { btn.disabled = false; btn.textContent = 'Download PNG'; }
      }, 'image/png');

    }).catch(function (err) {
      console.error('Map export failed:', err);
      alert('Map export failed. See console for details.');
      if (btn) { btn.disabled = false; btn.textContent = 'Download PNG'; }
    });
  }

  // ── Toggle export panel ──
  function togglePanel() {
    var panel = document.getElementById('exportPanel');
    var isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
      showSelection();
    } else {
      // Clean up event listeners before removing DOM elements
      if (selEl && selEl._cleanup) selEl._cleanup();
      if (handleEls.length && handleEls[0]._cleanup) handleEls[0]._cleanup();
      removeSelection();
    }
  }

  return { exportPNG: exportPNG, togglePanel: togglePanel, getQueryLines: getQueryLines, getSummaryLines: getSummaryLines };
})();
