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
// Session-wide display unit for every Age/Year axis in the app. Chosen by
// the server at /analyze time from all input records' maxAge values — yr AD
// when the majority of records stay within the last 2000 BP, else yr BP.
let displayTimeUnit = 'yr BP';

// Per-dataset auto-selection, recomputed client-side from filterState on
// every toggle. Each entry: {dataSetName, archiveType, status,
// autoKeptTsids, autoDroppedTsids, candidateTsids}. status ∈ {'auto-picked',
// 'excluded'} — 'excluded' means the AND-filter knocked every candidate out
// so the dataset contributes zero records.
let datasetsInfo = [];
let expandedDatasets = new Set();   // dataset names with manual-override list expanded

// Client-side filter state — the AND-filter driving Step 1 auto-selection.
// Populated once from the server's /analyze `filterOptions` event, then
// mutated by the Auto-selection filters panel. Every mutation triggers
// recomputeDatasets() + refreshAllViews().
const INTERP_NO_VALUE = '(no interpretation)';
let filterState = {
  // interp_Vars buckets currently checked. Defaults to every bucket returned
  // by the server (all on).
  interpVars: new Set(),
  // {archiveName: Set<variableName>} — checked proxy variables per archive.
  // Seeded from server's `isDefault` flag: every variable present in the data
  // starts checked. The panel is an opt-OUT tool for excluding unwanted
  // proxies, not an opt-IN whitelist.
  variablesByArchive: {},
  // When true, a record must also be a member of at least one compilation
  // (paleoData_mostRecentCompilations) to pass. Default off per user
  // request — casts a wide net by default; curator-vetted-only is opt-in.
  requireCompilation: false,
};
// Server-provided metadata for the filter panel UI. interpVarSummary is
// [{value, count}]. variablesByArchive is {archive: [{name, count, isDefault}]}.
let filterOptions = { interpVarSummary: [], variablesByArchive: {} };

// Two-step wizard. currentStep ∈ {1, 2}. Step 1 == dataset-primary review,
// step 2 == spatial duplicate review. Step 2 is hidden until step 1 is
// resolved (all needs-review datasets have ≥ 1 picked candidate).
let currentStep = 1;
let step2EverEntered = false;  // lazy-render gate for renderDuplicates/Coverage/PCA

// Sort state
let sortKey = null;
let sortAsc = true;

// Flagged TSIDs (members of duplicate groups)
let flaggedTSIDs = new Set();

// Free-text notes keyed by groupId (Step 2 duplicate groups)
const groupNotes = {};
// Free-text notes keyed by dataSetName (Step 1 dataset-level annotations).
// Mirrors groupNotes so users can capture reasoning on auto-picks and
// overrides alongside per-duplicate-group notes.
const datasetNotes = {};

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

// Format a multi-compilation string. Upstream sources use "|" (the raw
// `inCompilationBeta` separator written by lipdverseR), as well as ";" and
// "," in places, so accept all three.
function formatCompilationString(compStr) {
  if (!compStr) return '';
  return compStr
    .split(/[|;,]/)
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
  // Apply initial step visibility so step-2 panels/footers are hidden from
  // first paint (inline `style="display:none"` already handles this, but this
  // keeps pill state + intros consistent if the inline attrs are ever dropped).
  applyStepVisibility();
  // Fire-and-forget — compilation date annotations upgrade in place once
  // the metadata arrives; callers fall back to the raw string if not ready.
  loadCompilationMetadata();
  if (!UNIQUE_ID || !RECON) {
    showError('Missing uniqueID or recon parameter in URL. Please start over from the query page.');
    hideLoading();
    return;
  }

  // If the user already curated this query (e.g. they hit Back from the
  // editor, or arrived via /reuse), don't blow away their selection by
  // re-running analysis from scratch. Show them what's there and let them
  // pick: continue to the editor with the saved set, or re-curate.
  let priorState = null;
  try {
    const r = await fetch(
      '/datacleaning/state?uniqueID=' + encodeURIComponent(UNIQUE_ID) +
      '&recon=' + encodeURIComponent(RECON),
      { cache: 'no-store' }
    );
    if (r.ok) priorState = await r.json();
  } catch (_) { /* non-fatal — fall through to fresh analysis */ }

  if (priorState && priorState.hasCleaned) {
    showPriorCurationBanner(priorState);
    hideLoading();
    return; // user picks an action; analysis only runs if they choose Re-curate
  }

  await runFreshAnalysis();
});

// Run the SSE analysis pipeline. Extracted so showPriorCurationBanner can
// trigger it from a "Re-curate" click after first wiping prior artifacts.
async function runFreshAnalysis() {
  setLoadingMsg('Downloading lipdverse metadata…');
  try {
    await analyzeWithStreaming();
  } catch (err) {
    showError('Analysis failed: ' + err.message + '. You can skip data cleaning and proceed to the editor.');
    hideLoading();
    hideInlineProgress();
    updateFooter();
  }
}

