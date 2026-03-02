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
    // Build score summary string
    const corrs = group.correlations || [];
    const dtws = group.dtwDistances || [];
    let scoreText = '';
    if (corrs.length > 0) {
      const validR = corrs.filter(c => c.pearson != null).map(c => c.pearson);
      if (validR.length) scoreText += `r = ${Math.max(...validR).toFixed(2)}`;
    }
    if (dtws.length > 0) {
      const validD = dtws.filter(d => d.dtw != null).map(d => d.dtw);
      if (validD.length) scoreText += (scoreText ? ',  ' : '') + `DTW = ${Math.min(...validD).toFixed(4)}`;
    }
    const distKm = corrs[0]?.distKm != null ? `${corrs[0].distKm} km apart` : '';

    const groupEl = document.createElement('div');
    groupEl.className = 'dup-group';
    groupEl.id = `dup-group-${group.groupId}`;

    let recordsHtml = '';
    group.records.forEach((tsid, idx) => {
      const meta = allRecords.find(r => r.tsid === tsid) || {};
      const isFirst = idx === 0;
      const keepVal = isFirst ? 'keep' : 'remove';
      // Mark others as excluded by default
      if (!isFirst) excludedTSIDs.add(tsid);

      recordsHtml += `
        <div class="dup-record" id="dup-rec-${group.groupId}-${idx}">
          <div class="record-info">
            <div class="record-name">${meta.dataSetName || tsid}</div>
            <div class="record-meta">
              ${meta.archiveType || ''} · ${meta.variableName || ''}
              ${(meta.lat != null && meta.lon != null) ? ` · ${meta.lat.toFixed(2)}°, ${meta.lon.toFixed(2)}°` : ''}
            </div>
          </div>
          <div class="keep-remove">
            <label>
              <input type="radio" name="dup-${group.groupId}-${tsid}" value="keep"
                ${isFirst ? 'checked' : ''}
                onchange="onDupRadioChange('${tsid}', 'keep')" />
              Keep
            </label>
            <label>
              <input type="radio" name="dup-${group.groupId}-${tsid}" value="remove"
                ${!isFirst ? 'checked' : ''}
                onchange="onDupRadioChange('${tsid}', 'remove')" />
              Remove
            </label>
          </div>
        </div>`;
    });

    groupEl.innerHTML = `
      <div class="dup-group-header">
        <strong>Duplicate Group ${group.groupId + 1}</strong>
        <span class="scores">${distKm}${scoreText ? '  |  ' + scoreText : ''}</span>
        <span style="margin-left:auto;font-size:0.8rem;color:#777;">${group.records.length} records</span>
      </div>
      <div class="dup-records">${recordsHtml}</div>`;

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
