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
async function createRepository(token, recon, uniqueID, configData) {
  const octokit = new Octokit({ auth: token });
  const repoName = generateRepoName(recon, uniqueID);

  // Get authenticated user
  const userInfo = await getUserInfo(token);
  const owner = userInfo.username;

  // Template repository mapping
  const templates = {
    'LMR': { owner: 'DaveEdge1', name: 'LMR2' },
    'holocene_da': { owner: 'DaveEdge1', name: 'holocene_da_template' }, // TODO: create this
    'temp12k': { owner: 'DaveEdge1', name: 'temp12k_template' } // TODO: create this
  };

  const template = templates[recon];
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
  await updateRepositoryConfig(octokit, owner, repoName, recon, uniqueID, configData);

  // Enable GitHub Pages (gh-pages branch created by visualize.yml on first run)
  // This call may fail on first creation if gh-pages branch doesn't exist yet —
  // the visualize.yml workflow also enables Pages after its first push as a fallback.
  try {
    await octokit.rest.repos.createPagesSite({
      owner,
      repo: repoName,
      source: { branch: 'gh-pages', path: '/' }
    });
    console.log(`✓ GitHub Pages enabled for ${repoName}`);
  } catch (err) {
    // 409 = already configured, 422 = branch doesn't exist yet — both are acceptable
    console.warn(`GitHub Pages not enabled at creation time (${err.status}): will be enabled by visualize.yml on first run`);
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
 * Update repository configuration files with user's parameters
 * @param {Octokit} octokit - Authenticated Octokit instance
 * @param {string} owner - Repository owner (username)
 * @param {string} repo - Repository name
 * @param {string} recon - Reconstruction type
 * @param {string} uniqueID - Unique reconstruction identifier
 * @param {Object} configData - User configuration data
 */
async function updateRepositoryConfig(octokit, owner, repo, recon, uniqueID, configData) {
  console.log('Updating repository configuration...');

  // Update the config file with user's parameters
  // LMR template has lmr_configs.yml at root level
  const configPath = recon === 'LMR' ? 'lmr_configs.yml' : 'config/user_config.yml';
  const configYaml = yaml.dump(configData);

  try {
    // Get existing config file to get its SHA
    const { data: existingFile } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: configPath
    });

    // Update config file
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: configPath,
      message: `Update configuration for reconstruction ${uniqueID}`,
      content: Buffer.from(configYaml).toString('base64'),
      sha: existingFile.sha
    });

    console.log(`✓ Updated ${configPath}`);

    // Update README with reconstruction ID
    const { data: readmeFile } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: 'README.md'
    });

    const readmeContent = Buffer.from(readmeFile.content, 'base64').toString('utf8');
    const updatedReadme = readmeContent.replace(/Reconstruction ID:.*/, `Reconstruction ID: ${uniqueID}`);

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'README.md',
      message: `Update README for reconstruction ${uniqueID}`,
      content: Buffer.from(updatedReadme).toString('base64'),
      sha: readmeFile.sha
    });

    console.log('✓ Updated README.md');
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
4. **Results:** NetCDF files and visualizations are committed to this repository
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
  ? '- **Visualizations:** [GitHub Pages](https://' + configData.user + '.github.io/' + generateRepoName(recon, uniqueID) + ')\n- **NetCDF Files:** \`results/*.nc\`\n- **Plots:** \`results/viz/\`'
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
