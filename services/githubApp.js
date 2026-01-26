/**
 * GitHub App Service
 *
 * Handles anonymous/centralized reconstructions using GitHub App credentials.
 * More secure than OAuth (short-lived tokens), no user login required.
 *
 * Installation tokens expire after 1 hour and are not stored.
 */

const { App } = require('@octokit/app');
const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const config = require('../config');

/**
 * Initialize GitHub App
 * Private key can be provided as file path or directly as string
 */
function getPrivateKey() {
  if (config.githubApp.privateKeyPath) {
    // Read from file
    return fs.readFileSync(config.githubApp.privateKeyPath, 'utf8');
  } else if (config.githubApp.privateKey) {
    // Use directly from env var (useful for Docker secrets)
    return config.githubApp.privateKey;
  } else {
    throw new Error('GitHub App private key not configured. Set GITHUB_APP_PRIVATE_KEY_PATH or GITHUB_APP_PRIVATE_KEY');
  }
}

let app;
try {
  if (config.githubApp.appId && !config.githubApp.disabled) {
    app = new App({
      appId: config.githubApp.appId,
      privateKey: getPrivateKey(),
    });
    console.log('GitHub App initialized successfully');
  } else {
    console.log('GitHub App disabled or not configured');
  }
} catch (error) {
  console.error('Failed to initialize GitHub App:', error.message);
  console.log('Anonymous reconstructions will be unavailable');
}

/**
 * Get an installation access token (expires in 1 hour)
 * These are ephemeral and not stored in database
 */
async function getInstallationToken() {
  if (!app) {
    throw new Error('GitHub App not initialized');
  }

  const installationId = config.githubApp.installationId;
  if (!installationId) {
    throw new Error('GitHub App installation ID not configured');
  }

  try {
    const octokit = await app.getInstallationOctokit(installationId);
    return octokit;
  } catch (error) {
    console.error('Failed to get installation token:', error);
    throw new Error('Failed to authenticate with GitHub App');
  }
}

/**
 * Generate repository name for centralized storage
 * Format: presto-{reconType}-{date}-{uniqueId}
 * Example: presto-holocene-da-20260126-a1b2c3
 */
function generateRepoName(reconType, uniqueId) {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const sanitizedType = reconType.toLowerCase().replace(/_/g, '-');
  const shortId = uniqueId.substring(0, 6);

  return `presto-${sanitizedType}-${date}-${shortId}`;
}

/**
 * Create reconstruction repository in organization
 *
 * @param {Object} reconData - Reconstruction data
 * @param {string} reconData.uniqueId - Unique identifier
 * @param {string} reconData.reconType - Type (holocene_da or temp12k)
 * @param {Object} reconData.formData - Form parameters
 * @returns {Object} Repository info
 */
async function createReconstructionRepo(reconData) {
  const { uniqueId, reconType, formData } = reconData;
  const org = config.githubApp.organization;

  if (!org) {
    throw new Error('GitHub App organization not configured');
  }

  console.log(`Creating anonymous reconstruction repo for ${reconType} (${uniqueId})`);

  try {
    const octokit = await getInstallationToken();
    const repoName = generateRepoName(reconType, uniqueId);

    // Create repository in organization
    const { data: repo } = await octokit.repos.createInOrg({
      org: org,
      name: repoName,
      description: `Presto ${reconType} reconstruction - ${new Date().toISOString().split('T')[0]}`,
      private: false, // Public by default (can be changed if org has paid plan)
      auto_init: false,
      has_issues: false,
      has_projects: false,
      has_wiki: false,
    });

    console.log(`Repository created: ${repo.html_url}`);

    // Initialize repository with workflow and scripts
    await initializeRepository(octokit, org, repoName, reconType, formData, uniqueId);

    return {
      repoUrl: repo.html_url,
      repoName: repo.full_name,
      cloneUrl: repo.clone_url,
      defaultBranch: repo.default_branch,
    };
  } catch (error) {
    console.error('Failed to create repository:', error);
    throw new Error(`Failed to create GitHub repository: ${error.message}`);
  }
}

/**
 * Initialize repository with workflow files and configuration
 */
