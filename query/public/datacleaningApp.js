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

// Free-text notes keyed by groupId
const groupNotes = {};

// =============================================================================
// Initialise
// =============================================================================
// ---------------------------------------------------------------------------
// Compilation metadata (name → {versions, versionDates}) fetched once from
// lipdverse on page load. Used to annotate compilation labels with release
// dates in the ranking dialog and in per-group record details.
// ---------------------------------------------------------------------------
let _compilationMeta = null;

async function loadCompilationMetadata() {
  try {
    const resp = await fetch('/datacleaning/compilation-metadata', { cache: 'force-cache' });
    if (!resp.ok) return;
    _compilationMeta = await resp.json();
  } catch (_) {
    // Non-fatal — labels just fall back to the raw compilation string.
  }
}

// Parse a compilation token like "Temp12k-1_2_0" or "SISAL-LiPD-2_1_1" into
// {name, version}. Version is always trailing numeric underscores.
function parseCompilationToken(token) {
  if (!token) return { name: '', version: '' };
  const m = token.match(/^(.+)-(\d+(?:_\d+)+)$/);
  if (!m) return { name: token, version: '' };
  return { name: m[1], version: m[2] };
}

function getCompilationDate(token) {
  if (!_compilationMeta) return '';
  const { name, version } = parseCompilationToken(token);
  if (!name || !version) return '';
  const entry = _compilationMeta[name];
  if (!entry || !entry.versionDates) return '';
  return entry.versionDates[version] || '';
}

// Format a single "Name-version" token for display, appending the release
// date if we know it.
function formatCompilationToken(token) {
  const { name, version } = parseCompilationToken(token);
  if (!version) return token;
  const date = getCompilationDate(token);
  return date ? `${name} v${version} (${date})` : `${name} v${version}`;
}

// Format a multi-compilation string. Records use both ";" and "," as
// separators depending on the upstream source, so split on either.
function formatCompilationString(compStr) {
  if (!compStr) return '';
  return compStr
    .split(/[;,]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(formatCompilationToken)
    .join('; ');
}

// Compare two version strings like "2_1_4" vs "2_2_0". Returns -1 / 0 / +1.
// Used as the fallback when release dates are missing from compilationMetadata.
function compareVersionStrings(a, b) {
  const pa = String(a || '').split('_').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '').split('_').map(n => parseInt(n, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const da = pa[i] || 0, db = pb[i] || 0;
    if (da !== db) return da < db ? -1 : 1;
  }
  return 0;
}

// Compare two compilation tokens ("Pages2kTemperature-2_1_4" vs "...-2_2_0").
// Prefers release date from compilationMetadata (date strings are ISO so lex
// comparison is correct); falls back to version-number comparison.
// Returns -1 / 0 / +1 (older < newer).
function compareVersionTokens(tokenA, tokenB) {
  const dateA = getCompilationDate(tokenA);
  const dateB = getCompilationDate(tokenB);
  if (dateA && dateB && dateA !== dateB) return dateA < dateB ? -1 : 1;
  const { version: vA } = parseCompilationToken(tokenA);
  const { version: vB } = parseCompilationToken(tokenB);
  return compareVersionStrings(vA, vB);
}

// Default blacklist of variableName values that are metadata / chronology
// statistics / coordinate axes rather than proxy time series measurements.
// Matched case-insensitively. Used to seed `excludedVariableNames` on load;
// the user can toggle any entry via the Variable filter panel.
//
// `thickness` is special: we split it into two synthetic keys
// `thickness:annual` (resolution ≤ 1 yr — varve records, kept by default) and
// `thickness:nonannual` (all other thickness rows — excluded by default).
// These synthetic keys never appear as raw record variableNames; they only
// live in the exclusion set and the filter UI.
const DEFAULT_BLACKLIST_VARIABLE_NAMES = new Set([
  // axes
  'age', 'year', 'depth', 'depthtop', 'depthbottom', 'juliandate', 'duration',
  // uncertainty
  'uncertainty', 'uncertaintyhigh', 'uncertaintylow',
  'uncertainty1s', 'uncertainty2s', 'uncertaintyhigh95', 'uncertaintylow95',
  // tree-ring chronology statistics
  'arstan', 'rbar', 'eps', 'correlationcoefficient',
  'segmentlength', 'samplecount', 'residualchronology', 'correction',
  // metadata / flags
  'sampleid', 'core', 'notes', 'hashiatus', 'hasgap',
  'composite', 'needstobechanged', 'count',
  // derived / dimensionality reduction outputs
  'pc1', 'cca1',
  // varve/sediment thickness — non-annual rows excluded by default;
  // annual rows (thickness:annual) are kept automatically.
  'thickness:nonannual',
  // misc statistics
  'numberofsamples', 'standarddeviation', 'standarderror',
]);

// User-editable. Starts equal to the default blacklist, mutated by the
// Variable filter panel, and consulted by `isValidProxyRecord`.
let excludedVariableNames = new Set(DEFAULT_BLACKLIST_VARIABLE_NAMES);

// Map a record to its filter-key: 'thickness' rows split on resolution, all
// other rows use the lower-cased variableName.
function filterKeyFor(r) {
  const vn = (r && r.variableName || '').toString().trim().toLowerCase();
  if (!vn) return null;
  if (vn === 'thickness') {
    return (Number.isFinite(r.resolution) && r.resolution <= 1)
      ? 'thickness:annual'
      : 'thickness:nonannual';
  }
  return vn;
}

function isValidProxyRecord(r) {
  if (!r) return false;
  if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon)) return false;
  const key = filterKeyFor(r);
  if (!key) return false;
  return !excludedVariableNames.has(key);
}

// Prevent the browser from restoring a previous scroll position when the
// page reloads — the page grows dynamically as records come in, and the
// restored position ends up somewhere in the middle of the plots.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

window.addEventListener('DOMContentLoaded', async () => {
  window.scrollTo(0, 0);
  // Fire-and-forget — compilation date annotations upgrade in place once
  // the metadata arrives; callers fall back to the raw string if not ready.
  loadCompilationMetadata();
  if (!UNIQUE_ID || !RECON) {
    showError('Missing uniqueID or recon parameter in URL. Please start over from the query page.');
    hideLoading();
    return;
  }

  setLoadingMsg('Downloading lipdverse metadata…');

  try {
    await analyzeWithStreaming();
  } catch (err) {
    showError('Analysis failed: ' + err.message + '. You can skip data cleaning and proceed to the editor.');
    hideLoading();
    hideInlineProgress();
    updateFooter();
  }
});

// =============================================================================
// SSE streaming analysis
// =============================================================================
async function analyzeWithStreaming() {
  const url = `/datacleaning/analyze-stream?uniqueID=${encodeURIComponent(UNIQUE_ID)}&recon=${encodeURIComponent(RECON)}`;
  const resp = await fetch(url);

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || 'Analysis request failed');
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events (delimited by double newline)
    const parts = buffer.split('\n\n');
    buffer = parts.pop(); // keep incomplete chunk

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data: ')) continue;
      let event;
      try {
        event = JSON.parse(line.slice(6));
      } catch { continue; }

      handleStreamEvent(event);
    }
  }

  // Process any remaining buffer
  if (buffer.trim().startsWith('data: ')) {
    try {
      handleStreamEvent(JSON.parse(buffer.trim().slice(6)));
    } catch { /* ignore */ }
  }
}

function handleStreamEvent(event) {
  const phase = event.phase;

  if (phase === 'error') {
    throw new Error(event.message || 'Analysis failed');
  }

  if (phase === 'metadata') {
    if (event.status === 'loading') {
      setLoadingMsg('Downloading lipdverse metadata…');
    } else if (event.status === 'done') {
      setLoadingMsg(`Found ${event.recordCount} records. Building analysis…`);
    } else if (event.status === 'error') {
      throw new Error(event.message || 'Failed to load metadata');
    }
  }

  if (phase === 'records' && event.status === 'done') {
    allRecords = event.records || [];
    renderVariableFilter();
    renderTable();
    renderCoverage();
    updateFooter();
    // Hide overlay — page is now interactive
    hideLoading();
    // Show inline progress for remaining phases
    showInlineProgress('Computing PCA and checking for duplicates…', 0);
  }

  if (phase === 'pca' && event.status === 'done') {
    pcaCoords = event.pcaCoords || [];
    renderPCA();
  }

  if (phase === 'duplicates') {
    if (event.status === 'progress') {
      const pct = event.total > 0 ? Math.round((event.checked / event.total) * 100) : 0;
      showInlineProgress(`Checking for duplicates… ${event.checked} of ${event.total} records reviewed (${pct}%)`, pct);
    } else if (event.status === 'done') {
      duplicateGroups = event.duplicateGroups || [];
      flaggedTSIDs = new Set();
      for (const g of duplicateGroups) {
        for (const t of g.records) flaggedTSIDs.add(t);
      }
      renderDuplicates();
      renderTable(); // re-render to highlight flagged rows
      updateFooter();
      startPreloadPolling();
      // Enable "Remove exact duplicates" once we have at least 2-record groups
      const btnRemoveExact = document.getElementById('btn-remove-exact');
      if (btnRemoveExact) {
        btnRemoveExact.disabled = duplicateGroups.length === 0;
      }
    }
  }

  if (phase === 'complete') {
    hideInlineProgress();
    loadAndRestoreProgress();
  }
}

function showInlineProgress(msg, pct) {
  const el = document.getElementById('inline-progress');
  const msgEl = document.getElementById('inline-progress-msg');
  const barEl = document.getElementById('inline-progress-bar');
  if (el) el.style.display = 'block';
  if (msgEl) msgEl.textContent = msg;
  if (barEl) barEl.style.width = pct + '%';
  // Also update the loading overlay progress bar (if still visible)
  const loadBar = document.getElementById('loading-progress');
  const loadBarFill = document.getElementById('loading-progress-bar');
  if (loadBar) loadBar.style.display = 'block';
  if (loadBarFill) loadBarFill.style.width = pct + '%';
}

