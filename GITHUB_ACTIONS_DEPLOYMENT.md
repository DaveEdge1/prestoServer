# GitHub Actions Integration - Deployment Guide

## Implementation Summary

The GitHub Actions integration has been successfully implemented for the Presto custom reconstruction engine. This allows users to:

1. Login with their GitHub account via OAuth
2. Run reconstructions via GitHub Actions
3. Store results permanently in their own GitHub repositories
4. Track reconstruction status in real-time
5. View visualizations on GitHub Pages (for holocene_da)

## Files Created

### Database & Configuration
- `db/migrations/001_github_integration.sql` - Database schema for users, tokens, jobs, webhooks
- Updated `config/index.js` - Added GitHub OAuth and security configuration
- Updated `.env.example` - Added GitHub environment variables

### Backend Services
- `services/github.js` - GitHub API integration (Octokit wrapper)
  - OAuth authentication
  - Repository creation and initialization
  - Workflow dispatch
  - Token encryption/decryption

### Routes
- `routes/oauth.js` - OAuth flow (login, callback, logout, status)
- `routes/webhooks.js` - GitHub webhook handler for workflow events
- `routes/status.js` - Status tracking API endpoints

### Frontend
- `public/status.html` - Real-time reconstruction status page
- Updated `jsonEditor/forms/holocene_da.html` - Added GitHub auth UI
- Updated `jsonEditor/forms/temp12k.html` - Added GitHub auth UI

### GitHub Actions Templates
- `templates/workflows/holocene_da.yml` - Holocene DA workflow
- `templates/workflows/temp12k.yml` - Temperature 12k workflow
- `templates/scripts/gather_lipd_data.sh` - LiPD data gathering script
- `templates/scripts/run_reconstruction.sh` - Reconstruction execution script
- `templates/scripts/generate_visualizations.sh` - Visualization generation script

### Application Integration
- Updated `app.js` - Added session middleware and new routes
- Updated `routes/editor.js` - Modified form submission handler
- Updated `package.json` - Added required dependencies

## Deployment Steps

### 1. Install Dependencies

```bash
npm install
```

This will install the new packages:
- `@octokit/rest` - GitHub API client
- `@octokit/webhooks` - Webhook event handling
- `express-session` - Session management
- `crypto-js` - Token encryption
- `connect-session-sequelize` - Session storage (optional)
- `js-yaml` - YAML parsing

### 2. Register GitHub OAuth Application

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name:** PReSto Custom Reconstruction Engine
   - **Homepage URL:** `http://143.198.98.66` (or your domain)
   - **Authorization callback URL:** `http://143.198.98.66/oauth/github/callback`
   - **Description:** Paleoclimate reconstruction via GitHub Actions
4. Click "Register application"
5. Copy the **Client ID** and generate a **Client Secret**

### 3. Configure Environment Variables

Update your `.env` file with the GitHub credentials:

```bash
# GitHub OAuth
GITHUB_CLIENT_ID=your_client_id_from_github
GITHUB_CLIENT_SECRET=your_client_secret_from_github
GITHUB_CALLBACK_URL=http://143.198.98.66/oauth/github/callback
GITHUB_DEFAULT_VISIBILITY=public

# Webhook Security
GITHUB_WEBHOOK_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Encryption & Sessions
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

**Important:** Keep these secrets secure and never commit them to version control!

### 4. Run Database Migration

Execute the SQL migration to create the required tables:

```bash
mysql -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE < db/migrations/001_github_integration.sql
```

Or manually run the SQL commands from `db/migrations/001_github_integration.sql` in your MySQL console.

Verify tables were created:
```sql
SHOW TABLES LIKE '%github%';
-- Should show: users, github_tokens, reconstruction_jobs, webhook_events
```

### 5. Test Locally (Development)

For local testing, update your `.env` with localhost callback:

```bash
GITHUB_CALLBACK_URL=http://localhost:3000/oauth/github/callback
BASE_URL=http://localhost:3000
```

Update your GitHub OAuth app callback URL to match.

Start the server:
```bash
npm start
```

Test the flow:
1. Navigate to `http://localhost:3000/forms`
2. Click on a reconstruction form (holocene_da or temp12k)
3. Verify "Login with GitHub" button appears
4. Click login and authorize the app
5. Verify username appears after authentication
6. Fill form and submit with checkbox checked

### 6. Configure GitHub Webhook (Production)

After deploying to production, configure the webhook:

