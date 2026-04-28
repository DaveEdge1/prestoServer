/**
 * Status Routes
 * Provides reconstruction job status tracking
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const config = require('../config');

// Database connection
const mysql = require('mysql2/promise');
let db;

(async () => {
  db = await mysql.createPool(config.mysql);
})();

/**
 * GET /status/:uniqueID
 * Display status page for a reconstruction job
 */
router.get('/:uniqueID', async (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'status.html'));
});

/**
 * GET /status/api/:uniqueID
 * Get reconstruction job status as JSON
 */
router.get('/api/:uniqueID', async (req, res) => {
  const { uniqueID } = req.params;

  try {
    // Get job information
    const [jobs] = await db.query(
      `SELECT
        id,
        unique_id,
        user_id,
        email,
        recon_type,
        execution_mode,
        github_repo_name,
        github_repo_url,
        workflow_run_id,
        workflow_status,
        created_at,
        started_at,
        completed_at
       FROM reconstruction_jobs
       WHERE unique_id = ?`,
      [uniqueID]
    );

    if (jobs.length === 0) {
      return res.status(404).json({ error: 'Reconstruction job not found' });
    }

    const job = jobs[0];

    // Get recent webhook events
    const [events] = await db.query(
      `SELECT event_type, received_at
       FROM webhook_events
       WHERE job_id = ?
       ORDER BY received_at DESC
       LIMIT 10`,
      [job.id]
    );

    // Calculate duration
    let duration = null;
    if (job.started_at && job.completed_at) {
      duration = Math.round((new Date(job.completed_at) - new Date(job.started_at)) / 1000);
    }

    res.json({
      uniqueId: job.unique_id,
      reconType: job.recon_type,
      executionMode: job.execution_mode,
      status: job.workflow_status,
      repository: {
        name: job.github_repo_name,
        url: job.github_repo_url
      },
      workflowRunId: job.workflow_run_id,
      timestamps: {
        created: job.created_at,
        started: job.started_at,
        completed: job.completed_at
      },
      duration: duration,
      events: events.map(e => ({
        type: e.event_type,
        timestamp: e.received_at
      }))
    });

  } catch (error) {
    console.error('Status API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /status/api/:uniqueID/logs
 * Get GitHub Actions workflow logs URL
 */
router.get('/api/:uniqueID/logs', async (req, res) => {
  const { uniqueID } = req.params;

  try {
    const [jobs] = await db.query(
      'SELECT github_repo_url, workflow_run_id FROM reconstruction_jobs WHERE unique_id = ?',
      [uniqueID]
    );

    if (jobs.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = jobs[0];

    if (!job.github_repo_url || !job.workflow_run_id) {
      return res.status(404).json({ error: 'Workflow not started' });
    }

    // Construct GitHub Actions logs URL
    const logsUrl = `${job.github_repo_url}/actions/runs/${job.workflow_run_id}`;

    res.json({ logsUrl });

  } catch (error) {
    console.error('Logs API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
