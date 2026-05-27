/**
 * GitHub Integration Service
 * Handles OAuth authentication, repository management, and workflow dispatch
 */

const { Octokit } = require('@octokit/rest');
const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const config = require('../config');
const reconRegistry = require('../presto/reconRegistry');

/**
 * Encrypt a GitHub access token for secure storage
 * @param {string} token - The plaintext token
 * @returns {string} Encrypted token
 */
function encryptToken(token) {
  if (!config.encryptionKey) {
    throw new Error('ENCRYPTION_KEY not configured in environment variables');
  }
  return CryptoJS.AES.encrypt(token, config.encryptionKey).toString();
}

/**
 * Decrypt a GitHub access token
 * @param {string} encryptedToken - The encrypted token
 * @returns {string} Plaintext token
 */
function decryptToken(encryptedToken) {
  if (!config.encryptionKey) {
    throw new Error('ENCRYPTION_KEY not configured in environment variables');
  }
  const bytes = CryptoJS.AES.decrypt(encryptedToken, config.encryptionKey);
  return bytes.toString(CryptoJS.enc.Utf8);
}

/**
 * Exchange OAuth authorization code for access token
 * @param {string} code - Authorization code from GitHub OAuth callback
 * @returns {Promise<Object>} Token data including access_token and scope
 */
async function authenticateUser(code) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      client_id: config.github.clientId,
      client_secret: config.github.clientSecret,
      code: code
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
  }

  return {
    access_token: data.access_token,
    scope: data.scope,
    token_type: data.token_type
  };
}

/**
 * Get authenticated user's GitHub profile
 * @param {string} token - GitHub access token
 * @returns {Promise<Object>} User profile data
 */
async function getUserInfo(token) {
  const octokit = new Octokit({ auth: token });
  const { data } = await octokit.rest.users.getAuthenticated();
  return {
    id: data.id,
    username: data.login,
    email: data.email,
    name: data.name,
    avatar_url: data.avatar_url
  };
}

/**
 * Create repository name following convention: presto-{recon_type}-{uniqueID}
 * @param {string} recon - Reconstruction type (holocene_da or temp12k)
 * @param {string} uniqueID - Unique reconstruction identifier
 * @returns {string} Repository name
 */
function generateRepoName(recon, uniqueID) {
  return `presto-${recon}-${uniqueID}`;
}

/**
 * Create and initialize a GitHub repository for reconstruction
 * @param {string} token - GitHub access token
 * @param {string} recon - Reconstruction type
 * @param {string} uniqueID - Unique reconstruction identifier
 * @param {Object} configData - User configuration data
 * @returns {Promise<Object>} Repository information
 */
