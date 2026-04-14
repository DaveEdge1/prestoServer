/**
 * Compilation Metadata Updater
 *
 * Scrapes lipdverse.org daily to discover compilations and their versions,
 * then writes query/public/compilationMetadata.js so the query page
 * always has an up-to-date list.
 *
 * Runs once ~60 s after server startup, then every 24 hours.
 */

const fs   = require('fs');
const path = require('path');

const OUTPUT_FILE       = path.join(__dirname, '..', 'query', 'public', 'compilationMetadata.js');
const PROJECTS_URL      = 'https://lipdverse.org/project/';
const STARTUP_DELAY_MS  = 60 * 1000;          // 60 s
const RUN_INTERVAL_MS   = 24 * 60 * 60 * 1000; // 24 h

/**
 * Fetch the list of project slugs from the lipdverse projects page.
 * Returns an array like ['coralhydro2k', 'freesoda', 'temp12k', ...]
 */
async function fetchProjectSlugs() {
  const resp = await fetch(PROJECTS_URL);
  const html = await resp.text();
  const matches = html.match(/href="https:\/\/lipdverse\.org\/project\/([^/"]+)\//g) || [];
  const slugs = new Set();
  for (const m of matches) {
    const slug = m.match(/\/project\/([^/"]+)\//);
    if (slug) slugs.add(slug[1]);
  }
  return Array.from(slugs);
}

/**
 * For a given project slug, discover the canonical compilation name
 * and current version from lipdverse.org.
 *
 * Returns { compilationName, version } or null if not resolvable.
 */
async function fetchCompilationInfo(slug) {
  try {
    // Step 1: Get the canonical compilation name from the project page
    const projResp = await fetch(`https://lipdverse.org/project/${slug}/`);
    const projHtml = await projResp.text();

    // Look for the current_version link which contains the canonical name
    const linkMatch = projHtml.match(/href="https?:\/\/lipdverse\.org\/([^/"]+)\/current_version\/?"/i);
    if (!linkMatch) return null;

    const compilationName = linkMatch[1];

    // Step 2: Fetch the current_version page to get the version string
    const verResp = await fetch(`https://lipdverse.org/${compilationName}/current_version/`);
    if (!verResp.ok) return null;

    const verHtml = await verResp.text();
    // Page contains a line like "CompilationName - 1_0_0"
    const verMatch = verHtml.match(new RegExp(compilationName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\s*-\\s*([0-9][0-9_]*)'));
    if (!verMatch) return null;

    return { compilationName, version: verMatch[1] };
  } catch (err) {
    console.error(`[compilationUpdater] Error fetching info for "${slug}":`, err.message);
    return null;
  }
}

/**
 * Main update function: scrape lipdverse.org and write compilationMetadata.js
 */
async function updateCompilationMetadata() {
  console.log('[compilationUpdater] Starting update...');

  try {
    const slugs = await fetchProjectSlugs();
    console.log(`[compilationUpdater] Found ${slugs.length} projects: ${slugs.join(', ')}`);

    const results = await Promise.allSettled(
      slugs.map(slug => fetchCompilationInfo(slug))
    );

    const compilationJson = {};
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const { compilationName, version } = result.value;
        compilationJson[compilationName] = {
          compilationName,
          versions: version
        };
      }
    }

    const count = Object.keys(compilationJson).length;
    if (count === 0) {
      console.warn('[compilationUpdater] No compilations found — skipping file write to avoid data loss');
      return;
    }

    const content = 'var compilationJson = ' + JSON.stringify(compilationJson, null, 2) + '\n';
    fs.writeFileSync(OUTPUT_FILE, content, 'utf8');
    console.log(`[compilationUpdater] Wrote ${count} compilations to ${OUTPUT_FILE}`);

  } catch (err) {
    console.error('[compilationUpdater] Update failed:', err.message);
  }
}

function startCompilationUpdater() {
  setTimeout(() => {
    updateCompilationMetadata();
    setInterval(updateCompilationMetadata, RUN_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
  console.log('[compilationUpdater] Scheduler registered (first run in 60 s, then every 24 h)');
}

module.exports = { startCompilationUpdater, updateCompilationMetadata };
