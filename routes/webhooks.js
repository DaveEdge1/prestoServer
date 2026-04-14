/**
 * Webhook Routes
 * Handles GitHub webhook events for workflow status updates
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const config = require('../config');

// Database connection
const mysql = require('mysql2/promise');
let db;

(async () => {
  db = await mysql.createPool(config.mysql);
})();

/**
 * Verify GitHub webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - Signature from X-Hub-Signature-256 header
 * @returns {boolean} True if signature is valid
 */
function verifyGitHubSignature(payload, signature) {
  if (!signature || !config.github.webhookSecret) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', config.github.webhookSecret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

/**
 * Map GitHub workflow status to database status
 * @param {string} githubStatus - GitHub workflow status (queued, in_progress, completed)
 * @param {string} conclusion - GitHub workflow conclusion (success, failure, cancelled, etc.)
 * @returns {string} Database status
 */
function mapWorkflowStatus(githubStatus, conclusion) {
  if (githubStatus === 'queued') return 'queued';
  if (githubStatus === 'in_progress') return 'in_progress';
  if (githubStatus === 'completed') {
    if (conclusion === 'success') return 'completed';
    if (conclusion === 'cancelled') return 'cancelled';
    return 'failed';
  }
  return 'pending';
}

/**
 * POST /webhooks/github
 * Handle GitHub webhook events
 */
router.post('/github', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  const delivery = req.headers['x-github-delivery'];

  // Verify webhook signature
  if (!verifyGitHubSignature(req.body, signature)) {
    console.error('Invalid webhook signature');
    return res.status(401).send('Invalid signature');
  }

  // Parse payload
  let payload;
  try {
    payload = JSON.parse(req.body.toString());
  } catch (error) {
    console.error('Invalid JSON payload:', error);
    return res.status(400).send('Invalid JSON');
  }

  console.log(`Received GitHub webhook: ${event} (${delivery})`);

  // Only process workflow_run events
  if (event !== 'workflow_run') {
    return res.status(200).send('Event type not processed');
  }

  try {
    const workflowRun = payload.workflow_run;
    const action = payload.action; // requested, in_progress, completed
    const runId = workflowRun.id;
    const status = workflowRun.status;
    const conclusion = workflowRun.conclusion;
    const repoName = payload.repository.name;

    console.log(`Workflow run ${runId}: ${action} (status: ${status}, conclusion: ${conclusion})`);

    // Find reconstruction job by workflow_run_id or repo name
    const [jobs] = await db.query(
      'SELECT id, unique_id, email, user_id, recon_type FROM reconstruction_jobs WHERE workflow_run_id = ? OR github_repo_name = ?',
      [runId, repoName]
    );

    if (jobs.length === 0) {
      console.warn(`No reconstruction job found for workflow run ${runId} or repo ${repoName}`);
      return res.status(200).send('Job not found');
    }

    const job = jobs[0];
    const dbStatus = mapWorkflowStatus(status, conclusion);

    // Update job status
    const updates = {
      workflow_status: dbStatus,
      workflow_run_id: runId
    };

    if (dbStatus === 'in_progress' && !job.started_at) {
      updates.started_at = new Date();
    }

    if (dbStatus === 'completed' || dbStatus === 'failed' || dbStatus === 'cancelled') {
      updates.completed_at = new Date();
    }

    // Build update query
    const updateFields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const updateValues = Object.values(updates);
    updateValues.push(job.id);

    await db.query(
      `UPDATE reconstruction_jobs SET ${updateFields} WHERE id = ?`,
      updateValues
    );

    // Log webhook event
    await db.query(
      'INSERT INTO webhook_events (job_id, event_type, workflow_run_id, payload) VALUES (?, ?, ?, ?)',
      [job.id, `workflow_run.${action}`, runId, JSON.stringify(payload)]
    );

    console.log(`Updated job ${job.unique_id} to status ${dbStatus}`);

    // For completed visualization workflows, set the repo homepage to the Pages URL.
    // GITHUB_TOKEN in Actions lacks admin permission, so we use the user's OAuth token.
    const workflowName = workflowRun.name || '';
    if (dbStatus === 'completed' && workflowName.toLowerCase().includes('visualize')) {
      try {
        const githubService = require('../services/github');
        const { Octokit } = require('@octokit/rest');

        const [tokens] = await db.query(
          'SELECT encrypted_token FROM github_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
          [job.user_id]
        );

        if (tokens.length > 0) {
          const token = githubService.decryptToken(tokens[0].encrypted_token);
          const octokit = new Octokit({ auth: token });
          const repoOwner = payload.repository.owner.login;
          const pagesUrl = `https://${repoOwner}.github.io/${repoName}/docs/visualizer.html`;

          await octokit.rest.repos.update({
            owner: repoOwner,
            repo: repoName,
            homepage: pagesUrl
          });

          console.log(`Set ${repoName} homepage to Pages URL: ${pagesUrl}`);
        } else {
          console.warn(`No stored token for user_id ${job.user_id} — cannot set Pages homepage`);
        }
      } catch (homepageErr) {
        console.error(`Failed to set Pages homepage for ${repoName}:`, homepageErr.message);
      }
    }

    // For completed lipdDownload jobs, set the repo's About/homepage URL to the artifact
    if (dbStatus === 'completed' && job.recon_type === 'lipdDownload') {
      try {
        const githubService = require('../services/github');
        const { Octokit } = require('@octokit/rest');

        // Retrieve the user's stored OAuth token
        const [tokens] = await db.query(
          'SELECT encrypted_token FROM github_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
          [job.user_id]
        );

        if (tokens.length > 0) {
          const token = githubService.decryptToken(tokens[0].encrypted_token);
          const octokit = new Octokit({ auth: token });
          const repoOwner = payload.repository.owner.login;

          // List artifacts for this workflow run to get the artifact ID
          const { data: artifactsData } = await octokit.rest.actions.listWorkflowRunArtifacts({
            owner: repoOwner,
            repo: repoName,
            run_id: runId
          });

          if (artifactsData.artifacts.length > 0) {
            const artifact = artifactsData.artifacts[0];
            const artifactUrl = `https://github.com/${repoOwner}/${repoName}/actions/runs/${runId}/artifacts/${artifact.id}`;

            // Update the repo's homepage (About section website link)
            await octokit.rest.repos.update({
              owner: repoOwner,
              repo: repoName,
              homepage: artifactUrl
            });

            console.log(`Set ${repoName} homepage to artifact: ${artifactUrl}`);
          } else {
            console.warn(`No artifacts found for workflow run ${runId} in ${repoName}`);
          }
        } else {
          console.warn(`No stored token for user_id ${job.user_id} — cannot update repo homepage`);
        }
      } catch (homepageErr) {
        console.error(`Failed to set repo homepage for ${repoName}:`, homepageErr.message);
        // Non-fatal — don't fail the webhook
      }
    }

    // Send email notification on completion (optional)
    if (dbStatus === 'completed' && job.email) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.port === 465,
          auth: {
            user: config.smtp.user,
            pass: config.smtp.password
          }
        });

        const repoUrl = workflowRun.repository.html_url;
        const workflowUrl = workflowRun.html_url;

        await transporter.sendMail({
          from: config.smtp.from,
          to: job.email,
          subject: `PReSto Reconstruction Complete: ${job.unique_id}`,
          html: `
            <h2>Your PReSto reconstruction is complete!</h2>
            <p><strong>Reconstruction ID:</strong> ${job.unique_id}</p>
            <p><strong>Repository:</strong> <a href="${repoUrl}">${repoUrl}</a></p>
            <p><strong>Workflow Run:</strong> <a href="${workflowUrl}">${workflowUrl}</a></p>
            <p>Your results are now permanently stored in your GitHub repository.</p>
            <hr>
            <p><small>Generated by <a href="https://paleopresto.com/">PReSto</a></small></p>
          `
        });

        console.log(`Sent completion email to ${job.email}`);
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Don't fail webhook processing if email fails
      }
    }

    res.status(200).send('Webhook processed');

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send('Internal server error');
  }
});

module.exports = router;
