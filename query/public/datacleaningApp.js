/**
 * Data Cleaning Page — Client-side app
 *
 * Flow:
 * 1. Parse URL params (recon, uniqueID, user, domain, language, useGitHubActions)
 * 2. POST /datacleaning/analyze → get { records, duplicateGroups, pcaCoords }
 * 3. Render duplicate groups, PCA scatter, and full records table
 * 4. Track user's keep/remove choices
 * 5. "Skip" → go directly to editor with all TSIDs
 *    "Continue" → POST /datacleaning/confirm → redirect to editor with cleaned set
 */

// =============================================================================
// URL params
// =============================================================================
const urlParams = new URLSearchParams(window.location.search);
const RECON = urlParams.get('recon') || '';
const UNIQUE_ID = urlParams.get('uniqueID') || '';
// Editor destination URL (preserves all original routing params)
const EDITOR_URL = '/editor/querypath' + window.location.search;

// =============================================================================
// State
// =============================================================================
let allRecords = [];          // full list of record metadata objects
let duplicateGroups = [];     // list of duplicate group objects
let pcaCoords = [];           // per-tsid PCA coordinates
let excludedTSIDs = new Set(); // TSIDs the user wants to remove

// Sort state
let sortKey = null;
let sortAsc = true;

// Flagged TSIDs (members of duplicate groups)
let flaggedTSIDs = new Set();

// =============================================================================
// Initialise
// =============================================================================
window.addEventListener('DOMContentLoaded', async () => {
  if (!UNIQUE_ID || !RECON) {
    showError('Missing uniqueID or recon parameter in URL. Please start over from the query page.');
    hideLoading();
    return;
  }

  setLoadingMsg('Downloading lipdverse metadata and running analysis…');

  try {
    const resp = await fetch('/datacleaning/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uniqueID: UNIQUE_ID, recon: RECON })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || 'Analysis request failed');
    }

    const data = await resp.json();
    allRecords = data.records || [];
    duplicateGroups = data.duplicateGroups || [];
    pcaCoords = data.pcaCoords || [];

    // Build flagged set
    flaggedTSIDs = new Set();
    for (const g of duplicateGroups) {
      for (const t of g.records) flaggedTSIDs.add(t);
    }

    renderDuplicates();
    renderPCA();
    renderTable();
    updateFooter();
    startPreloadPolling();

    hideLoading();
  } catch (err) {
    showError('Analysis failed: ' + err.message + '. You can skip data cleaning and proceed to the editor.');
    hideLoading();
    // Still enable skip button
    updateFooter();
  }
});

// =============================================================================
// Loading / error helpers
// =============================================================================
function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.style.display = 'none';
}

function setLoadingMsg(msg) {
  const el = document.getElementById('loading-msg');
  if (el) el.textContent = msg;
}

function showError(msg) {
  const box = document.getElementById('error-box');
  if (box) {
    box.textContent = msg;
    box.style.display = 'block';
  }
}

// =============================================================================
// Panel toggle
// =============================================================================
function togglePanel(id) {
  const body = document.getElementById('body-' + id);
  const chevron = document.getElementById('chevron-' + id);
  if (!body) return;
  const hidden = body.style.display === 'none';
  body.style.display = hidden ? '' : 'none';
  if (chevron) chevron.classList.toggle('open', hidden);
}

// Track which groups have had their details loaded / been saved
const loadedGroups = new Set();
const savedGroups  = new Set();

// =============================================================================
// Preload status polling — marks group headers "ready" as cache populates
// =============================================================================
let _preloadPollTimer = null;

