/**
 * Editor routes (was editorServer.js)
 * Interactive parameter editor for reconstruction configs
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const config = require('../config');

const editorDir = path.join(__dirname, '..', 'jsonEditor');

// Serve static files from jsonEditor/public
router.use('/', express.static(path.join(editorDir, 'public')));

// Helper: Find form key in form data
function formKeyIndex(formData, formKey) {
  let ans1 = '';
  for (let keyA in formData) {
    if (keyA == formKey) {
      ans1 = keyA;
    }
  }
  return ans1;
}

// Helper: Parse boolean
function parseBool(val) {
  return val === true || val === 'true';
}

// Edit config file with form data
function editConfigs(configLoc, formEdits, recon, uniqueID) {
  const configDir = path.join(config.paths.userRecons, uniqueID);

  // Create user directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const configFile = fs.readFileSync(configLoc, 'utf8');
  const configFileNew = YAML.parse(configFile);

  for (let key1 in configFileNew) {
    for (let key2 in configFileNew[key1]) {
      const formKey = key1 + '_' + key2;
      console.log(
        'key1: ', key1,
        'key2:', key2,
        'form key:', formKey,
        'old: ', configFileNew[key1][key2]['value'],
        'new: ', formEdits[formKeyIndex(formEdits, formKey)]
      );
      console.log(
        'old object type: ' + typeof configFileNew[key1][key2]['value'] +
        ' new: ' + typeof formEdits[formKeyIndex(formEdits, formKey)]
      );

      let newKey = formEdits[formKeyIndex(formEdits, formKey)];
      if (newKey == undefined) {
        continue;
      }

      if (typeof configFileNew[key1][key2]['value'] === 'number') {
        configFileNew[key1][key2]['value'] = Number(newKey);
      } else if (Array.isArray(configFileNew[key1][key2]['value'])) {
        console.log(
          configFileNew[key1][key2]['long_name'],
          'length: ',
          configFileNew[key1][key2]['value'].length
        );

        if (!Array.isArray(newKey)) {
          newKey = new Array(newKey);
          configFileNew[key1][key2]['value'] = [];
          console.log('made empty array: ' + configFileNew[key1][key2]['value']);
        }

        let dataType = '';
        if (typeof configFileNew[key1][key2]['value'][0] === 'number') {
          dataType = 'num';
        } else if (typeof configFileNew[key1][key2]['value'][0] === 'boolean') {
          dataType = 'bool';
        }

        configFileNew[key1][key2]['value'] = [];
        console.log('made empty array: ' + configFileNew[key1][key2]['value']);

        for (let ii in newKey) {
          console.log('old: ', configFileNew[key1][key2]['value'][ii], ' new: ', newKey[ii]);
          if (dataType === 'num') {
            configFileNew[key1][key2]['value'][ii] = Number(newKey[ii]);
          } else if (dataType === 'bool') {
            configFileNew[key1][key2]['value'][ii] = parseBool(newKey[ii]);
          } else {
            configFileNew[key1][key2]['value'][ii] = newKey[ii];
          }
        }
      } else if (typeof configFileNew[key1][key2]['value'] === 'boolean') {
        configFileNew[key1][key2]['value'] = parseBool(newKey);
      } else {
        configFileNew[key1][key2]['value'] = newKey;
      }
    }
  }

  fs.writeFileSync(path.join(configDir, 'configs.yml'), YAML.stringify(configFileNew), (err) => {
    if (err) {
      return console.log(err);
    }
    console.log('The config file was saved!');
  });

  return path.join(configDir, 'configs.yml');
}

// Write configs and return redirect path
function writeConfigs(recon, user, domain, jsonBody, uniqueID, language) {
  console.log('language: ' + language);
  const reconID = uniqueID + '_' + recon;

  // Use BASE_URL for redirects
  const downloadPath = `${config.baseUrl}/reconstruct/${recon}/${user}/${domain}/${reconID}/${language}`;

  if (recon !== 'download') {
    const configLoc = path.join(config.paths.prestoForm, recon, 'configs.yml');
    editConfigs(configLoc, jsonBody, recon, reconID);
  }

  return downloadPath;
}

// Form location helper
function formLocate(recon1) {
  return path.join(editorDir, 'forms', recon1 + '.html');
}

function formLocate2(recon1) {
  return path.join(editorDir, 'forms-query', recon1 + '.html');
}

// GET / - Main editor form (recon-specific)
router.get('/', (req, res) => {
  res.sendFile(formLocate(req.query.recon));
});

// GET /querypath - Query path form
router.get('/querypath', (req, res) => {
  res.sendFile(formLocate2(req.query.recon));
});

// POST /sendReconRequest - Submit reconstruction request
router.post('/sendReconRequest', async (req, res) => {
  console.log(req.query.uniqueID);

  const { recon, user, domain, uniqueID, language } = req.query;
  const useGitHubActions = req.body.useGitHubActions === 'true';
  const isAuthenticated = !!(req.session && req.session.userId);

  console.log(`Reconstruction submission - useGitHubActions: ${useGitHubActions}, isAuthenticated: ${isAuthenticated}, userId: ${req.session?.userId}, username: ${req.session?.githubUsername}`);

  // GitHub Actions workflow (OAuth or App)
  if (useGitHubActions) {
    try {
      const mysql = require('mysql2/promise');
      const db = await mysql.createPool(config.mysql);

      // Save configuration to prestoForm directory
      const reconID = uniqueID + '_' + recon;
      const configLoc = path.join(config.paths.prestoForm, recon, 'configs.yml');
      const configPath = editConfigs(configLoc, req.body, recon, reconID);

      // Prepare configuration data for GitHub repository
      const configData = {
        ...req.body,
        recon: recon,
        user: user,
        domain: domain,
        uniqueID: uniqueID,
        language: language || 'en'
      };

      let repo, authType, isAnonymous, userId, githubOrg;

      // OPTION 1: OAuth - Personal Repository (User is authenticated)
      if (isAuthenticated) {
        console.log(`Creating personal GitHub repository for ${recon} reconstruction ${uniqueID}...`);

        const githubService = require('../services/github');

        // Get user's GitHub token
        const [tokens] = await db.query(
          'SELECT encrypted_token FROM github_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
          [req.session.userId]
        );

        if (tokens.length === 0) {
          throw new Error('GitHub token not found. Please login again.');
        }

        const token = githubService.decryptToken(tokens[0].encrypted_token);

        // ── Compute lipdQueryJson BEFORE creating repository ──────────────────
        // Must be done first so createRepository can commit query_params.json
        // (containing the cleaned TSID selection) to the repo before the push
        // to lmr_configs.yml triggers the workflow run.
        let lipdQueryJson = null;

        if (recon === 'LMR') {
          console.log('Processing LiPD data for LMR reconstruction...');
          const userReconDir = path.join(config.paths.userRecons, `${uniqueID}_LMR`);
          const archivedCompPath = path.join(userReconDir, 'archivedComp.json');

          if (fs.existsSync(archivedCompPath)) {
            // Path A: Archived compilation
            const archiveInfo = JSON.parse(fs.readFileSync(archivedCompPath, 'utf8'));
            lipdQueryJson = JSON.stringify({
              mode: 'archived',
              compilation: archiveInfo.compilation,
              version: archiveInfo.version
            });
            console.log(`Using archived compilation: ${archiveInfo.compilation} v${archiveInfo.version}`);
          } else {
            // Path B: Filtered query — load server-side params + cleaned TSID selection
            const queryParamsPath = path.join(userReconDir, 'query_params.json');
            let queryParams = {};
            if (fs.existsSync(queryParamsPath)) {
              queryParams = JSON.parse(fs.readFileSync(queryParamsPath, 'utf8'));
              console.log('Loaded query params from query page:', queryParams);
            } else {
              console.warn('query_params.json not found for', uniqueID, '- queryParams will be empty');
            }

            const cleanedPath = path.join(userReconDir, 'cleaned_TSIDs.json');
            const cleanedTSIDs = fs.existsSync(cleanedPath)
              ? JSON.parse(fs.readFileSync(cleanedPath, 'utf8')).TSIDs
              : null;
            if (cleanedTSIDs) {
              console.log(`Using cleaned TSID selection: ${cleanedTSIDs.length} TSIDs (from cleaned_TSIDs.json)`);
            }

            lipdQueryJson = JSON.stringify({
              mode: 'filtered',
              ...queryParams,
              ...(cleanedTSIDs ? { tsids: cleanedTSIDs } : {})
            });
            console.log('Using filtered query with parameters:', queryParams);
          }
        }

        // Create repository in user's account.
        // For LMR: commits query_params.json + updated workflow to the repo
        // before pushing lmr_configs.yml so they are available when the
        // push-triggered workflow run starts.
        const repoData = await githubService.createRepository(
          token,
          recon,
          uniqueID,
          configData,
          lipdQueryJson   // null for non-LMR
        );

        // LMR: workflow is already triggered by the push to lmr_configs.yml
        // in updateRepositoryConfig() — no explicit dispatch needed.
        // Other recon types dispatch their workflow explicitly.
        let workflowRun = { id: null };
        if (recon !== 'LMR') {
          console.log(`Dispatching workflow for ${repoData.name}...`);
          const workflowInputs = { unique_id: uniqueID, recon_type: recon };
          workflowRun = await githubService.dispatchWorkflow(
            token,
            repoData.owner,
            repoData.name,
            workflowInputs
          );
        } else {
          console.log(`LMR: workflow triggered by config push to ${repoData.name}`);
        }

        repo = {
          name: repoData.name,
          url: repoData.url,
          workflowRunId: workflowRun.id
        };
        authType = 'oauth';
        isAnonymous = false;
        userId = req.session.userId;
        githubOrg = null;

        console.log(`Personal repository created: ${repo.url}`);
      }
      // OPTION 2: GitHub App - Anonymous/Centralized Repository
      else {
        console.log(`Creating anonymous GitHub repository for ${recon} reconstruction ${uniqueID}...`);

        const githubAppService = require('../services/githubApp');

        // Check if GitHub App is available
        if (!githubAppService.isAvailable()) {
          throw new Error('Anonymous reconstructions are not available. Please login with GitHub or use traditional workflow.');
        }

        // Create and run reconstruction using GitHub App
        const result = await githubAppService.createAndRunReconstruction({
          uniqueId: uniqueID,
          reconType: recon,
          formData: configData
        });

        repo = {
          name: result.repoName,
          url: result.repoUrl,
          workflowRunId: null // GitHub App doesn't return workflow run ID immediately
        };
        authType = 'github_app';
        isAnonymous = true;
        userId = null;
        githubOrg = result.organization;

        console.log(`Anonymous repository created: ${repo.url}`);
      }

      // Save job to database with auth type tracking
      await db.query(
        `INSERT INTO reconstruction_jobs
         (unique_id, user_id, email, recon_type, execution_mode, github_repo_name, github_repo_url, workflow_run_id, workflow_status, config_json, auth_type, is_anonymous, github_org)
         VALUES (?, ?, ?, ?, 'github_actions', ?, ?, ?, 'queued', ?, ?, ?, ?)`,
        [
          uniqueID,
          userId,
          user + '@' + domain,
          recon,
          repo.name,
          repo.url,
          repo.workflowRunId,
          JSON.stringify(configData),
          authType,
          isAnonymous,
          githubOrg
        ]
      );

      console.log(`Job saved to database for ${uniqueID} (auth_type: ${authType})`);

      // Temporary redirect page — 10s countdown then forward to the repo's Actions tab
      const actionsUrl = `${repo.url}/actions`;
      res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reconstruction Submitted</title>
  <style>
    body { font-family: sans-serif; max-width: 640px; margin: 60px auto; padding: 0 20px; color: #333; }
    h2 { color: #2a6496; }
    .countdown { font-size: 1.4em; font-weight: bold; color: #2a6496; }
    a { color: #2a6496; }
    .repo-link { word-break: break-all; }
  </style>
</head>
<body>
  <h2>Reconstruction submitted!</h2>
  <p>Your <strong>${recon}</strong> reconstruction has been queued in GitHub Actions.</p>
  <p>Repository: <a class="repo-link" href="${repo.url}" target="_blank">${repo.url}</a></p>
  <p>You will be redirected to the Actions page in <span class="countdown" id="t">10</span> seconds.</p>
  <p><a href="${actionsUrl}">Go now &rarr;</a></p>
  <p><em>Warning: Using your browser's Back button will resubmit the form.</em></p>
  <script>
    history.pushState(null, null, window.location.href);
    history.back();
    window.onpopstate = () => history.forward();
    var seconds = 10;
    var el = document.getElementById('t');
    var interval = setInterval(function() {
      seconds--;
      el.textContent = seconds;
      if (seconds <= 0) { clearInterval(interval); window.location = '${actionsUrl}'; }
    }, 1000);
  </script>
</body>
</html>`);

    } catch (error) {
      console.error('GitHub Actions error:', error);
      res.status(500).send(`
        <h2>Reconstruction submission failed</h2>
        <p>${error.message}</p>
        <p><a href="javascript:history.back()">Go back</a></p>
      `);
    }
  } else {
    // Traditional workflow (existing code)
    res.redirect(
      writeConfigs(
        req.query.recon,
        req.query.user,
        req.query.domain,
        req.body,
        req.query.uniqueID,
        req.query.language
      )
    );
  }
});

module.exports = router;
