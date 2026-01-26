# Hybrid GitHub Actions Deployment Guide

## Overview

The Presto reconstruction engine now supports THREE execution modes:

1. **Anonymous/Quick Run** (GitHub App) - No login, results in public archive
2. **Personal Run** (OAuth) - User login, results in user's GitHub account
3. **Traditional** (Email) - Existing server-based workflow

This guide covers deployment of the hybrid GitHub implementation.

## Prerequisites

- Production server with Docker/Docker Compose
- GitHub account for creating OAuth App and GitHub App
- Access to create a GitHub organization (for centralized repos)

## Part 1: GitHub OAuth Setup (Personal Repos)

### 1.1 Register OAuth App

1. Go to https://github.com/settings/developers
2. Click **"New OAuth App"**
3. Fill in:
   - **Application name:** PReSto Custom Reconstruction Engine
   - **Homepage URL:** `http://143.198.98.66`
   - **Authorization callback URL:** `http://143.198.98.66/oauth/github/callback`
   - **Description:** Paleoclimate reconstruction via GitHub Actions
4. Click **"Register application"**
5. Copy **Client ID** and generate **Client Secret**

### 1.2 Add OAuth Credentials to .env

```bash
# GitHub OAuth (for personal repos)
GITHUB_CLIENT_ID=your_oauth_client_id
GITHUB_CLIENT_SECRET=your_oauth_client_secret
GITHUB_CALLBACK_URL=http://143.198.98.66/oauth/github/callback
GITHUB_DEFAULT_VISIBILITY=public
GITHUB_WEBHOOK_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

## Part 2: GitHub App Setup (Anonymous Repos)

### 2.1 Create GitHub Organization

1. Go to https://github.com/organizations/plan
2. Click **"Create organization"**
3. Choose **"Create a free organization"**
4. Organization name: `presto-reconstructions` (or your preferred name)
5. Contact email: your email
6. Complete setup

### 2.2 Register GitHub App

1. Go to https://github.com/organizations/presto-reconstructions/settings/apps/new
2. Fill in:
   - **GitHub App name:** `presto-reconstruction-engine`
   - **Homepage URL:** `http://143.198.98.66`
   - **Webhook URL:** `http://143.198.98.66/webhooks/github`
   - **Webhook secret:** Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - **Repository permissions:**
     - Contents: Read & Write
     - Workflows: Read & Write
     - Metadata: Read
   - **Subscribe to events:**
     - Workflow run
3. Click **"Create GitHub App"**
4. Note the **App ID**
5. Scroll to **"Private keys"** section
6. Click **"Generate a private key"**
7. Download the `.pem` file (keep secure!)

### 2.3 Install GitHub App

1. On the GitHub App settings page, click **"Install App"**
2. Select your organization: `presto-reconstructions`
3. Choose **"All repositories"** or **"Only select repositories"**
4. Click **"Install"**
5. Note the installation ID from the URL: `https://github.com/organizations/.../settings/installations/XXXXXXXX`
   (The number after `installations/` is your Installation ID)

### 2.4 Upload Private Key to Server

```bash
# On production server
mkdir -p /root/presto/secrets
chmod 700 /root/presto/secrets

# Upload private key (from local machine)
scp downloaded-private-key.pem user@143.198.98.66:/root/presto/secrets/github-app-private-key.pem

# Set secure permissions
ssh user@143.198.98.66
chmod 600 /root/presto/secrets/github-app-private-key.pem
```

### 2.5 Add GitHub App Credentials to .env

```bash
# GitHub App (for anonymous/centralized repos)
GITHUB_APP_ID=your_app_id
GITHUB_APP_INSTALLATION_ID=your_installation_id
GITHUB_APP_PRIVATE_KEY_PATH=/root/presto/secrets/github-app-private-key.pem
GITHUB_APP_ORG=presto-reconstructions
# GITHUB_APP_DISABLED=false  # Set to true to temporarily disable
```

## Part 3: Security & Encryption Setup