async function createRepository(token, recon, uniqueID, configData, queryParamsJson = null, cleaningReportJson = null, variableFilterYaml = null) {
  const octokit = new Octokit({ auth: token });
  const repoName = generateRepoName(recon, uniqueID);

  // Get authenticated user
  const userInfo = await getUserInfo(token);
  const owner = userInfo.username;

  // Template repository mapping comes from the recon registry.
  const entry = reconRegistry.get(recon);
  const template = entry && entry.template;
  if (!template) {
    throw new Error(`No template repository configured for ${recon}`);
  }

  console.log(`Creating repository from template ${template.owner}/${template.name}...`);

  // Create repository from template
  const { data: repo } = await octokit.rest.repos.createUsingTemplate({
    template_owner: template.owner,
    template_repo: template.name,
    name: repoName,
    description: `PReSto ${recon} reconstruction - ${uniqueID}`,
    private: config.github.defaultVisibility === 'private',
    include_all_branches: false
  });

  console.log(`✓ Repository created from template: ${repo.html_url}`);

  // Wait for template repository to be fully copied
  console.log('Waiting for template files to be ready...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Update configuration files with user's config
  await updateRepositoryConfig(octokit, owner, repoName, recon, uniqueID, configData, queryParamsJson, cleaningReportJson, variableFilterYaml);

  // Enable GitHub Pages with Actions build type.
  // build_type:'workflow' doesn't require a gh-pages branch to exist, so this
  // works immediately at repo creation time. configure-pages@v5 defaults to
  // enablement:false and won't create Pages on its own.
  // Downloads don't publish Pages — controlled per recon via behavior.publishesPages.
  if (entry.behavior.publishesPages) {
    try {
      await octokit.rest.repos.createPagesSite({
        owner,
        repo: repoName,
        build_type: 'workflow'
      });
      console.log(`✓ GitHub Pages (Actions) enabled for ${repoName}`);
    } catch (err) {
      // 409 = already configured — acceptable
      if (err.status !== 409) {
        console.warn(`GitHub Pages enablement failed (${err.status}): ${err.message}`);
      }
    }

    // Set the repo "About" homepage URL to the predicted Pages URL so it
    // shows up immediately, before the first Pages build completes.
    const pagesUrl = `https://${owner.toLowerCase()}.github.io/${repoName}/`;
    try {
      await octokit.rest.repos.update({
        owner,
        repo: repoName,
        homepage: pagesUrl
      });
      console.log(`✓ Repo homepage set to ${pagesUrl}`);
    } catch (err) {
      console.warn(`Setting repo homepage failed (${err.status}): ${err.message}`);
    }
  }

  return {
    name: repoName,
    owner: owner,
    url: repo.html_url,
    clone_url: repo.clone_url,
    id: repo.id
  };
}

/**
 * Generate a descriptive README for lipdDownload repositories
 * @param {string} uniqueID - Unique reconstruction identifier
 * @param {string} queryParamsJson - JSON string of query parameters
 * @returns {string} Markdown README content
 */
function generateLipdDownloadReadme(uniqueID, queryParamsJson, cleaningReportJson) {
  let qp = {};
  try { qp = JSON.parse(queryParamsJson); } catch (e) { /* ignore */ }

  // cleaning_report.json accepts two shapes: legacy bare array of groups, or
  // current { groups: [...], datasetNotes?: {...} } wrapper. Normalize here so
  // the downstream rendering code doesn't care which one it got.
  let cleaningGroups = [];
  let datasetNotes = null;
  if (cleaningReportJson) {
    try {
      const parsed = JSON.parse(cleaningReportJson);
      if (Array.isArray(parsed)) {
        cleaningGroups = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.groups)) cleaningGroups = parsed.groups;
        if (parsed.datasetNotes && typeof parsed.datasetNotes === 'object') {
          datasetNotes = parsed.datasetNotes;
        }
      }
    } catch (e) { /* ignore */ }
  }

  const lines = [
    '# LiPD Download',
    '',
    `**Reconstruction ID:** ${uniqueID}`,
    '',
    'LiPD files selected via [PReSto](https://paleopresto.com/) and packaged by a GitHub Actions workflow.',
    'When the workflow completes, download `lipd_files.zip` from the **Actions → Artifacts** section.',
    '',
    '## Query Filters',
    '',
  ];

  const filters = [];
  if (qp.proxy)        filters.push(`- **Proxy:** ${qp.proxy}`);
  if (qp.variableName) filters.push(`- **Variable Name:** ${qp.variableName}`);
  if (qp.archiveTypes) filters.push(`- **Archive Type:** ${qp.archiveTypes}`);
  if (qp.country)      filters.push(`- **Country:** ${qp.country}`);
  if (qp.continent)    filters.push(`- **Continent:** ${qp.continent}`);
  if (qp.compilation)  filters.push(`- **Compilation:** ${qp.compilation}`);
  if (qp.seasonality)  filters.push(`- **Seasonality:** ${qp.seasonality}`);
  if (qp.coords && Array.isArray(qp.coords) && qp.coords.length === 4) {
    filters.push(`- **Coordinates:** lat ${qp.coords[0]}° to ${qp.coords[1]}°, lon ${qp.coords[2]}° to ${qp.coords[3]}°`);
  }
  if (qp.extendBack != null) {
    filters.push(`- **Extends back to:** ≥ ${qp.extendBack} yr BP`);
  }
  if (qp.extendForward != null) {
    filters.push(`- **Extends forward to:** ≤ ${qp.extendForward} yr BP`);
  }
  if (qp.subannualOnly) {
    filters.push(`- **Resolution:** subannual only (< 1 yr)`);
  } else if (qp.resolution != null) {
    filters.push(`- **Max median resolution:** ${qp.resolution} yr`);
  }
  if (filters.length > 0) {
    lines.push(...filters);
  } else {
    lines.push('_No query filters recorded._');
  }

  // TSID count
  if (qp.tsids && Array.isArray(qp.tsids)) {
    lines.push('', `**Selected records:** ${qp.tsids.length} TSIDs`);
  }

  lines.push('', 'See [`query_params.json`](query_params.json) for the full query specification and TSID list.');

  // Data Cleaning section
  if (cleaningGroups.length > 0) {
    const removedCount = cleaningGroups.reduce((n, g) =>
      n + g.records.filter(r => r.decision === 'remove').length, 0);

    lines.push(
      '',
      '## Data Cleaning',
      '',
      `${cleaningGroups.length} duplicate group(s) were reviewed and **${removedCount} record(s) removed**.`,
      '',
      'See [`cleaning_report.json`](cleaning_report.json) for per-group decisions, TSIDs, and notes.',
      '',
      '> **Important:** Removed records are excluded from the TSID list in `query_params.json`,',
      '> but LiPD files are downloaded at the dataset level and may still contain time series',
      '> from removed TSIDs. Use the TSID list in `query_params.json` to filter if needed.'
    );
  }

  if (datasetNotes && Object.keys(datasetNotes).length > 0) {
    lines.push('', '### Dataset-level notes', '');
    lines.push(
      'Captured during the data-cleaning step — a mix of user-typed ' +
      'commentary on individual datasets and automated audit lines ' +
      'from the duplicate-detection auto-picker.'
    );
    lines.push('');
    const names = Object.keys(datasetNotes).sort();
    for (const name of names) {
      const text = (datasetNotes[name] || '').trim();
      if (!text) continue;
      lines.push(`- **${name}**`);
      for (const line of text.split('\n')) {
        lines.push(line.trim() ? `  > ${line}` : '  >');
      }
    }
  }

  lines.push(
    '',
    '---',
    `Generated by [PReSto Custom Engine](https://paleopresto.com/)`,
    ''
  );

  return lines.join('\n');
}