function startPreloadPolling() {
  if (duplicateGroups.length === 0) return;

  // Build a map: tsid → groupId for fast lookup
  const tsidToGroup = {};
  for (const g of duplicateGroups) {
    for (const t of g.records) tsidToGroup[t] = g.groupId;
  }

  // Track which groups are fully ready
  const readyGroups = new Set();
  let pollCount = 0;
  const MAX_POLLS = 90; // ~3 min at 2s interval

  async function poll() {
    pollCount++;
    try {
      const resp = await fetch('/datacleaning/preload-status');
      if (resp.ok) {
        const { readyTsids = [] } = await resp.json();
        const readySet = new Set(readyTsids);

        for (const g of duplicateGroups) {
          if (readyGroups.has(g.groupId)) continue;
          // Group is ready if every record TSid has cached data
          if (g.records.every(t => readySet.has(t))) {
            readyGroups.add(g.groupId);
            markGroupReady(g.groupId);
          }
        }
      }
    } catch (_) { /* silently ignore poll errors */ }

    const allReady = readyGroups.size === duplicateGroups.length;
    if (!allReady && pollCount < MAX_POLLS) {
      _preloadPollTimer = setTimeout(poll, 2000);
    }
  }

  _preloadPollTimer = setTimeout(poll, 1500); // first poll after 1.5s
}

function markGroupReady(groupId) {
  const scoresEl = document.getElementById(`scores-${groupId}`);
  // Only update if the group hasn't been opened yet (no results loaded)
  if (scoresEl && !loadedGroups.has(groupId)) {
    scoresEl.innerHTML = '<span style="color:#3a7a3a;font-size:0.78rem;">● ready</span>';
  }
}

// =============================================================================
// Render: Duplicate Groups
// =============================================================================
function renderDuplicates() {
  const container = document.getElementById('dup-groups-container');
  const countBadge = document.getElementById('dup-count');
  if (!container) return;

  countBadge.textContent = duplicateGroups.length;

  if (duplicateGroups.length === 0) {
    container.innerHTML = '<div class="empty-state">No likely duplicate groups detected in this selection.</div>';
    return;
  }

  container.innerHTML = '';

  for (const group of duplicateGroups) {
    const groupEl = document.createElement('div');
    groupEl.className = 'dup-group';
    groupEl.id = `dup-group-${group.groupId}`;

    let recordsHtml = '';
    group.records.forEach((tsid, idx) => {
      const meta = allRecords.find(r => r.tsid === tsid) || {};

      recordsHtml += `
        <div class="dup-record" id="dup-rec-${group.groupId}-${idx}" data-tsid="${tsid}">
          <div class="record-info">
            <div class="record-name">${meta.dataSetName || tsid}</div>
            <div class="record-meta">
              ${meta.archiveType || ''} · ${meta.variableName || ''}
              ${(meta.lat != null && meta.lon != null) ? ` · ${meta.lat.toFixed(2)}°, ${meta.lon.toFixed(2)}°` : ''}
              ${meta.compilation ? ` · <em>${meta.compilation}</em>` : ''}
            </div>
          </div>
          <div class="keep-remove">
            <label>
              <input type="radio" name="dup-${group.groupId}-${tsid}" value="keep"
                checked
                onchange="onDupRadioChange('${tsid}', 'keep')" />
              Keep
            </label>
            <label>
              <input type="radio" name="dup-${group.groupId}-${tsid}" value="remove"
                onchange="onDupRadioChange('${tsid}', 'remove')" />
              Remove
            </label>
          </div>
        </div>`;
    });

    groupEl.innerHTML = `
      <div class="dup-group-header" id="header-${group.groupId}"
           onclick="toggleGroupDetails(${group.groupId})">
        <span class="expand-icon" id="expand-${group.groupId}">&#9654;</span>
        <strong>Group ${group.groupId + 1}</strong>
        <span class="scores" id="scores-${group.groupId}" style="color:#888;font-size:0.8rem;">click to analyse</span>
        <span style="margin-left:auto;font-size:0.8rem;color:#777;">${group.records.length} records</span>
      </div>
      <div class="dup-group-details" id="details-${group.groupId}" style="display:none">
        <div class="detail-loading" id="detail-loading-${group.groupId}">Loading…</div>
        <div class="pair-selector" id="pair-selector-${group.groupId}" style="display:none"></div>
        <div id="detail-scores-${group.groupId}" style="display:none"></div>
        <div class="series-toggle" id="series-toggle-${group.groupId}" style="display:none"></div>
        <div class="dup-group-plot" id="plot-${group.groupId}" style="display:none"></div>
        <div class="detail-warning" id="detail-warning-${group.groupId}" style="display:none"></div>
      </div>
      <div class="dup-records" id="dup-records-${group.groupId}">
        ${recordsHtml}
        <div class="save-row">
          <button class="btn-save-group" onclick="saveGroup(${group.groupId})">Save</button>
        </div>
      </div>`;

    container.appendChild(groupEl);
  }

  // Sync table highlighting to defaults
  renderTable();
}