// =============================================================================
// "You already curated this" banner — shown when /state reports cleaned_TSIDs
// already exists. Without this, hitting Back from the editor used to silently
// re-run a multi-minute analysis and lose every selection the user made.
// =============================================================================
function showPriorCurationBanner(state) {
  const host = document.querySelector('main') || document.body;
  if (!host || document.getElementById('prior-curation-banner')) return;

  const when = state.cleanedAt ? new Date(state.cleanedAt) : null;
  const whenText = when && !isNaN(when.getTime())
    ? when.toLocaleString()
    : 'earlier';
  const kept    = state.keptCount || 0;
  const removed = state.removedCount || 0;
  const total   = kept + removed;

  const banner = document.createElement('div');
  banner.id = 'prior-curation-banner';
  banner.style.cssText =
    'background:#e2f0ff;border:1px solid #b6daff;color:#08518f;' +
    'padding:18px 22px;margin:24px auto;max-width:900px;border-radius:8px;' +
    'font-size:1rem;line-height:1.5;';
  banner.innerHTML =
    '<h3 style="margin:0 0 8px 0;color:#08518f;font-size:1.15rem;">You already curated this query</h3>' +
    '<p style="margin:0 0 12px 0;">Saved ' + whenText + ' &mdash; <strong>' +
      kept + '</strong> kept' +
      (removed > 0 ? ', <strong>' + removed + '</strong> removed' : '') +
      (total  > 0 ? ' (' + total + ' total)' : '') +
    '. Continue to the editor with this selection, or start over to re-run the duplicate analysis.</p>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
      '<button type="button" id="prior-continue" ' +
        'style="background:#0969da;color:#fff;border:none;padding:9px 18px;' +
        'border-radius:4px;font-weight:600;cursor:pointer;">' +
        'Continue to editor →' +
      '</button>' +
      '<button type="button" id="prior-recurate" ' +
        'style="background:#fff;color:#08518f;border:1px solid #b6daff;padding:9px 18px;' +
        'border-radius:4px;font-weight:600;cursor:pointer;">' +
        'Re-curate from scratch' +
      '</button>' +
    '</div>';

  // Insert at the very top of the main content area.
  if (host.firstChild) host.insertBefore(banner, host.firstChild);
  else host.appendChild(banner);

  document.getElementById('prior-continue').addEventListener('click', () => {
    suppressUnloadWarning();
    const next = (RECON === 'lipdDownload') ? '/lipd-download/confirm' : '/editor/querypath';
    window.location.href = next + window.location.search;
  });

  document.getElementById('prior-recurate').addEventListener('click', async () => {
    const btn = document.getElementById('prior-recurate');
    if (btn) { btn.disabled = true; btn.textContent = 'Clearing…'; }
    try {
      await fetch('/datacleaning/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uniqueID: UNIQUE_ID, recon: RECON }),
      });
    } catch (_) { /* best-effort — we'll overwrite on Continue anyway */ }
    banner.remove();
    showLoading();
    await runFreshAnalysis();
  });
}

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
    if (event.displayTimeUnit) displayTimeUnit = event.displayTimeUnit;
    renderTable();
    renderCoverage();
    updateFooter();
    // Hide overlay — page is now interactive
    hideLoading();
    // Show inline progress for remaining phases
    showInlineProgress('Computing PCA and checking for duplicates…', 0);
  }

  if (phase === 'filterOptions' && event.status === 'done') {
    filterOptions = {
      interpVarSummary: event.interpVarSummary || [],
      variablesByArchive: event.variablesByArchive || {},
    };
    initFilterStateFromServer();
    renderAutoFilters();
    recomputeDatasets();          // build datasetsInfo from filter state
    applyAutoFilterToExclusions(); // seed excludedTSIDs from the filter
    renderDatasetsPanel();
    renderTable();
    updateFooter();
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

function showLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.style.display = 'flex';
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
        <div id="dup-corr-matrix-${group.groupId}" style="display:none"></div>
        <div id="dup-metadata-${group.groupId}"></div>
      </div>
      <div class="dup-records" id="dup-records-${group.groupId}" style="display:none">
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
  // binCenters are in the CSV's native BP unit — convert to the session's
  // display unit for the Plotly x-axis so the axis agrees with the rest of
  // the app (main records table, per-dataset plots).
  const binCenters = Array.from({ length: NBINS }, (_, i) =>
    _convertTimeValue(xLow + (i + 0.5) * binWidth, 'yr BP', displayTimeUnit));

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
    xaxis: {
      title: `Age (${displayTimeUnit})`,
      // Reverse the axis only when the unit is BP so older values sit on
      // the left per paleoclimate convention. For yr AD, increasing = newer
      // naturally places recent on the right without reversal.
      ...(displayTimeUnit === 'yr BP' || displayTimeUnit === 'ka BP' || displayTimeUnit === 'Ma BP'
        ? { autorange: 'reversed' } : {}),
    },
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
  // Dynamic column headers reflect the session's chosen display unit.
  const thead = document.querySelector('#records-table thead tr');
  if (thead) {
    const minTh = thead.querySelector('th[onclick*="minAge"]');
    const maxTh = thead.querySelector('th[onclick*="maxAge"]');
    const label = displayTimeUnit === 'yr AD' ? 'yr AD' : 'yr BP';
    if (minTh) minTh.innerHTML = `Min Age (${label}) <span class="sort-icon">&#8597;</span>`;
    if (maxTh) maxTh.innerHTML = `Max Age (${label}) <span class="sort-icon">&#8597;</span>`;
  }

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
      <td>${_formatAgeCell(rec.minAge)}</td>
      <td>${_formatAgeCell(rec.maxAge)}</td>
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
// Two-step wizard — advance / return / visibility
// =============================================================================
// Show only the panel-sections (and intro copy) whose `data-step` matches
// the current step, or is "both". Drives the by-dataset → by-location split.
function applyStepVisibility() {
  const targets = document.querySelectorAll('[data-step]');
  for (const el of targets) {
    const s = el.getAttribute('data-step');
    const show = (s === 'both' || Number(s) === currentStep);
    el.style.display = show ? '' : 'none';
  }
  const p1 = document.getElementById('pill-step-1');
  const p2 = document.getElementById('pill-step-2');
  if (p1) {
    p1.classList.toggle('active', currentStep === 1);
    p1.classList.toggle('done',   currentStep === 2);
  }
  if (p2) {
    p2.classList.toggle('active', currentStep === 2);
    p2.classList.toggle('done',   false);
  }
}

function advanceToStep2() {
  if (unresolvedReviewCount() > 0) return;
  currentStep = 2;
  applyStepVisibility();
  // First entry: render the step-2 panels. Their DOM was hidden until now so
  // we couldn't safely call Plotly earlier (it needs a visible container).
  if (!step2EverEntered) {
    step2EverEntered = true;
    if (typeof renderDuplicates === 'function') renderDuplicates();
    if (typeof renderCoverage   === 'function') renderCoverage();
    if (typeof renderPCA        === 'function') renderPCA();
  }
  updateFooter();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function returnToStep1() {
  currentStep = 1;
  applyStepVisibility();
  updateFooter();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================================================
// Dataset-first primary-proxy panel
// =============================================================================
// Legacy hook — Step 1 no longer forces a "≥ 1 primary per dataset" rule.
// The AND-filter may leave some datasets with zero survivors (they move to
// the "Excluded by filters" section), and Step 2's duplicate review handles
// same-location correlation. Kept as a stub for backward compatibility.
function unresolvedReviewCount() {
  return 0;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _recordByTsid(tsid) {
  return allRecords.find(r => r.tsid === tsid) || null;
}

function toggleDatasetCandidate(tsid) {
  if (excludedTSIDs.has(tsid)) excludedTSIDs.delete(tsid);
  else                         excludedTSIDs.add(tsid);
  syncTableRow(tsid);
  for (const g of duplicateGroups) {
    if (g.records.includes(tsid)) {
      const radioKeep   = document.querySelector(`input[name="dup-${g.groupId}-${tsid}"][value="keep"]`);
      const radioRemove = document.querySelector(`input[name="dup-${g.groupId}-${tsid}"][value="remove"]`);
      if (radioKeep)   radioKeep.checked   = !excludedTSIDs.has(tsid);
      if (radioRemove) radioRemove.checked =  excludedTSIDs.has(tsid);
    }
  }
  // Re-render any correlation matrix that includes this TSID: the Step 1
  // dataset card it belongs to (if open) and every Step 2 duplicate group
  // that contains it. Checked/unchecked matches the metadata table below.
  const ds = datasetsInfo.find(d =>
    (d.autoKeptTsids || []).includes(tsid) ||
    (d.autoDroppedTsids || []).includes(tsid) ||
    (d.candidateTsids  || []).includes(tsid)
  );
  if (ds && expandedDatasets.has(ds.dataSetName) && groupState[ds.dataSetName]) {
    _renderDatasetCorrelationMatrix(ds.dataSetName);
  }
  // Step 2 groups containing this TSID: re-plot (refreshGroupViews updates
  // chips + plot) and re-render the matrix (its row/col set depends on
  // excludedTSIDs).
  refreshGroupViews(tsid);
  for (const g of duplicateGroups) {
    if (g.records.includes(tsid) && groupState[g.groupId]) {
      _renderCorrelationMatrix(g.groupId, {
        containerId: `dup-corr-matrix-${g.groupId}`,
        onCellClick: 'setGroupPair',
      });
    }
  }
  // updateFooter() → renderDatasetsPanel() rebuilds the dataset card DOM and
  // re-renders the plot for any open card via its trailing rehydrate loop.
  updateFooter();
}

// Expand / collapse a dataset card. We DO NOT call renderDatasetsPanel()
// here — a full rebuild discards card DOM and jumps the scroll position
// because every sibling card re-renders at a new vertical offset. Instead,
// we toggle the details div's display in place and lazy-populate the
// candidate table + plot the first time a card opens.
function toggleDatasetDetails(dsName) {
  const opening = !expandedDatasets.has(dsName);

  if (opening) expandedDatasets.add(dsName);
  else         expandedDatasets.delete(dsName);

  const details    = document.getElementById(`ds-details-${dsName}`);
  const expandIcon = document.getElementById(`ds-expand-${dsName}`);
  if (details)    details.style.display = opening ? '' : 'none';
  if (expandIcon) expandIcon.classList.toggle('open', opening);

  if (!opening) return;

  // Populate candidate table if it hasn't been rendered yet (closed cards
  // ship with an empty #ds-table-${name} wrapper to keep initial HTML small).
  const ds = datasetsInfo.find(d => d.dataSetName === dsName);
  if (!ds) return;
  const tableWrap = document.getElementById(`ds-table-${dsName}`);
  if (tableWrap && !tableWrap.firstElementChild) {
    const allTsids = [...(ds.autoKeptTsids || []), ...(ds.autoDroppedTsids || [])];
    tableWrap.innerHTML = _renderCandidateTable(allTsids, { timeUnit: displayTimeUnit });
  }

  // Series: fetch if we haven't yet, else re-render the cached state.
  const st = groupState[dsName];
  if (!st || !st.series) {
    _fetchAndRenderDatasetSeries(ds).catch(err =>
      console.warn('[datacleaning] lazy series load failed:', err));
  } else {
    _renderDatasetReviewPlot(dsName);
    _renderDatasetPairSelector(dsName);
    _renderDatasetSeriesToggle(dsName);
    _renderDatasetCorrelationMatrix(dsName);
    renderDatasetMetrics(dsName);
  }
}

// Loaded set for step-1 datasets (mirror of loadedGroups in step 2). A name
// here means /correlate has been kicked off; we use groupState[name].series
// to detect completion.
const loadedDatasets = new Set();

// Saved set for step-1 datasets (mirror of savedGroups in step 2). Clicking
// "Save" on an expanded dataset card marks it saved — the card dims and
// collapses. Saved state is visual only; excludedTSIDs already captured the
// decision.
const savedDatasets = new Set();

// Save the current selection for a dataset and collapse the card.
function saveDataset(dsName) {
  savedDatasets.add(dsName);
  expandedDatasets.delete(dsName);
  renderDatasetsPanel();
  updateFooter();
}

async function _fetchAndRenderDatasetSeries(ds) {
  // Fetch the full dataset (kept + dropped) so the plot and table show every
  // candidate the user could re-include — not just the current auto-pick set.
  const tsids = [...(ds.autoKeptTsids || []), ...(ds.autoDroppedTsids || [])];
  if (tsids.length === 0) return;
  if (loadedDatasets.has(ds.dataSetName)) return;  // already in-flight / done
  loadedDatasets.add(ds.dataSetName);
  try {
    const resp = await fetch('/datacleaning/correlate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tsids, display_unit: displayTimeUnit }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const series = data.series || {};
    const pairs  = data.pairs  || [];
    const commonTimeUnit = data.commonTimeUnit || null;
    const tsidOrder = Object.keys(series);
    const tsidColors = {};
    tsidOrder.forEach((t, i) => { tsidColors[t] = traceColor(i); });

    // Effective non-NaN time range per TSid. Comes from each series' own
    // time array (the server strips None pairs before returning), so this
    // is the range where real data exists — not the shared age-axis range
    // the CSV's minAge/maxAge was derived from. Bucketing uses these so
    // records with partial coverage inside a shared axis split correctly.
    const effectiveByTsid = {};
    for (const tsid of tsidOrder) {
      const s = series[tsid];
      const t = s && Array.isArray(s.time) ? s.time.filter(Number.isFinite) : [];
      if (t.length > 0) {
        let mn = t[0], mx = t[0];
        for (let i = 1; i < t.length; i++) {
          if (t[i] < mn) mn = t[i];
          if (t[i] > mx) mx = t[i];
        }
        // Server's time array is already in `commonTimeUnit`; convert back
        // to yr BP for our bucketing (CSV's canonical unit).
        if (commonTimeUnit && commonTimeUnit !== 'yr BP') {
          mn = _convertTimeValue(mn, commonTimeUnit, 'yr BP');
          mx = _convertTimeValue(mx, commonTimeUnit, 'yr BP');
        }
        // Normalize min/max after potential conversion
        effectiveByTsid[tsid] = { min: Math.min(mn, mx), max: Math.max(mn, mx) };
      }
    }

    groupState[ds.dataSetName] = {
      series,
      pairs,
      tsidColors,
      commonTimeUnit,
      effectiveByTsid,
      // Pre-select the two longest series so the metrics strip shows
      // something meaningful on first expand.
      selectedTsids: _pickInitialDatasetPair(tsidOrder, series),
      seriesFilter: 'all',
    };
    // Auto-remove perfect duplicates before the first render so the user
    // sees the cleaned selection straight away. Skipped if the user has
    // already touched the dataset (saved / run before) — we don't want to
    // override a manual decision.
    const autoRemoved = savedDatasets.has(ds.dataSetName)
      ? 0 : _autoRemovePerfectDuplicates(ds.dataSetName);

    // Pairs are now loaded — the presumed-unique check in recomputeDatasets
    // can read them. Always rerun so a dataset that starts needs-review can
    // promote to auto-picked when all kept pairs have |r| <= 0.5.
    if (autoRemoved > 0) {
      // The removal may have moved this dataset out of 'needs-review' into
      // 'auto-picked'. updateFooter rebuilds the panel, which re-renders the
      // card (including the candidate table) with the new state.
      updateFooter();
    } else {
      // No removals — rerun recompute in case the correlation-based
      // promotion applies, then re-render in place.
      const prevStatus = ds.status;
      recomputeDatasets();
      const newDs = datasetsInfo.find(d => d.dataSetName === ds.dataSetName);
      if (newDs && newDs.status !== prevStatus) {
        updateFooter();
      } else {
        _rerenderDatasetCandidateTable(ds.dataSetName);
      }
    }

    _renderDatasetReviewPlot(ds.dataSetName);
    _renderDatasetPairSelector(ds.dataSetName);
    _renderDatasetSeriesToggle(ds.dataSetName);
    _renderDatasetCorrelationMatrix(ds.dataSetName);
    renderDatasetMetrics(ds.dataSetName);
  } catch (err) {
    loadedDatasets.delete(ds.dataSetName);  // allow retry on next expand
    const el = document.getElementById(`ds-plot-${ds.dataSetName}`);
    if (el) {
      el.classList.remove('loading');
      el.textContent = `Time-series load failed: ${err.message}`;
      el.style.color = '#c66';
    }
  }
}

// Rebuild the candidate-table wrapper for one expanded dataset using the
// current groupState context (effective ranges + common time unit). Called
// after /correlate loads or any time those inputs change, so the expanded
// table's bucketing and Age-column unit stay aligned with the plot above it.
function _rerenderDatasetCandidateTable(dsName) {
  const ds = datasetsInfo.find(d => d.dataSetName === dsName);
  if (!ds) return;
  const wrap = document.getElementById(`ds-table-${dsName}`);
  if (!wrap) return;
  const allTsids = [...(ds.autoKeptTsids || []), ...(ds.autoDroppedTsids || [])];
  const st = groupState[dsName];
  const ctx = {
    effectiveByTsid: st && st.effectiveByTsid,
    // Always use the session-wide display unit so every table in the app
    // agrees — not the per-group commonTimeUnit.
    timeUnit: displayTimeUnit,
  };
  wrap.innerHTML = _renderCandidateTable(allTsids, ctx);
  _colorDatasetTableRows(dsName);
}

// Near-identical records are records whose effective time range matches
// within this tolerance (in yr BP, the CSV's canonical unit). 1 yr or 1 %
// of the shorter span — whichever is larger — keeps annual records strict
// while tolerating minor edge differences on long paleoclimate records.
const _PERFECT_DUP_PEARSON = 0.995;
function _rangesEffectivelyEqual(a, b) {
  if (!a || !b) return false;
  const spanA = Math.abs(a.max - a.min);
  const spanB = Math.abs(b.max - b.min);
  const tol = Math.max(1, 0.01 * Math.min(spanA, spanB));
  return Math.abs(a.min - b.min) <= tol && Math.abs(a.max - b.max) <= tol;
}

// Within each already-bucketed group of candidates, find clusters of
// records that are perfect duplicates (Pearson r > 0.995 AND matching
// effective temporal coverage) and deselect all but the LMR-preferred
// record in each cluster. Appends a note to datasetNotes so the removal
// is traceable. Returns the number of TSids auto-removed.
function _autoRemovePerfectDuplicates(dsName) {
  const st = groupState[dsName];
  const ds = datasetsInfo.find(d => d.dataSetName === dsName);
  if (!st || !ds || !Array.isArray(st.pairs)) return 0;

  // Build fast Pearson lookup
  const pMap = new Map();
  for (const p of st.pairs) {
    const key = [p.tsid1, p.tsid2].sort().join('\x00');
    pMap.set(key, p.pearson);
  }
  const pearsonOf = (a, b) => pMap.get([a, b].sort().join('\x00'));

  const effective = st.effectiveByTsid || {};
  const allTsids = [...(ds.autoKeptTsids || []), ...(ds.autoDroppedTsids || [])];
  // Bucket with current effective ranges (same key function the table uses)
  const buckets = _bucketDatasetCandidates(allTsids, effective);

  const removedTsids = [];

  for (const bucket of buckets) {
    if (bucket.records.length < 2) continue;
    const memberTsids = bucket.records.map(r => r.tsid);

    // Union-find over bucket members, linking pairs that are near-identical
    const parent = {};
    memberTsids.forEach(t => { parent[t] = t; });
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };

    for (let i = 0; i < memberTsids.length; i++) {
      for (let j = i + 1; j < memberTsids.length; j++) {
        const ti = memberTsids[i], tj = memberTsids[j];
        const r = pearsonOf(ti, tj);
        if (r == null || !(r > _PERFECT_DUP_PEARSON)) continue;
        if (!_rangesEffectivelyEqual(effective[ti], effective[tj])) continue;
        union(ti, tj);
      }
    }

    // Group by cluster root
    const clusters = new Map();
    for (const t of memberTsids) {
      const root = find(t);
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root).push(t);
    }
    for (const cluster of clusters.values()) {
      if (cluster.length < 2) continue;
      // Preferred record — bucket records are already sorted by
      // _comparePreference, so the first cluster member in bucket order wins.
      const preferred = bucket.records.find(r => cluster.includes(r.tsid));
      if (!preferred) continue;
      for (const t of cluster) {
        if (t === preferred.tsid) continue;
        if (!excludedTSIDs.has(t)) {
          excludedTSIDs.add(t);
          removedTsids.push(t);
        }
      }
    }
  }

  if (removedTsids.length === 0) return 0;

  // Recompute datasetsInfo so the needs-review / auto-picked split reflects
  // the new kept-count immediately.
  recomputeDatasets();

  const noteLine =
    `Auto-removed ${removedTsids.length} perfect duplicate${removedTsids.length === 1 ? '' : 's'} ` +
    `(Pearson r > ${_PERFECT_DUP_PEARSON}, matching temporal coverage): ${removedTsids.join(', ')}.`;
  const existing = (datasetNotes[dsName] || '').trim();
  datasetNotes[dsName] = existing && !existing.includes(noteLine)
    ? `${existing}\n${noteLine}`
    : (existing.includes(noteLine) ? existing : noteLine);

  // Sync any matching Step 2 duplicate-group radios
  for (const t of removedTsids) {
    syncTableRow(t);
    for (const g of duplicateGroups) {
      if (!g.records.includes(t)) continue;
      const keepRadio   = document.querySelector(`input[name="dup-${g.groupId}-${t}"][value="keep"]`);
      const removeRadio = document.querySelector(`input[name="dup-${g.groupId}-${t}"][value="remove"]`);
      if (keepRadio)   keepRadio.checked   = false;
      if (removeRadio) removeRadio.checked = true;
    }
  }

  return removedTsids.length;
}

function _pickInitialDatasetPair(tsidOrder, series) {
  // Pre-select the two longest series on first expand. Lets the metrics
  // strip show a non-trivial Pearson/DTW out of the box rather than
  // requiring the user to click around. Falls back to first two if lengths
  // are unknown.
  const byLen = tsidOrder.slice().sort((a, b) => {
    const la = (series[a] && series[a].values || []).length;
    const lb = (series[b] && series[b].values || []).length;
    return lb - la;
  });
  return byLen.slice(0, Math.min(2, tsidOrder.length));
}

// Correlation-matrix heat map. Gradient is white → presto-blue for positive r,
// white → presto-red for negative. Strong (|r| > 0.6) cells flip text white
// for legibility; NaN cells render neutral-grey with an em-dash.
function _correlationColor(r) {
  if (!Number.isFinite(r)) return '#f5f5f5';
  const a = Math.min(1, Math.abs(r));
  if (r >= 0) {
    const R = Math.round(255 + a * (42 - 255));
    const G = Math.round(255 + a * (100 - 255));
    const B = Math.round(255 + a * (150 - 255));
    return `rgb(${R},${G},${B})`;
  }
  const R = Math.round(255 + a * (178 - 255));
  const G = Math.round(255 + a * (34 - 255));
  const B = Math.round(255 + a * (68 - 255));
  return `rgb(${R},${G},${B})`;
}

function _renderCorrelationMatrix(key, opts) {
  // Generic renderer keyed by groupState[key]. opts.containerId selects the
  // target DOM element; opts.onCellClick is the GLOBAL function name to
  // invoke when a cell is clicked (signature: fn(key, tsidA, tsidB)).
  // Only checked (non-excluded) records contribute rows/columns — the matrix
  // follows the same keep/remove state as the metadata table beneath it.
  // Threshold is on the ORIGINAL series count (>= 3) so a 3-record group
  // that loses one via exclusion still shows a 2x2 matrix. A group that
  // starts with only 2 records uses the metric chips instead.
  const containerId = (opts && opts.containerId) || `ds-corr-matrix-${key}`;
  const onCellClick = (opts && opts.onCellClick) || 'setDatasetPair';
  const el = document.getElementById(containerId);
  const st = groupState[key];
  if (!el || !st || !st.pairs) return;
  const allTsids = Object.keys(st.series);
  if (allTsids.length < 3) {
    el.innerHTML = '';
    el.style.display = 'none';
    return;
  }
  const tsids = allTsids.filter(t => !excludedTSIDs.has(t));
  if (tsids.length < 2) {
    el.innerHTML = '';
    el.style.display = 'none';
    return;
  }

  const pMap = new Map();
  for (const p of st.pairs) {
    const mk = [p.tsid1, p.tsid2].sort().join('\x00');
    pMap.set(mk, p.pearson);
  }
  const rOf = (a, b) => (a === b ? 1 : pMap.get([a, b].sort().join('\x00')));

  const safeKey = String(key).replace(/['"\\]/g, c => '\\' + c);
  const headerCells = tsids.map(t => {
    const color = st.tsidColors[t] || '#666';
    const label = shortName((st.series[t] && st.series[t].label) || t, 10);
    return `<th style="color:${color}" title="${escapeHtml(t)}">${escapeHtml(label)}</th>`;
  }).join('');

  const bodyRows = tsids.map(a => {
    const color = st.tsidColors[a] || '#666';
    const label = shortName((st.series[a] && st.series[a].label) || a, 18);
    const cells = tsids.map(b => {
      const r = rOf(a, b);
      if (r == null || !Number.isFinite(r)) {
        return `<td class="corr-cell na">—</td>`;
      }
      const bg = _correlationColor(r);
      const fg = Math.abs(r) > 0.6 ? '#fff' : '#222';
      if (a === b) {
        return `<td class="corr-cell diag" style="background:${bg};color:${fg}">1.00</td>`;
      }
      const safeA = a.replace(/['"\\]/g, c => '\\' + c);
      const safeB = b.replace(/['"\\]/g, c => '\\' + c);
      return `<td class="corr-cell" style="background:${bg};color:${fg}" ` +
        `title="${escapeHtml(a)} × ${escapeHtml(b)}: r=${r.toFixed(3)}" ` +
        `onclick="${onCellClick}('${safeKey}', '${safeA}', '${safeB}')">` +
        `${r.toFixed(2)}</td>`;
    }).join('');
    return `<tr><th class="corr-row-head" style="color:${color}" ` +
      `title="${escapeHtml(a)}">${escapeHtml(label)}</th>${cells}</tr>`;
  }).join('');

  el.innerHTML =
    `<details class="corr-matrix-wrap" open>` +
      `<summary class="corr-matrix-summary">` +
        `Correlation matrix (Pearson <em>r</em>, ${tsids.length}×${tsids.length}) — ` +
        `<span style="color:#888;font-weight:400;">click any cell to load that pair</span>` +
      `</summary>` +
      `<div class="corr-matrix-scroll">` +
        `<table class="corr-matrix">` +
          `<thead><tr><th></th>${headerCells}</tr></thead>` +
          `<tbody>${bodyRows}</tbody>` +
        `</table>` +
      `</div>` +
    `</details>`;
  el.style.display = '';
}

// Step 1 wrapper — keeps existing callers working.
function _renderDatasetCorrelationMatrix(dsName) {
  _renderCorrelationMatrix(dsName, {
    containerId: `ds-corr-matrix-${dsName}`,
    onCellClick: 'setDatasetPair',
  });
}

// Step 2 counterparts of setDatasetPair / setAllDatasetCandidates — they
// let the mirrored table + correlation matrix inside a duplicate-group
// card operate on the group's state and member records.
function setGroupPair(groupId, tsidA, tsidB) {
  const gid = Number(groupId);
  const st = groupState[gid];
  if (!st) return;
  for (const t of (st.selectedTsids || [])) setChipSelected(gid, t, false);
  st.selectedTsids = [tsidA, tsidB];
  const col = st.tsidColors || {};
  for (const t of st.selectedTsids) setChipSelected(gid, t, true, col[t]);
  renderGroupMetrics(gid);
  // Clicking a matrix cell is an explicit "show me these two" gesture;
  // switch the plot to pair-only so the two traces are actually visible.
  st.seriesFilter = 'pair';
  const allBtn  = document.getElementById(`toggle-all-${gid}`);
  const pairBtn = document.getElementById(`toggle-pair-${gid}`);
  if (allBtn)  allBtn.classList.remove('active');
  if (pairBtn) pairBtn.classList.add('active');
  const plotEl = document.getElementById(`plot-${gid}`);
  if (plotEl) renderGroupPlot(gid, st.series, st.tsidColors, plotEl, st.selectedTsids);
}

function setAllGroupCandidates(groupId, selectAll) {
  const gid = Number(groupId);
  const group = duplicateGroups.find(g => g.groupId === gid);
  if (!group) return;
  const affectedDatasets = new Set();
  for (const tsid of group.records) {
    if (selectAll) excludedTSIDs.delete(tsid);
    else           excludedTSIDs.add(tsid);
    syncTableRow(tsid);
    const keepRadio   = document.querySelector(`input[name="dup-${gid}-${tsid}"][value="keep"]`);
    const removeRadio = document.querySelector(`input[name="dup-${gid}-${tsid}"][value="remove"]`);
    if (keepRadio)   keepRadio.checked   = selectAll;
    if (removeRadio) removeRadio.checked = !selectAll;
    const ds = datasetsInfo.find(d =>
      (d.autoKeptTsids || []).includes(tsid) ||
      (d.autoDroppedTsids || []).includes(tsid) ||
      (d.candidateTsids  || []).includes(tsid)
    );
    if (ds) affectedDatasets.add(ds.dataSetName);
  }
  if (groupState[gid]) {
    // Refresh the plot for the bulk-toggled group. Calling refreshGroupViews
    // on any member picks up the group's full kept/excluded state.
    if (group.records.length > 0) refreshGroupViews(group.records[0]);
    _renderCorrelationMatrix(gid, {
      containerId: `dup-corr-matrix-${gid}`,
      onCellClick: 'setGroupPair',
    });
  }
  for (const dsName of affectedDatasets) {
    if (expandedDatasets.has(dsName) && groupState[dsName]) {
      _renderDatasetCorrelationMatrix(dsName);
    }
  }
  updateFooter();
}

function setDatasetPair(dsName, tsidA, tsidB) {
  const st = groupState[dsName];
  if (!st) return;
  for (const t of st.selectedTsids) _setDatasetChipSelected(dsName, t, false);
  st.selectedTsids = [tsidA, tsidB];
  for (const t of st.selectedTsids) _setDatasetChipSelected(dsName, t, true);
  renderDatasetMetrics(dsName);
  // Clicking a cell is an explicit "show me this pair" gesture — flip the
  // plot to "Selected pair" mode so the two series are actually visible,
  // not drowned in the full set of traces.
  st.seriesFilter = 'pair';
  _renderDatasetSeriesToggle(dsName);
  _renderDatasetReviewPlot(dsName);
}

function _renderDatasetSeriesToggle(dsName) {
  const el = document.getElementById(`ds-series-toggle-${dsName}`);
  const st = groupState[dsName];
  if (!el || !st) return;
  // Only meaningful for 2+ series. Single-series datasets always render "all".
  const tsidCount = Object.keys(st.series).length;
  if (tsidCount < 2) {
    el.innerHTML = '';
    el.style.display = 'none';
    return;
  }
  const safeName = dsName.replace(/['"\\]/g, c => '\\' + c);
  const filter = st.seriesFilter || 'all';
  el.innerHTML =
    `<span class="series-toggle-label">Show:</span>` +
    `<button class="toggle-btn${filter === 'all' ? ' active' : ''}" ` +
      `onclick="setDatasetSeriesFilter('${safeName}', 'all')">All series</button>` +
    `<button class="toggle-btn${filter === 'pair' ? ' active' : ''}" ` +
      `onclick="setDatasetSeriesFilter('${safeName}', 'pair')">Selected pair</button>`;
  el.style.display = '';
}

function setDatasetSeriesFilter(dsName, filter) {
  const st = groupState[dsName];
  if (!st) return;
  st.seriesFilter = filter;
  _renderDatasetSeriesToggle(dsName);
  _renderDatasetReviewPlot(dsName);
}

function _renderDatasetPairSelector(dsName) {
  const el = document.getElementById(`ds-pair-selector-${dsName}`);
  const st = groupState[dsName];
  if (!el || !st) return;
  const tsidOrder = Object.keys(st.series);
  // Only show the selector for 3+ series — with 2 there's a single pair and
  // the metrics strip already reflects it unambiguously.
  if (tsidOrder.length < 3) {
    el.innerHTML = '';
    el.style.display = 'none';
    return;
  }
  const safeName = dsName.replace(/['"\\]/g, c => '\\' + c);
  const chips = tsidOrder.map(tsid => {
    const color = st.tsidColors[tsid];
    const s = st.series[tsid] || {};
    const name = shortName(s.label || tsid);
    return `<button class="record-chip" id="ds-chip-${dsName}-${CSS.escape(tsid)}"
              style="--chip-color:${color};border-color:${color}"
              onclick="toggleDatasetRecordSelection('${safeName}', '${tsid}')"
              title="${escapeHtml(s.label || tsid)}">
              <span class="record-dot" style="background:${color}"></span>${escapeHtml(name)}</button>`;
  }).join('');
  el.innerHTML = `<span class="pair-selector-label">Select two:</span>${chips}`;
  el.style.display = '';
  for (const tsid of st.selectedTsids) _setDatasetChipSelected(dsName, tsid, true);
  for (const tsid of tsidOrder) {
    if (excludedTSIDs.has(tsid)) {
      const chip = document.getElementById(`ds-chip-${dsName}-${CSS.escape(tsid)}`);
      if (chip) chip.classList.add('excluded');
    }
  }
}

function _setDatasetChipSelected(dsName, tsid, selected) {
  const chip = document.getElementById(`ds-chip-${dsName}-${CSS.escape(tsid)}`);
  if (chip) chip.classList.toggle('selected', !!selected);
}

function toggleDatasetRecordSelection(dsName, tsid) {
  const st = groupState[dsName];
  if (!st) return;
  const idx = st.selectedTsids.indexOf(tsid);
  if (idx >= 0) {
    st.selectedTsids.splice(idx, 1);
    _setDatasetChipSelected(dsName, tsid, false);
  } else {
    if (st.selectedTsids.length >= 2) {
      const dropped = st.selectedTsids.shift();
      _setDatasetChipSelected(dsName, dropped, false);
    }
    st.selectedTsids.push(tsid);
    _setDatasetChipSelected(dsName, tsid, true);
  }
  renderDatasetMetrics(dsName);
  if (st.seriesFilter === 'pair') _renderDatasetReviewPlot(dsName);
}

function renderDatasetMetrics(dsName) {
  const st = groupState[dsName];
  const scoresEl = document.getElementById(`ds-detail-scores-${dsName}`);
  if (!st || !scoresEl) return;

  let pair = null;
  if (st.selectedTsids.length === 2) {
    const [t1, t2] = st.selectedTsids;
    pair = (st.pairs || []).find(p =>
      (p.tsid1 === t1 && p.tsid2 === t2) ||
      (p.tsid1 === t2 && p.tsid2 === t1)
    );
  } else if ((st.pairs || []).length === 1) {
    pair = st.pairs[0];
  }

  const TIPS = {
    r:   'Pearson r on overlapping intervals. Range −1..1. ≥ 0.8 suggests the two records co-vary — a strong signal they are duplicates (e.g. a master composite and its constituent cores in the same dataset).',
    dtw: 'DTW: shape-similarity score (0 identical, 1 opposite). < 0.03 ≈ near-identical series.',
  };
  const na = (label, title) => chip(label, '—', 'na', title);

  if (!pair) {
    const hint = st.selectedTsids.length === 1
      ? '<span style="color:#888;font-size:0.8rem;margin-left:6px;">Select one more record</span>'
      : '<span style="color:#888;font-size:0.8rem;margin-left:6px;">Select two records to compare</span>';
    scoresEl.innerHTML = `<div class="metrics-strip">${na('Pearson r', TIPS.r)}${na('DTW', TIPS.dtw)}${hint}</div>`;
  } else {
    const rChip   = chip('Pearson r', pair.pearson != null ? pair.pearson.toFixed(3) : '—', pair.pearson == null ? 'na' : pair.pearson > 0.8 ? '' : 'warn', TIPS.r);
    const dtwChip = chip('DTW',       pair.dtw     != null ? pair.dtw.toFixed(4)     : '—', pair.dtw     == null ? 'na' : pair.dtw < 0.03    ? '' : 'warn', TIPS.dtw);
    scoresEl.innerHTML = `<div class="metrics-strip">${rChip}${dtwChip}</div>`;
  }
  scoresEl.style.display = '';
}

function _renderDatasetReviewPlot(dsName) {
  const el = document.getElementById(`ds-plot-${dsName}`);
  const st = groupState[dsName];
  if (!el || !st) return;
  el.classList.remove('loading');
  el.textContent = '';
  let filter;
  if (st.seriesFilter === 'pair' && st.selectedTsids && st.selectedTsids.length > 0) {
    filter = st.selectedTsids.slice();
  } else {
    // 'all' mode — every kept (non-excluded) series in the dataset.
    filter = Object.keys(st.series).filter(t => !excludedTSIDs.has(t));
  }
  // renderGroupPlot doubles as the step-1 plotter — state keyed by dsName.
  renderGroupPlot(dsName, st.series, st.tsidColors, el, filter);
  // Color the Variable column cells to match the Plotly trace colors, so
  // the user can visually link each row to its plotted line. Matches the
  // pattern loadGroupDetails uses on .record-name in step 2.
  _colorDatasetTableRows(dsName);
}

function _colorDatasetTableRows(dsName) {
  const st = groupState[dsName];
  if (!st || !st.tsidColors) return;
  const wrapper = document.getElementById(`ds-table-${dsName}`);
  if (!wrapper) return;
  _colorCandidateTableRows(wrapper, st.tsidColors);
}

// Color the Variable column of a rendered candidate table so each row's
// label matches its plotted trace color. Walks every `[data-tsid]` row
// across all sub-tables (near-duplicate buckets each produce one).
function _colorCandidateTableRows(wrapper, tsidColors) {
  if (!wrapper || !tsidColors) return;
  for (const tr of wrapper.querySelectorAll('tr[data-tsid]')) {
    const tsid = tr.getAttribute('data-tsid');
    const color = tsidColors[tsid];
    if (!color) continue;
    const varCell = tr.querySelector('td.ds-td-var');
    if (varCell) varCell.style.color = color;
  }
}

// Time-unit conversion. lipdverseR's `minAge` / `maxAge` are always in yr BP
// (its derivedMetadata converts yr AD → BP before taking min/max), so that's
// our canonical source unit. Targets we support are the canonical units the
// server picks in `_pick_common_unit`.
function _convertTimeValue(v, src, dst) {
  if (!Number.isFinite(v) || !src || !dst || src === dst) return v;
  // Normalize to yr BP as an intermediate
  let bp;
  if (src === 'yr BP')      bp = v;
  else if (src === 'yr AD') bp = 1950 - v;
  else if (src === 'ka BP') bp = v * 1000;
  else if (src === 'Ma BP') bp = v * 1_000_000;
  else return v;
  if (dst === 'yr BP') return bp;
  if (dst === 'yr AD') return 1950 - bp;
  if (dst === 'ka BP') return bp / 1000;
  if (dst === 'Ma BP') return bp / 1_000_000;
  return v;
}

// Convert a CSV-native BP age value into the session's display unit and
// return a pretty string for the main records table.
function _formatAgeCell(bpValue) {
  if (bpValue == null || !Number.isFinite(bpValue)) return '—';
  const v = _convertTimeValue(bpValue, 'yr BP', displayTimeUnit);
  return _formatAgeValue(v, displayTimeUnit);
}

function _formatAgeValue(v, unit) {
  if (!Number.isFinite(v)) return '?';
  if (unit === 'ka BP' || unit === 'Ma BP') return v.toFixed(2).replace(/\.?0+$/, '');
  const abs = Math.abs(v);
  if (abs >= 100) return Math.round(v).toString();
  if (abs >= 1)   return v.toFixed(1).replace(/\.0$/, '');
  return v.toFixed(2).replace(/\.?0+$/, '');
}

// Render the age range for a record in the chosen target unit. `effective`
// is the optional non-NaN min/max from the loaded series; falls back to the
// CSV minAge/maxAge. The CSV values are ALWAYS interpreted as yr BP.
function _ageRangeStr(r, targetUnit, effective) {
  const unit = targetUnit || 'yr BP';
  const loSrc = effective && Number.isFinite(effective.min) ? effective.min : r.minAge;
  const hiSrc = effective && Number.isFinite(effective.max) ? effective.max : r.maxAge;
  const lo = Number.isFinite(loSrc) ? _convertTimeValue(loSrc, 'yr BP', unit) : null;
  const hi = Number.isFinite(hiSrc) ? _convertTimeValue(hiSrc, 'yr BP', unit) : null;
  if (lo == null && hi == null) return '';
  // For AD, chronological order is (older, younger) = (smaller, larger).
  // For BP, it's the reverse. Always print as "older–younger" based on unit.
  let left, right;
  if (unit === 'yr AD') {
    left  = (lo != null && hi != null) ? Math.min(lo, hi) : (lo ?? hi);
    right = (lo != null && hi != null) ? Math.max(lo, hi) : (lo ?? hi);
  } else {
    left  = (lo != null && hi != null) ? Math.max(lo, hi) : (lo ?? hi);
    right = (lo != null && hi != null) ? Math.min(lo, hi) : (lo ?? hi);
  }
  return `${_formatAgeValue(left, unit)}–${_formatAgeValue(right, unit)}`;
}

function _resStr(r) {
  if (r.resolution == null || !Number.isFinite(r.resolution)) return '';
  return r.resolution < 1 ? r.resolution.toFixed(2) : String(Math.round(r.resolution));
}

function _td(value, cls) {
  const safe = (value == null || value === '' || value === 'NA') ? '—' : escapeHtml(value);
  return `<td${cls ? ` class="${cls}"` : ''}>${safe}</td>`;
}

// ── Near-duplicate bucketing ───────────────────────────────────────────────
// Group a dataset's candidate records by metadata so near-duplicates sit
// together for review. Key is (variableName, units, interp_Vars set,
// seasonality, resTier, spanTier, ageMidTier). resTier + spanTier are log10-
// order-of-magnitude buckets so "annual" / "sub-annual" / "centennial" end
// up in distinct groups without being overly sensitive to floating-point
// rounding in medianResolution.
function _resTier(r) {
  if (!Number.isFinite(r) || r <= 0) return 'unknown';
  return Math.round(Math.log10(r)).toString();
}
function _spanTier(minAge, maxAge) {
  if (!Number.isFinite(minAge) || !Number.isFinite(maxAge)) return 'unknown';
  const span = Math.abs(maxAge - minAge);
  if (span <= 0) return '0';
  return Math.round(Math.log10(span)).toString();
}
function _ageMidTier(minAge, maxAge) {
  // Mid-point rounded to the span tier so two records with slightly different
  // starts but matching length end up in the same bucket. Prevents 01A
  // (-43..56) and a hypothetical (−50..50) from landing apart.
  if (!Number.isFinite(minAge) || !Number.isFinite(maxAge)) return 'unknown';
  const mid = (minAge + maxAge) / 2;
  const span = Math.abs(maxAge - minAge) || 1;
  // Round mid to ~10% of span so minor offsets don't split the bucket.
  const gran = Math.max(1, Math.pow(10, Math.floor(Math.log10(span)) - 1));
  return (Math.round(mid / gran) * gran).toString();
}
function _interpKey(raw) {
  return interpBucketsFor({ interp_Vars: raw }).slice().sort().join('|');
}

function _bucketKey(r, effective) {
  // `effective` overrides minAge/maxAge from the CSV with the range actually
  // covered by non-NaN values. The CSV values come from the shared age axis
  // and collapse genuinely different coverage within one dataset into the
  // same bucket.
  const lo = effective && Number.isFinite(effective.min) ? effective.min : r.minAge;
  const hi = effective && Number.isFinite(effective.max) ? effective.max : r.maxAge;
  return [
    (r.variableName || '').trim().toLowerCase(),
    (r.units || '').trim().toLowerCase(),
    _interpKey(r.interp_Vars),
    (r.interp_Details || '').trim().toLowerCase(),
    (r.seasonality || '').trim().toLowerCase(),
    _resTier(r.resolution),
    _spanTier(lo, hi),
    _ageMidTier(lo, hi),
  ].join(' | ');
}

// Recon-specific preference ranking. LMR is an annual reconstruction, so
// annual resolution + any declared seasonality are the primary signals for
// picking the best record within a near-duplicate bucket. Other recons fall
// back to a neutral rank (longest span → finest resolution → tsid alpha)
// since we don't know their target cadence.
//
// Returns a sort key tuple — lower sorts first. Fields that are "more is
// better" (span, nComps) are negated.
function _isLmrRecon() {
  return typeof RECON === 'string' && RECON === 'LMR';
}

function _recordPreferenceKey(r) {
  if (_isLmrRecon()) {
    const res = Number.isFinite(r.resolution) ? r.resolution : NaN;
    const annualDistance = Number.isFinite(res) && res > 0
      ? Math.abs(Math.log10(res))
      : 99;
    const hasSeason = r.seasonality && String(r.seasonality).trim() &&
                      String(r.seasonality).trim().toLowerCase() !== 'na' ? 0 : 1;
    const span = Number.isFinite(r.minAge) && Number.isFinite(r.maxAge)
      ? -Math.abs(r.maxAge - r.minAge) : 0;
    const nComps = (r.compilation || '').split(/[|;,]/).filter(Boolean).length;
    return [annualDistance, hasSeason, span, -nComps, r.tsid || ''];
  }
  // Neutral rank for non-LMR recons.
  const span = Number.isFinite(r.minAge) && Number.isFinite(r.maxAge)
    ? -Math.abs(r.maxAge - r.minAge) : 0;
  const res = Number.isFinite(r.resolution) && r.resolution > 0
    ? r.resolution : Infinity;
  return [span, res, r.tsid || ''];
}

function _comparePreference(a, b) {
  const ka = _recordPreferenceKey(a);
  const kb = _recordPreferenceKey(b);
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
}

function _bucketLabel(recs, effectiveByTsid) {
  // Short human label summarising what makes a bucket distinct. Uses the
  // effective time range (non-NaN values) when available, falling back to
  // the CSV's shared-axis range otherwise.
  const r = recs[0];
  const eff = effectiveByTsid && effectiveByTsid[r.tsid];
  const lo = eff && Number.isFinite(eff.min) ? eff.min : r.minAge;
  const hi = eff && Number.isFinite(eff.max) ? eff.max : r.maxAge;

  const res = Number.isFinite(r.resolution) ? r.resolution : null;
  let resTxt;
  if (res == null)      resTxt = 'unknown res';
  else if (res < 0.5)   resTxt = `${res.toFixed(2)}-yr (sub-annual)`;
  else if (res <= 1.5)  resTxt = 'annual';
  else if (res < 10)    resTxt = `${res.toFixed(0)}-yr`;
  else if (res < 100)   resTxt = `${Math.round(res)}-yr (decadal)`;
  else                  resTxt = `${Math.round(res)}-yr (centennial+)`;

  let spanTxt;
  if (Number.isFinite(lo) && Number.isFinite(hi)) {
    const span = Math.abs(hi - lo);
    if (span < 500)            spanTxt = `${Math.round(span)}-yr span`;
    else if (span < 10000)     spanTxt = `${(span / 1000).toFixed(1)}-kyr span`;
    else                       spanTxt = `${Math.round(span / 1000)}-kyr span`;
  } else {
    spanTxt = 'unknown span';
  }

  const season = (r.seasonality || '').trim();
  const seasonTxt = season && season.toLowerCase() !== 'na' ? ` · ${season}` : '';
  return `${r.variableName || 'unknown'} · ${resTxt} · ${spanTxt}${seasonTxt}`;
}

// Split the TSids for one dataset into near-duplicate buckets. Each bucket
// is ordered by LMR preference (annual + seasonality first). Returns an
// ordered list of buckets, multi-record buckets first, then solo buckets,
// each outer group sorted by the preference of its first record.
//
// `effectiveByTsid` (optional): {tsid: {min, max}} with the non-NaN time
// range per TSid (populated after /correlate loads). When absent, bucketing
// falls back to the CSV's shared-axis minAge/maxAge.
function _bucketDatasetCandidates(tsids, effectiveByTsid) {
  const byKey = new Map();
  for (const tsid of tsids || []) {
    const r = _recordByTsid(tsid);
    if (!r) continue;
    const eff = effectiveByTsid && effectiveByTsid[tsid];
    const key = _bucketKey(r, eff);
    if (!byKey.has(key)) byKey.set(key, { key, records: [] });
    byKey.get(key).records.push(r);
  }
  const buckets = [];
  for (const { records } of byKey.values()) {
    records.sort(_comparePreference);
    buckets.push({
      label: _bucketLabel(records, effectiveByTsid),
      records,
    });
  }
  buckets.sort((a, b) => {
    // Multi-record buckets first (they need review), then solo
    const mA = a.records.length > 1 ? 0 : 1;
    const mB = b.records.length > 1 ? 0 : 1;
    if (mA !== mB) return mA - mB;
    return _comparePreference(a.records[0], b.records[0]);
  });
  return buckets;
}

// Candidate rows as a side-by-side comparison table so users can visually
// scan variableName / proxy / interp / detail / season / units / age / res /
// compilation / tsid in aligned columns. Now grouped into near-duplicate
// buckets — records that match on metadata-equivalent fields sit together
// in a framed sub-table. The top record per multi-record bucket is marked
// with a ★ to hint at the LMR-preferred choice (annual + seasonality
// first); it is NOT auto-selected.
//
// `ctx` (optional): { effectiveByTsid, timeUnit }. When supplied, the
// bucketing uses non-NaN time ranges from the loaded series and the Age
// column renders in the plot's time unit — so the expanded table and the
// plot above it agree on both grouping and labels.
function _renderCandidateTable(tsids, ctx) {
  const all = (tsids || []);
  const total = all.length;
  const effectiveByTsid = (ctx && ctx.effectiveByTsid) || null;
  const timeUnit        = (ctx && ctx.timeUnit)        || 'yr BP';
  const ageColLabel     = `Age (${timeUnit})`;
  const selectedCount = all.filter(t => !excludedTSIDs.has(t)).length;
  // Step 1 uses the dataset name as its bulk key; Step 2 passes its numeric
  // groupId and a group-aware handler. Defaults preserve the Step 1 behavior.
  const bulkHandler = (ctx && ctx.bulkHandler) || 'setAllDatasetCandidates';
  const bulkKey     = (ctx && ctx.bulkKey != null)
    ? String(ctx.bulkKey)
    : (total > 0 ? ((_recordByTsid(all[0]) || {}).dataSetName || '') : '');
  const bulkKeyAttr = bulkKey.replace(/['"\\]/g, c => '\\' + c);

  const toolbar = (
    `<div class="ds-table-toolbar">` +
      `<span class="ds-table-count">${selectedCount} of ${total} selected</span>` +
      `<button type="button" class="btn-ds-bulk" onclick="${bulkHandler}('${bulkKeyAttr}', true)">Select all</button>` +
      `<button type="button" class="btn-ds-bulk" onclick="${bulkHandler}('${bulkKeyAttr}', false)">Deselect all</button>` +
    `</div>`
  );

  const buckets = _bucketDatasetCandidates(all, effectiveByTsid);
  const parts = [];
  let multiIdx = 0;
  for (const bucket of buckets) {
    const multi = bucket.records.length > 1;
    const bucketKept = bucket.records.filter(r => !excludedTSIDs.has(r.tsid)).length;
    const topTsid = multi ? bucket.records[0].tsid : null;
    // Only show the ★ "LMR-preferred" indicator when the top record is
    // meaningfully better than the runner-up — i.e., the preference key
    // differs on something other than the tsid alpha tiebreaker. Otherwise
    // the star is just redundantly marking the alphabetically-first TSid.
    const showPreference = _isLmrRecon() && multi && (() => {
      if (bucket.records.length < 2) return false;
      const k0 = _recordPreferenceKey(bucket.records[0]);
      const k1 = _recordPreferenceKey(bucket.records[1]);
      // Compare all fields except the last (tsid alpha tiebreaker)
      for (let i = 0; i < k0.length - 1; i++) {
        if (k0[i] !== k1[i]) return true;
      }
      return false;
    })();
    const rowsHtml = bucket.records.map((r, idx) => {
      const tsid = r.tsid;
      const checked = !excludedTSIDs.has(tsid);
      const isPreferred = idx === 0 && showPreference;
      const trCls = [
        checked ? '' : 'excluded-row',
        isPreferred ? 'preferred-row' : '',
      ].filter(Boolean).join(' ');
      const varCell = (isPreferred ? '<span class="preferred-star" title="LMR preferred: annual resolution + seasonality weighted first">★</span> ' : '') +
                      (r.variableName ? escapeHtml(r.variableName) : '—');
      return (
        `<tr${trCls ? ` class="${trCls}"` : ''} data-tsid="${escapeHtml(tsid)}">` +
          `<td><input type="checkbox" ${checked ? 'checked' : ''} ` +
            `onchange="toggleDatasetCandidate('${escapeHtml(tsid)}')" /></td>` +
          `<td class="ds-td-var">${varCell}</td>` +
          _td(r.proxy) +
          _td(r.interp_Vars) +
          _td(r.interp_Details) +
          _td(r.seasonality) +
          _td(r.units) +
          _td(_ageRangeStr(r, timeUnit, effectiveByTsid && effectiveByTsid[tsid])) +
          _td(_resStr(r)) +
          _td(formatCompilationString(r.compilation)) +
          _td(r.tsid, 'ds-td-tsid') +
        `</tr>`
      );
    }).join('');

    let heading;
    if (multi) {
      multiIdx++;
      heading =
        `<div class="ds-bucket-heading multi">` +
          `<strong>Near-duplicate group ${multiIdx}</strong>` +
          `<span class="ds-bucket-label">${escapeHtml(bucket.label)}</span>` +
          `<span class="ds-bucket-count">${bucketKept} / ${bucket.records.length} selected</span>` +
        `</div>`;
    } else {
      heading =
        `<div class="ds-bucket-heading solo">` +
          `<span class="ds-bucket-label">Unique · ${escapeHtml(bucket.label)}</span>` +
        `</div>`;
    }

    parts.push(
      `<div class="ds-bucket${multi ? ' ds-bucket-multi' : ' ds-bucket-solo'}">` +
        heading +
        `<table class="ds-detail-table">` +
          `<thead><tr>` +
            `<th></th><th>Variable</th><th>Proxy</th><th>Interp</th>` +
            `<th>Detail</th><th>Season</th><th>Units</th>` +
            `<th>${escapeHtml(ageColLabel)}</th><th>Res (yr)</th><th>Compilation</th><th>TSID</th>` +
          `</tr></thead>` +
          `<tbody>${rowsHtml}</tbody>` +
        `</table>` +
      `</div>`
    );
  }

  return toolbar + parts.join('');
}

function setAllDatasetCandidates(dsName, selectAll) {
  if (!dsName) return;
  const ds = datasetsInfo.find(d => d.dataSetName === dsName);
  if (!ds) return;
  const tsids = [...(ds.autoKeptTsids || []), ...(ds.autoDroppedTsids || [])];
  const affectedGroups = new Set();
  for (const tsid of tsids) {
    if (selectAll) excludedTSIDs.delete(tsid);
    else           excludedTSIDs.add(tsid);
    // Keep the duplicate-group radios in sync if the TSID appears in step 2.
    for (const g of duplicateGroups) {
      if (!g.records.includes(tsid)) continue;
      const keepRadio   = document.querySelector(`input[name="dup-${g.groupId}-${tsid}"][value="keep"]`);
      const removeRadio = document.querySelector(`input[name="dup-${g.groupId}-${tsid}"][value="remove"]`);
      if (keepRadio)   keepRadio.checked   = selectAll;
      if (removeRadio) removeRadio.checked = !selectAll;
      affectedGroups.add(g.groupId);
    }
    syncTableRow(tsid);
  }
  if (expandedDatasets.has(dsName) && groupState[dsName]) {
    _renderDatasetCorrelationMatrix(dsName);
  }
  for (const gid of affectedGroups) {
    if (groupState[gid]) {
      const grp = duplicateGroups.find(g => g.groupId === gid);
      if (grp && grp.records.length > 0) refreshGroupViews(grp.records[0]);
      _renderCorrelationMatrix(gid, {
        containerId: `dup-corr-matrix-${gid}`,
        onCellClick: 'setGroupPair',
      });
    }
  }
  updateFooter();
}

// Render one dataset card. Two variants:
//   - 'auto-picked' — ≥ 1 record in the dataset passed the AND-filter. Shows
//     the picked variableName(s) in the hint.
//   - 'excluded'    — the filter rejected every record in the dataset. Shows
//     a greyed card so users can spot accidentally over-filtered datasets.
// Both are expandable; the body (plot + comparison table) is identical.
function _renderDatasetCard(ds) {
  const allTsids = [...(ds.autoKeptTsids || []), ...(ds.autoDroppedTsids || [])];
  const isOpen = expandedDatasets.has(ds.dataSetName);
  const safeName = escapeHtml(ds.dataSetName);
  const safeNameAttr = ds.dataSetName.replace(/['"\\]/g, c => '\\' + c);

  const saved = savedDatasets.has(ds.dataSetName);

  let cardClass, hintText, statusCls, statusText;
  if (ds.status === 'excluded') {
    cardClass = 'ds-review-card excluded-ds';
    hintText  = `${allTsids.length} candidate${allTsids.length === 1 ? '' : 's'}, none match current filters — click to override`;
    statusCls = 'ds-review-status pending';
    statusText = 'Excluded';
  } else if (ds.status === 'needs-review') {
    const keptRecs = (ds.autoKeptTsids || []).map(_recordByTsid).filter(Boolean);
    const names = keptRecs.map(r => r.variableName || '?').join(', ');
    cardClass = 'ds-review-card needs-review';
    hintText  = `${keptRecs.length} kept · ${names} — likely near-duplicates, review`;
    statusCls = 'ds-review-status pending';
    statusText = `${keptRecs.length} kept`;
  } else {
    const keptRecs = (ds.autoKeptTsids || []).map(_recordByTsid).filter(Boolean);
    const names = keptRecs.map(r => r.variableName || '?').join(', ');
    const prefCount = (ds.compilationPreferredTsids || []).length;
    cardClass = 'ds-review-card auto';
    if (ds.presumedUnique) {
      hintText = `${keptRecs.length} kept · ${names} — uncorrelated (|r| ≤ 0.5), presumed distinct`;
    } else if (prefCount > 0) {
      hintText = `${keptRecs.length} kept · ${names} — ${prefCount} non-compilation record${prefCount === 1 ? '' : 's'} excluded`;
    } else {
      hintText = keptRecs.length > 0 ? `kept: ${names}` : 'click to expand';
    }
    statusCls = 'ds-confidence high';
    statusText = `${keptRecs.length} kept`;
  }
  if (saved) {
    cardClass += ' saved';
    statusCls = 'ds-review-status done';
    statusText = '✓ Saved';
  }

  const plotState = groupState[ds.dataSetName];
  const tableCtx = {
    effectiveByTsid: plotState && plotState.effectiveByTsid,
    timeUnit: displayTimeUnit,
  };
  const table = isOpen ? _renderCandidateTable(allTsids, tableCtx) : '';
  const plotLoading = !plotState || !plotState.series;
  const plotContents = plotLoading ? 'Loading time series…' : '';

  return (
    `<div class="${cardClass}" id="ds-card-${safeName}">` +
      `<div class="ds-review-header" onclick="toggleDatasetDetails('${safeNameAttr}')">` +
        `<span class="expand-icon${isOpen ? ' open' : ''}" id="ds-expand-${safeName}">&#9654;</span>` +
        `<span class="ds-review-title">${safeName}</span>` +
        `<span class="ds-review-archive">${escapeHtml(ds.archiveType || '—')}</span>` +
        `<span class="ds-review-hint">${escapeHtml(hintText)}</span>` +
        `<span class="${statusCls}" style="margin-left:auto;">${statusText}</span>` +
      `</div>` +
      `<div class="ds-review-details" id="ds-details-${safeName}" style="display:${isOpen ? '' : 'none'}">` +
        `<div class="pair-selector" id="ds-pair-selector-${safeName}" style="display:none"></div>` +
        `<div class="series-toggle" id="ds-series-toggle-${safeName}" style="display:none"></div>` +
        `<div id="ds-detail-scores-${safeName}" style="display:none"></div>` +
        `<div class="ds-review-plot${plotLoading ? ' loading' : ''}" id="ds-plot-${safeName}">${plotContents}</div>` +
        `<div id="ds-corr-matrix-${safeName}" style="display:none"></div>` +
        `<div id="ds-table-${safeName}">${table}</div>` +
        `<div class="group-notes-row">` +
          `<label class="group-notes-label" for="ds-notes-${safeName}">Notes</label>` +
          `<textarea id="ds-notes-${safeName}" class="group-notes-textarea" rows="2" ` +
            `placeholder="Add notes about this dataset's primary-proxy selection…" ` +
            `oninput="updateDatasetNotes('${safeNameAttr}', this.value)">` +
            `${(datasetNotes[ds.dataSetName] || '').replace(/</g, '&lt;')}</textarea>` +
        `</div>` +
        `<div class="ds-save-row">` +
          `<button class="btn-save-group" onclick="event.stopPropagation(); saveDataset('${safeNameAttr}')">Save</button>` +
        `</div>` +
      `</div>` +
    `</div>`
  );
}

function renderDatasetsPanel() {
  const excludedDiv = document.getElementById('datasets-excluded');
  const autoDiv     = document.getElementById('datasets-auto-picked');
  const reviewDiv   = document.getElementById('datasets-needs-review');
  const badge       = document.getElementById('datasets-count');
  if (!excludedDiv || !autoDiv || !reviewDiv) return;

  const review   = datasetsInfo.filter(d => d.status === 'needs-review');
  const picked   = datasetsInfo.filter(d => d.status === 'auto-picked');
  const excluded = datasetsInfo.filter(d => d.status === 'excluded');

  if (badge) {
    const parts = [];
    if (review.length > 0)   parts.push(`${review.length} need review`);
    parts.push(`${picked.length} auto-picked`);
    if (excluded.length > 0) parts.push(`${excluded.length} excluded`);
    badge.textContent = parts.join(' · ');
  }

  // "Needs review" section (top). Two or more series passed the filter for
  // this dataset — worth a manual look to pick the primary or collapse
  // near-duplicates before Step 2.
  if (review.length === 0) {
    reviewDiv.innerHTML = '';
  } else {
    reviewDiv.innerHTML =
      `<div class="ds-section-heading">Needs review — ${review.length} dataset${review.length === 1 ? '' : 's'} with multiple kept series of the same proxy</div>` +
      review.map(_renderDatasetCard).join('');
  }

  // "Excluded by filters" section. Dataset has candidates but none survived
  // the AND-filter — user can expand to verify or override.
  if (excluded.length === 0) {
    excludedDiv.innerHTML = '';
  } else {
    excludedDiv.innerHTML =
      `<div class="ds-section-heading">Excluded by filters (${excluded.length})</div>` +
      excluded.map(_renderDatasetCard).join('');
  }

  // Auto-picked (exactly 1 kept) datasets — trivial case, no review needed.
  if (picked.length === 0) {
    autoDiv.innerHTML =
      (review.length === 0 && excluded.length === 0)
        ? '<div class="empty-state">No datasets to review.</div>'
        : '';
  } else {
    autoDiv.innerHTML =
      `<div class="ds-section-heading">Auto-picked (${picked.length}) — single kept series, or multiple kept with distinct proxies</div>` +
      picked.map(_renderDatasetCard).join('');
  }

  // Rehydrate any open cards' plots + metrics with cached state.
  for (const ds of datasetsInfo) {
    if (!expandedDatasets.has(ds.dataSetName)) continue;
    const st = groupState[ds.dataSetName];
    if (st && st.series) {
      _renderDatasetReviewPlot(ds.dataSetName);
      _renderDatasetPairSelector(ds.dataSetName);
      _renderDatasetSeriesToggle(ds.dataSetName);
      _renderDatasetCorrelationMatrix(ds.dataSetName);
      renderDatasetMetrics(ds.dataSetName);
    }
  }
}

function updateFooter() {
  // Temporal coverage reflects kept records, so re-render on every
  // selection change.
  renderCoverage();
  // Datasets panel + auto-filter summary reflect the current excludedTSIDs
  // state. Re-render on the same tick.
  if (datasetsInfo.length > 0) renderDatasetsPanel();
  renderAutoFilterSummary();

  // Only valid proxy records count toward the footer and Continue button.
  const validRecords = allRecords.filter(isValidProxyRecord);
  const totalValid   = validRecords.length;
  const keptCount    = validRecords.filter(r => !excludedTSIDs.has(r.tsid)).length;

  const footerEl = document.getElementById('footer-count');
  const footerElStep2 = document.getElementById('footer-count-step-2');
  const continueCountEl = document.getElementById('continue-count');
  const btnContinue = document.getElementById('btn-continue');
  const btnNextStep2 = document.getElementById('btn-next-step-2');

  const uniqueDatasets = new Set(validRecords.filter(r => !excludedTSIDs.has(r.tsid))
                                             .map(r => r.dataSetName).filter(Boolean)).size;
  const footerText = `${keptCount} of ${totalValid} proxy records selected (from ${uniqueDatasets} datasets)`;

  if (footerEl)      footerEl.textContent = footerText;
  if (footerElStep2) footerElStep2.textContent = footerText;
  if (continueCountEl) continueCountEl.textContent = keptCount;

  // Step 1 footer: "Next → location review" only requires at least 1 record.
  if (btnNextStep2) {
    btnNextStep2.disabled = keptCount === 0;
    btnNextStep2.title = keptCount === 0 ? 'No records selected' : '';
  }
  // Step 2 footer: final Continue button gates on keptCount only.
  if (btnContinue) {
    btnContinue.disabled = keptCount === 0;
    btnContinue.title = keptCount === 0 ? 'No records selected' : '';
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
async function skipCleaning() {
  // Drop any prior cleaning artifacts on the server first; otherwise a
  // previous Continue's cleaned_TSIDs.json would silently reapply.
  try {
    await fetch('/datacleaning/skip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uniqueID: UNIQUE_ID, recon: RECON }),
    });
  } catch (_) { /* non-fatal */ }
  suppressUnloadWarning();
  const nextPage = (RECON === 'lipdDownload') ? '/lipd-download/confirm' : '/editor/querypath';
  window.location.href = nextPage + window.location.search;
}

// =============================================================================
// Save progress — persists state server-side then opens share dialog
// =============================================================================
// Auto-save: a quiet, debounced /save-progress call wired into every state
// change. Without this, hitting Back from the editor used to lose every
// keep/remove/notes decision the user made (loadAndRestoreProgress only
// reads progress.json, which only existed if the user clicked "Save
// progress" manually). The throttle keeps us from posting per-keystroke.
let _autoSaveTimer    = null;
let _autoSaveInFlight = false;
let _autoSavePending  = false;
let _autoSaveEnabled  = false;     // flipped to true once the user has any state worth saving
const AUTO_SAVE_DELAY_MS = 1500;

function _autoSavePayload() {
  return {
    uniqueID:      UNIQUE_ID,
    recon:         RECON,
    urlParams:     window.location.search,
    excludedTSIDs: [...excludedTSIDs],
    excludedVariableNames: [...excludedVariableNames],
    filterState:   typeof serializeFilterState === 'function' ? serializeFilterState() : null,
    groupNotes,
    datasetNotes,
    savedDatasets: [...savedDatasets],
    savedGroups:   [...savedGroups],
  };
}

async function _autoSaveNow() {
  if (_autoSaveInFlight) { _autoSavePending = true; return; }
  _autoSaveInFlight = true;
  try {
    await fetch('/datacleaning/save-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_autoSavePayload()),
      keepalive: true, // try to deliver even if the page is unloading
    });
  } catch (_) { /* non-fatal — the user can still click Save progress */ }
  finally {
    _autoSaveInFlight = false;
    if (_autoSavePending) { _autoSavePending = false; _autoSaveNow(); }
  }
}

function scheduleAutoSave() {
  if (!UNIQUE_ID || !RECON) return;
  _autoSaveEnabled = true;
  if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(_autoSaveNow, AUTO_SAVE_DELAY_MS);
}

// Best-effort flush before the page goes away — pagehide is the modern
// equivalent of unload that doesn't disable bfcache. keepalive: true above
// lets the request survive even if the navigation completes first.
window.addEventListener('pagehide', () => {
  if (!_autoSaveEnabled) return;
  if (_autoSaveTimer) { clearTimeout(_autoSaveTimer); _autoSaveTimer = null; }
  _autoSaveNow();
});

// Warn when leaving with selections that haven't reached the editor yet.
// Suppressed during the "Continue" / "Skip" / "Re-curate" navigations and
// when a flush is already in flight — those are intentional exits.
let _suppressUnloadWarning = false;
function suppressUnloadWarning() { _suppressUnloadWarning = true; }
window.addEventListener('beforeunload', (e) => {
  if (_suppressUnloadWarning) return;
  if (!_autoSaveEnabled) return;
  // Only warn if there's at least one manual decision the user could lose.
  // (excludedTSIDs from the AND-filter is auto-derived; we only block exit
  // for things the user typed or clicked on.)
  const hasManualState =
    savedGroups.size   > 0 ||
    savedDatasets.size > 0 ||
    Object.values(groupNotes  || {}).some(v => typeof v === 'string' && v.trim()) ||
    Object.values(datasetNotes|| {}).some(v => typeof v === 'string' && v.trim());
  if (!hasManualState) return;
  e.preventDefault();
  // Modern browsers ignore the message and show a generic prompt. The string
  // assignment is required for older browsers / Safari.
  e.returnValue = 'You have unsaved data-cleaning decisions. Leave without saving?';
  return e.returnValue;
});

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
        filterState:   serializeFilterState(),
        groupNotes,
        datasetNotes,
        savedDatasets: [...savedDatasets],
        savedGroups:   [...savedGroups],
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

    // Restore filter state first — it will rebuild excludedTSIDs via the
    // AND-filter. The explicit excludedTSIDs restore below then overlays any
    // manual per-TSID overrides the user made on top of the filter.
    if (progress.filterState && filterOptions.interpVarSummary.length > 0) {
      try {
        deserializeFilterState(progress.filterState);
        renderAutoFilters();
        recomputeDatasets();
        applyAutoFilterToExclusions();
      } catch (_) {
        // Fall back to server defaults if the saved state is malformed.
      }
    }

    // Restore excluded TSIDs — overlays the filter-derived exclusions so
    // manual Keep/Remove decisions from Step 1/2 survive.
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

    // Restore notes (Step 2 groups + Step 1 datasets)
    if (progress.groupNotes && typeof progress.groupNotes === 'object') {
      Object.assign(groupNotes, progress.groupNotes);
    }
    if (progress.datasetNotes && typeof progress.datasetNotes === 'object') {
      Object.assign(datasetNotes, progress.datasetNotes);
    }

    // Restore Step 1 dataset review status + Step 2 group review status
    if (Array.isArray(progress.savedDatasets)) {
      for (const name of progress.savedDatasets) savedDatasets.add(name);
    }
    if (Array.isArray(progress.savedGroups)) {
      for (const gid of progress.savedGroups) savedGroups.add(Number(gid));
    }
    // Reflect saved-group dimming in the Step 2 cards. Step 1 re-renders
    // automatically on the upcoming updateFooter() call.
    for (const gid of savedGroups) {
      const groupEl = document.getElementById(`dup-group-${gid}`);
      if (groupEl) groupEl.classList.add('saved');
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
        datasetNotes,
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
    suppressUnloadWarning();
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
  scheduleAutoSave();
}

// Step 1 equivalent, keyed by dataSetName. Empty strings are preserved so
// renderDatasetsPanel re-renders don't clobber them between keystrokes.
function updateDatasetNotes(dsName, text) {
  datasetNotes[dsName] = text;
  scheduleAutoSave();
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
      body: JSON.stringify({ tsids: group.records, display_unit: displayTimeUnit })
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

    // Effective non-NaN time range per TSid (BP) — same computation Step 1
    // uses. Drives bucketing + the Age column in the metadata table so the
    // mirrored table stays consistent with the plot above it.
    const effectiveByTsid = {};
    for (const tsid of tsidOrder) {
      const s = series[tsid];
      const t = s && Array.isArray(s.time) ? s.time.filter(Number.isFinite) : [];
      if (t.length > 0) {
        let mn = t[0], mx = t[0];
        for (let i = 1; i < t.length; i++) {
          if (t[i] < mn) mn = t[i];
          if (t[i] > mx) mx = t[i];
        }
        if (commonTimeUnit && commonTimeUnit !== 'yr BP') {
          mn = _convertTimeValue(mn, commonTimeUnit, 'yr BP');
          mx = _convertTimeValue(mx, commonTimeUnit, 'yr BP');
        }
        effectiveByTsid[tsid] = { min: Math.min(mn, mx), max: Math.max(mn, mx) };
      }
    }

    groupState[groupId] = {
      pairs,
      series,
      tsidColors,
      effectiveByTsid,
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

    // ── Full metadata table + correlation matrix ──
    // Mirror the Step 1 dataset review so users get the same information
    // density when hand-reviewing spatial duplicates across datasets.
    const metadataEl = document.getElementById(`dup-metadata-${groupId}`);
    if (metadataEl) {
      metadataEl.innerHTML = _renderCandidateTable(group.records, {
        effectiveByTsid,
        timeUnit: displayTimeUnit,
        bulkHandler: 'setAllGroupCandidates',
        bulkKey: String(groupId),
      });
      _colorCandidateTableRows(metadataEl, tsidColors);
    }
    _renderCorrelationMatrix(groupId, {
      containerId: `dup-corr-matrix-${groupId}`,
      onCellClick: 'setGroupPair',
    });

    group.correlations = pairs.map(p => ({ tsid1: p.tsid1, tsid2: p.tsid2, pearson: p.pearson, distKm: p.distKm }));
    group.dtwDistances = pairs.map(p => ({ tsid1: p.tsid1, tsid2: p.tsid2, dtw: p.dtw }));

    _maybeAutoResolveUncorrelatedGroup(groupId);

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

// If every pairwise |r| in a duplicate group is at or below the uniqueness
// threshold, the records measure independent signals and don't need manual
// de-duplication review. Auto-mark the group as saved (keeping every record)
// with a badge explaining why. Skipped if the user has already saved the
// group or manually excluded any member record. Returns true iff the group
// was auto-resolved in this call.
function _maybeAutoResolveUncorrelatedGroup(groupId) {
  if (savedGroups.has(groupId)) return false;
  const group = duplicateGroups.find(g => g.groupId === groupId);
  if (!group || !Array.isArray(group.correlations) || group.correlations.length === 0) return false;
  if (group.records.some(t => excludedTSIDs.has(t))) return false;
  for (const p of group.correlations) {
    const r = Number(p.pearson);
    if (!Number.isFinite(r) || Math.abs(r) > _UNIQUENESS_PEARSON) return false;
  }
  saveGroup(groupId);
  const scoresEl = document.getElementById(`scores-${groupId}`);
  if (scoresEl) {
    scoresEl.innerHTML =
      '<span style="color:#3a7a3a;font-weight:600;font-size:0.8rem;">✓ Auto-resolved</span>' +
      '<span style="color:#888;font-size:0.75rem;margin-left:6px;">(|r| ≤ 0.5, presumed distinct)</span>';
  }
  return true;
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

  // Assign each trace to a y-axis group keyed by (variableName, units). A
  // dataset with e.g. a temperature record (degC) alongside a d18O record
  // (permil) will then get a left + right axis rather than squashing both
  // onto one shared scale.
  const axisGroupOrder = []; // preserves first-seen order for axis assignment
  const axisGroups = new Map(); // key → { label, tsids: Set, traces: [] }
  const _axisKey = (s, r) => {
    const vn = (s && s.label) || (r && r.variableName) || '';
    const u  = (r && r.units) || '';
    return `${vn}|${u}`;
  };
  const _axisLabel = (key) => {
    const [vn, u] = key.split('|');
    if (!vn) return 'Value';
    return u ? `${vn} (${u})` : vn;
  };

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
    const rec = _recordByTsid(tsid);
    const key = _axisKey(s, rec);
    if (!axisGroups.has(key)) {
      axisGroups.set(key, { label: _axisLabel(key) });
      axisGroupOrder.push(key);
    }
    return {
      type: 'scatter',
      mode: 'lines',
      name: traceName,
      x,
      y,
      line: { width: 1.5, color: tsidColors[tsid] },
      hovertemplate: `<b>${traceName}</b><br>x: %{x:.1f}<br>y: %{y:.3f}<extra></extra>`,
      _axisKey: key,
    };
  });

  // Bind each trace to its assigned Plotly y-axis. We support up to two
  // side-by-side axes (left + right); a third+ axis group falls back onto
  // the right axis so the chart stays readable. This matches the common
  // paleoclimate pattern of "proxy (permil) vs calibrated variable (degC)".
  const keyToAxis = new Map();
  axisGroupOrder.forEach((key, i) => {
    if (i === 0)      keyToAxis.set(key, 'y');
    else              keyToAxis.set(key, 'y2');
  });
  for (const t of traces) {
    const axis = keyToAxis.get(t._axisKey) || 'y';
    if (axis !== 'y') t.yaxis = axis;
    delete t._axisKey;
  }

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

  const isBp = commonTimeUnit === 'yr BP' || commonTimeUnit === 'ka BP' || commonTimeUnit === 'Ma BP';
  const primaryLabel  = axisGroupOrder[0] ? axisGroups.get(axisGroupOrder[0]).label : (entries[0][1].label || 'Value');
  const secondaryKeys = axisGroupOrder.slice(1);
  const secondaryLabel = secondaryKeys.length > 0
    ? secondaryKeys.map(k => axisGroups.get(k).label).join(' / ')
    : null;
  const layout = {
    margin: { l: 52, r: secondaryLabel ? 52 : 10, t: 6, b: 36 },
    xaxis: {
      title: hasTime ? (commonTimeUnit ? `Age (${commonTimeUnit})` : 'Age / Year') : 'Index',
      titlefont: { size: 11 },
      // Paleoclimate convention: BP axes reversed so recent (0) sits on the
      // right and older values extend leftward.
      ...(isBp && hasTime ? { autorange: 'reversed' } : {}),
    },
    yaxis: { title: primaryLabel, titlefont: { size: 11 } },
    showlegend: false,
    hovermode: 'x unified',
    font: { size: 10 }
  };
  if (secondaryLabel) {
    layout.yaxis2 = {
      title: secondaryLabel,
      titlefont: { size: 11 },
      overlaying: 'y',
      side: 'right',
    };
  }

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
      body: JSON.stringify({ tsids: group.records, display_unit: displayTimeUnit })
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

    const autoResolved = _maybeAutoResolveUncorrelatedGroup(groupId);

    // Populate inline detail elements so the inline expand panel works later.
    // Keep the header scores visible if we auto-resolved — that badge IS the
    // result the user should see.
    const headerScores = document.getElementById(`scores-${groupId}`);
    if (headerScores && !autoResolved) headerScores.style.display = 'none';
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
// Auto-selection filters — the AND-filter that drives Step 1 primary-proxy
// selection. Three subsections:
//   1. Interpretation variables (multi-select, defaults all on)
//   2. Valid proxy variables, per archive (defaults = ARCHIVE_VARIABLE_PRIORITY)
//   3. Compilation-membership toggle (default off) — uses
//      paleoData_mostRecentCompilations, which already encodes "this record
//      belongs to ≥ 1 curated compilation"; no separate field needed.
// All three combine with AND. Recomputed entirely client-side on every toggle.
// =============================================================================

function serializeFilterState() {
  const variables = {};
  for (const [archive, set] of Object.entries(filterState.variablesByArchive)) {
    variables[archive] = [...set];
  }
  return {
    interpVars: [...filterState.interpVars],
    variablesByArchive: variables,
    requireCompilation: !!filterState.requireCompilation,
  };
}

function deserializeFilterState(raw) {
  if (!raw || typeof raw !== 'object') return;
  if (Array.isArray(raw.interpVars)) {
    filterState.interpVars = new Set(raw.interpVars);
  }
  if (raw.variablesByArchive && typeof raw.variablesByArchive === 'object') {
    const restored = {};
    for (const [archive, list] of Object.entries(raw.variablesByArchive)) {
      if (Array.isArray(list)) restored[archive] = new Set(list);
    }
    filterState.variablesByArchive = restored;
  }
  // Accept the legacy `useCompilationBeta` key from progress files saved
  // before this rename.
  filterState.requireCompilation = !!(raw.requireCompilation ?? raw.useCompilationBeta);
}

function initFilterStateFromServer() {
  // Interp_Vars — default ALL checked so the filter is a no-op until the
  // user narrows. This matches the user's mental model: they come in with
  // whatever the query produced and trim from there.
  filterState.interpVars = new Set();
  for (const entry of filterOptions.interpVarSummary) {
    filterState.interpVars.add(entry.value);
  }
  // Per-archive variables — seeded from the server's isDefault flag. All
  // variables present in the data start checked; the user opts out.
  filterState.variablesByArchive = {};
  for (const [archive, entries] of Object.entries(filterOptions.variablesByArchive)) {
    const set = new Set();
    for (const e of entries) if (e.isDefault) set.add(e.name);
    filterState.variablesByArchive[archive] = set;
  }
  filterState.requireCompilation = false;
}

function interpBucketsFor(record) {
  // Mirror of server _interp_buckets. lipdverseR's queryCsv.R joins a
  // single TS's interpretation columns with `|`; `;` and `,` are accepted
  // defensively. Duplicates within one cell (e.g. "temperature|temperature")
  // are deduped so each record contributes at most 1 to any bucket.
  const raw = record && record.interp_Vars;
  if (raw == null) return [INTERP_NO_VALUE];
  const s = String(raw).trim();
  if (!s || ['nan', 'none', 'null', 'na'].includes(s.toLowerCase())) {
    return [INTERP_NO_VALUE];
  }
  const seen = new Set();
  const out = [];
  for (const p of s.split(/[|;,]/)) {
    const v = p.trim();
    if (v && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out.length > 0 ? out : [INTERP_NO_VALUE];
}

function recordHasCompilation(record) {
  // Compilation membership is already signaled by paleoData_mostRecentCompilations
  // (exposed on the record as `compilation`). A populated value means at
  // least one curated compilation includes this record.
  const raw = record && record.compilation;
  if (!raw) return false;
  const s = String(raw).trim();
  if (!s || ['nan', 'none', 'null', 'na'].includes(s.toLowerCase())) return false;
  return s.split(/[|;,]/).some(t => t.trim().length > 0);
}

function recordPassesAutoFilter(r) {
  // 1) Per-archive variable whitelist
  const archive = (r.archiveType || '').trim() || '(unknown)';
  const selectedVars = filterState.variablesByArchive[archive];
  const varName = (r.variableName || '').trim();
  if (!selectedVars || !varName || !selectedVars.has(varName)) return false;

  // 2) At least one interp_Vars bucket is in the selected set
  const buckets = interpBucketsFor(r);
  let interpMatch = false;
  for (const b of buckets) {
    if (filterState.interpVars.has(b)) { interpMatch = true; break; }
  }
  if (!interpMatch) return false;

  // 3) Optional compilation-membership requirement
  if (filterState.requireCompilation && !recordHasCompilation(r)) return false;

  return true;
}

// Within a dataset, when some records (sharing a proxy) are members of a
// curated compilation and others are not, prefer the compilation members.
// This handles the common pattern where a dataset has multiple candidate
// versions but only one made it into the most recent compilation (e.g.
// O2kLR_105 in Pages2kTemperature alongside O2kLR_107 which is not).
// Returns a Set of TSids to auto-exclude.
function _computeCompilationPreferenceExclusions() {
  const proxyKey = (r) => {
    const p = (r.proxy || '').toString().trim().toLowerCase();
    if (p && !['na', 'null', 'none', ''].includes(p)) return p;
    return (r.variableName || '').toString().trim().toLowerCase();
  };
  const byGroup = new Map();
  for (const r of allRecords) {
    if (!isValidProxyRecord(r) || !recordPassesAutoFilter(r)) continue;
    const ds = r.dataSetName || '';
    if (!ds) continue;
    const key = ds + '\x00' + proxyKey(r);
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(r);
  }
  const excludes = new Set();
  for (const recs of byGroup.values()) {
    if (recs.length < 2) continue;
    const withComp    = recs.filter(recordHasCompilation);
    const withoutComp = recs.filter(r => !recordHasCompilation(r));
    if (withComp.length > 0 && withoutComp.length > 0) {
      for (const r of withoutComp) excludes.add(r.tsid);
    }
  }
  return excludes;
}

// True iff every pairwise Pearson r between currently-kept records of this
// dataset has |r| <= 0.5. Requires at least one loaded pair covering the
// kept set — otherwise we can't conclude uniqueness and return false so the
// dataset stays in needs-review until /correlate loads.
const _UNIQUENESS_PEARSON = 0.5;
function _keptPairsUncorrelated(ds) {
  const st = groupState[ds.dataSetName];
  if (!st || !Array.isArray(st.pairs) || st.pairs.length === 0) return false;
  const kept = new Set(ds.autoKeptTsids || []);
  if (kept.size < 2) return false;
  let sawKeptPair = false;
  for (const p of st.pairs) {
    if (!kept.has(p.tsid1) || !kept.has(p.tsid2)) continue;
    sawKeptPair = true;
    const r = Number(p.pearson);
    if (!Number.isFinite(r)) return false; // unresolved pair → can't conclude
    if (Math.abs(r) > _UNIQUENESS_PEARSON) return false;
  }
  return sawKeptPair;
}

function recomputeDatasets() {
  // Rebuild datasetsInfo from allRecords + filterState. Every dataset produces
  // exactly one entry; candidateTsids is every record in the dataset (for the
  // expand-to-override table) while autoKeptTsids is the subset passing the
  // current filter. If all candidates fail the filter, status='excluded'.
  const compPrefExcl = _computeCompilationPreferenceExclusions();
  const byDataset = new Map();
  for (const r of allRecords) {
    if (!isValidProxyRecord(r)) continue;
    const name = r.dataSetName;
    if (!name) continue;
    if (!byDataset.has(name)) {
      byDataset.set(name, {
        dataSetName: name,
        archiveType: r.archiveType || null,
        candidateTsids: [],
        autoKeptTsids: [],
        autoDroppedTsids: [],
        compilationPreferredTsids: [],
      });
    }
    const ds = byDataset.get(name);
    ds.candidateTsids.push(r.tsid);
    const passes = recordPassesAutoFilter(r);
    if (passes && compPrefExcl.has(r.tsid)) {
      ds.compilationPreferredTsids.push(r.tsid);
      ds.autoDroppedTsids.push(r.tsid);
    } else if (passes) {
      ds.autoKeptTsids.push(r.tsid);
    } else {
      ds.autoDroppedTsids.push(r.tsid);
    }
  }
  datasetsInfo = [];
  for (const ds of byDataset.values()) {
    // Three-way split:
    //  - excluded      : no candidate survived the AND-filter
    //  - needs-review  : 2+ kept AND any two share the same variableName
    //                    (likely near-duplicates of the same proxy type)
    //  - auto-picked   : 1 kept, OR 2+ kept where every record is a
    //                    distinct variableName (legitimate multi-proxy
    //                    dataset — e.g. d18O + Sr/Ca from one coral)
    const kept = ds.autoKeptTsids.length;
    if (kept === 0) {
      ds.status = 'excluded';
    } else if (kept === 1) {
      ds.status = 'auto-picked';
    } else {
      // Use paleoData_proxy (record.proxy) as the distinctness signal —
      // that's the generic proxy type (d18O, Sr/Ca, alkenone, …) rather
      // than the variable name. When proxy is unset / 'NA', fall back to
      // variableName so records with no proxy annotation still group.
      const proxyKey = (t) => {
        const r = _recordByTsid(t) || {};
        const p = (r.proxy || '').toString().trim().toLowerCase();
        if (p && !['na', 'null', 'none', ''].includes(p)) return p;
        return (r.variableName || '').toString().trim().toLowerCase();
      };
      const proxies = new Set(ds.autoKeptTsids.map(proxyKey));
      if (proxies.size === kept) {
        ds.status = 'auto-picked';
      } else if (_keptPairsUncorrelated(ds)) {
        // Loaded pairwise |r| <= 0.5 for every kept pair — the records are
        // presumed to measure distinct signals despite sharing a proxy name,
        // so no duplicate review is needed.
        ds.status = 'auto-picked';
        ds.presumedUnique = true;
      } else {
        ds.status = 'needs-review';
      }
    }
    datasetsInfo.push(ds);
  }
  // Sort by currently-selected count DESC so the datasets contributing the
  // most records to the reconstruction surface first. Tiebreak by total
  // candidate count DESC (surfaces large excluded-by-filter datasets) then
  // by name ASC. Computed at filter-change time — individual manual toggles
  // don't reorder, which would be disorienting.
  datasetsInfo.sort((a, b) => {
    const diff = b.autoKeptTsids.length - a.autoKeptTsids.length;
    if (diff !== 0) return diff;
    const candDiff = (b.candidateTsids.length) - (a.candidateTsids.length);
    if (candDiff !== 0) return candDiff;
    return a.dataSetName.localeCompare(b.dataSetName);
  });
}

function applyAutoFilterToExclusions() {
  // Rebuild excludedTSIDs from the current filter. Any manual per-TSID
  // overrides the user made in the Step-1 table are intentionally dropped
  // when filter state changes — the filter is the source of truth.
  excludedTSIDs = new Set();
  for (const r of allRecords) {
    if (!isValidProxyRecord(r) || !recordPassesAutoFilter(r)) {
      excludedTSIDs.add(r.tsid);
    }
  }
  // Within-dataset compilation preference: drop non-compilation records
  // when a same-proxy compilation counterpart is kept.
  for (const tsid of _computeCompilationPreferenceExclusions()) {
    excludedTSIDs.add(tsid);
  }
}

// ---- UI -------------------------------------------------------------------

function renderAutoFilters() {
  renderInterpFilter();
  renderVariablesByArchive();
  renderCompilationBetaToggle();
  renderAutoFilterSummary();
}

function _renderCheckRow(key, label, count, checked, onToggle) {
  const row = document.createElement('label');
  row.className = 'variable-filter-row';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = !!checked;
  cb.addEventListener('change', () => onToggle(cb.checked));
  const name = document.createElement('span');
  name.className = 'variable-filter-name';
  name.textContent = label;
  const badge = document.createElement('span');
  badge.className = 'variable-filter-count';
  badge.textContent = String(count);
  row.appendChild(cb);
  row.appendChild(name);
  row.appendChild(badge);
  return row;
}

function renderInterpFilter() {
  const container = document.getElementById('interp-filter-list');
  if (!container) return;
  container.innerHTML = '';
  for (const entry of filterOptions.interpVarSummary) {
    const checked = filterState.interpVars.has(entry.value);
    const row = _renderCheckRow(entry.value, entry.value, entry.count, checked, (c) => {
      if (c) filterState.interpVars.add(entry.value);
      else   filterState.interpVars.delete(entry.value);
      onAutoFilterChange();
    });
    container.appendChild(row);
  }
}

function renderVariablesByArchive() {
  const container = document.getElementById('variables-by-archive-list');
  if (!container) return;
  container.innerHTML = '';

  const archives = Object.keys(filterOptions.variablesByArchive).sort((a, b) => a.localeCompare(b));
  for (const archive of archives) {
    const entries = filterOptions.variablesByArchive[archive];
    const selected = filterState.variablesByArchive[archive] || new Set();

    const section = document.createElement('details');
    section.className = 'archive-var-section';
    section.open = true;

    const summary = document.createElement('summary');
    const checkedCount = entries.filter(e => selected.has(e.name)).length;
    const totalCount = entries.reduce((s, e) => s + e.count, 0);
    summary.innerHTML =
      `<strong>${escapeHtml(archive)}</strong> ` +
      `<span style="color:#777;font-size:0.82rem;">` +
      `${checkedCount} / ${entries.length} variable${entries.length === 1 ? '' : 's'} — ` +
      `${totalCount} record${totalCount === 1 ? '' : 's'}</span>`;
    section.appendChild(summary);

    const list = document.createElement('div');
    list.className = 'variable-filter-list-inner';
    for (const e of entries) {
      const checked = selected.has(e.name);
      const row = _renderCheckRow(e.name, e.name, e.count, checked, (c) => {
        if (!filterState.variablesByArchive[archive]) {
          filterState.variablesByArchive[archive] = new Set();
        }
        if (c) filterState.variablesByArchive[archive].add(e.name);
        else   filterState.variablesByArchive[archive].delete(e.name);
        onAutoFilterChange();
      });
      if (!e.isDefault) {
        const hint = document.createElement('span');
        hint.className = 'variable-filter-hint';
        hint.textContent = 'not in default priority list';
        row.appendChild(hint);
      }
      list.appendChild(row);
    }
    section.appendChild(list);
    container.appendChild(section);
  }
}

function renderCompilationBetaToggle() {
  const cb = document.getElementById('compilation-toggle');
  if (!cb) return;
  cb.checked = filterState.requireCompilation;
  cb.onchange = () => {
    filterState.requireCompilation = cb.checked;
    onAutoFilterChange();
  };
}

function renderAutoFilterSummary() {
  const el = document.getElementById('auto-filter-summary');
  if (!el) return;
  const valid = allRecords.filter(isValidProxyRecord);
  const kept = valid.filter(recordPassesAutoFilter);
  const datasetsKept = new Set(kept.map(r => r.dataSetName).filter(Boolean)).size;
  const datasetsTotal = new Set(valid.map(r => r.dataSetName).filter(Boolean)).size;
  el.textContent =
    `${kept.length} / ${valid.length} records kept · ` +
    `${datasetsKept} / ${datasetsTotal} datasets contribute`;
}

function onAutoFilterChange() {
  recomputeDatasets();
  applyAutoFilterToExclusions();
  renderAutoFilters();
  refreshAllViews();
}

function refreshAllViews() {
  // Run after any change that affects which records are valid. Touches every
  // view that reads through isValidProxyRecord.
  renderAutoFilterSummary();
  renderTable();
  renderCoverage();
  if (typeof renderPCA === 'function') renderPCA();
  updateFooter();
  if (typeof renderDuplicates === 'function') renderDuplicates();
  // Persist the user's selections so a Back navigation (or refresh) restores
  // them via loadAndRestoreProgress instead of dropping everything.
  scheduleAutoSave();
}