/**
 * Update repository configuration files with user's parameters
 * @param {Octokit} octokit - Authenticated Octokit instance
 * @param {string} owner - Repository owner (username)
 * @param {string} repo - Repository name
 * @param {string} recon - Reconstruction type
 * @param {string} uniqueID - Unique reconstruction identifier
 * @param {Object} configData - User configuration data
 */
async function updateRepositoryConfig(octokit, owner, repo, recon, uniqueID, configData, queryParamsJson = null, cleaningReportJson = null, variableFilterYaml = null) {
  console.log('Updating repository configuration...');

  const entry = reconRegistry.get(recon);
  const isDownload = reconRegistry.canonical(recon) === 'lipdDownload';
  const configPath = entry.behavior.configPath;

  // For LMR, generate a user_config.yml with proper CFR key names and types.
  // This is mounted as /app/user_config.yml and merged over the base lmr_configs.yml
  // by cfr_main_code.py — so only override keys need to be present here.
  // configStrategy 'none' (e.g. lipdDownload) commits no config file at all.
  let configYaml = null;
  if (entry.configStrategy !== 'none') {
    let effectiveConfigData;
    if (entry.configStrategy === 'lmr') {
      const toIntArray = arr => (Array.isArray(arr) ? arr : []).map(v => parseInt(v, 10)).filter(n => !isNaN(n));
      effectiveConfigData = {
        recon_period:            toIntArray(configData.recon_period).length   ? toIntArray(configData.recon_period)            : [0, 2000],
        recon_seeds:             parseInt(configData.recon_seeds, 10) > 0     ? Array.from({length: parseInt(configData.recon_seeds, 10)}, (_, i) => i + 1) : [1, 2, 3],
        prior_annualize_months:  toIntArray(configData.prior_annualize_months).length ? toIntArray(configData.prior_annualize_months) : [1,2,3,4,5,6,7,8,9,10,11,12],
        prior_anom_period:       toIntArray(configData.prior_anom_period).length ? toIntArray(configData.prior_anom_period)      : [850, 1850],
        assim_frac:              parseFloat(configData.proxy_assim_frac) || 0.75,
        nens:                    parseInt(configData.proxy_nens, 10)     || 10,
        recon_loc_rad:           parseInt(configData.recon_loc_rad, 10)  || 25000,
        proxydb_path:            '/app/lipd_cfr.pkl',
        save_dirpath:            '/recons',
      };
    } else if (entry.configStrategy === 'holocene_da') {
      // Translate standardized form values to flat config_default.yml keys
      // using the recon's lookup.json mapping (same logic as the recon's
      // prestoForm/<handle>/translate.js).
      const lookup = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', 'prestoForm', entry.handle, 'lookup.json'), 'utf8'));
      const defaults = yaml.load(fs.readFileSync(
        path.join(__dirname, '..', 'prestoForm', entry.handle, 'config_default.yml'), 'utf8'));

      for (const [formKey, mapping] of Object.entries(lookup)) {
        // configData comes from req.body which has the standardized nested structure
        if (configData[formKey] !== undefined) {
          let val = configData[formKey];
          // Extract .value if it's an object with a value property
          if (val && typeof val === 'object' && 'value' in val) val = val.value;

          // Coerce form strings to match the type of the default value
          const defaultVal = defaults[mapping.orig];
          if (typeof defaultVal === 'number') {
            val = Number(val);
          } else if (typeof defaultVal === 'boolean') {
            val = (val === true || val === 'true');
          } else if (Array.isArray(defaultVal)) {
            if (!Array.isArray(val)) val = [val];
            // Coerce array elements to match the type of the first default element
            if (defaultVal.length > 0 && typeof defaultVal[0] === 'number') {
              val = val.map(v => Number(v));
            } else if (defaultVal.length > 0 && typeof defaultVal[0] === 'boolean') {
              val = val.map(v => v === true || v === 'true');
            }
          }
          // Handle special 'null'/'None' strings
          if (val === 'null' || val === 'None') val = null;

          defaults[mapping.orig] = val;
        }
      }
      // Hardcode data_dir so paths resolve to /proxies/... and /models/...
      defaults.data_dir = '/';
      effectiveConfigData = defaults;
    } else if (entry.configStrategy === 'nested') {
      // General nested-config translation: lookup.json maps each standardized
      // form key to a `path` array into config_default.yml; set each leaf,
      // coercing to the type of the existing default. Reusable by any recon
      // whose container reads a nested config (e.g. BayGMST's user_config.yml).
      const lookup = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', 'prestoForm', entry.handle, 'lookup.json'), 'utf8'));
      const defaults = yaml.load(fs.readFileSync(
        path.join(__dirname, '..', 'prestoForm', entry.handle, 'config_default.yml'), 'utf8'));

      for (const [formKey, mapping] of Object.entries(lookup)) {
        const pathArr = mapping && mapping.path;
        if (!Array.isArray(pathArr) || pathArr.length === 0) continue;
        if (configData[formKey] === undefined) continue;

        let val = configData[formKey];
        if (val && typeof val === 'object' && 'value' in val) val = val.value;

        // Walk to the parent node, creating intermediate objects if needed.
        let node = defaults;
        for (let i = 0; i < pathArr.length - 1; i++) {
          if (node[pathArr[i]] == null || typeof node[pathArr[i]] !== 'object') {
            node[pathArr[i]] = {};
          }
          node = node[pathArr[i]];
        }
        const leaf = pathArr[pathArr.length - 1];

        // Coerce the form string to match the existing default's type.
        const cur = node[leaf];
        if (typeof cur === 'number') val = Number(val);
        else if (typeof cur === 'boolean') val = (val === true || val === 'true');
        if (val === 'null' || val === 'None') val = null;

        node[leaf] = val;
      }
      effectiveConfigData = defaults;
    } else {
      effectiveConfigData = configData;
    }
    configYaml = yaml.dump(effectiveConfigData);
  }

  try {
    // ── Single commit via Git Trees API ───────────────────────────────────
    // Previously three separate createOrUpdateFileContents calls produced
    // three pushes, each triggering a spurious validation failure for
    // visualize.yml (which has a workflow_run trigger but no push: trigger).
    // One commit = one push = one validation run instead of three.

    // 1. Get current HEAD
    const { data: refData } = await octokit.rest.git.getRef({
      owner, repo, ref: 'heads/main'
    });
    const headSha = refData.object.sha;

    const { data: headCommit } = await octokit.rest.git.getCommit({
      owner, repo, commit_sha: headSha
    });

    // 2. Read README so we can update it
    const { data: readmeFile } = await octokit.rest.repos.getContent({
      owner, repo, path: 'README.md'
    });
    const readmeContent = Buffer.from(readmeFile.content, 'base64').toString('utf8');

    let updatedReadme;
    if (isDownload && queryParamsJson) {
      updatedReadme = generateLipdDownloadReadme(uniqueID, queryParamsJson, cleaningReportJson);
    } else {
      updatedReadme = readmeContent.replace(/Reconstruction ID:.*/, `Reconstruction ID: ${uniqueID}`);
    }

    // 3. Build file list — Trees API accepts raw content strings directly
    // lipdDownload only needs README + query_params.json (no config YAML)
    const treeItems = [
      { path: 'README.md', mode: '100644', type: 'blob', content: updatedReadme },
    ];
    if (entry.configStrategy !== 'none') {
      treeItems.push({ path: configPath, mode: '100644', type: 'blob', content: configYaml });
    }
    if (entry.behavior.commitsQueryParams && queryParamsJson) {
      treeItems.push({ path: 'query_params.json', mode: '100644', type: 'blob', content: queryParamsJson });
    }
    if (cleaningReportJson) {
      treeItems.push({ path: 'cleaning_report.json', mode: '100644', type: 'blob', content: cleaningReportJson });
    }
    // variable_filter.yaml — committed when the recon's workflow inspects which
    // variable names the user included/excluded. Not used by lipdDownload
    // (no reconstruction step there).
    if (variableFilterYaml && entry.behavior.commitsVariableFilter) {
      treeItems.push({ path: 'variable_filter.yaml', mode: '100644', type: 'blob', content: variableFilterYaml });
    }
    if (entry.configStrategy === 'lmr') {
      const scriptsDir = path.join(__dirname, '..', 'templates', 'scripts');
      for (const script of ['lipd_to_pdb.py', 'combine_seeds.py']) {
        const content = fs.readFileSync(path.join(scriptsDir, script), 'utf8');
        treeItems.push({ path: `scripts/${script}`, mode: '100644', type: 'blob', content });
      }
    }

    // 4. Create tree, commit, and advance the ref in one push
    const { data: newTree } = await octokit.rest.git.createTree({
      owner, repo,
      base_tree: headCommit.tree.sha,
      tree: treeItems,
    });

    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner, repo,
      message: `Configure reconstruction ${uniqueID}`,
      tree: newTree.sha,
      parents: [headSha],
    });

    await octokit.rest.git.updateRef({
      owner, repo,
      ref: 'heads/main',
      sha: newCommit.sha,
    });

    console.log(`✓ Committed ${treeItems.map(f => f.path).join(', ')} in a single push`);
    console.log('✓ Repository configuration complete');

  } catch (error) {
    console.error('Failed to update repository config:', error.message);
    throw error;
  }
}