async function initializeRepository(octokit, org, repoName, reconType, formData, uniqueId) {
  console.log(`Initializing repository ${org}/${repoName}`);

  try {
    // Read workflow template
    const workflowTemplate = fs.readFileSync(
      path.join(__dirname, '..', 'templates', 'workflows', `${reconType}.yml`),
      'utf8'
    );

    // Read script templates
    const gatherScript = fs.readFileSync(
      path.join(__dirname, '..', 'templates', 'scripts', 'gather_lipd_data.sh'),
      'utf8'
    );
    const reconstructScript = fs.readFileSync(
      path.join(__dirname, '..', 'templates', 'scripts', 'run_reconstruction.sh'),
      'utf8'
    );
    const visualizeScript = fs.readFileSync(
      path.join(__dirname, '..', 'templates', 'scripts', 'generate_visualizations.sh'),
      'utf8'
    );

    // Create README
    const readme = generateReadme(reconType, formData, uniqueId);

    // Create parameters file
    const paramsFile = JSON.stringify(formData, null, 2);

    // Create all files in a single commit
    const files = [
      {
        path: '.github/workflows/reconstruction.yml',
        content: workflowTemplate,
      },
      {
        path: 'scripts/gather_lipd_data.sh',
        content: gatherScript,
      },
      {
        path: 'scripts/run_reconstruction.sh',
        content: reconstructScript,
      },
      {
        path: 'scripts/generate_visualizations.sh',
        content: visualizeScript,
      },
      {
        path: 'README.md',
        content: readme,
      },
      {
        path: 'parameters.json',
        content: paramsFile,
      },
    ];

    // Create files using the new file creation API
    for (const file of files) {
      await octokit.repos.createOrUpdateFileContents({
        owner: org,
        repo: repoName,
        path: file.path,
        message: `Initialize ${file.path}`,
        content: Buffer.from(file.content).toString('base64'),
      });
    }

    console.log(`Repository ${org}/${repoName} initialized successfully`);
  } catch (error) {
    console.error('Failed to initialize repository:', error);
    throw error;
  }
}

/**
 * Generate README.md content
 */
function generateReadme(reconType, formData, uniqueId) {
  const date = new Date().toISOString().split('T')[0];

  return `# Presto ${reconType.toUpperCase()} Reconstruction

**Reconstruction ID:** ${uniqueId}
**Date:** ${date}
**Type:** ${reconType}
**Status:** Running...

## Overview

This repository contains a paleoclimate reconstruction generated by the [PReSto Custom Reconstruction Engine](http://143.198.98.66).

## Parameters

\`\`\`json
${JSON.stringify(formData, null, 2)}
\`\`\`

## Workflow

This reconstruction runs via GitHub Actions:

1. **Gather Data** - Downloads LiPD files from the database
2. **Run Reconstruction** - Executes ${reconType} algorithm
3. **Generate Visualizations** - Creates plots and figures
4. **Publish Results** - Uploads artifacts and optionally publishes to GitHub Pages

## Results

Once the workflow completes, results will be available in the **Actions** tab above.

## Status

Track live reconstruction progress at: http://143.198.98.66/status?id=${uniqueId}

## Citation

If you use these results in your research, please cite:

\`\`\`
[Citation format to be added]
\`\`\`

## About

Generated by [PReSto](http://143.198.98.66) - Paleoclimate Reconstruction Engine
`;
}

/**
 * Dispatch workflow to start reconstruction
 *
 * @param {string} org - Organization name
 * @param {string} repoName - Repository name
 * @param {Object} inputs - Workflow inputs
 */
async function dispatchWorkflow(org, repoName, inputs) {
  console.log(`Dispatching workflow for ${org}/${repoName}`);

  try {
    const octokit = await getInstallationToken();

    await octokit.actions.createWorkflowDispatch({
      owner: org,
      repo: repoName,
      workflow_id: 'reconstruction.yml',
      ref: 'main',
      inputs: inputs || {},
    });

    console.log(`Workflow dispatched successfully for ${org}/${repoName}`);
  } catch (error) {
    console.error('Failed to dispatch workflow:', error);
    throw new Error(`Failed to start reconstruction: ${error.message}`);
  }
}

/**
 * Complete workflow: Create repo, initialize, and dispatch workflow
 *
 * @param {Object} reconData - Reconstruction data
 * @returns {Object} Repository and workflow info
 */
async function createAndRunReconstruction(reconData) {
  const { uniqueId, reconType, formData } = reconData;
  const org = config.githubApp.organization;

  // Create and initialize repository
  const repoInfo = await createReconstructionRepo(reconData);

  // Extract repository name from full name (org/repo)
  const repoName = repoInfo.repoName.split('/')[1];

  // Dispatch workflow
  await dispatchWorkflow(org, repoName, {
    reconstruction_id: uniqueId,
  });

  return {
    ...repoInfo,
    workflowStatus: 'queued',
    authType: 'github_app',
    isAnonymous: true,
    organization: org,
  };
}

/**
 * Check if GitHub App is configured and available
 */
function isAvailable() {
  return !!(app && config.githubApp.organization && !config.githubApp.disabled);
}

module.exports = {
  createReconstructionRepo,
  dispatchWorkflow,
  createAndRunReconstruction,
  isAvailable,
};
