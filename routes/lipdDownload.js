/**
 * LiPD Download routes
 * Confirmation page and GitHub repo creation for filtered LiPD file downloads.
 *
 * Flow:
 *   GET  /confirm        — serve lipdDownload.html
 *   GET  /record-count   — return { count, source } based on cleaned/original TSIDs
 *   POST /submit         — fork lipd-download-template, commit query_params.json, redirect to /status
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');

const queryDir = path.join(__dirname, '..', 'query');

// Single shared connection pool — created at module load, not per request.
// The previous in-handler createPool was a connection leak that exhausted
// MySQL's max_connections under sustained download submissions.
const db = mysql.createPool(config.mysql);

// GET /confirm — serve the confirmation page
router.get('/confirm', (req, res) => {
  res.sendFile(path.join(queryDir, 'lipdDownload.html'));
});

// GET /record-count — return TSID count for the confirmation page
router.get('/record-count', (req, res) => {
  const { uniqueID, recon } = req.query;

  if (!uniqueID || !recon) {
    return res.status(400).json({ error: 'uniqueID and recon are required' });
  }

  const userReconDir = path.join(config.paths.userRecons, `${uniqueID}_${recon}`);
  const cleanedPath = path.join(userReconDir, 'cleaned_TSIDs.json');
  const originalPath = path.join(userReconDir, 'TSIDs.json');

  try {
    if (fs.existsSync(cleanedPath)) {
      const data = JSON.parse(fs.readFileSync(cleanedPath, 'utf8'));
      return res.json({ count: (data.TSIDs || []).length, source: 'cleaned' });
    }
    if (fs.existsSync(originalPath)) {
      const data = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
      return res.json({ count: (data.TSIDs || []).length, source: 'original' });
    }
    return res.status(404).json({ error: 'No TSID file found — session may have expired' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read TSID file: ' + err.message });
  }
});

// POST /submit — create GitHub repo and trigger download workflow
router.post('/submit', async (req, res) => {
  const { recon, user, domain, uniqueID } = req.query;

  if (!recon || !uniqueID) {
    return res.status(400).json({ error: 'recon and uniqueID are required' });
  }

  const isAuthenticated = !!(req.session && req.session.userId);

  try {
    const userReconDir = path.join(config.paths.userRecons, `${uniqueID}_${recon}`);

    // Build query params JSON with cleaned TSID selection
    const queryParamsPath = path.join(userReconDir, 'query_params.json');
    let queryParams = {};
    if (fs.existsSync(queryParamsPath)) {
      queryParams = JSON.parse(fs.readFileSync(queryParamsPath, 'utf8'));
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
      console.log(`lipdDownload: using cleaned TSID selection: ${cleanedTSIDs.length} TSIDs`);
    }
    if (removedTSIDs) {
      console.log(`lipdDownload: ${removedTSIDs.length} TSIDs explicitly removed`);
    }

    const reportPath = path.join(userReconDir, 'cleaning_report.json');
    const cleaningReportJson = fs.existsSync(reportPath)
      ? fs.readFileSync(reportPath, 'utf8')
      : null;

    const lipdQueryJson = JSON.stringify({
      mode: 'filtered',
      ...queryParams,
      ...(cleanedTSIDs ? { tsids: cleanedTSIDs } : {}),
      ...(removedTSIDs ? { removedTsids: removedTSIDs } : {})
    });

    let repo, authType, isAnonymous, userId, githubOrg;

    if (isAuthenticated) {
      const githubService = require('../services/github');

      const [tokens] = await db.query(
        'SELECT encrypted_token FROM github_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [req.session.userId]
      );
      if (tokens.length === 0) {
        throw new Error('GitHub token not found. Please login again.');
      }

      const token = githubService.decryptToken(tokens[0].encrypted_token);

      const repoData = await githubService.createRepository(
        token,
        'lipdDownload',
        uniqueID,
        {},            // no configData needed for downloads
        lipdQueryJson,
        cleaningReportJson
      );

      repo = { name: repoData.name, url: repoData.url };
      authType = 'oauth';
      isAnonymous = false;
      userId = req.session.userId;
      githubOrg = null;

      console.log(`lipdDownload repo created: ${repo.url}`);
    } else {
      const githubAppService = require('../services/githubApp');

      if (!githubAppService.isAvailable()) {
        throw new Error('Anonymous downloads are not available. Please login with GitHub.');
      }

      const result = await githubAppService.createAndRunReconstruction({
        uniqueId: uniqueID,
        reconType: 'lipdDownload',
        formData: {}
      });

      repo = { name: result.repoName, url: result.repoUrl };
      authType = 'github_app';
      isAnonymous = true;
      userId = null;
      githubOrg = result.organization;
    }

    await db.query(
      `INSERT INTO reconstruction_jobs
       (unique_id, user_id, email, recon_type, execution_mode, github_repo_name, github_repo_url, workflow_run_id, workflow_status, config_json, auth_type, is_anonymous, github_org)
       VALUES (?, ?, ?, ?, 'github_actions', ?, ?, ?, 'queued', ?, ?, ?, ?)`,
      [
        uniqueID,
        userId,
        user && domain ? `${user}@${domain}` : null,
        'lipdDownload',
        repo.name,
        repo.url,
        null,
        '{}',
        authType,
        isAnonymous,
        githubOrg
      ]
    );

    console.log(`lipdDownload job saved to database for ${uniqueID}`);

    return res.json({ redirectUrl: `/status/${uniqueID}` });

  } catch (error) {
    console.error('lipdDownload submit error:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