/**
 * Initialize repository with workflow files, scripts, and user configuration (DEPRECATED - using templates now)
 * @param {Octokit} octokit - Authenticated Octokit instance
 * @param {string} owner - Repository owner (username)
 * @param {string} repo - Repository name
 * @param {string} recon - Reconstruction type
 * @param {string} uniqueID - Unique reconstruction identifier
 * @param {Object} configData - User configuration data
 */
async function initializeRepository(octokit, owner, repo, recon, uniqueID, configData) {
  const templateDir = path.join(__dirname, '..', 'templates');

  console.log('Initializing repository with Git Data API...');

  //Files to create in the repository
  const filesToCreate = [];

  // 1. Workflow file
  const workflowPath = `.github/workflows/${recon}.yml`;
  const workflowContent = fs.readFileSync(
    path.join(templateDir, 'workflows', `${recon}.yml`),
    'utf8'
  );
  filesToCreate.push({
    path: workflowPath,
    content: workflowContent
  });

  // 2. Shell scripts (not needed for download or LMR - they use different workflows)
  if (recon !== 'download' && recon !== 'LMR') {
    const scripts = ['gather_lipd_data.sh', 'run_reconstruction.sh'];
    if (recon === 'holocene_da') {
      scripts.push('generate_visualizations.sh');
    }

    for (const script of scripts) {
      const scriptPath = `scripts/${script}`;
      const scriptContent = fs.readFileSync(
        path.join(templateDir, 'scripts', script),
        'utf8'
      );
      filesToCreate.push({
        path: scriptPath,
        content: scriptContent
      });
    }
  }

  // 3. User configuration
  const configPath = recon === 'LMR' ? 'config/lmr_configs.yml' : 'config/user_config.yml';
  const configYaml = yaml.dump(configData);
  filesToCreate.push({
    path: configPath,
    content: configYaml
  });

  // 4. README (update the auto-generated one)
  const readmeContent = generateReadme(recon, uniqueID, configData);
  filesToCreate.push({
    path: 'README.md',
    content: readmeContent
  });

  // 5. Dockerfile (if exists in templates)
  const dockerfilePath = path.join(templateDir, 'Dockerfile');
  if (fs.existsSync(dockerfilePath)) {
    const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
    filesToCreate.push({
      path: 'Dockerfile',
      content: dockerfileContent
    });
  }

  // Use Git Data API to create all files in a single commit
  // Step 1: Create blobs for all files
  console.log('Creating blobs...');
  const tree = await Promise.all(
    filesToCreate.map(async (file) => {
      const { data: blob } = await octokit.rest.git.createBlob({
        owner,
        repo,
        content: Buffer.from(file.content).toString('base64'),
        encoding: 'base64'
      });
      console.log(`✓ Blob created for ${file.path}`);
      return {
        path: file.path,
        mode: file.path.startsWith('scripts/') ? '100755' : '100644',
        type: 'blob',
        sha: blob.sha
      };
    })
  );

  // Step 2: Create tree
  console.log('Creating tree...');
  const { data: newTree } = await octokit.rest.git.createTree({
    owner,
    repo,
    tree: tree
  });

  // Step 3: Create commit
  console.log('Creating initial commit...');
  const { data: newCommit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: `Initialize PReSto ${recon} reconstruction\n\nReconstruction ID: ${uniqueID}\nGenerated by PReSto Custom Reconstruction Engine`,
    tree: newTree.sha,
    parents: []  // No parents - this is the initial commit
  });

  // Step 4: Create main branch reference
  console.log('Creating main branch...');
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: 'refs/heads/main',
    sha: newCommit.sha
  });

  console.log('✓ Repository initialized successfully with all files');

  // Enable GitHub Pages (for holocene_da visualizations)
  if (recon === 'holocene_da') {
    try {
      await octokit.rest.repos.createPagesSite({
        owner,
        repo,
        source: {
          branch: 'main',
          path: '/results/viz'
        }
      });
    } catch (error) {
      // Pages may not be available immediately, log but don't fail
      console.warn('Could not enable GitHub Pages:', error.message);
    }
  }
}

