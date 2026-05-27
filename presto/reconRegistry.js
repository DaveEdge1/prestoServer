/**
 * Reconstruction registry — single source of truth for per-recon metadata.
 *
 * Every consumer that used to hardcode a recon list (the query page configs,
 * the GitHub template-repo map, the UI dropdown, the parameter-editor titles,
 * the per-recon behavior flags, etc.) reads from presto/reconRegistry.json
 * through this loader. Adding a new reconstruction method is therefore mostly
 * a matter of adding one entry to that JSON file plus a prestoForm/<handle>/
 * folder — see docs/adding-a-reconstruction.md.
 *
 * Handles are canonical keys. `aliases` lets alternate spellings (e.g.
 * "download"/"downloadNew" → "lipdDownload") resolve to the same entry, and all
 * lookups are case-insensitive so /query/lmr and /query/LMR behave identically.
 */

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, 'reconRegistry.json');

// Loaded once at module init (matches how every prior consumer read its JSON).
const REGISTRY = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

// Build a lowercased index: canonical handle + each alias → canonical handle.
const HANDLE_BY_LOWER = {};
for (const handle of Object.keys(REGISTRY)) {
  HANDLE_BY_LOWER[handle.toLowerCase()] = handle;
  for (const alias of REGISTRY[handle].aliases || []) {
    HANDLE_BY_LOWER[alias.toLowerCase()] = handle;
  }
}

/** Resolve any handle/alias (any case) to the canonical handle, or null. */
function canonical(recon) {
  if (typeof recon !== 'string') return null;
  return HANDLE_BY_LOWER[recon.toLowerCase()] || null;
}

/** Return the full registry entry for a handle/alias, or undefined. */
function get(recon) {
  const key = canonical(recon);
  return key ? REGISTRY[key] : undefined;
}

/**
 * List entries (each with its canonical `handle`) sorted by `order`.
 * Pass { enabledOnly: true } to drop entries flagged `enabled: false`.
 */
function list({ enabledOnly = false } = {}) {
  return Object.values(REGISTRY)
    .filter(e => (enabledOnly ? e.enabled !== false : true))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/** { canonicalHandle: pageConfig } for entries that drive the unified query page. */
function pageConfigs() {
  const out = {};
  for (const [handle, e] of Object.entries(REGISTRY)) {
    if (e.pageConfig) out[handle] = e.pageConfig;
  }
  return out;
}

/**
 * { lowerHandleOrAlias: pageConfig } so query.js can look up a page config from
 * any case/alias (preserves the old PAGE_CONFIG_BY_LOWER behavior).
 */
function pageConfigByLower() {
  const out = {};
  for (const e of Object.values(REGISTRY)) {
    if (!e.pageConfig) continue;
    out[e.handle.toLowerCase()] = e.pageConfig;
    for (const alias of e.aliases || []) out[alias.toLowerCase()] = e.pageConfig;
  }
  return out;
}

/** { canonicalHandle: { owner, name } } for entries with a GitHub template repo. */
function templates() {
  const out = {};
  for (const [handle, e] of Object.entries(REGISTRY)) {
    if (e.template) out[handle] = e.template;
  }
  return out;
}

/** { canonicalHandle: reconPredicate } for entries that define a loader predicate. */
function predicates() {
  const out = {};
  for (const [handle, e] of Object.entries(REGISTRY)) {
    if (e.behavior && e.behavior.reconPredicate) out[handle] = e.behavior.reconPredicate;
  }
  return out;
}

module.exports = {
  canonical,
  get,
  list,
  pageConfigs,
  pageConfigByLower,
  templates,
  predicates,
  REGISTRY_PATH,
};
