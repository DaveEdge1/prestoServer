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

        // Create repository in user's account
        const repoData = await githubService.createRepository(
          token,
          recon,
          uniqueID,
          configData
        );

        // LMR-specific: Generate and upload LiPD pickle
        let lipdDataUrl = null;
        if (recon === 'LMR') {
          console.log('Generating LiPD data for LMR reconstruction...');

          const lipdService = require('../services/lipdDataService');

          // Extract query parameters from formData
          const queryParams = {
            compilation: req.body.data_selection_compilation || 'PAGES2kv2',
            coords: [
              parseFloat(req.body.geo_proxy_coords?.[0] || -90),
              parseFloat(req.body.geo_proxy_coords?.[1] || 90),
              parseFloat(req.body.geo_proxy_coords?.[2] || -180),
              parseFloat(req.body.geo_proxy_coords?.[3] || 180)
            ],
            archiveTypes: req.body.data_selection_archive_types || null,
            variableName: req.body.paleoData_variableName || null
          };

          // Generate and upload pickle to repository
          lipdDataUrl = await lipdService.generateAndUploadLipdPickle(
            queryParams,
            uniqueID,
            token,
            repoData.owner,
            repoData.name
          );

          console.log(`LiPD data uploaded: ${lipdDataUrl}`);
        }

        // Dispatch workflow
        console.log(`Dispatching workflow for ${repoData.name}...`);
        const workflowInputs = {
          unique_id: uniqueID,
          recon_type: recon
        };

        // Add lipd_data_url for LMR
        if (recon === 'LMR' && lipdDataUrl) {
          workflowInputs.lipd_data_url = lipdDataUrl;
        }

        const workflowRun = await githubService.dispatchWorkflow(
          token,
          repoData.owner,
          repoData.name,
          workflowInputs
        );

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

      // Redirect to status page
      res.redirect(`/status/${uniqueID}?repo=${encodeURIComponent(repo.url)}`);

    } catch (error) {
      console.error('GitHub Actions error:', error);

      // Fallback to traditional workflow
      console.warn('Falling back to traditional workflow...');
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