/**
 * Generate README.md content for the repository
 * @param {string} recon - Reconstruction type
 * @param {string} uniqueID - Unique reconstruction identifier
 * @param {Object} configData - User configuration data
 * @returns {string} README content
 */
function generateReadme(recon, uniqueID, configData) {
  const reconTitle = recon === 'holocene_da' ? 'Holocene DA' : 'Temperature 12k';
  return `# PReSto ${reconTitle} Reconstruction

**Reconstruction ID:** ${uniqueID}
**Created:** ${new Date().toISOString()}
**Generated by:** [PReSto Custom Reconstruction Engine](https://paleopresto.com/)

## About

This repository contains a paleoclimate reconstruction generated using the PReSto (Paleoclimate Reconstruction Storehouse) custom reconstruction engine. The reconstruction runs automatically via GitHub Actions whenever you trigger the workflow.

## Reconstruction Type

**${reconTitle}** - ${recon === 'holocene_da'
    ? 'Data assimilation reconstruction for the Holocene period (last 12,000 years)'
    : 'Regional temperature composites for the last 12,000 years'}

## How It Works

1. **Configuration:** Your reconstruction parameters are stored in \`config/user_config.yml\`
2. **Data Gathering:** The workflow downloads proxy data from the LiPDverse
3. **Reconstruction:** Runs in a Docker container with R/Python scientific computing environment
4. **Results:** ${recon === 'holocene_da'
  ? 'Plots and configs are committed to `results/`; the NetCDF output is published as a GitHub Release asset (too large to commit — see the Results section below)'
  : 'NetCDF files and visualizations are committed to this repository'}
5. **Deployment:** ${recon === 'holocene_da' ? 'Interactive visualizations are deployed to GitHub Pages' : 'Results are stored as artifacts'}

## Running the Reconstruction

### Via GitHub Actions (Automatic)

The reconstruction was automatically triggered when this repository was created. To run it again:

1. Go to the **Actions** tab
2. Click on the "${reconTitle} Reconstruction" workflow
3. Click **Run workflow** → **Run workflow**
4. Monitor progress in the Actions tab

### Status

Check the [Actions tab](../../actions) for workflow status and logs.

## Results

${recon === 'holocene_da'
  ? '- **Visualizations:** [GitHub Pages](https://' + configData.user + '.github.io/' + generateRepoName(recon, uniqueID) + ')\n- **Validation report:** Published alongside the visualization on the same GitHub Pages site — GMST R + CE vs published Holocene reconstructions (Kaufman 2020 Temp12k, Marcott 2013 if available) plus a 6 ka spatial anomaly map\n- **Plots & config:** \`results/*.png\`, \`results/configs.yml\` (committed to this repo)\n- **NetCDF output:** [Releases tab](../../releases) — each run publishes a release tagged `results-<run_id>` with the `.nc` file as an asset (git\'s 100MB per-file push limit rules out committing it directly)\n- **Workflow artifact:** The full `results/` folder is also kept for 90 days on the [Actions run page](../../actions)'
  : '- **NetCDF Files:** \`results/*.nc\`\n- **Artifacts:** Available in Actions workflow runs (90-day retention)'}

## Configuration

Your reconstruction parameters:

\`\`\`yaml
${yaml.dump(configData, { lineWidth: 80 })}
\`\`\`

To modify parameters, edit \`config/user_config.yml\` and push changes to trigger a new reconstruction.

## Support

- **PReSto Website:** https://paleopresto.com/
- **Documentation:** https://paleopresto.com/about.html
- **Issues:** Report problems in this repository's Issues tab

## Citation

If you use this reconstruction in your research, please cite:

- The PReSto platform: https://paleopresto.com/
- The underlying reconstruction method (see PReSto documentation)
- The proxy datasets used (TSIDs listed in configuration)

---

*This repository was automatically generated by PReSto. The reconstruction runs via GitHub Actions using Docker containers.*
`;
}