function hideInlineProgress() {
  const el = document.getElementById('inline-progress');
  if (el) el.style.display = 'none';
}

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

    // Shared metadata — same for every record in the group by construction
    const firstMeta = allRecords.find(r => r.tsid === group.records[0]) || {};
    const sharedParts = [];
    if (firstMeta.archiveType)  sharedParts.push(firstMeta.archiveType);
    if (firstMeta.variableName) sharedParts.push(firstMeta.variableName);
    if (firstMeta.lat != null && firstMeta.lon != null)
      sharedParts.push(`${firstMeta.lat.toFixed(2)}°, ${firstMeta.lon.toFixed(2)}°`);
    const sharedInfo = sharedParts.join(' · ');

    let recordsHtml = '';
    group.records.forEach((tsid, idx) => {
      const meta = allRecords.find(r => r.tsid === tsid) || {};

      recordsHtml += `
        <div class="dup-record" id="dup-rec-${group.groupId}-${idx}" data-tsid="${tsid}">
          <div class="record-info">
            <div class="record-name">${meta.dataSetName || tsid}</div>
            <div class="record-meta"><code style="font-size:0.82em;color:#555;">${tsid}</code></div>
            ${meta.compilation ? `<div class="record-meta"><em>${formatCompilationString(meta.compilation)}</em></div>` : ''}
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
        ${sharedInfo ? `<span class="group-shared-info">${sharedInfo}</span>` : ''}
        <span class="scores" id="scores-${group.groupId}" style="color:#888;font-size:0.8rem;">click to analyse</span>
        <span style="font-size:0.8rem;color:#777;margin-left:auto;">${group.records.length} records</span>
        <button class="btn-expand-group" onclick="openGroupModal(${group.groupId}, event)" title="Expand to full screen">&#x26F6; Expand</button>
      </div>
      <div class="dup-group-details" id="details-${group.groupId}" style="display:none">
        <div class="detail-loading" id="detail-loading-${group.groupId}">Loading…</div>
        <div class="pair-selector" id="pair-selector-${group.groupId}" style="display:none"></div>
        <div id="detail-scores-${group.groupId}" style="display:none"></div>
        <div class="series-toggle" id="series-toggle-${group.groupId}" style="display:none"></div>
        <div class="dup-group-plot" id="plot-${group.groupId}" style="display:none"></div>
        <div class="detail-warning" id="detail-warning-${group.groupId}" style="display:none"></div>
      </div>
      <div class="dup-records" id="dup-records-${group.groupId}" style="display:none">
        ${recordsHtml}
        <div class="group-notes-row">
          <label class="group-notes-label" for="group-notes-${group.groupId}">Notes</label>
          <textarea id="group-notes-${group.groupId}" class="group-notes-textarea" rows="2"
                    placeholder="Add notes about this group…"
                    oninput="updateGroupNotes(${group.groupId}, this.value)">${(groupNotes[group.groupId] || '').replace(/</g, '&lt;')}</textarea>
        </div>
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
  refreshGroupViews(tsid);
}

// Sync the group plot and chip selector when a record's keep/remove state changes.
function refreshGroupViews(tsid) {
  const group = duplicateGroups.find(g => g.records.includes(tsid));
  if (!group) return;
  const groupId = group.groupId;
  const isExcluded = excludedTSIDs.has(tsid);

  // Sync both inline and modal radios so neither view goes stale
  const inlineRemove = document.querySelector(`input[name="dup-${groupId}-${tsid}"][value="remove"]`);
  const inlineKeep   = document.querySelector(`input[name="dup-${groupId}-${tsid}"][value="keep"]`);
  const modalRemove  = document.querySelector(`input[name="modal-dup-${groupId}-${tsid}"][value="remove"]`);
  const modalKeep    = document.querySelector(`input[name="modal-dup-${groupId}-${tsid}"][value="keep"]`);
  if (inlineRemove) inlineRemove.checked = isExcluded;
  if (inlineKeep)   inlineKeep.checked   = !isExcluded;
  if (modalRemove)  modalRemove.checked  = isExcluded;
  if (modalKeep)    modalKeep.checked    = !isExcluded;

  // Dim / restore chips in the pair selector
  const inlineChip = document.getElementById(`record-chip-${groupId}-${CSS.escape(tsid)}`);
  const modalChip  = document.getElementById(`m-chip-${groupId}-${CSS.escape(tsid)}`);
  if (inlineChip) inlineChip.classList.toggle('excluded', isExcluded);
  if (modalChip)  modalChip.classList.toggle('excluded',  isExcluded);

  // Nothing to replot if correlation data hasn't loaded yet
  const state = groupState[groupId];
  if (!state) return;

  // If the tsid was selected for pair comparison, deselect it
  if (isExcluded) {
    const idx = state.selectedTsids.indexOf(tsid);
    if (idx !== -1) {
      state.selectedTsids.splice(idx, 1);
      if (inlineChip) inlineChip.classList.remove('selected');
      if (modalChip)  modalChip.classList.remove('selected');
    }
  }

  // Active (non-excluded) members of this group
  const activeTsids = group.records.filter(t => !excludedTSIDs.has(t));

  // Effective filter: in pair mode, show selected active TSIDs;
  // in all mode, show all active TSIDs (null = no filter only when all are active)
  let filterForPlot;
  if (state.seriesFilter === 'pair') {
    filterForPlot = state.selectedTsids.filter(t => !excludedTSIDs.has(t));
  } else {
    filterForPlot = activeTsids.length < group.records.length ? activeTsids : null;
  }

  const inlinePlotEl = document.getElementById(`plot-${groupId}`);
  if (inlinePlotEl && inlinePlotEl.style.display !== 'none') {
    renderGroupPlot(groupId, state.series, state.tsidColors, inlinePlotEl, filterForPlot);
  }
  if (activeModalGroupId === groupId) {
    const modalPlotEl = document.getElementById(`m-plot-${groupId}`);
    if (modalPlotEl) renderGroupPlot(groupId, state.series, state.tsidColors, modalPlotEl, filterForPlot);
  }
}

// =============================================================================
// Render: PCA plot
// =============================================================================
// =============================================================================
// Render: Temporal Coverage (stacked count of active records by time bin)
// =============================================================================
function renderCoverage() {
  const el = document.getElementById('coverage-plot');
  if (!el || !allRecords.length) return;

  const selector = document.getElementById('coverage-color-by');
  const colorBy = (selector && selector.value) || 'variableName';

  // Only include valid proxy records (see isValidProxyRecord) with a
  // usable age range that the user has NOT excluded.
  const usable = allRecords.filter(r =>
    isValidProxyRecord(r) &&
    !excludedTSIDs.has(r.tsid) &&
    Number.isFinite(r.minAge) && Number.isFinite(r.maxAge) && r.maxAge > r.minAge
  );
  if (usable.length === 0) {
    el.innerHTML = '<p style="padding:20px;color:#888;text-align:center;">No records with valid age ranges.</p>';
    return;
  }

  // Determine the plotted axis range BEFORE binning so the bins are spent
  // on the visible window rather than on long tails driven by one record.
  // Clip both edges by a 5 % percentile: only the youngest 5 % of records
  // extend the recent edge, only the oldest 5 % extend the old edge.
  const minAgesSorted = usable.map(r => r.minAge).sort((a, b) => a - b);
  const maxAgesSorted = usable.map(r => r.maxAge).sort((a, b) => a - b);
  const lowIdx  = Math.min(minAgesSorted.length - 1, Math.floor(0.05 * minAgesSorted.length));
  const highIdx = Math.max(0, Math.ceil(0.95 * maxAgesSorted.length) - 1);
  const xLow  = minAgesSorted[lowIdx];
  const xHigh = maxAgesSorted[highIdx];
  if (!(xHigh > xLow)) return;

  const NBINS = 80;
  const binWidth = (xHigh - xLow) / NBINS;
  const binCenters = Array.from({ length: NBINS }, (_, i) => xLow + (i + 0.5) * binWidth);

  // Tally counts per category per bin across the clipped window. Records
  // whose range extends past either edge still contribute to every bin
  // inside the window.
  const categories = new Map(); // key -> array of length NBINS
  for (const r of usable) {
    if (r.maxAge < xLow || r.minAge > xHigh) continue; // entirely outside
    const key = (r[colorBy] || 'Unknown').toString().trim() || 'Unknown';
    if (!categories.has(key)) categories.set(key, new Array(NBINS).fill(0));
    const counts = categories.get(key);
    const startIdx = Math.max(0, Math.floor((Math.max(r.minAge, xLow) - xLow) / binWidth));
    const endIdx   = Math.min(NBINS - 1, Math.floor((Math.min(r.maxAge, xHigh) - xLow) / binWidth));
    for (let i = startIdx; i <= endIdx; i++) counts[i] += 1;
  }

  // Sort categories by total (largest first) and stash the total on each
  // entry so it can drive both legend order and the hover label.
  const withTotals = [...categories.entries()].map(([name, counts]) => {
    const total = counts.reduce((x, y) => x + y, 0);
    return { name, counts, total };
  });
  withTotals.sort((a, b) => b.total - a.total);

  // Cap the number of legend rows: categories beyond the top 15 get
  // rolled up into a single "Other" stack so both the legend and the
  // unified hover popup stay readable.
  const MAX_CATEGORIES = 15;
  let finalCats = withTotals;
  if (withTotals.length > MAX_CATEGORIES) {
    const top    = withTotals.slice(0, MAX_CATEGORIES - 1);
    const rest   = withTotals.slice(MAX_CATEGORIES - 1);
    const merged = new Array(NBINS).fill(0);
    let mergedTotal = 0;
    for (const r of rest) {
      for (let i = 0; i < NBINS; i++) merged[i] += r.counts[i];
      mergedTotal += r.total;
    }
    finalCats = [
      ...top,
      { name: `Other (${rest.length})`, counts: merged, total: mergedTotal },
    ];
  }

  // Plotly stacks bars bottom-up in trace order, so the first trace sits
  // at the bottom of the stack AND the top of the legend. We want the
  // most-common category at the top of the legend, which matches the
  // natural trace order here.
  const traces = finalCats.map(({ name, counts }) => ({
    type: 'bar',
    name,
    x: binCenters,
    y: counts,
    hovertemplate: `<b>%{fullData.name}</b>: %{y}<extra></extra>`,
  }));

  const layout = {
    barmode: 'stack',
    bargap: 0,
    xaxis: { title: 'Age (yr BP)', autorange: 'reversed' },
    yaxis: { title: 'Proxy records' },
    legend: { orientation: 'h', y: -0.25, traceorder: 'normal' },
    margin: { l: 60, r: 20, t: 20, b: 70 },
    hovermode: 'x unified',
    hoverlabel: {
      font: { size: 11 },
      namelength: -1, // don't truncate long category names
      bgcolor: 'rgba(255,255,255,0.92)',
      bordercolor: '#888',
    },
  };

  Plotly.newPlot(el, traces, layout, { responsive: true, displayModeBar: 'hover' });
}

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

  Plotly.newPlot(el, traces, layout, { responsive: true, displayModeBar: 'hover', scrollZoom: true });

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

  const validOnly = allRecords.filter(isValidProxyRecord);
  const uniqueDatasets = new Set(validOnly.map(r => r.dataSetName).filter(Boolean)).size;
  countBadge.textContent = validOnly.length;
  const datasetNote = document.getElementById('table-dataset-note');
  if (datasetNote) datasetNote.textContent = `${validOnly.length} proxy records from ${uniqueDatasets} datasets`;

  let records = [...validOnly];

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
      for (const rec of allRecords.filter(isValidProxyRecord)) {
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
  // Temporal coverage reflects kept records, so re-render on every
  // selection change.
  renderCoverage();

  // Only valid proxy records count toward the footer and Continue button.
  const validRecords = allRecords.filter(isValidProxyRecord);
  const totalValid   = validRecords.length;
  const keptCount    = validRecords.filter(r => !excludedTSIDs.has(r.tsid)).length;

  const footerEl = document.getElementById('footer-count');
  const continueCountEl = document.getElementById('continue-count');
  const btnContinue = document.getElementById('btn-continue');

  if (footerEl) {
    const uniqueDatasets = new Set(validRecords.map(r => r.dataSetName).filter(Boolean)).size;
    footerEl.textContent = `${keptCount} of ${totalValid} proxy records selected (from ${uniqueDatasets} datasets)`;
  }
  if (continueCountEl) {
    continueCountEl.textContent = keptCount;
  }
  if (btnContinue) {
    btnContinue.disabled = keptCount === 0;
  }

  // Center progress: "X / Y duplicate groups reviewed"
  const reviewTextEl = document.getElementById('review-progress-text');
  const reviewBarEl  = document.getElementById('review-progress-bar');
  const reviewWrap   = document.getElementById('review-progress');
  const totalGroups  = Array.isArray(duplicateGroups) ? duplicateGroups.length : 0;
  const reviewedCount = savedGroups.size;
  if (reviewWrap) {
    reviewWrap.style.display = totalGroups > 0 ? 'flex' : 'none';
  }
  if (reviewTextEl) {
    const label = totalGroups === 1 ? 'duplicate group reviewed' : 'duplicate groups reviewed';
    reviewTextEl.textContent = `${reviewedCount} / ${totalGroups} ${label}`;
  }
  if (reviewBarEl) {
    const pct = totalGroups > 0 ? Math.round((reviewedCount / totalGroups) * 100) : 0;
    reviewBarEl.style.width = pct + '%';
  }
}

// =============================================================================
// Skip — navigate to editor with all original TSIDs (no cleaned_TSIDs.json written)
// =============================================================================
function skipCleaning() {
  const nextPage = (RECON === 'lipdDownload') ? '/lipd-download/confirm' : '/editor/querypath';
  window.location.href = nextPage + window.location.search;
}

// =============================================================================
// Save progress — persists state server-side then opens share dialog
// =============================================================================
async function saveProgress() {
  const btn    = document.getElementById('btn-save-progress');
  const status = document.getElementById('save-progress-status');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  if (status) status.textContent = '';

  try {
    const resp = await fetch('/datacleaning/save-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uniqueID:      UNIQUE_ID,
        recon:         RECON,
        urlParams:     window.location.search,
        excludedTSIDs: [...excludedTSIDs],
        excludedVariableNames: [...excludedVariableNames],
        groupNotes,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || 'Save failed');
    }

    if (btn) { btn.disabled = false; btn.textContent = 'Save progress'; }
    openSaveDialog();
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Save progress'; }
    if (status) {
      status.style.color = '#c00';
      status.textContent = 'Save failed — ' + err.message;
      setTimeout(() => { if (status) { status.textContent = ''; status.style.color = ''; } }, 6000);
    }
  }
}

function openSaveDialog() {
  const overlay = document.getElementById('save-dialog-overlay');
  if (!overlay) return;
  const resumeUrl = window.location.origin + '/datacleaning' + window.location.search;
  const urlInput = document.getElementById('save-dialog-url');
  if (urlInput) urlInput.value = resumeUrl;
  const copyMsg  = document.getElementById('save-dialog-copy-msg');
  const emailMsg = document.getElementById('save-dialog-email-msg');
  const sendBtn  = document.getElementById('save-dialog-send-btn');
  if (copyMsg)  copyMsg.textContent  = '';
  if (emailMsg) emailMsg.textContent = '';
  if (sendBtn)  { sendBtn.disabled = false; sendBtn.textContent = 'Send'; }
  overlay.style.display = 'flex';
}

function closeSaveDialog() {
  const overlay = document.getElementById('save-dialog-overlay');
  if (overlay) overlay.style.display = 'none';
}

async function copyProgressLink() {
  const urlInput = document.getElementById('save-dialog-url');
  const copyMsg  = document.getElementById('save-dialog-copy-msg');
  if (!urlInput) return;
  try {
    await navigator.clipboard.writeText(urlInput.value);
    if (copyMsg) {
      copyMsg.style.color = '#3a7a3a';
      copyMsg.textContent = '✓ Link copied to clipboard';
      setTimeout(() => { if (copyMsg) copyMsg.textContent = ''; }, 4000);
    }
  } catch {
    // Fallback: select the text so user can copy manually
    urlInput.select();
    if (copyMsg) {
      copyMsg.style.color = '#555';
      copyMsg.textContent = 'Press Ctrl+C to copy';
    }
  }
}

async function emailProgressLink() {
  const emailInput = document.getElementById('save-dialog-email');
  const emailMsg   = document.getElementById('save-dialog-email-msg');
  const sendBtn    = document.getElementById('save-dialog-send-btn');
  const urlInput   = document.getElementById('save-dialog-url');
  if (!emailInput) return;

  const email = emailInput.value.trim();
  if (!email || !email.includes('@')) {
    if (emailMsg) { emailMsg.style.color = '#c00'; emailMsg.textContent = 'Please enter a valid email address.'; }
    return;
  }

  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Sending…'; }
  if (emailMsg) emailMsg.textContent = '';

  try {
    const resp = await fetch('/datacleaning/email-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uniqueID: UNIQUE_ID,
        recon:    RECON,
        email,
        resumeUrl: urlInput ? urlInput.value : '',
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || 'Send failed');
    }
    if (emailMsg) { emailMsg.style.color = '#3a7a3a'; emailMsg.textContent = `✓ Link sent to ${email}`; }
    if (sendBtn)  { sendBtn.disabled = false; sendBtn.textContent = 'Send'; }
  } catch (err) {
    if (emailMsg) { emailMsg.style.color = '#c00'; emailMsg.textContent = 'Send failed — ' + err.message; }
    if (sendBtn)  { sendBtn.disabled = false; sendBtn.textContent = 'Send'; }
  }
}

// =============================================================================
// Restore progress — called on page load after the DOM is rendered
// =============================================================================
async function loadAndRestoreProgress() {
  try {
    const resp = await fetch(`/datacleaning/progress?uniqueID=${encodeURIComponent(UNIQUE_ID)}&recon=${encodeURIComponent(RECON)}`);
    if (!resp.ok) return;
    const progress = await resp.json();
    if (!progress) return;

    // Restore excluded TSIDs
    if (Array.isArray(progress.excludedTSIDs)) {
      for (const t of progress.excludedTSIDs) excludedTSIDs.add(t);
    }

    // Restore variable-name exclusions (replaces the default blacklist when
    // present). Legacy progress files without this key keep the default.
    // A bare 'thickness' key from an older session is translated to
    // 'thickness:nonannual' (the new default) + 'thickness:annual' so the old
    // behaviour of excluding all thickness rows is preserved.
    if (Array.isArray(progress.excludedVariableNames)) {
      const restored = new Set();
      for (const raw of progress.excludedVariableNames) {
        const k = String(raw).toLowerCase();
        if (k === 'thickness') {
          restored.add('thickness:annual');
          restored.add('thickness:nonannual');
        } else {
          restored.add(k);
        }
      }
      excludedVariableNames = restored;
    }

    // Restore notes
    if (progress.groupNotes && typeof progress.groupNotes === 'object') {
      Object.assign(groupNotes, progress.groupNotes);
    }

    // Sync radio buttons in the rendered DOM
    for (const group of duplicateGroups) {
      for (const tsid of group.records) {
        const isExcluded  = excludedTSIDs.has(tsid);
        const removeRadio = document.querySelector(`input[name="dup-${group.groupId}-${tsid}"][value="remove"]`);
        const keepRadio   = document.querySelector(`input[name="dup-${group.groupId}-${tsid}"][value="keep"]`);
        if (removeRadio) removeRadio.checked = isExcluded;
        if (keepRadio)   keepRadio.checked   = !isExcluded;
      }
    }

    // Sync notes textareas
    for (const [gid, text] of Object.entries(groupNotes)) {
      const el = document.getElementById(`group-notes-${gid}`);
      if (el) el.value = text;
    }

    updateFooter();

    // Show restoration banner
    const banner = document.getElementById('restore-banner');
    if (banner && progress.savedAt) {
      const date = new Date(progress.savedAt).toLocaleString();
      banner.textContent = `Progress restored from ${date}. Your Keep / Remove selections and notes have been reloaded.`;
      banner.style.display = 'block';
      setTimeout(() => { banner.style.display = 'none'; }, 12000);
    }
  } catch {
    // Non-fatal — fresh session if restore fails
  }
}

// =============================================================================
// Confirm — write cleaned selection, then redirect to editor
// =============================================================================
async function confirmCleaning() {
  // Only submit valid proxy records — non-proxy rows (missing lat/lon or
  // variableName) should never make it into the editor payload.
  const keptTSIDs = allRecords
    .filter(r => isValidProxyRecord(r) && !excludedTSIDs.has(r.tsid))
    .map(r => r.tsid);

  if (keptTSIDs.length === 0) {
    alert('Please keep at least one record.');
    return;
  }

  // Variable-filter-excluded TSIDs: records that have valid lat/lon and
  // variableName but were dropped purely by the variable filter (distinct
  // from the per-record Keep/Remove decisions in excludedTSIDs). These need
  // to be merged into the downstream excluded list AND reported in the
  // variable_filter.yaml that ships with the reconstruction repo.
  const variableFilterExcluded = []; // { tsid, variableName, filterKey }
  for (const r of allRecords) {
    if (!r || !r.tsid) continue;
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon)) continue;
    const key = filterKeyFor(r);
    if (!key) continue;
    if (excludedVariableNames.has(key)) {
      variableFilterExcluded.push({
        tsid: r.tsid,
        variableName: (r.variableName || '').toString().trim(),
        filterKey: key,
      });
    }
  }

  // Included variable filter keys (those present in data that are NOT excluded).
  // Useful context in the YAML so downstream code can see the full decision.
  const seenKeys = new Set();
  for (const r of allRecords) {
    const k = filterKeyFor(r);
    if (k) seenKeys.add(k);
  }
  const includedVariableKeys = [...seenKeys].filter(k => !excludedVariableNames.has(k));

  // Build per-group cleaning decisions
  const cleaningGroups = duplicateGroups.map(g => {
    const records = g.records.map(tsid => {
      const meta = allRecords.find(r => r.tsid === tsid) || {};
      return {
        tsid,
        dataSetName: meta.dataSetName || null,
        decision: excludedTSIDs.has(tsid) ? 'remove' : 'keep'
      };
    });
    return {
      groupId: g.groupId,
      records,
      notes: (groupNotes[g.groupId] || '').trim() || null
    };
  });

  const btn = document.getElementById('btn-continue');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    const resp = await fetch('/datacleaning/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uniqueID: UNIQUE_ID,
        recon: RECON,
        keptTSIDs,
        removedTSIDs: [...excludedTSIDs],
        groupNotes,
        cleaningGroups,
        variableFilterExcluded,
        excludedVariableKeys: [...excludedVariableNames],
        includedVariableKeys,
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || 'Save failed');
    }

    // Redirect to next page — lipdDownload goes to confirmation page; all others go to editor
    const nextPage = (RECON === 'lipdDownload') ? '/lipd-download/confirm' : '/editor/querypath';
    window.location.href = nextPage + window.location.search;
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

  // Normal (unsaved): toggle records section and details panel together
  const opening = records && records.style.display === 'none';
  if (records) records.style.display = opening ? '' : 'none';
  if (opening && loadedGroups.has(groupId)) {
    details.style.display = '';
  } else if (!opening) {
    details.style.display = 'none';
  }
  if (icon) icon.classList.toggle('open', opening);

  if (opening && !loadedGroups.has(groupId)) {
    // Clear the ready badge — loading indicator takes over
    const scoresEl = document.getElementById(`scores-${groupId}`);
    if (scoresEl) scoresEl.innerHTML = '';
    loadGroupDetails(groupId);
    details.style.display = '';
  }
}

// =============================================================================
// Save a group's Keep/Remove selection and collapse it
// =============================================================================
// Keep groupNotes in sync between the inline textarea and the modal textarea.
function updateGroupNotes(groupId, text) {
  groupNotes[groupId] = text;
  const inlineEl = document.getElementById(`group-notes-${groupId}`);
  const modalEl  = document.getElementById(`m-notes-${groupId}`);
  if (inlineEl && inlineEl !== document.activeElement) inlineEl.value = text;
  if (modalEl  && modalEl  !== document.activeElement) modalEl.value  = text;
}

function saveGroup(groupId) {
  savedGroups.add(groupId);

  // Dim the group card to indicate completion
  const groupEl = document.getElementById(`dup-group-${groupId}`);
  if (groupEl) groupEl.classList.add('saved');

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
    const commonTimeUnit = data.commonTimeUnit || null;

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
      seriesFilter: 'all',
      commonTimeUnit
    };

    // ── Record selector (3+ records only) ──
    if (multiRecord && pairSelEl) {
      pairSelEl.innerHTML = buildRecordSelector(groupId, tsidOrder, series, tsidColors);
      pairSelEl.style.display = '';
      // Mark the pre-selected chips
      for (const tsid of initSelected) {
        setChipSelected(groupId, tsid, true, tsidColors[tsid]);
      }
      // Dim chips for records already excluded before correlation loaded
      for (const tsid of tsidOrder) {
        if (excludedTSIDs.has(tsid)) {
          const chip = document.getElementById(`record-chip-${groupId}-${CSS.escape(tsid)}`);
          if (chip) chip.classList.add('excluded');
        }
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
        const group = duplicateGroups.find(g => g.groupId === groupId);
        const activeTsids = group ? group.records.filter(t => !excludedTSIDs.has(t)) : null;
        const initFilter = (activeTsids && activeTsids.length < tsidOrder.length) ? activeTsids : null;
        renderGroupPlot(groupId, series, tsidColors, plotEl, initFilter);
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

  // Selecting a chip auto-switches to "Selected pair" view; deselecting keeps current filter.
  if (idx === -1) {
    setSeriesFilter(groupId, 'pair');
  } else if (state.seriesFilter === 'pair') {
    const plotEl = document.getElementById(`plot-${groupId}`);
    if (plotEl) renderGroupPlot(groupId, state.series, state.tsidColors, plotEl, state.selectedTsids);
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
    // Show all non-excluded series
    const group = duplicateGroups.find(g => g.groupId === groupId);
    const activeTsids = group ? group.records.filter(t => !excludedTSIDs.has(t)) : null;
    renderGroupPlot(groupId, state.series, state.tsidColors, plotEl, activeTsids);
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
  const state = groupState[groupId] || {};
  const commonTimeUnit = state.commonTimeUnit || null;
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

  // Detect overlapping traces and widen lower ones so they remain visible.
  // Plotly renders traces in array order (first = bottom, last = top), so a
  // trace at rank 0 is fully hidden when an identical trace sits on top of it.
  // Width formula: top trace keeps base width 1.5 px; each layer beneath adds
  // another 1.5 px (2 overlapping → 3 + 1.5, 3 overlapping → 4.5 + 3 + 1.5, …).
  const sigMap = new Map();
  traces.forEach((trace, i) => {
    const sig = JSON.stringify([trace.x, trace.y]);
    if (!sigMap.has(sig)) sigMap.set(sig, []);
    sigMap.get(sig).push(i);
  });
  sigMap.forEach(indices => {
    if (indices.length < 2) return;
    const n = indices.length;
    indices.forEach((traceIdx, rank) => {
      // rank 0 = bottom-most; rank n-1 = top (visible) trace
      traces[traceIdx].line.width = 1.5 * (n - rank);
    });
  });

  const layout = {
    margin: { l: 44, r: 10, t: 6, b: 36 },
    xaxis: {
      title: hasTime ? (commonTimeUnit ? `Time (${commonTimeUnit})` : 'Age / Year') : 'Index',
      titlefont: { size: 11 }
    },
    yaxis: { title: entries[0][1].label || 'Value', titlefont: { size: 11 } },
    showlegend: false,
    hovermode: 'x unified',
    font: { size: 10 }
  };

  Plotly.newPlot(el, traces, layout, { responsive: true, displayModeBar: 'hover', scrollZoom: true });
}

// =============================================================================
// Expand modal — opens a full-screen view of a duplicate group
// =============================================================================
let activeModalGroupId = null;

function openGroupModal(groupId, event) {
  if (event) event.stopPropagation();
  activeModalGroupId = groupId;

  const group = duplicateGroups.find(g => g.groupId === groupId);
  if (!group) return;

  const overlay = document.getElementById('group-modal-overlay');
  const title   = document.getElementById('group-modal-title');
  const left    = document.getElementById('group-modal-left');

  // Shared metadata for modal title
  const firstMetaM = allRecords.find(r => r.tsid === group.records[0]) || {};
  const sharedPartsM = [];
  if (firstMetaM.archiveType)  sharedPartsM.push(firstMetaM.archiveType);
  if (firstMetaM.variableName) sharedPartsM.push(firstMetaM.variableName);
  if (firstMetaM.lat != null && firstMetaM.lon != null)
    sharedPartsM.push(`${firstMetaM.lat.toFixed(2)}°, ${firstMetaM.lon.toFixed(2)}°`);

  title.textContent = `Group ${groupId + 1} — ${group.records.length} records`;
  const subtitleEl = document.getElementById('group-modal-subtitle');
  if (subtitleEl) subtitleEl.textContent = sharedPartsM.join(' · ');

  // --- Left panel: Keep / Remove record cards ---
  const state      = groupState[groupId];
  const tsidColors = state ? state.tsidColors : {};
  let recordsHtml  = '';

  group.records.forEach(tsid => {
    const meta     = allRecords.find(r => r.tsid === tsid) || {};
    const color    = tsidColors[tsid] || '';
    const excluded = excludedTSIDs.has(tsid);
    recordsHtml += `
      <div class="dup-record" data-tsid="${tsid}">
        <div class="record-info">
          <div class="record-name"${color ? ` style="color:${color}"` : ''}>${meta.dataSetName || tsid}</div>
          <div class="record-meta"><code style="font-size:0.82em;color:#555;">${tsid}</code></div>
          ${meta.compilation ? `<div class="record-meta"><em>${formatCompilationString(meta.compilation)}</em></div>` : ''}
        </div>
        <div class="keep-remove">
          <label>
            <input type="radio" name="modal-dup-${groupId}-${tsid}" value="keep"
              ${excluded ? '' : 'checked'}
              onchange="onDupRadioChange('${tsid}', 'keep')" />
            Keep
          </label>
          <label>
            <input type="radio" name="modal-dup-${groupId}-${tsid}" value="remove"
              ${excluded ? 'checked' : ''}
              onchange="onDupRadioChange('${tsid}', 'remove')" />
            Remove
          </label>
        </div>
      </div>`;
  });
  recordsHtml += `
    <div class="group-notes-row">
      <label class="group-notes-label" for="m-notes-${groupId}">Notes</label>
      <textarea id="m-notes-${groupId}" class="group-notes-textarea" rows="3"
                placeholder="Add notes about this group…"
                oninput="updateGroupNotes(${groupId}, this.value)">${(groupNotes[groupId] || '').replace(/</g, '&lt;')}</textarea>
    </div>
    <div class="save-row">
      <button class="btn-save-group" onclick="saveGroup(${groupId});closeGroupModal()">Save &amp; Close</button>
    </div>`;
  left.innerHTML = recordsHtml;

  // --- Right panel: analysis ---
  renderModalAnalysis(groupId);

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeGroupModal() {
  const overlay = document.getElementById('group-modal-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';

  if (activeModalGroupId !== null) {
    // Sync table rows after any modal Keep/Remove changes
    const group = duplicateGroups.find(g => g.groupId === activeModalGroupId);
    if (group) {
      for (const tsid of group.records) syncTableRow(tsid);
    }
    // Re-colour inline record names to match loaded state
    const state = groupState[activeModalGroupId];
    if (state) {
      const groupEl = document.getElementById(`dup-group-${activeModalGroupId}`);
      if (groupEl) {
        groupEl.querySelectorAll('.dup-record').forEach(recEl => {
          const color = state.tsidColors[recEl.dataset.tsid];
          if (color) {
            const nameEl = recEl.querySelector('.record-name');
            if (nameEl) nameEl.style.color = color;
          }
        });
      }
    }
    updateFooter();
  }
  activeModalGroupId = null;
}

// Renders the right-panel analysis (chips, toggle, metrics, plot) into modal
function renderModalAnalysis(groupId) {
  const right = document.getElementById('group-modal-right');
  if (!right) return;

  const state = groupState[groupId];
  if (!state) {
    // Trigger load — show spinner while waiting
    right.innerHTML = `<div class="detail-loading" style="padding:20px">Loading correlation data…</div>`;
    if (!loadedGroups.has(groupId)) loadGroupDetailsModal(groupId);
    return;
  }

  const { pairs, series, tsidColors, selectedTsids, seriesFilter } = state;
  const tsidOrder   = Object.keys(series);
  const multiRecord = tsidOrder.length > 2;
  const hasSeries   = Object.values(series).some(s => s.values && s.values.length > 0);

  let html = '';

  if (multiRecord) {
    const chips = tsidOrder.map(tsid => {
      const color = tsidColors[tsid];
      const name  = shortName((series[tsid]?.dataSetName) || tsid);
      return `<button class="record-chip" id="m-chip-${groupId}-${CSS.escape(tsid)}"
                style="--chip-color:${color};border-color:${color}"
                onclick="toggleModalChip(${groupId}, '${tsid}')"
                title="${series[tsid]?.dataSetName || tsid}">
                <span class="record-dot" style="background:${color}"></span>${name}</button>`;
    }).join('');
    html += `<div class="pair-selector"><span class="pair-selector-label">Select two:</span>${chips}</div>`;
    html += `<div class="series-toggle">
      <span class="series-toggle-label">Show:</span>
      <button class="toggle-btn${seriesFilter === 'all'  ? ' active' : ''}" id="m-toggle-all-${groupId}"
              onclick="setModalSeriesFilter(${groupId}, 'all')">All</button>
      <button class="toggle-btn${seriesFilter === 'pair' ? ' active' : ''}" id="m-toggle-pair-${groupId}"
              onclick="setModalSeriesFilter(${groupId}, 'pair')">Selected pair</button>
    </div>`;
  }

  html += `<div id="m-scores-${groupId}" style="flex-shrink:0"></div>`;
  html += `<div id="m-plot-${groupId}" style="flex:1;min-height:0"></div>`;

  right.innerHTML = html;

  // Apply chip selected state
  if (multiRecord) {
    for (const tsid of selectedTsids) {
      const chipEl = document.getElementById(`m-chip-${groupId}-${CSS.escape(tsid)}`);
      if (chipEl) chipEl.classList.add('selected');
    }
  }

  // Metrics
  renderModalMetrics(groupId);

  // Plot
  if (hasSeries) {
    const plotEl = document.getElementById(`m-plot-${groupId}`);
    if (plotEl) {
      let filterForPlot;
      if (seriesFilter === 'pair' && selectedTsids.length > 0) {
        filterForPlot = selectedTsids;
      } else {
        const group = duplicateGroups.find(g => g.groupId === groupId);
        const activeTsids = group ? group.records.filter(t => !excludedTSIDs.has(t)) : null;
        filterForPlot = activeTsids;
      }
      renderGroupPlot(groupId, series, tsidColors, plotEl, filterForPlot);
    }
  } else {
    const plotEl = document.getElementById(`m-plot-${groupId}`);
    if (plotEl) {
      plotEl.innerHTML = '<div style="text-align:center;color:#999;padding:48px 0;font-size:0.88rem;">Time series data not available for this group</div>';
    }
  }
}

function renderModalMetrics(groupId) {
  const scoresEl = document.getElementById(`m-scores-${groupId}`);
  if (!scoresEl) return;

  const state = groupState[groupId];
  if (!state) return;

  let pair = null;
  if (state.selectedTsids.length === 2) {
    const [t1, t2] = state.selectedTsids;
    pair = state.pairs.find(p =>
      (p.tsid1 === t1 && p.tsid2 === t2) || (p.tsid1 === t2 && p.tsid2 === t1)
    );
  } else if (state.pairs.length === 1) {
    pair = state.pairs[0];
  }

  const TIPS = {
    dist: 'Geographic distance between the two proxy sites in kilometres.',
    r:    'Pearson r: linear correlation coefficient. Values above 0.8 suggest the records may be duplicates.',
    dtw:  'DTW (Dynamic Time Warping): shape-similarity. 0 = identical; 1 = opposite. Values below 0.03 indicate near-identical records.'
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
}

function toggleModalChip(groupId, tsid) {
  const state = groupState[groupId];
  if (!state) return;

  const idx = state.selectedTsids.indexOf(tsid);
  if (idx !== -1) {
    state.selectedTsids.splice(idx, 1);
    const el = document.getElementById(`m-chip-${groupId}-${CSS.escape(tsid)}`);
    if (el) el.classList.remove('selected');
  } else {
    if (state.selectedTsids.length >= 2) {
      const removed = state.selectedTsids.shift();
      const oldEl = document.getElementById(`m-chip-${groupId}-${CSS.escape(removed)}`);
      if (oldEl) oldEl.classList.remove('selected');
    }
    state.selectedTsids.push(tsid);
    const el = document.getElementById(`m-chip-${groupId}-${CSS.escape(tsid)}`);
    if (el) el.classList.add('selected');
  }

  renderModalMetrics(groupId);

  // Selecting a chip auto-switches to "Selected pair" view; deselecting keeps current filter.
  if (idx === -1) {
    setModalSeriesFilter(groupId, 'pair');
  } else if (state.seriesFilter === 'pair') {
    const plotEl = document.getElementById(`m-plot-${groupId}`);
    if (plotEl) renderGroupPlot(groupId, state.series, state.tsidColors, plotEl, state.selectedTsids);
  }
}

function setModalSeriesFilter(groupId, filter) {
  const state = groupState[groupId];
  if (!state) return;
  state.seriesFilter = filter;

  const allBtn  = document.getElementById(`m-toggle-all-${groupId}`);
  const pairBtn = document.getElementById(`m-toggle-pair-${groupId}`);
  if (allBtn)  allBtn.classList.toggle('active',  filter === 'all');
  if (pairBtn) pairBtn.classList.toggle('active', filter === 'pair');

  const plotEl = document.getElementById(`m-plot-${groupId}`);
  if (!plotEl) return;

  let filterTsids;
  if (filter === 'pair' && state.selectedTsids.length > 0) {
    filterTsids = state.selectedTsids;
  } else {
    const group = duplicateGroups.find(g => g.groupId === groupId);
    filterTsids = group ? group.records.filter(t => !excludedTSIDs.has(t)) : null;
  }
  renderGroupPlot(groupId, state.series, state.tsidColors, plotEl, filterTsids);
}

// Load correlation data triggered from the modal (same logic as loadGroupDetails but
// renders into modal on completion rather than inline elements)
async function loadGroupDetailsModal(groupId) {
  const group = duplicateGroups.find(g => g.groupId === groupId);
  if (!group) return;
  loadedGroups.add(groupId);

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
    const pairs    = data.pairs  || [];
    const series   = data.series || {};
    const commonTimeUnit = data.commonTimeUnit || null;
    const tsidOrder = Object.keys(series);
    const tsidColors = {};
    tsidOrder.forEach((t, i) => { tsidColors[t] = traceColor(i); });

    const initSelected = tsidOrder.slice(0, 2);
    groupState[groupId] = {
      pairs,
      series,
      tsidColors,
      selectedTsids: [...initSelected],
      seriesFilter: 'all',
      commonTimeUnit
    };

    group.correlations = pairs.map(p => ({ tsid1: p.tsid1, tsid2: p.tsid2, pearson: p.pearson, distKm: p.distKm }));
    group.dtwDistances = pairs.map(p => ({ tsid1: p.tsid1, tsid2: p.tsid2, dtw: p.dtw }));

    // Populate inline detail elements so the inline expand panel works later
    const headerScores = document.getElementById(`scores-${groupId}`);
    if (headerScores) headerScores.style.display = 'none';
    const loadingInline = document.getElementById(`detail-loading-${groupId}`);
    if (loadingInline) loadingInline.style.display = 'none';

    const multiRecord = tsidOrder.length > 2;
    const pairSelEl   = document.getElementById(`pair-selector-${groupId}`);
    const toggleEl    = document.getElementById(`series-toggle-${groupId}`);
    if (multiRecord && pairSelEl) {
      pairSelEl.innerHTML = buildRecordSelector(groupId, tsidOrder, series, tsidColors);
      pairSelEl.style.display = '';
      for (const tsid of initSelected) setChipSelected(groupId, tsid, true, tsidColors[tsid]);
    }
    if (multiRecord && toggleEl) {
      toggleEl.innerHTML = buildSeriesToggle(groupId);
      toggleEl.style.display = '';
    }
    renderGroupMetrics(groupId);
    const hasSeries = Object.values(series).some(s => s.values && s.values.length > 0);
    const inlinePlotEl = document.getElementById(`plot-${groupId}`);
    if (inlinePlotEl) {
      if (hasSeries) {
        const grp2 = duplicateGroups.find(g => g.groupId === groupId);
        const active2 = grp2 ? grp2.records.filter(t => !excludedTSIDs.has(t)) : null;
        const initFilter2 = (active2 && active2.length < tsidOrder.length) ? active2 : null;
        renderGroupPlot(groupId, series, tsidColors, inlinePlotEl, initFilter2);
        inlinePlotEl.style.display = '';
      } else {
        inlinePlotEl.innerHTML = '<div style="text-align:center;color:#999;padding:32px 0;font-size:0.88rem;">Time series data not available for this group</div>';
        inlinePlotEl.style.height = 'auto';
        inlinePlotEl.style.display = '';
      }
    }
    // Colour inline record names
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

    // If the modal is still open for this group, render analysis and update record colours
    if (activeModalGroupId === groupId) {
      renderModalAnalysis(groupId);
      const left = document.getElementById('group-modal-left');
      if (left) {
        left.querySelectorAll('.dup-record').forEach(recEl => {
          const color = tsidColors[recEl.dataset.tsid];
          if (color) {
            const nameEl = recEl.querySelector('.record-name');
            if (nameEl) nameEl.style.color = color;
          }
        });
      }
    }

  } catch (err) {
    console.error('Modal group details error:', err);
    loadedGroups.delete(groupId);
    const right = document.getElementById('group-modal-right');
    if (right && activeModalGroupId === groupId) {
      right.innerHTML = `<div style="padding:20px;color:#a00;font-size:0.88rem;">Failed to load: ${err.message} — <a href="#" onclick="loadGroupDetailsModal(${groupId});return false;">try again</a></div>`;
    }
  }
}

// Close modal on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && activeModalGroupId !== null) closeGroupModal();
});

// =============================================================================
// Remove exact duplicates feature
// =============================================================================
const EXACT_DUP_NOTE = 'removed by exact duplicate detection';
let compilationRanking = [];        // ordered list of compilation names (best → worst)
let pendingExactRemovals = null;    // { removeTsids: Set, clusters: [...] }

function setExactDupStatus(msg, isError) {
  const el = document.getElementById('exact-dup-status');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = isError ? '#b24' : '#3a7a3a';
  if (msg) {
    clearTimeout(setExactDupStatus._t);
    setExactDupStatus._t = setTimeout(() => { el.textContent = ''; }, 5000);
  }
}

function gatherUniqueCompilations() {
  const comps = new Set();
  for (const r of allRecords) {
    // Records use both ";" and "," as separators depending on source.
    const raw = (r.compilation || '').split(/[;,]/);
    for (const part of raw) {
      const c = part.trim();
      if (c) comps.add(c);
    }
  }
  // Default order: newest release first (descending). Falls back to
  // alphabetical for tokens with no version / no metadata so results stay
  // stable regardless of metadata availability.
  return [...comps].sort((a, b) => {
    const cmp = compareVersionTokens(b, a); // reversed → newer first
    if (cmp !== 0) return cmp;
    return a.localeCompare(b);
  });
}

function openRankDialog() {
  if (!duplicateGroups || duplicateGroups.length === 0) {
    setExactDupStatus('No duplicate groups to scan.', true);
    return;
  }
  // Build ranking list — preserve any prior order from this session, then append new comps
  const allComps = gatherUniqueCompilations();
  const seen = new Set();
  const ordered = [];
  for (const c of compilationRanking) {
    if (allComps.includes(c) && !seen.has(c)) { ordered.push(c); seen.add(c); }
  }
  for (const c of allComps) {
    if (!seen.has(c)) { ordered.push(c); seen.add(c); }
  }
  compilationRanking = ordered;

  renderRankList();
  const overlay = document.getElementById('rank-dialog-overlay');
  if (overlay) overlay.style.display = 'flex';
}

function closeRankDialog() {
  const overlay = document.getElementById('rank-dialog-overlay');
  if (overlay) overlay.style.display = 'none';
}

function renderRankList() {
  const list = document.getElementById('comp-rank-list');
  if (!list) return;
  list.innerHTML = '';
  if (compilationRanking.length === 0) {
    list.innerHTML = '<li style="cursor:default;color:#888;font-style:italic;">No compilations found in this dataset.</li>';
    return;
  }
  compilationRanking.forEach((comp, idx) => {
    const li = document.createElement('li');
    li.draggable = true;
    li.dataset.idx = idx;
    li.innerHTML = `
      <span class="rank-num">${idx + 1}</span>
      <span class="drag-handle">&#x2630;</span>
      <span class="rank-name"></span>
      <button class="rank-move" onclick="moveRankItem(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} title="Move up">&#x25B2;</button>
      <button class="rank-move" onclick="moveRankItem(${idx}, 1)" ${idx === compilationRanking.length - 1 ? 'disabled' : ''} title="Move down">&#x25BC;</button>
    `;
    li.querySelector('.rank-name').textContent = formatCompilationToken(comp);
    li.addEventListener('dragstart', onRankDragStart);
    li.addEventListener('dragover', onRankDragOver);
    li.addEventListener('dragleave', onRankDragLeave);
    li.addEventListener('drop', onRankDrop);
    li.addEventListener('dragend', onRankDragEnd);
    list.appendChild(li);
  });
}

let _dragSrcIdx = null;
function onRankDragStart(e) {
  _dragSrcIdx = parseInt(this.dataset.idx, 10);
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  // Firefox needs data set to start the drag
  try { e.dataTransfer.setData('text/plain', String(_dragSrcIdx)); } catch (_) {}
}
function onRankDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  this.classList.add('drag-over');
}
function onRankDragLeave() { this.classList.remove('drag-over'); }
function onRankDragEnd() {
  document.querySelectorAll('#comp-rank-list li').forEach(li => {
    li.classList.remove('dragging');
    li.classList.remove('drag-over');
  });
  _dragSrcIdx = null;
}
function onRankDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  const targetIdx = parseInt(this.dataset.idx, 10);
  if (_dragSrcIdx == null || _dragSrcIdx === targetIdx) return;
  const [moved] = compilationRanking.splice(_dragSrcIdx, 1);
  compilationRanking.splice(targetIdx, 0, moved);
  renderRankList();
}

function moveRankItem(idx, dir) {
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= compilationRanking.length) return;
  const [moved] = compilationRanking.splice(idx, 1);
  compilationRanking.splice(newIdx, 0, moved);
  renderRankList();
}

function setScanProgress(checked, total, msg, indeterminate) {
  const wrap = document.getElementById('exact-scan-progress');
  const track = document.getElementById('exact-scan-track');
  const bar  = document.getElementById('exact-scan-bar');
  const msgEl = document.getElementById('exact-scan-msg');
  if (wrap) wrap.style.display = 'block';
  if (track) track.classList.toggle('indeterminate', !!indeterminate);
  if (indeterminate) {
    if (msgEl) msgEl.textContent = msg || 'Working…';
    return;
  }
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
  if (bar) bar.style.width = pct + '%';
  if (msgEl) {
    msgEl.textContent = msg || `Scanning group ${checked} of ${total}… (${pct}%)`;
  }
}

function hideScanProgress() {
  const wrap = document.getElementById('exact-scan-progress');
  if (wrap) wrap.style.display = 'none';
}

function onNearDupToggle() {
  const cb = document.getElementById('near-dup-toggle');
  const wrap = document.getElementById('near-dup-threshold-wrap');
  if (wrap) wrap.style.display = cb && cb.checked ? 'block' : 'none';
}

function onNearDupThresholdInput() {
  const s = document.getElementById('near-dup-threshold');
  const v = document.getElementById('near-dup-threshold-val');
  if (s && v) v.textContent = Number(s.value).toFixed(2);
}

function getScanOptions() {
  const policyEl = document.querySelector('input[name="length-policy"]:checked');
  const lengthPolicy = policyEl ? policyEl.value : 'longer';
  const nearCb = document.getElementById('near-dup-toggle');
  const include_near = !!(nearCb && nearCb.checked);
  const threshEl = document.getElementById('near-dup-threshold');
  const near_threshold = threshEl ? Number(threshEl.value) : 0.99;
  const olderVerCb = document.getElementById('older-version-toggle');
  const removeOlderVersions = !!(olderVerCb && olderVerCb.checked);
  return { lengthPolicy, include_near, near_threshold, removeOlderVersions };
}

// Detect records that are older-version superseded copies of the same dataset.
// For each candidate group, walks records grouped by dataSetName. When two or
// more records share a dataSetName and appear in different versions of the
// same compilation base (e.g., NAm_867 in Pages2kTemperature-2_1_4 and NAm_868
// in Pages2kTemperature-2_2_0), the records whose newest compilation version
// is strictly older than the newest seen are marked for removal.
//
// Returns an array of synthetic clusters shaped like the backend exact-dup
// clusters, with `kind: 'older_version'` so the preview dialog can distinguish
// them. No Pearson data is computed — this decision is metadata-only.
function detectOlderVersionClusters(candidateGroups) {
  const clusters = [];
  const seenTsids = new Set(); // avoid duplicate clusters across overlapping groups

  for (const groupTsids of candidateGroups) {
    // Bucket records in this group by dataSetName. Records without a name
    // cannot be matched to a superseded version, so skip them.
    const byName = new Map();
    for (const tsid of groupTsids) {
      const r = allRecords.find(rec => rec.tsid === tsid);
      if (!r || !r.dataSetName) continue;
      if (!byName.has(r.dataSetName)) byName.set(r.dataSetName, []);
      byName.get(r.dataSetName).push(r);
    }

    for (const [dsName, records] of byName) {
      if (records.length < 2) continue;

      // For each record, parse its compilation field into tokens keyed by
      // base name. A single record can belong to multiple compilation bases
      // (e.g., Pages2kTemperature + Temp12k); each base is evaluated
      // independently.
      // baseMap: Map<baseName, Map<tsid, bestToken>>
      const baseMap = new Map();
      for (const r of records) {
        const tokens = (r.compilation || '')
          .split(/[;,]/)
          .map(s => s.trim())
          .filter(Boolean);
        for (const tk of tokens) {
          const { name, version } = parseCompilationToken(tk);
          if (!name || !version) continue;
          if (!baseMap.has(name)) baseMap.set(name, new Map());
          const perRec = baseMap.get(name);
          const existing = perRec.get(r.tsid);
          // Keep only the newest token per (base, record) so a record that
          // straddles two versions is compared at its best version.
          if (!existing || compareVersionTokens(tk, existing) > 0) {
            perRec.set(r.tsid, tk);
          }
        }
      }

      // Walk each base. A version conflict exists only when >=2 records are
      // present for that base with different tokens.
      const loserTsids = new Set();
      let keeperTsid = null;
      let keeperToken = null;
      let conflictBaseTokens = []; // [{base, newestToken}] for the summary

      for (const [base, perRec] of baseMap) {
        if (perRec.size < 2) continue;
        const distinctTokens = new Set(perRec.values());
        if (distinctTokens.size < 2) continue;

        // Find the newest token across all records in this base.
        let newest = null;
        for (const tk of perRec.values()) {
          if (!newest || compareVersionTokens(tk, newest) > 0) newest = tk;
        }

        // Anyone whose token is older than newest is a loser for this base.
        // Anyone at the newest token is a potential keeper.
        for (const [tsid, tk] of perRec) {
          if (compareVersionTokens(tk, newest) < 0) {
            loserTsids.add(tsid);
          } else if (!keeperTsid) {
            keeperTsid = tsid;
            keeperToken = newest;
          }
        }
        conflictBaseTokens.push({ base, newestToken: newest });
      }

      if (loserTsids.size === 0 || !keeperTsid) continue;
      // Guard against double-counting a tsid across overlapping groups.
      const sig = [...loserTsids].sort().join(',') + '|' + keeperTsid;
      if (seenTsids.has(sig)) continue;
      seenTsids.add(sig);

      clusters.push({
        tsids:  [keeperTsid, ...loserTsids],
        keeper: keeperTsid,
        losers: [...loserTsids],
        kind:   'older_version',
        dataSetName:         dsName,
        keeperToken:         keeperToken,
        conflictBaseTokens:  conflictBaseTokens,
      });
    }
  }
  return clusters;
}

async function submitRanking() {
  // Build the candidate group list — drop already-excluded TSIDs and groups < 2 members
  let groups = duplicateGroups
    .map(g => g.records.filter(t => !excludedTSIDs.has(t)))
    .filter(arr => arr.length >= 2);

  if (groups.length === 0) {
    setExactDupStatus('No active duplicate groups to scan.', true);
    closeRankDialog();
    return;
  }

  const opts = getScanOptions();

  // Pre-pass: detect older-version losers BEFORE the exact-dup scan so the
  // backend doesn't spend SPARQL time correlating records we already know
  // will be removed. The pre-pass runs purely on client-side metadata.
  let olderVersionClusters = [];
  if (opts.removeOlderVersions) {
    olderVersionClusters = detectOlderVersionClusters(groups);
    if (olderVersionClusters.length > 0) {
      const dropped = new Set();
      for (const c of olderVersionClusters) {
        for (const t of c.losers) dropped.add(t);
      }
      // Remove older-version losers from the candidate groups passed to the
      // backend. Any group that collapses below 2 members is then dropped.
      groups = groups
        .map(arr => arr.filter(t => !dropped.has(t)))
        .filter(arr => arr.length >= 2);
    }
  }

  const btn = document.getElementById('btn-find-exact');
  const cancelBtn = document.getElementById('btn-rank-cancel');
  if (btn) { btn.disabled = true; btn.textContent = 'Scanning…'; }
  if (cancelBtn) cancelBtn.disabled = true;

  // Fast path: all candidate groups collapsed to older-version decisions,
  // nothing left for the backend to scan. Show the version-only preview.
  if (groups.length === 0) {
    try {
      closeRankDialog();
      if (olderVersionClusters.length === 0) {
        setExactDupStatus('No exact duplicates found.');
      } else {
        rankClusters([], opts.lengthPolicy); // reset pendingExactRemovals
        appendOlderVersionClusters(olderVersionClusters);
        renderExactPreview();
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Find duplicates'; }
      if (cancelBtn) cancelBtn.disabled = false;
    }
    return;
  }

  setScanProgress(0, groups.length, 'Preparing scan…', true);

  let finalClusters = null;
  let streamError = null;

  try {
    const resp = await fetch('/datacleaning/exact-duplicates-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groups,
        include_near: opts.include_near,
        near_threshold: opts.near_threshold,
      })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || 'Request failed');
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop();
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data: ')) continue;
        let event;
        try { event = JSON.parse(line.slice(6)); } catch { continue; }

        if (event.phase === 'start') {
          setScanProgress(0, event.total || groups.length, `Preparing scan of ${event.total || groups.length} groups…`, true);
        } else if (event.phase === 'loading') {
          // Legacy event from older servers — still show indeterminate as a fallback.
          setScanProgress(0, event.total || groups.length, event.message || 'Fetching time series…', true);
        } else if (event.phase === 'fetch') {
          // Determinate progress over the batched series fetch.
          const fetched = event.fetched || 0;
          const totalTsids = event.totalTsids || 1;
          setScanProgress(
            fetched,
            totalTsids,
            `Fetching time series… ${fetched} / ${totalTsids}`,
            false
          );
        } else if (event.phase === 'progress') {
          setScanProgress(event.checked || 0, event.total || groups.length, `Clustering group ${event.checked || 0} / ${event.total || groups.length}…`, false);
        } else if (event.phase === 'done') {
          finalClusters = Array.isArray(event.clusters) ? event.clusters : [];
        } else if (event.phase === 'error') {
          streamError = event.message || 'Streaming error';
        }
      }
    }

    if (streamError) throw new Error(streamError);

    const clusters = finalClusters || [];
    closeRankDialog();

    if (clusters.length === 0 && olderVersionClusters.length === 0) {
      setExactDupStatus(opts.include_near
        ? 'No exact or near duplicates found.'
        : 'No exact duplicates found.');
      return;
    }
    rankClusters(clusters, opts.lengthPolicy);
    // Merge older-version clusters into the same pending set so the preview
    // dialog shows them alongside the Pearson-based clusters and one Apply
    // removes everything.
    if (olderVersionClusters.length > 0) {
      appendOlderVersionClusters(olderVersionClusters);
    }
    renderExactPreview();
  } catch (err) {
    setExactDupStatus('Detection failed: ' + err.message, true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Find duplicates'; }
    if (cancelBtn) cancelBtn.disabled = false;
    hideScanProgress();
  }
}

function scoreRecord(tsid) {
  const rec = allRecords.find(r => r.tsid === tsid) || {};
  const comps = (rec.compilation || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
  let best = Infinity;
  for (const c of comps) {
    const idx = compilationRanking.indexOf(c);
    if (idx !== -1 && idx < best) best = idx;
  }
  return best;
}

function rankClusters(clusters, lengthPolicy) {
  const policy = lengthPolicy || 'longer';
  const removeTsids = new Set();
  const enriched = [];

  for (const cluster of clusters) {
    const candidates = cluster.tsids.filter(t => !excludedTSIDs.has(t));
    if (candidates.length < 2) continue;

    const lengths = cluster.lengths || {};
    const lenOf = t => Number(lengths[t] ?? cluster.length ?? 0);

    // Build a comparator based on the selected policy. Lower = better (sorted first).
    let comparator;
    if (policy === 'rank') {
      // Rank wins; length breaks ties; tsid lex breaks remaining ties
      comparator = (a, b) => {
        const sa = scoreRecord(a), sb = scoreRecord(b);
        if (sa !== sb) return sa - sb;
        const la = lenOf(a), lb = lenOf(b);
        if (la !== lb) return lb - la;            // longer first
        return String(a).localeCompare(String(b));
      };
    } else if (policy === 'length_only') {
      // Length only; tsid lex tiebreak
      comparator = (a, b) => {
        const la = lenOf(a), lb = lenOf(b);
        if (la !== lb) return lb - la;
        return String(a).localeCompare(String(b));
      };
    } else {
      // "longer" (default): length wins; rank breaks ties; tsid lex last
      comparator = (a, b) => {
        const la = lenOf(a), lb = lenOf(b);
        if (la !== lb) return lb - la;
        const sa = scoreRecord(a), sb = scoreRecord(b);
        if (sa !== sb) return sa - sb;
        return String(a).localeCompare(String(b));
      };
    }

    const sorted = [...candidates].sort(comparator);
    const keeper = sorted[0];
    const losers = sorted.slice(1);
    for (const t of losers) removeTsids.add(t);
    enriched.push({
      tsids:   candidates,
      lengths,
      keeper,
      losers,
      kind:    cluster.kind || 'exact',
      minPearson: typeof cluster.minPearson === 'number' ? cluster.minPearson : 1.0,
    });
  }

  pendingExactRemovals = { removeTsids, clusters: enriched };
}

// Merge synthetic "older_version" clusters into the current pendingExactRemovals.
// These clusters bypass the length/rank policy because their keeper is already
// fixed by the version date. Called after rankClusters() — assumes
// pendingExactRemovals is populated.
function appendOlderVersionClusters(versionClusters) {
  if (!pendingExactRemovals) {
    pendingExactRemovals = { removeTsids: new Set(), clusters: [] };
  }
  const { removeTsids, clusters: enriched } = pendingExactRemovals;
  for (const c of versionClusters) {
    // Filter out any losers the user has already removed by hand.
    const losers = c.losers.filter(t => !excludedTSIDs.has(t));
    if (losers.length === 0) continue;
    if (excludedTSIDs.has(c.keeper)) continue; // keeper already gone — skip to avoid a zombie cluster
    for (const t of losers) removeTsids.add(t);
    enriched.push({
      tsids:  [c.keeper, ...losers],
      lengths: {},
      keeper: c.keeper,
      losers,
      kind:   'older_version',
      dataSetName:        c.dataSetName,
      keeperToken:        c.keeperToken,
      conflictBaseTokens: c.conflictBaseTokens,
    });
  }
}

function renderExactPreview() {
  if (!pendingExactRemovals) return;
  const { removeTsids, clusters } = pendingExactRemovals;
  const summary = document.getElementById('exact-preview-summary');
  const list = document.getElementById('exact-cluster-list');
  if (!summary || !list) return;

  if (clusters.length === 0 || removeTsids.size === 0) {
    setExactDupStatus('No duplicates found.');
    closeExactPreview();
    return;
  }

  const exactCount   = clusters.filter(c => c.kind === 'exact' || (!c.kind)).length;
  const nearCount    = clusters.filter(c => c.kind === 'near').length;
  const versionCount = clusters.filter(c => c.kind === 'older_version').length;
  const totalRecords = clusters.reduce((s, c) => s + c.tsids.length, 0);

  const parts = [];
  if (exactCount)   parts.push(`<strong>${exactCount}</strong> exact`);
  if (nearCount)    parts.push(`<strong>${nearCount}</strong> near-duplicate`);
  if (versionCount) parts.push(`<strong>${versionCount}</strong> older-version`);
  summary.innerHTML = `Found ${parts.join(' + ')} ${clusters.length === 1 ? 'cluster' : 'clusters'} covering ${totalRecords} records. <strong>${removeTsids.size}</strong> records will be removed, ${clusters.length} kept.`;

  list.innerHTML = '';
  clusters.forEach((cluster, idx) => {
    const keeperMeta = allRecords.find(r => r.tsid === cluster.keeper) || {};
    const keeperLen = cluster.lengths ? cluster.lengths[cluster.keeper] : null;
    const loserRows = cluster.losers.map(tsid => {
      const m = allRecords.find(r => r.tsid === tsid) || {};
      const l = cluster.lengths ? cluster.lengths[tsid] : null;
      const lenStr = l != null ? ` · ${l} pts` : '';
      return `<div class="remove-row">${escapeHtml(m.dataSetName || tsid)} <span class="meta">— ${escapeHtml(formatCompilationString(m.compilation) || 'no compilation')}${lenStr}</span></div>`;
    }).join('');
    const isNear    = cluster.kind === 'near';
    const isVersion = cluster.kind === 'older_version';
    let badge;
    if (isNear) {
      badge = `<span style="display:inline-block;background:#f0ad4e;color:#fff;border-radius:3px;padding:1px 6px;font-size:0.72rem;margin-left:6px;">near · r=${cluster.minPearson.toFixed(3)}</span>`;
    } else if (isVersion) {
      badge = `<span style="display:inline-block;background:#6f42c1;color:#fff;border-radius:3px;padding:1px 6px;font-size:0.72rem;margin-left:6px;" title="Same dataSetName across different compilation versions — newest kept">older version</span>`;
    } else {
      badge = `<span style="display:inline-block;background:#5cb85c;color:#fff;border-radius:3px;padding:1px 6px;font-size:0.72rem;margin-left:6px;">exact</span>`;
    }
    const keeperLenStr = keeperLen != null ? ` · ${keeperLen} pts` : '';
    const div = document.createElement('div');
    div.className = 'exact-cluster';
    div.innerHTML = `
      <div class="exact-cluster-head">Cluster ${idx + 1} · ${cluster.tsids.length} records${badge}</div>
      <div class="keep-row">KEEP: ${escapeHtml(keeperMeta.dataSetName || cluster.keeper)} <span class="meta">— ${escapeHtml(formatCompilationString(keeperMeta.compilation) || 'no compilation')}${keeperLenStr}</span></div>
      ${loserRows}
    `;
    list.appendChild(div);
  });

  const btnApply = document.getElementById('btn-apply-exact');
  if (btnApply) btnApply.textContent = `Apply — remove ${removeTsids.size} records`;

  const overlay = document.getElementById('exact-dup-preview-overlay');
  if (overlay) overlay.style.display = 'flex';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function closeExactPreview() {
  const overlay = document.getElementById('exact-dup-preview-overlay');
  if (overlay) overlay.style.display = 'none';
  pendingExactRemovals = null;
}

function applyExactRemovals() {
  if (!pendingExactRemovals) return;
  const { removeTsids } = pendingExactRemovals;
  if (removeTsids.size === 0) {
    closeExactPreview();
    return;
  }

  // Show a simple loading state on the Apply button and block further clicks
  // while the (synchronous) DOM work runs. Defer the actual work to the next
  // frame so the browser can paint the spinner before the main thread blocks.
  const btnApply  = document.getElementById('btn-apply-exact');
  const btnCancel = document.getElementById('btn-exact-cancel');
  if (btnApply) {
    btnApply.disabled = true;
    btnApply.dataset.origLabel = btnApply.textContent;
    btnApply.innerHTML = '<span class="apply-spinner"></span> Applying…';
  }
  if (btnCancel) btnCancel.disabled = true;

  // Two rAFs guarantees the browser has rendered the new button label
  // before we start the blocking work.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    _doApplyExactRemovals(removeTsids);
    if (btnApply) {
      btnApply.disabled = false;
      if (btnApply.dataset.origLabel) btnApply.textContent = btnApply.dataset.origLabel;
    }
    if (btnCancel) btnCancel.disabled = false;
  }));
}

function _doApplyExactRemovals(removeTsids) {
  // 1. Add to excludedTSIDs
  for (const t of removeTsids) excludedTSIDs.add(t);

  // 2. Find affected groups + annotate notes
  const affectedGroupIds = new Set();
  for (const g of duplicateGroups) {
    if (g.records.some(t => removeTsids.has(t))) {
      affectedGroupIds.add(g.groupId);
    }
  }
  for (const gid of affectedGroupIds) {
    const existing = (groupNotes[gid] || '').trim();
    if (existing.includes(EXACT_DUP_NOTE)) continue;
    groupNotes[gid] = existing
      ? `${existing}\n${EXACT_DUP_NOTE}`
      : EXACT_DUP_NOTE;
    const ta = document.getElementById(`group-notes-${gid}`);
    if (ta) ta.value = groupNotes[gid];
  }

  // 3. Sync table rows + duplicate-group radios for each removed TSID
  for (const t of removeTsids) {
    syncTableRow(t);
    for (const g of duplicateGroups) {
      if (!g.records.includes(t)) continue;
      const removeRadio = document.querySelector(`input[name="dup-${g.groupId}-${t}"][value="remove"]`);
      const keepRadio   = document.querySelector(`input[name="dup-${g.groupId}-${t}"][value="keep"]`);
      if (removeRadio) removeRadio.checked = true;
      if (keepRadio)   keepRadio.checked   = false;
    }
  }

  // 4. Mark affected groups as saved (dims the card + collapses details)
  for (const gid of affectedGroupIds) {
    saveGroup(gid);
  }

  // 5. Update footer
  updateFooter();

  // 6. Status + close
  const removedCount = removeTsids.size;
  const groupCount = affectedGroupIds.size;
  closeExactPreview();
  setExactDupStatus(`Removed ${removedCount} exact duplicate${removedCount === 1 ? '' : 's'} across ${groupCount} group${groupCount === 1 ? '' : 's'}.`);
}

// =============================================================================
// Variable filter — lets the user override the default blacklist after load
// =============================================================================

function computeVariableNameStats() {
  // Walk allRecords once; produce one entry per unique filter-key. Thickness
  // rows split into two keys (see filterKeyFor).
  const byKey = new Map();
  for (const r of allRecords) {
    const key = filterKeyFor(r);
    if (!key) continue;
    let entry = byKey.get(key);
    if (!entry) {
      let display;
      if (key === 'thickness:annual')         display = 'thickness (annually resolved)';
      else if (key === 'thickness:nonannual') display = 'thickness (not annually resolved)';
      else                                    display = (r.variableName || '').toString().trim();
      entry = { key, display, count: 0 };
      byKey.set(key, entry);
    }
    entry.count += 1;
  }
  const arr = Array.from(byKey.values());
  arr.forEach(e => { e.excluded = excludedVariableNames.has(e.key); });
  arr.sort((a, b) => b.count - a.count);
  return arr;
}

function renderVariableFilter() {
  const list = document.getElementById('variable-filter-list');
  const summary = document.getElementById('variable-filter-summary');
  if (!list) return;

  const stats = computeVariableNameStats();
  list.innerHTML = '';

  for (const entry of stats) {
    const row = document.createElement('label');
    row.className = 'variable-filter-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !entry.excluded;
    cb.addEventListener('change', () => onVariableToggle(entry.key, cb.checked));

    const name = document.createElement('span');
    name.className = 'variable-filter-name';
    name.textContent = entry.display;

    const badge = document.createElement('span');
    badge.className = 'variable-filter-count';
    badge.textContent = entry.count.toString();

    row.appendChild(cb);
    row.appendChild(name);
    row.appendChild(badge);

    list.appendChild(row);
  }

  if (summary) {
    const totalNames = stats.length;
    const includedNames = stats.filter(s => !s.excluded).length;
    const excludedRecordCount = allRecords.filter(r => !isValidProxyRecord(r)).length;
    summary.textContent = `${includedNames} of ${totalNames} variable names included — ${excludedRecordCount} records excluded`;
  }
}

function onVariableToggle(key, checked) {
  if (checked) {
    excludedVariableNames.delete(key);
  } else {
    excludedVariableNames.add(key);
  }
  refreshAllViews();
}

function refreshAllViews() {
  // Run after any change that affects which records are valid. Touches every
  // view that reads through isValidProxyRecord.
  renderVariableFilter();
  renderTable();
  renderCoverage();
  if (typeof renderPCA === 'function') renderPCA();
  updateFooter();
  if (typeof renderDuplicates === 'function') renderDuplicates();
}
