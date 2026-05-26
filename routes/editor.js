/**
 * Editor routes (was editorServer.js)
 * Interactive parameter editor for reconstruction configs
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const mysql = require('mysql2/promise');
const config = require('../config');
const { computeTsidComplement } = require('./data');

const editorDir = path.join(__dirname, '..', 'jsonEditor');

// Single shared connection pool — created at module load, not per request.
// The previous in-handler createPool was a connection leak that exhausted
// MySQL's max_connections under sustained submission traffic.
const db = mysql.createPool(config.mysql);

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

// GET /querypath - Query path form (the live editor; users always reach
// this via /query/:recon → optional /datacleaning → /editor/querypath)
router.get('/querypath', (req, res) => {
  res.sendFile(path.join(editorDir, 'forms-query', req.query.recon + '.html'));
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
      // ── Idempotency guard ─────────────────────────────────────────────────
      // If a row already exists for this uniqueID, the user has already
      // submitted (most likely they hit Back from /status and re-clicked
      // Submit). Don't redo the file writes or the GitHub work — just send
      // them back to /status, which will show the in-flight or completed job.
      const [existing] = await db.query(
        'SELECT workflow_status FROM reconstruction_jobs WHERE unique_id = ? LIMIT 1',
        [uniqueID]
      );
      if (existing.length > 0) {
        console.log(`Re-submission for ${uniqueID} — existing status=${existing[0].workflow_status}; redirecting to /status without re-running setup.`);
        return res.redirect(`/status/${uniqueID}?already=1`);
      }

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

          // Fold the per-dataset degC complement into removedTsids so
          // lipdGenerator strips ride-along proxies before pickle generation.
          // Without this, the parent .lpd files carry all sibling Temp12k+degC
          // TSIDs through to the loader, which assimilates a superset of the
          // user's selection.
          let implicitRemoves = [];
          if (cleanedTSIDs && cleanedTSIDs.length > 0) {
            try {
              const { complement, stats } = await computeTsidComplement(cleanedTSIDs, recon);
              implicitRemoves = complement;
              if (stats) {
                console.log(
                  `TSID complement (${recon}): kept=${cleanedTSIDs.length}, ` +
                  `universe=${stats.universe}, implicit-removes=${stats.complement}, ` +
                  `seeds-matched=${stats.matched}/${cleanedTSIDs.length}`
                );
              }
            } catch (err) {
              console.warn(
                `computeTsidComplement failed for ${uniqueID}; ` +
                `falling back to explicit removedTSIDs only:`, err.message
              );
            }
          }
          const allRemoved = [...(removedTSIDs || []), ...implicitRemoves];
          const finalRemovedTsids = allRemoved.length > 0 ? [...new Set(allRemoved)] : null;

          lipdQueryJson = JSON.stringify({
            mode: 'filtered',
            ...queryParams,
            ...(cleanedTSIDs ? { tsids: cleanedTSIDs } : {}),
            ...(finalRemovedTsids ? { removedTsids: finalRemovedTsids } : {})
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

      // Map known failures to friendlier messages. The defaults still get the
      // raw message because operators benefit from it during local development;
      // production surfaces should keep this list tight.
      let title = 'Reconstruction submission failed';
      let body = 'An unexpected error prevented your reconstruction from being created.';
      let extra = '';
      const code = (error && error.code) || '';
      const msg  = (error && error.message) || '';

      if (code === 'ER_DUP_ENTRY' || /Duplicate entry/i.test(msg)) {
        // Should be unreachable now that the idempotency guard above redirects
        // re-submits to /status, but keep this branch as a safety net.
        return res.redirect(`/status/${uniqueID}?already=1`);
      }
      if (/GitHub token not found/i.test(msg)) {
        title = 'GitHub login expired';
        body  = 'Your GitHub session is no longer valid. Please log in again and re-submit.';
        extra = `<p><a href="/oauth/github?returnTo=${encodeURIComponent(req.get('referer') || '/forms/')}">Log in with GitHub</a></p>`;
      } else if (/Anonymous reconstructions are not available/i.test(msg)) {
        title = 'Login required';
        body  = 'This server is not configured to run anonymous reconstructions. Please log in with GitHub before submitting.';
      } else {
        body = msg || body;
      }

      res.status(500).send(`
        <h2>${title}</h2>
        <p>${body}</p>
        ${extra}
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