/**
 * Dispatch a workflow run
 * @param {string} token - GitHub access token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Object} inputs - Workflow inputs
 * @returns {Promise<Object>} Workflow run information
 */
async function dispatchWorkflow(token, owner, repo, inputs) {
  const octokit = new Octokit({ auth: token });

  // Trigger workflow_dispatch event
  await octokit.rest.actions.createWorkflowDispatch({
    owner,
    repo,
    workflow_id: `${inputs.recon_type || 'holocene_da'}.yml`,
    ref: 'main',
    inputs: inputs
  });

  // Wait a moment for GitHub to register the workflow run
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Get the most recent workflow run
  const { data: runs } = await octokit.rest.actions.listWorkflowRuns({
    owner,
    repo,
    workflow_id: `${inputs.recon_type || 'holocene_da'}.yml`,
    per_page: 1
  });

  if (runs.workflow_runs.length === 0) {
    // Dispatch succeeded but run not yet registered — return without an ID
    console.warn('Workflow dispatched but run not yet listed by GitHub (race condition). Continuing without run ID.');
    return { id: null, status: 'queued', html_url: null };
  }

  return {
    id: runs.workflow_runs[0].id,
    status: runs.workflow_runs[0].status,
    html_url: runs.workflow_runs[0].html_url
  };
}

