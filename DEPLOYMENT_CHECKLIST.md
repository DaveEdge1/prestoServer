# GitHub Actions Integration - Deployment Checklist (Containerized)

## Prerequisites
- Docker and Docker Compose installed on production server
- Access to production server (143.198.98.66)
- GitHub account for OAuth app registration

## Step 1: Register GitHub OAuth Application

1. Go to https://github.com/settings/developers
2. Click **"New OAuth App"**
3. Fill in:
   - **Application name:** PReSto Custom Reconstruction Engine
   - **Homepage URL:** `http://143.198.98.66`
   - **Authorization callback URL:** `http://143.198.98.66/oauth/github/callback`
   - **Description:** Paleoclimate reconstruction via GitHub Actions
4. Click **"Register application"**
5. Copy the **Client ID**
6. Click **"Generate a new client secret"** and copy it immediately

## Step 2: Update Production .env File

On the production server, add these variables to `.env`:

```bash
# GitHub OAuth & Actions Configuration
GITHUB_CLIENT_ID=your_client_id_from_step1
GITHUB_CLIENT_SECRET=your_client_secret_from_step1
GITHUB_CALLBACK_URL=http://143.198.98.66/oauth/github/callback
GITHUB_DEFAULT_VISIBILITY=public

# Generate secure secrets (run these commands):
GITHUB_WEBHOOK_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Base URL
BASE_URL=http://143.198.98.66
```

**IMPORTANT:** Keep these secrets secure and never commit them to version control!

## Step 3: Pull Latest Code on Production

```bash
# SSH into production server
ssh user@143.198.98.66

# Navigate to presto directory
cd /root/presto

# Fetch and checkout the actions branch
git fetch origin
git checkout actions
git pull origin actions
```

## Step 4: Run Database Migration

```bash
# Option A: If MySQL container is running
docker-compose exec mysql mysql -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE < db/migrations/001_github_integration.sql

# Option B: If containers are not running yet, start MySQL first
docker-compose up -d mysql
# Wait 30 seconds for MySQL to initialize
sleep 30
docker-compose exec mysql mysql -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE < db/migrations/001_github_integration.sql
```

Verify tables were created:
```bash
docker-compose exec mysql mysql -u $MYSQL_USER -p$MYSQL_PASSWORD -e "SHOW TABLES LIKE '%github%';" $MYSQL_DATABASE
# Should show: users, github_tokens, reconstruction_jobs, webhook_events
```

## Step 5: Rebuild and Restart Containers

```bash
# Stop current containers
docker-compose down

# Rebuild the orchestrator image (installs new npm packages)
docker-compose build presto-orchestrator

# Start all services
docker-compose up -d

# Verify all containers are running
docker-compose ps

# Check orchestrator logs for errors
docker-compose logs -f presto-orchestrator
# Press Ctrl+C to exit logs
```

## Step 6: Verify Deployment

Test the OAuth endpoint:
```bash
curl http://143.198.98.66/oauth/github/status
# Should return: {"authenticated":false}
```

Test the health check:
```bash
curl http://143.198.98.66/health
# Should return: {"status":"healthy","version":"2.0.0","timestamp":"..."}
```

## Step 7: End-to-End Test

1. Open browser to `http://143.198.98.66/forms`
2. Click on "holocene_da" or "temp12k" form
3. Verify "Login with GitHub" button appears
4. Click login and authorize the app
5. Verify your GitHub username appears after login
6. Fill out form with test parameters
7. Check "Run in GitHub Actions" checkbox
8. Submit form
9. Verify redirect to status page
10. Check your GitHub account for new repository
11. Verify workflow is running in the repository's Actions tab

## Step 8: Configure GitHub Webhook (Optional but Recommended)

After a successful test reconstruction:

1. Go to the newly created repository in GitHub
2. Navigate to **Settings → Webhooks**
3. Click **"Add webhook"**
4. Configure:
   - **Payload URL:** `http://143.198.98.66/webhooks/github`
   - **Content type:** `application/json`
   - **Secret:** Use the `GITHUB_WEBHOOK_SECRET` from your `.env`
   - **Events:** Select "Workflow runs"
   - **Active:** Checked
5. Click **"Add webhook"**

Test webhook:
```bash
# Check recent webhook events in database
docker-compose exec mysql mysql -u $MYSQL_USER -p$MYSQL_PASSWORD -e "SELECT event_type, received_at FROM webhook_events ORDER BY received_at DESC LIMIT 5;" $MYSQL_DATABASE
```

## Monitoring

### View Container Logs
```bash
# All services
docker-compose logs -f

# Just orchestrator
docker-compose logs -f presto-orchestrator

# Just MySQL
docker-compose logs -f mysql
```

### Check Database Records
```bash
# List users
docker-compose exec mysql mysql -u $MYSQL_USER -p$MYSQL_PASSWORD -e "SELECT id, github_username, email, created_at FROM users;" $MYSQL_DATABASE

# List recent jobs
docker-compose exec mysql mysql -u $MYSQL_USER -p$MYSQL_PASSWORD -e "SELECT unique_id, recon_type, workflow_status, created_at FROM reconstruction_jobs ORDER BY created_at DESC LIMIT 10;" $MYSQL_DATABASE
```

## Rollback Plan

If issues occur, the GitHub integration can be disabled without affecting traditional workflow:

1. Comment out GitHub routes in `app.js`:
   ```javascript
   // app.use('/oauth', require('./routes/oauth'));
   // app.use('/webhooks', require('./routes/webhooks'));
   // app.use('/status', require('./routes/status'));
   ```

2. Rebuild and restart:
   ```bash
   docker-compose build presto-orchestrator
   docker-compose up -d
   ```

3. Traditional workflow remains fully functional

## Troubleshooting

### OAuth Login Fails
- Check `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env`
- Verify callback URL matches GitHub app settings
- Check orchestrator logs: `docker-compose logs presto-orchestrator`

### Repository Creation Fails
- Verify user granted `repo` scope during OAuth
- Check GitHub API rate limits
- Ensure token is valid in `github_tokens` table

### Webhook Not Received
- Verify webhook URL is accessible from internet
- Check webhook secret matches
- Inspect webhook delivery logs in GitHub repository settings

### Session Not Persisting
- Check `SESSION_SECRET` is set in `.env`
- Verify cookies are enabled in browser
- For HTTPS, ensure `NODE_ENV=production` and secure flag is set

## Support

For issues:
- Check container logs: `docker-compose logs`
- Review database records (queries above)
- Test OAuth flow in isolation
- Verify all environment variables are set

## Next Steps

After successful deployment:
- Monitor first few reconstructions
- Set up automated backups for MySQL data
- Consider configuring HTTPS with SSL certificates
- Document any production-specific configurations