```bash
# Generate secure secrets
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Add to .env
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> .env
echo "SESSION_SECRET=$SESSION_SECRET" >> .env
```

## Part 4: Database Migration

### 4.1 Run First Migration (OAuth tables)

```bash
docker-compose exec mysql mysql -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE < db/migrations/001_github_integration.sql
```

### 4.2 Run Second Migration (Hybrid auth columns)

```bash
docker-compose exec mysql mysql -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE < db/migrations/002_add_hybrid_auth_support.sql
```

### 4.3 Verify Tables

```bash
docker-compose exec mysql mysql -u $MYSQL_USER -p$MYSQL_PASSWORD -e "
  SHOW TABLES LIKE '%github%';
  DESCRIBE reconstruction_jobs;
" $MYSQL_DATABASE
```

Expected tables:
- `users`
- `github_tokens`
- `reconstruction_jobs` (should have: auth_type, is_anonymous, github_org columns)
- `webhook_events`

## Part 5: Deploy to Production

### 5.1 Pull Latest Code

```bash
ssh user@143.198.98.66
cd /root/presto
git fetch origin
git checkout actions
git pull origin actions
```

### 5.2 Rebuild and Restart

```bash
# Stop containers
docker-compose down

# Rebuild (installs new npm packages including @octokit/app)
docker-compose build presto-orchestrator

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f presto-orchestrator
```

## Part 6: Verification

### 6.1 Test Health Endpoint

```bash
curl http://143.198.98.66/health
# Expected: {"status":"healthy","version":"2.0.0",...}
```

### 6.2 Test OAuth Status

```bash
curl http://143.198.98.66/oauth/github/status
# Expected: {"authenticated":false}
```

### 6.3 Test Form Pages

1. Open browser to `http://143.198.98.66/forms`
2. Click on "holocene_da" form
3. Verify you see THREE execution options:
   - Quick Run (No Login Required) - **checked by default**
   - Run in Your GitHub Account - with "Login with GitHub" button
   - Traditional Workflow (Email Results)

### 6.4 Test Anonymous Reconstruction

1. Fill out form parameters
2. Select "Quick Run" option (should be default)
3. Submit form
4. Verify:
   - Redirects to status page
   - Repository created in `presto-reconstructions` organization
   - Workflow is running in GitHub Actions

### 6.5 Test Personal Reconstruction

1. Click "Login with GitHub"
2. Authorize the OAuth app
3. Verify username appears after login
4. "Run in Your GitHub Account" option should now be selected
5. Fill form and submit
6. Verify:
   - Repository created in user's account (not org)
   - Workflow is running

### 6.6 Check Database Records

```bash
docker-compose exec mysql mysql -u $MYSQL_USER -p$MYSQL_PASSWORD -e "
  SELECT unique_id, auth_type, is_anonymous, github_org, github_repo_name
  FROM reconstruction_jobs
  ORDER BY created_at DESC
  LIMIT 5;
" $MYSQL_DATABASE
```

You should see:
- Anonymous runs with `auth_type='github_app'`, `is_anonymous=1`, `github_org='presto-reconstructions'`
- Personal runs with `auth_type='oauth'`, `is_anonymous=0`, `github_org=NULL`

## Part 7: Monitoring

### 7.1 Check GitHub App API Usage

```bash
# In container
docker-compose exec presto-orchestrator node -e "
const { Octokit } = require('@octokit/rest');
const config = require('./config');
const { App } = require('@octokit/app');
const fs = require('fs');

const app = new App({
  appId: config.githubApp.appId,
  privateKey: fs.readFileSync(config.githubApp.privateKeyPath, 'utf8')
});

(async () => {
  const octokit = await app.getInstallationOctokit(config.githubApp.installationId);
  const { data } = await octokit.rateLimit.get();
  console.log('Rate Limit:', data.rate);
})();
"
```

### 7.2 Monitor Logs