function onDupRadioChange(tsid, choice) {
  if (choice === 'remove') {
    excludedTSIDs.add(tsid);
  } else {
    excludedTSIDs.delete(tsid);
  }
  syncTableRow(tsid);
  updateFooter();
}

// =============================================================================
// Render: PCA plot
// =============================================================================
function renderPCA() {
  const el = document.getElementById('pca-plot');
  if (!el || pcaCoords.length === 0) return;

  // Group by archiveType for coloring
  const archiveGroups = {};
  for (const p of pcaCoords) {
    const key = p.archiveType || 'Unknown';
    if (!archiveGroups[key]) archiveGroups[key] = { x: [], y: [], text: [], tsids: [] };
    archiveGroups[key].x.push(p.pc1);
    archiveGroups[key].y.push(p.pc2);
    archiveGroups[key].text.push(
      (allRecords.find(r => r.tsid === p.tsid) || {}).dataSetName || p.tsid
    );
    archiveGroups[key].tsids.push(p.tsid);
  }

  const traces = Object.entries(archiveGroups).map(([archive, pts]) => ({
    type: 'scatter',
    mode: 'markers',
    name: archive,
    x: pts.x,
    y: pts.y,
    text: pts.text,
    customdata: pts.tsids,
    hovertemplate: '<b>%{text}</b><br>PC1: %{x:.2f}<br>PC2: %{y:.2f}<extra></extra>',
    marker: { size: 7, opacity: 0.75 }
  }));

  const layout = {
    xaxis: { title: 'PC1' },
    yaxis: { title: 'PC2' },
    legend: { orientation: 'h', y: -0.15 },
    margin: { l: 50, r: 20, t: 20, b: 60 },
    hovermode: 'closest'
  };

  Plotly.newPlot(el, traces, layout, { responsive: true });

  // Clicking a point scrolls the table row into view
  el.on('plotly_click', function (eventData) {
    const pt = eventData.points[0];
    const tsid = pt.customdata;
    const row = document.getElementById('tr-' + tsid);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.style.outline = '2px solid #2a6496';
      setTimeout(() => { row.style.outline = ''; }, 1500);
    }
  });
}

// =============================================================================
// Render: Records Table
// =============================================================================
function renderTable() {
  const tbody = document.getElementById('table-body');
  const countBadge = document.getElementById('table-count');
  if (!tbody) return;

  countBadge.textContent = allRecords.length;

  let records = [...allRecords];

  if (sortKey) {
    records.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortAsc ? av - bv : bv - av;
      }
      const as = String(av).toLowerCase(), bs = String(bv).toLowerCase();
      return sortAsc ? as.localeCompare(bs) : bs.localeCompare(as);
    });
  }

  tbody.innerHTML = '';
  for (const rec of records) {
    const tsid = rec.tsid || '';
    const excluded = excludedTSIDs.has(tsid);
    const flagged = flaggedTSIDs.has(tsid);

    const tr = document.createElement('tr');
    tr.id = 'tr-' + tsid;
    if (flagged) tr.classList.add('flagged');
    if (excluded) tr.classList.add('removed');

    tr.innerHTML = `
      <td><input type="checkbox" class="row-check" data-tsid="${tsid}"
          ${excluded ? '' : 'checked'}
          onchange="onRowCheck('${tsid}', this.checked)" /></td>
      <td title="${tsid}">${rec.dataSetName || '—'}</td>
      <td>${rec.archiveType || '—'}</td>
      <td>${rec.variableName || '—'}</td>
      <td title="${rec.compilation || ''}">${rec.compilation || '—'}</td>
      <td>${rec.lat != null ? rec.lat.toFixed(2) : '—'}</td>
      <td>${rec.lon != null ? rec.lon.toFixed(2) : '—'}</td>
      <td>${rec.minAge != null ? Math.round(rec.minAge) : '—'}</td>
      <td>${rec.maxAge != null ? Math.round(rec.maxAge) : '—'}</td>
      <td>${rec.resolution != null ? Math.round(rec.resolution) : '—'}</td>`;

    tbody.appendChild(tr);
  }

  // Wire select-all checkbox
  const checkAll = document.getElementById('check-all');
  if (checkAll) {
    checkAll.onchange = function () {
      for (const rec of allRecords) {
        if (this.checked) {
          excludedTSIDs.delete(rec.tsid);
        } else {
          excludedTSIDs.add(rec.tsid);
        }
      }
      renderTable();
      updateFooter();
    };
  }
}