/**
 * Get workflow run status
 * @param {string} token - GitHub access token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} runId - Workflow run ID
 * @returns {Promise<Object>} Workflow run status
 */
async function getWorkflowStatus(token, owner, repo, runId) {
  const octokit = new Octokit({ auth: token });

  const { data: run } = await octokit.rest.actions.getWorkflowRun({
    owner,
    repo,
    run_id: runId
  });

  return {
    id: run.id,
    status: run.status,
    conclusion: run.conclusion,
    html_url: run.html_url,
    created_at: run.created_at,
    updated_at: run.updated_at
  };
}

/**
 * List workflow runs for a repository
 * @param {string} token - GitHub access token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Array>} List of workflow runs
 */
async function listWorkflowRuns(token, owner, repo) {
  const octokit = new Octokit({ auth: token });

  const { data: runs } = await octokit.rest.actions.listWorkflowRunsForRepo({
    owner,
    repo,
    per_page: 10
  });

  return runs.workflow_runs.map(run => ({
    id: run.id,
    status: run.status,
    conclusion: run.conclusion,
    html_url: run.html_url,
    created_at: run.created_at,
    updated_at: run.updated_at
  }));
}

module.exports = {
  encryptToken,
  decryptToken,
  authenticateUser,
  getUserInfo,
  generateRepoName,
  createRepository,
  initializeRepository,
  dispatchWorkflow,
  getWorkflowStatus,
  listWorkflowRuns
};
