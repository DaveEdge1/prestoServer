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

      // ── Fast synchronous work (before redirect) ───────────────────────────

      // Save configuration to prestoForm directory
      const reconID = uniqueID + '_' + recon;
      const configLoc = path.join(config.paths.prestoForm, recon, 'configs.yml');
      editConfigs(configLoc, req.body, recon, reconID);

      // Prepare configuration data for GitHub repository
      const configData = {
        ...req.body,
        recon: recon,
        user: user,
        domain: domain,
        uniqueID: uniqueID,
        language: language || 'en'
      };

      const authType = isAuthenticated ? 'oauth' : 'github_app';
      const isAnonymous = !isAuthenticated;
      const userId = isAuthenticated ? req.session.userId : null;

      // Validate prerequisites and capture token before redirect
      let token = null;
      if (isAuthenticated) {
        const githubService = require('../services/github');
        const [tokens] = await db.query(
          'SELECT encrypted_token FROM github_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
          [userId]
        );
        if (tokens.length === 0) {
          throw new Error('GitHub token not found. Please login again.');
        }
        token = githubService.decryptToken(tokens[0].encrypted_token);
      } else {
        const githubAppService = require('../services/githubApp');
        if (!githubAppService.isAvailable()) {
          throw new Error('Anonymous reconstructions are not available. Please login with GitHub.');
        }
      }

      // Compute lipdQueryJson (reads local files — fast, no network)
      let lipdQueryJson = null;
      let cleaningReportJson = null;
      let variableFilterYaml = null;
      if ((recon === 'LMR' || recon === 'holocene_da') && isAuthenticated) {
        console.log(`Processing LiPD data for ${recon} reconstruction...`);
        const userReconDir = path.join(config.paths.userRecons, `${uniqueID}_${recon}`);
        const archivedCompPath = path.join(userReconDir, 'archivedComp.json');

        if (fs.existsSync(archivedCompPath)) {
          const archiveInfo = JSON.parse(fs.readFileSync(archivedCompPath, 'utf8'));
          lipdQueryJson = JSON.stringify({
            mode: 'archived',
            compilation: archiveInfo.compilation,
            version: archiveInfo.version
          });
          console.log(`Using archived compilation: ${archiveInfo.compilation} v${archiveInfo.version}`);
        } else {
          const queryParamsPath = path.join(userReconDir, 'query_params.json');
          let queryParams = {};
          if (fs.existsSync(queryParamsPath)) {
            queryParams = JSON.parse(fs.readFileSync(queryParamsPath, 'utf8'));
            console.log('Loaded query params from query page:', queryParams);
          } else {
            console.warn('query_params.json not found for', uniqueID, '- queryParams will be empty');
          }

          const cleanedPath = path.join(userReconDir, 'cleaned_TSIDs.json');
          let cleanedTSIDs = null;
          let removedTSIDs = null;
          if (fs.existsSync(cleanedPath)) {
            const cleanedData = JSON.parse(fs.readFileSync(cleanedPath, 'utf8'));
            cleanedTSIDs = cleanedData.TSIDs || null;
            removedTSIDs = cleanedData.removedTSIDs || null;
          }
          if (cleanedTSIDs) {
            console.log(`Using cleaned TSID selection: ${cleanedTSIDs.length} TSIDs (from cleaned_TSIDs.json)`);
          }

          const reportPath = path.join(userReconDir, 'cleaning_report.json');
          cleaningReportJson = fs.existsSync(reportPath)
            ? fs.readFileSync(reportPath, 'utf8')
            : null;

          // variable_filter.yaml — written by /datacleaning/confirm. Passed
          // through to the repo so the workflow can read it alongside
          // query_params.json.
          const variableFilterPath = path.join(userReconDir, 'variable_filter.yaml');
          variableFilterYaml = fs.existsSync(variableFilterPath)
            ? fs.readFileSync(variableFilterPath, 'utf8')
            : null;

          lipdQueryJson = JSON.stringify({
            mode: 'filtered',
            ...queryParams,
            ...(cleanedTSIDs ? { tsids: cleanedTSIDs } : {}),
            ...(removedTSIDs ? { removedTsids: removedTSIDs } : {})
          });
          console.log('Using filtered query with parameters:', queryParams);
        }
      }

      // Insert pending job record, then redirect immediately
      await db.query(
        `INSERT INTO reconstruction_jobs
         (unique_id, user_id, email, recon_type, execution_mode, github_repo_name, github_repo_url, workflow_run_id, workflow_status, config_json, auth_type, is_anonymous, github_org)
         VALUES (?, ?, ?, ?, 'github_actions', NULL, NULL, NULL, 'pending', ?, ?, ?, NULL)`,
        [uniqueID, userId, user + '@' + domain, recon, JSON.stringify(configData), authType, isAnonymous]
      );

      console.log(`Redirecting to status page for ${uniqueID} — GitHub setup starting in background`);
      res.redirect(`/status/${uniqueID}`);

      // ── Slow GitHub API work (background, after redirect) ─────────────────
      setImmediate(async () => {
        try {
          let repo, githubOrg;

          if (isAuthenticated) {
            const githubService = require('../services/github');
            console.log(`Creating personal GitHub repository for ${recon} reconstruction ${uniqueID}...`);

            // Create repository in user's account.
            const repoData = await githubService.createRepository(
              token,
              recon,
              uniqueID,
              configData,
              lipdQueryJson,        // null for non-LMR
              cleaningReportJson,   // null if no cleaning was done
              variableFilterYaml    // null if no variable filter state
            );

            // LMR & holocene_da: workflow triggered by the push to query_params.json — no explicit dispatch needed.
            let workflowRun = { id: null };
            if (recon !== 'LMR' && recon !== 'holocene_da') {
              console.log(`Dispatching workflow for ${repoData.name}...`);
              workflowRun = await githubService.dispatchWorkflow(
                token,
                repoData.owner,
                repoData.name,
                { unique_id: uniqueID, recon_type: recon }
              );
            } else {
              console.log(`${recon}: workflow triggered by config push to ${repoData.name}`);
            }

            repo = { name: repoData.name, url: repoData.url, workflowRunId: workflowRun.id };
            githubOrg = null;
            console.log(`Personal repository created: ${repo.url}`);
          } else {
            const githubAppService = require('../services/githubApp');
            console.log(`Creating anonymous GitHub repository for ${recon} reconstruction ${uniqueID}...`);

            const result = await githubAppService.createAndRunReconstruction({
              uniqueId: uniqueID,
              reconType: recon,
              formData: configData
            });

            repo = { name: result.repoName, url: result.repoUrl, workflowRunId: null };
            githubOrg = result.organization;
            console.log(`Anonymous repository created: ${repo.url}`);
          }

          // Update DB record with actual repo info
          await db.query(
            `UPDATE reconstruction_jobs
             SET github_repo_name=?, github_repo_url=?, workflow_run_id=?, workflow_status='queued', github_org=?
             WHERE unique_id=?`,
            [repo.name, repo.url, repo.workflowRunId, githubOrg, uniqueID]
          );
          console.log(`Job updated in database for ${uniqueID} (auth_type: ${authType})`);

        } catch (error) {
          console.error('Background GitHub Actions error:', error);
          await db.query(
            `UPDATE reconstruction_jobs SET workflow_status='failed' WHERE unique_id=?`,
            [uniqueID]
          );
        }
      });

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