function syncTableRow(tsid) {
  const row = document.getElementById('tr-' + tsid);
  if (!row) return;
  const excluded = excludedTSIDs.has(tsid);
  row.classList.toggle('removed', excluded);
  const cb = row.querySelector('input[type=checkbox]');
  if (cb) cb.checked = !excluded;
}

function onRowCheck(tsid, checked) {
  if (checked) {
    excludedTSIDs.delete(tsid);
  } else {
    excludedTSIDs.add(tsid);
  }

  // Sync duplicate-group radio if applicable
  for (const g of duplicateGroups) {
    if (g.records.includes(tsid)) {
      const radioKeep = document.querySelector(`input[name="dup-${g.groupId}-${tsid}"][value="keep"]`);
      const radioRemove = document.querySelector(`input[name="dup-${g.groupId}-${tsid}"][value="remove"]`);
      if (radioKeep) radioKeep.checked = checked;
      if (radioRemove) radioRemove.checked = !checked;
    }
  }

  syncTableRow(tsid);
  updateFooter();
}

// =============================================================================
// Sort
// =============================================================================
function sortTable(key) {
  if (sortKey === key) {
    sortAsc = !sortAsc;
  } else {
    sortKey = key;
    sortAsc = true;
  }
  renderTable();
}

// =============================================================================
// Footer counter
// =============================================================================
function updateFooter() {
  const keptCount = allRecords.length - excludedTSIDs.size;
  const footerEl = document.getElementById('footer-count');
  const continueCountEl = document.getElementById('continue-count');
  const btnContinue = document.getElementById('btn-continue');

  if (footerEl) {
    footerEl.textContent = `${keptCount} of ${allRecords.length} records selected`;
  }
  if (continueCountEl) {
    continueCountEl.textContent = keptCount;
  }
  if (btnContinue) {
    btnContinue.disabled = keptCount === 0;
  }
}

// =============================================================================
// Skip — navigate to editor with all original TSIDs (no cleaned_TSIDs.json written)
// =============================================================================
function skipCleaning() {
  window.location.href = EDITOR_URL;
}

// =============================================================================
// Confirm — write cleaned selection, then redirect to editor
// =============================================================================
async function confirmCleaning() {
  const keptTSIDs = allRecords
    .map(r => r.tsid)
    .filter(t => !excludedTSIDs.has(t));

  if (keptTSIDs.length === 0) {
    alert('Please keep at least one record.');
    return;
  }

  const btn = document.getElementById('btn-continue');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    const resp = await fetch('/datacleaning/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uniqueID: UNIQUE_ID, recon: RECON, keptTSIDs })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || 'Save failed');
    }

    // Redirect to editor — all original routing params intact
    window.location.href = EDITOR_URL;
  } catch (err) {
    showError('Failed to save selection: ' + err.message);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Continue with <span id="continue-count">' + keptTSIDs.length + '</span> selected records →';
    }
  }
}