1. Go to your GitHub OAuth app settings
2. Or create a test repository and go to Settings → Webhooks
3. Add webhook:
   - **Payload URL:** `http://143.198.98.66/webhooks/github`
   - **Content type:** `application/json`
   - **Secret:** Your `GITHUB_WEBHOOK_SECRET` value
   - **Events:** Select "Workflow runs"
   - **Active:** Checked
4. Click "Add webhook"

Test webhook delivery:
- Trigger a reconstruction
- Check webhook delivery in GitHub settings
- Monitor Presto server logs

### 7. Deploy to Production

Build and deploy using your existing process:

```bash
# If using Docker
docker-compose down
docker-compose build
docker-compose up -d

# Or restart Node.js service
pm2 restart presto-server
```

Verify deployment:
```bash
curl http://143.198.98.66/oauth/github/status
# Should return: {"authenticated":false}
```

### 8. Verify Integration

Complete end-to-end test:

1. Navigate to production URL
2. Click holocene_da form
3. Login with GitHub
4. Fill form with test parameters
5. Check "Run in GitHub Actions"
6. Submit form
7. Verify redirect to status page
8. Check GitHub account for new repository
9. Verify workflow is running in Actions tab
10. Monitor webhook events in database
11. Wait for completion email

## Security Considerations

### Token Encryption
- All GitHub tokens are encrypted with AES-256 before storage
- Encryption key must be 32+ characters and stored securely
- Never log or expose decrypted tokens

### Webhook Verification
- All webhook payloads are verified with HMAC SHA-256
- Invalid signatures are rejected
- Uses constant-time comparison to prevent timing attacks

### Session Security
- Sessions use httpOnly cookies
- Secure flag enabled in production (HTTPS required)
- 30-day session expiration

### OAuth Security
- CSRF protection via state parameter
- State validated on callback
- Minimal OAuth scopes requested (repo, user:email)

## Monitoring & Troubleshooting

### Check Database Records

```sql
-- List users
SELECT id, github_username, email, created_at FROM users;

-- List active jobs
SELECT unique_id, recon_type, workflow_status, github_repo_url, created_at
FROM reconstruction_jobs
ORDER BY created_at DESC LIMIT 10;

-- List webhook events
SELECT event_type, received_at
FROM webhook_events
ORDER BY received_at DESC LIMIT 20;
```

### Common Issues

**OAuth login fails:**
- Check `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
- Verify callback URL matches GitHub app settings
- Check server logs for error messages

**Repository creation fails:**
- Verify user has granted `repo` scope
- Check GitHub API rate limits
- Ensure token is valid and not expired

**Webhook not received:**
- Verify webhook URL is accessible from internet
- Check webhook secret matches
- Inspect webhook delivery logs in GitHub

**Session not persisting:**
- Check `SESSION_SECRET` is set
- Verify cookies are enabled in browser
- For production, ensure HTTPS is configured

### Server Logs

Monitor key events:
```bash
# Follow server logs
tail -f /var/log/presto/server.log

# Look for GitHub-related events
grep -i github /var/log/presto/server.log

# Check webhook processing
grep -i webhook /var/log/presto/server.log
```

## Rollback Plan

If issues occur, the integration can be disabled without affecting traditional workflow:

1. Remove GitHub routes from `app.js`:
   ```javascript
   // Comment out these lines:
   // app.use('/oauth', require('./routes/oauth'));
   // app.use('/webhooks', require('./routes/webhooks'));
   // app.use('/status', require('./routes/status'));
   ```

2. Restart server
3. Traditional workflow remains functional
4. Users will see login button but won't be able to use GitHub Actions

## Future Enhancements

1. **Self-Hosted Runners** - Deploy runners on Presto server for unlimited minutes
2. **Repository Templates** - Pre-configure template repository to speed up creation
3. **Real-Time Status** - WebSocket connection for live progress updates
4. **Batch Processing** - Submit multiple reconstructions at once
5. **API Access** - Programmatic reconstruction submission

## Support

For issues or questions:
- Check server logs: `/var/log/presto/`
- Review GitHub webhook deliveries
- Inspect database records
- Test OAuth flow in isolation

## Changelog

**Version 1.0.0 (2026-01-23)**
- Initial GitHub Actions integration
- OAuth authentication flow
- Repository creation and initialization
- Workflow templates for holocene_da and temp12k
- Real-time status tracking
- Webhook event processing
- Parallel operation with traditional workflow