```bash
# Follow all logs
docker-compose logs -f

# Filter for GitHub-related events
docker-compose logs presto-orchestrator | grep -i github

# Check for errors
docker-compose logs presto-orchestrator | grep -i error
```

## Troubleshooting

### Anonymous Runs Fail

**Problem:** "Anonymous reconstructions are not available"

**Solutions:**
1. Check GitHub App is configured: `echo $GITHUB_APP_ID`
2. Verify private key exists: `ls -la /root/presto/secrets/`
3. Check app is installed on organization
4. Review logs: `docker-compose logs presto-orchestrator | grep -i "github app"`

### OAuth Runs Fail

**Problem:** "GitHub token not found"

**Solutions:**
1. User needs to login again
2. Check OAuth credentials: `echo $GITHUB_CLIENT_ID`
3. Verify callback URL matches GitHub app settings
4. Check database for tokens: `SELECT * FROM github_tokens;`

### Private Key Permission Error

**Problem:** "EACCES: permission denied"

**Solutions:**
```bash
chmod 600 /root/presto/secrets/github-app-private-key.pem
chown root:root /root/presto/secrets/github-app-private-key.pem
```

### Database Migration Fails

**Problem:** Column already exists

**Solutions:**
```bash
# Check if migration was already run
docker-compose exec mysql mysql -u $MYSQL_USER -p$MYSQL_PASSWORD -e "
  SHOW COLUMNS FROM reconstruction_jobs LIKE 'auth_type';
" $MYSQL_DATABASE

# If column exists, migration already ran - skip it
```

## Rollback Plans

### Disable GitHub App (Keep OAuth)

```bash
# In .env
GITHUB_APP_DISABLED=true

# Restart
docker-compose restart presto-orchestrator
```

Users will still see OAuth option but not anonymous option.

### Disable Both (Traditional Only)

```bash
# In routes/editor.js (temporary)
# Comment out GitHub logic
# OR set both disabled in .env
GITHUB_APP_DISABLED=true
# Remove GitHub OAuth vars (or set to empty)
```

### Full Rollback

```bash
git checkout master
docker-compose build presto-orchestrator
docker-compose up -d
```

## Security Checklist

- [ ] OAuth Client Secret is secure and not committed
- [ ] GitHub App Private Key has 600 permissions
- [ ] Webhook secrets are random 32+ char strings
- [ ] Encryption key is random 32+ chars
- [ ] Session secret is random 32+ chars
- [ ] .env file is in .gitignore
- [ ] Private key is in secure directory (not web-accessible)
- [ ] Database backups are configured
- [ ] HTTPS is enabled (if applicable)

## Next Steps

After successful deployment:

1. **Test Thoroughly**
   - Run multiple anonymous reconstructions
   - Run multiple personal reconstructions
   - Verify workflows complete successfully
   - Check GitHub Pages deployment (if enabled)

2. **Monitor Usage**
   - Track which auth type users prefer
   - Monitor API rate limits
   - Watch for errors in logs

3. **Documentation**
   - Add user-facing documentation
   - Create video tutorials
   - Write FAQ for common issues

4. **Optimization**
   - Consider GitHub Actions self-hosted runners
   - Set up automated cleanup of old repos
   - Implement usage analytics

## Support Resources

- Architecture docs: `HYBRID_ARCHITECTURE.md`
- Original deployment: `GITHUB_ACTIONS_DEPLOYMENT.md`
- Container setup: `DEPLOYMENT_CHECKLIST.md`
- GitHub App docs: https://docs.github.com/en/apps
- GitHub OAuth docs: https://docs.github.com/en/apps/oauth-apps

## Summary

The hybrid approach provides:
- **Low barrier to entry** (anonymous runs)
- **User ownership** (personal repos)
- **Backward compatibility** (traditional workflow)
- **Better security** (short-lived tokens)
- **Flexibility** for different use cases

Both anonymous and personal runs use GitHub Actions, providing transparent, reproducible, and shareable paleoclimate reconstructions.