// =============================================================================
// Group expand / collapse
// =============================================================================
function toggleGroupDetails(groupId) {
  const details = document.getElementById(`details-${groupId}`);
  const records = document.getElementById(`dup-records-${groupId}`);
  const icon    = document.getElementById(`expand-${groupId}`);
  if (!details) return;

  if (savedGroups.has(groupId)) {
    // Saved groups: toggle both records section and details panel together
    const isCollapsed = records && records.style.display === 'none';
    if (records)  records.style.display  = isCollapsed ? '' : 'none';
    if (details)  details.style.display  = (isCollapsed && loadedGroups.has(groupId)) ? '' : 'none';
    if (icon)     icon.classList.toggle('open', isCollapsed);
    return;
  }

  // Normal (unsaved): toggle just the details panel
  const opening = details.style.display === 'none';
  details.style.display = opening ? '' : 'none';
  if (icon) icon.classList.toggle('open', opening);

  if (opening && !loadedGroups.has(groupId)) {
    // Clear the ready badge — loading indicator takes over
    const scoresEl = document.getElementById(`scores-${groupId}`);
    if (scoresEl) scoresEl.innerHTML = '';
    loadGroupDetails(groupId);
  }
}

// =============================================================================
// Save a group's Keep/Remove selection and collapse it
// =============================================================================
function saveGroup(groupId) {
  savedGroups.add(groupId);

  // Collapse records section and details panel
  const recordsEl = document.getElementById(`dup-records-${groupId}`);
  const detailsEl = document.getElementById(`details-${groupId}`);
  const icon      = document.getElementById(`expand-${groupId}`);
  if (recordsEl) recordsEl.style.display = 'none';
  if (detailsEl) detailsEl.style.display = 'none';
  if (icon)      icon.classList.remove('open');

  // Show saved badge in the group banner (re-show in case loadGroupDetails hid it)
  const scoresEl = document.getElementById(`scores-${groupId}`);
  if (scoresEl) {
    scoresEl.style.display = '';
    scoresEl.innerHTML = '<span style="color:#3a7a3a;font-weight:600;font-size:0.8rem;">✓ Saved</span>';
  }

  // Sync all records in this group to the table (in case any radio was changed
  // without the table having been rendered yet)
  const group = duplicateGroups.find(g => g.groupId === groupId);
  if (group) {
    for (const tsid of group.records) syncTableRow(tsid);
  }
  updateFooter();
}

// =============================================================================
// Per-group state (set when correlation data loads)
// =============================================================================
const groupState = {};
// groupState[groupId] = { pairs, series, selectedPairIdx, seriesFilter }

// =============================================================================
// Metric chip helper (module-level so it can be reused)
// =============================================================================
function chip(label, value, cls = '', title = '') {
  return `<div class="metric-chip"${title ? ` title="${title}"` : ''}>
    <span class="mc-label">${label}</span>
    <span class="mc-value ${cls}">${value}</span>
  </div>`;
}

