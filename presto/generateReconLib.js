/**
 * Generate the legacy per-recon JSON artifacts from presto/reconRegistry.json.
 *
 * presto/reconRegistry.json is the single source of truth. A few older consumers
 * still read the pre-consolidation files by their original paths/shapes:
 *   - prestoForm/public/reconsTable.json → prestoForm/index2.html (language lookup)
 *   - jsonEditor/reconTitles.json     → jsonEditor/writeForm.js, query/writeQueryForm.js,
 *                                        jsonEditor/writeQuerypathForm.js
 *
 * reconLib.json is still emitted for backward compatibility but no longer has a
 * live reader (the prestoGo/prestoServer execution path was removed).
 *
 * Rather than edit each consumer, we regenerate these files from the registry so
 * they never drift. Run after editing the registry:
 *
 *   node presto/generateReconLib.js
 *
 * DO NOT hand-edit the generated files — edit reconRegistry.json instead.
 */

const fs = require('fs');
const path = require('path');
const registry = require('./reconRegistry');

const ROOT = path.join(__dirname, '..');
const REG = JSON.parse(fs.readFileSync(registry.REGISTRY_PATH, 'utf8'));
const editorMisc = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'jsonEditor', 'editorMisc.json'), 'utf8')
);

// Helper: write a JSON file with a 2-space indent + trailing newline.
function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
  console.log('  wrote', path.relative(ROOT, file));
}

// Apply fn for every canonical handle and each of its aliases.
function forHandlesAndAliases(fn) {
  for (const [handle, e] of Object.entries(REG)) {
    fn(handle, e);
    for (const alias of e.aliases || []) fn(alias, e);
  }
}

// 1. reconLib.json — flat shape keyed by handle (+aliases). lib already holds
//    the reconstruction title plus the container/path fields.
const reconLib = {};
forHandlesAndAliases((key, e) => {
  reconLib[key] = Object.assign({}, e.lib);
});

// 2. reconsTable.json — UI comparison-table metadata keyed by handle (+aliases).
const reconsTable = {};
forHandlesAndAliases((key, e) => {
  reconsTable[key] = {
    title: e.ui.title,
    time: e.ui.time,
    proxies: e.ui.proxies,
    models: e.ui.models,
    methods: e.ui.methods,
    doi: e.ui.doi,
    language: e.ui.language,
  };
});

// 3. reconTitles.json — parameter-editor headings: registry editorTitle (where
//    set) plus the non-recon entries from editorMisc.json (e.g. "query").
const reconTitles = Object.assign({}, editorMisc);
forHandlesAndAliases((key, e) => {
  if (e.editorTitle) reconTitles[key] = e.editorTitle;
});

console.log('Generating legacy artifacts from reconRegistry.json:');
writeJson(path.join(ROOT, 'presto', 'reconLib.json'), reconLib);
writeJson(path.join(ROOT, 'prestoForm', 'public', 'reconsTable.json'), reconsTable);
writeJson(path.join(ROOT, 'jsonEditor', 'reconTitles.json'), reconTitles);
console.log('Done.');
