/**
 * submittedGuard.js
 *
 * Detects whether the reconstruction whose uniqueID is in the URL has
 * already been submitted (i.e. there is a row in reconstruction_jobs).
 * If it has, replace the form's submit button with a "View status" link and
 * show a banner explaining why — so the user doesn't re-POST and either get
 * an error (idempotency redirect) or, worse, think nothing happened.
 *
 * Runs on initial load AND on `pageshow` (covers bfcache restore and Back
 * navigation from /status). Loaded by every form in jsonEditor/forms-query/.
 */
(function () {
  const params   = new URLSearchParams(window.location.search);
  const uniqueID = params.get('uniqueID');
  if (!uniqueID) return;

  // Statuses that mean "the user shouldn't submit again". `failed` is
  // intentionally omitted — the user may want to retry by re-submitting.
  const ACTIVE_STATUSES = new Set(['pending', 'queued', 'in_progress', 'completed', 'cancelled']);

  let lastKnownStatus = null;

  function showBanner(status) {
    if (document.getElementById('submitted-guard-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'submitted-guard-banner';
    banner.style.cssText =
      'background:#e2f0ff;border:1px solid #b6daff;color:#08518f;' +
      'padding:14px 18px;margin:14px auto;max-width:900px;border-radius:6px;' +
      'font-size:0.95rem;line-height:1.4;display:flex;align-items:center;' +
      'justify-content:space-between;gap:16px;flex-wrap:wrap;';

    const statusLabel = status ? status.replace(/_/g, ' ') : 'submitted';
    banner.innerHTML =
      '<div style="flex:1;min-width:260px;">' +
        '<strong>This reconstruction was already submitted.</strong> ' +
        'Status: <code>' + statusLabel + '</code>. ' +
        'Re-submitting this form will not start a second run.' +
      '</div>' +
      '<a href="/status/' + encodeURIComponent(uniqueID) + '" ' +
        'style="background:#0969da;color:#fff;padding:9px 16px;border-radius:4px;' +
        'text-decoration:none;font-weight:600;font-size:0.95rem;">' +
        'View status →' +
      '</a>';

    const form = document.getElementById('paramsForm');
    if (form && form.parentNode) {
      form.parentNode.insertBefore(banner, form);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }
  }

  function lockSubmitButton(status) {
    const btn = document.getElementById('submit-button');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = 'Already submitted';
    btn.title = 'Status: ' + (status || 'submitted') + '. Click "View status" above to follow this run.';
    // Prevent re-submission via Enter key on form fields too. We don't remove
    // the button — that would shift the layout — we just neuter it.
    btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); }, true);
  }

  function applyLockedState(status) {
    lastKnownStatus = status;
    showBanner(status);
    lockSubmitButton(status);
  }

  async function checkStatus() {
    try {
      const r = await fetch('/status/api/' + encodeURIComponent(uniqueID), {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (r.status === 404) return null; // never submitted — nothing to do
      if (!r.ok) return null;
      const data = await r.json();
      return (data && data.status) || null;
    } catch (_) {
      return null;
    }
  }

  async function runCheck() {
    const status = await checkStatus();
    if (status && ACTIVE_STATUSES.has(status)) {
      applyLockedState(status);
    }
  }

  // Initial check after DOM is ready (form must exist before we can lock it).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runCheck);
  } else {
    runCheck();
  }

  // Re-check on bfcache restore / Back navigation. The most common path is:
  // user submits → /status → Back → ends up here. Without this hook the
  // restored page would still show an enabled Submit button.
  window.addEventListener('pageshow', (e) => {
    const navEntries = performance.getEntriesByType && performance.getEntriesByType('navigation');
    const isBackForward = e.persisted ||
      (navEntries && navEntries[0] && navEntries[0].type === 'back_forward');
    if (isBackForward) runCheck();
  });
})();