function shortName(name, max = 20) {
  if (!name) return '—';
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

// Plotly default color sequence — must match trace assignment order
const PLOTLY_COLORS = [
  '#636EFA', '#EF553B', '#00CC96', '#AB63FA', '#FFA15A',
  '#19D3F3', '#FF6692', '#B6E880', '#FF97FF', '#FECB52'
];
function traceColor(idx) { return PLOTLY_COLORS[idx % PLOTLY_COLORS.length]; }

// =============================================================================
// Load correlation + time series for a group (called once on first open)
// =============================================================================
async function loadGroupDetails(groupId) {
  const group = duplicateGroups.find(g => g.groupId === groupId);
  if (!group) return;

  loadedGroups.add(groupId);

  const loadingEl    = document.getElementById(`detail-loading-${groupId}`);
  const warningEl    = document.getElementById(`detail-warning-${groupId}`);
  const plotEl       = document.getElementById(`plot-${groupId}`);
  const headerScores = document.getElementById(`scores-${groupId}`);
  const pairSelEl    = document.getElementById(`pair-selector-${groupId}`);
  const toggleEl     = document.getElementById(`series-toggle-${groupId}`);

  try {
    const resp = await fetch('/datacleaning/correlate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tsids: group.records })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || 'Request failed');
    }

    const data = await resp.json();
    const pairs  = data.pairs  || [];
    const series = data.series || {};

    if (loadingEl)    loadingEl.style.display = 'none';
    if (headerScores) headerScores.style.display = 'none';

    // Assign a stable color to each tsid based on its position in series
    const tsidOrder = Object.keys(series);
    const tsidColors = {};
    tsidOrder.forEach((t, i) => { tsidColors[t] = traceColor(i); });

    // Color the Keep/Remove record names to match the chips and plot traces
    const groupDomEl = document.getElementById(`dup-group-${groupId}`);
    if (groupDomEl) {
      groupDomEl.querySelectorAll('.dup-record').forEach(recEl => {
        const color = tsidColors[recEl.dataset.tsid];
        if (color) {
          const nameEl = recEl.querySelector('.record-name');
          if (nameEl) nameEl.style.color = color;
        }
      });
    }

    const multiRecord = group.records.length > 2;

    // For 2-record groups auto-select both; for 3+ start with nothing selected
    const initSelected = tsidOrder.slice(0, 2);  // always pre-select first two

    groupState[groupId] = {
      pairs,
      series,
      tsidColors,
      selectedTsids: [...initSelected],
      seriesFilter: 'all'
    };

    // ── Record selector (3+ records only) ──
    if (multiRecord && pairSelEl) {
      pairSelEl.innerHTML = buildRecordSelector(groupId, tsidOrder, series, tsidColors);
      pairSelEl.style.display = '';
      // Mark the pre-selected chips
      for (const tsid of initSelected) {
        setChipSelected(groupId, tsid, true, tsidColors[tsid]);
      }
    }

    // ── Series toggle (3+ records only) ──
    if (multiRecord && toggleEl) {
      toggleEl.innerHTML = buildSeriesToggle(groupId);
      toggleEl.style.display = '';
    }

    // ── Metrics ──
    renderGroupMetrics(groupId);

    // ── Plot ──
    const hasSeries = Object.values(series).some(s => s.values && s.values.length > 0);
    if (plotEl) {
      if (hasSeries) {
        renderGroupPlot(groupId, series, tsidColors, plotEl, null);
        plotEl.style.display = '';
      } else {
        plotEl.innerHTML = '<div style="text-align:center;color:#999;padding:32px 0;font-size:0.88rem;">Time series data not available for this group</div>';
        plotEl.style.height = 'auto';
        plotEl.style.display = '';
      }
    }

    if (data.warning && warningEl && !hasSeries) {
      // Clear from loadedGroups so the user can retry
      loadedGroups.delete(groupId);
      warningEl.innerHTML =
        `⚠ ${data.warning} — ` +
        `<a href="#" onclick="retryGroup(${groupId});return false;">try again</a>`;
      warningEl.style.display = '';
    }

    group.correlations = pairs.map(p => ({ tsid1: p.tsid1, tsid2: p.tsid2, pearson: p.pearson, distKm: p.distKm }));
    group.dtwDistances = pairs.map(p => ({ tsid1: p.tsid1, tsid2: p.tsid2, dtw: p.dtw }));

  } catch (err) {
    console.error('Group details error:', err);
    // Remove from loadedGroups so the user can retry by clicking again
    loadedGroups.delete(groupId);
    if (loadingEl) {
      loadingEl.innerHTML =
        `Failed to load: ${err.message} — ` +
        `<a href="#" onclick="retryGroup(${groupId});return false;">try again</a>`;
    }
  }
}

function retryGroup(groupId) {
  const loadingEl = document.getElementById(`detail-loading-${groupId}`);
  if (loadingEl) loadingEl.textContent = 'Loading…';
  loadGroupDetails(groupId);
}

// =============================================================================
// Build individual record selector
// =============================================================================
function buildRecordSelector(groupId, tsidOrder, series, tsidColors) {
  const chips = tsidOrder.map(tsid => {
    const color = tsidColors[tsid];
    const name  = shortName((series[tsid]?.dataSetName) || tsid);
    return `<button class="record-chip" id="record-chip-${groupId}-${CSS.escape(tsid)}"
              style="--chip-color:${color};border-color:${color}"
              onclick="toggleRecordSelection(${groupId}, '${tsid}')"
              title="${series[tsid]?.dataSetName || tsid}">
              <span class="record-dot" style="background:${color}"></span>${name}</button>`;
  }).join('');
  return `<span class="pair-selector-label">Select two:</span>${chips}`;
}

// =============================================================================
// Build series toggle HTML
// =============================================================================
function buildSeriesToggle(groupId) {
  return `<span class="series-toggle-label">Show:</span>
    <button class="toggle-btn active" id="toggle-all-${groupId}"
            onclick="setSeriesFilter(${groupId}, 'all')">All</button>
    <button class="toggle-btn" id="toggle-pair-${groupId}"
            onclick="setSeriesFilter(${groupId}, 'pair')">Selected pair</button>`;
}

// =============================================================================
// User clicks a record chip — toggle selection (max 2; clicking a 3rd
// replaces the first-selected)
// =============================================================================
function toggleRecordSelection(groupId, tsid) {
  const state = groupState[groupId];
  if (!state) return;

  const idx = state.selectedTsids.indexOf(tsid);

  if (idx !== -1) {
    // Deselect
    state.selectedTsids.splice(idx, 1);
    setChipSelected(groupId, tsid, false, state.tsidColors[tsid]);
  } else {
    if (state.selectedTsids.length >= 2) {
      // Replace oldest selection
      const removed = state.selectedTsids.shift();
      setChipSelected(groupId, removed, false, state.tsidColors[removed]);
    }
    state.selectedTsids.push(tsid);
    setChipSelected(groupId, tsid, true, state.tsidColors[tsid]);
  }

  renderGroupMetrics(groupId);

  if (state.seriesFilter === 'pair') {
    const plotEl = document.getElementById(`plot-${groupId}`);
    if (plotEl) {
      renderGroupPlot(groupId, state.series, state.tsidColors, plotEl, state.selectedTsids);
    }
  }
}

function setChipSelected(groupId, tsid, selected, color) {
  const el = document.getElementById(`record-chip-${groupId}-${CSS.escape(tsid)}`);
  if (el) el.classList.toggle('selected', selected);
}

// =============================================================================
// Render metrics for the currently selected pair (or blank if < 2 selected)
// =============================================================================
function renderGroupMetrics(groupId) {
  const state    = groupState[groupId];
  const scoresEl = document.getElementById(`detail-scores-${groupId}`);
  if (!state || !scoresEl) return;

  // Find the pair object for the two selected tsids
  let pair = null;
  if (state.selectedTsids.length === 2) {
    const [t1, t2] = state.selectedTsids;
    pair = state.pairs.find(p =>
      (p.tsid1 === t1 && p.tsid2 === t2) ||
      (p.tsid1 === t2 && p.tsid2 === t1)
    );
  } else if (state.pairs.length === 1) {
    // 2-record group — only one pair, always show it
    pair = state.pairs[0];
  }

  const TIPS = {
    dist: 'Geographic distance between the two proxy sites in kilometres.',
    r:    'Pearson r: linear correlation coefficient. Range: −1 to 1. Values above 0.8 suggest the two records co-vary strongly and may be duplicates. Unlike DTW, Pearson r is sensitive to the exact timing of each data point.',
    dtw:  'DTW (Dynamic Time Warping): shape-similarity score. Range: 0 to 1 (both series are min–max scaled to [0, 1] before comparison, then the total path cost is divided by series length). ' +
          '0 = perfectly identical shapes; 1 = completely opposite. ' +
          'Values below 0.03 indicate near-identical records. ' +
          'A value of 0.1 means the two series differ by ~10 % of their full amplitude on average — moderate similarity. ' +
          'Unlike Pearson r, DTW allows for small age-model offsets, so two records can score well here even if their time axes are slightly misaligned.'
  };

  const na = (label, title) => chip(label, '—', 'na', title);

  if (!pair) {
    const hint = state.selectedTsids.length === 1
      ? '<span style="color:#888;font-size:0.8rem;margin-left:6px;">Select one more record</span>'
      : '<span style="color:#888;font-size:0.8rem;margin-left:6px;">Select two records to compare</span>';
    scoresEl.innerHTML = `<div class="metrics-strip">${na('Distance', TIPS.dist)}${na('Pearson r', TIPS.r)}${na('DTW', TIPS.dtw)}${hint}</div>`;
  } else {
    const distChip = chip('Distance', pair.distKm  != null ? `${pair.distKm} km`     : '—', pair.distKm  == null ? 'na' : '',                              TIPS.dist);
    const rChip    = chip('Pearson r', pair.pearson != null ? pair.pearson.toFixed(3) : '—', pair.pearson == null ? 'na' : pair.pearson > 0.8 ? '' : 'warn', TIPS.r);
    const dtwChip  = chip('DTW',       pair.dtw     != null ? pair.dtw.toFixed(4)     : '—', pair.dtw     == null ? 'na' : pair.dtw < 0.03    ? '' : 'warn', TIPS.dtw);
    scoresEl.innerHTML = `<div class="metrics-strip">${distChip}${rChip}${dtwChip}</div>`;
  }
  scoresEl.style.display = '';
}

// =============================================================================
// User toggles All / Selected pair on the graph
// =============================================================================
function setSeriesFilter(groupId, filter) {
  const state = groupState[groupId];
  if (!state) return;

  state.seriesFilter = filter;

  const allBtn  = document.getElementById(`toggle-all-${groupId}`);
  const pairBtn = document.getElementById(`toggle-pair-${groupId}`);
  if (allBtn)  allBtn.classList.toggle('active',  filter === 'all');
  if (pairBtn) pairBtn.classList.toggle('active', filter === 'pair');

  const plotEl = document.getElementById(`plot-${groupId}`);
  if (!plotEl) return;

  if (filter === 'all') {
    renderGroupPlot(groupId, state.series, state.tsidColors, plotEl, null);
  } else {
    // Show only the selected chips (up to 2); empty selection → show nothing
    const selected = state.selectedTsids.length > 0 ? state.selectedTsids : [];
    renderGroupPlot(groupId, state.series, state.tsidColors, plotEl, selected);
  }
}

// =============================================================================
// Render Plotly time series mini-chart for a duplicate group
// tsidColors: {tsid: color} — must match record-chip colors
// filterTsids: string[] | null — null means show all series
// =============================================================================
function renderGroupPlot(groupId, series, tsidColors, el, filterTsids) {
  // Always iterate in the same stable order so colors stay consistent
  let entries = Object.entries(series);
  if (filterTsids) {
    const keep = new Set(filterTsids);
    entries = entries.filter(([tsid]) => keep.has(tsid));
  }
  if (!entries.length) return;

  const hasTime = entries.some(([, s]) => s.time && s.time.length > 0);

  const traces = entries.map(([tsid, s]) => {
    let x = (hasTime && s.time.length > 0) ? s.time : s.values.map((_, i) => i);
    let y = s.values;
    if (x.length !== y.length) {
      // Time and proxy arrays came from different tables — lengths don't align.
      // Fall back to sequential index so the trace is never zigzag.
      x = y.map((_, i) => i);
    } else if (x.length > 1) {
      // Fast monotonicity check (O(n)) — only sort if actually out of order.
      let outOfOrder = false;
      for (let i = 1; i < x.length; i++) {
        if (x[i] < x[i - 1]) { outOfOrder = true; break; }
      }
      if (outOfOrder) {
        const pairs = x.map((xi, i) => [xi, y[i]]).sort((a, b) => a[0] - b[0]);
        x = pairs.map(p => p[0]);
        y = pairs.map(p => p[1]);
      }
    }
    const baseName  = s.dataSetName || tsid;
    const traceName = s.compilation ? `${baseName} [${s.compilation}]` : baseName;
    return {
      type: 'scatter',
      mode: 'lines',
      name: traceName,
      x,
      y,
      line: { width: 1.5, color: tsidColors[tsid] },
      hovertemplate: `<b>${traceName}</b><br>x: %{x:.1f}<br>y: %{y:.3f}<extra></extra>`
    };
  });

  const layout = {
    margin: { l: 44, r: 10, t: 6, b: 36 },
    xaxis: { title: hasTime ? 'Age / Year' : 'Index', titlefont: { size: 11 } },
    yaxis: { title: entries[0][1].label || 'Value', titlefont: { size: 11 } },
    showlegend: false,
    hovermode: 'x unified',
    font: { size: 10 }
  };

  Plotly.newPlot(el, traces, layout, { responsive: true, displayModeBar: false });
}
