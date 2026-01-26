# Hybrid GitHub Architecture - OAuth + GitHub App

## Overview

This architecture supports two reconstruction workflows:

1. **Anonymous/Guest Mode** - Uses GitHub App, no login required
2. **Personal Mode** - Uses OAuth, user owns their data

## Authentication Flows

### Flow 1: Anonymous Reconstruction (GitHub App)

```
User fills form
  ↓
Clicks "Run Now" (no login)
  ↓
Server uses GitHub App credentials
  ↓
Creates repo in presto-reconstructions org
  ↓
Dispatches workflow
  ↓
User gets unique status URL
  ↓
Results stored in: presto-reconstructions/holocene-abc123
```

**Advantages:**
- No GitHub account needed
- Fastest path to results
- All public reconstructions archived centrally
- Higher API rate limits

### Flow 2: Personal Reconstruction (OAuth)

```
User clicks "Login with GitHub"
  ↓
OAuth flow (redirect to GitHub)
  ↓
User authorizes app
  ↓
Returns to form (authenticated)
  ↓
Fills form and clicks "Run in My Account"
  ↓
Server uses user's OAuth token
  ↓
Creates repo in user's account
  ↓
Dispatches workflow
  ↓
Results stored in: username/presto-holocene-abc123
```

**Advantages:**
- User owns the repository
- Can make private repos
- Full control over data
- Can modify workflow

## Technical Architecture

### Environment Variables

```bash
# GitHub App (for anonymous/centralized runs)
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY_PATH=/path/to/private-key.pem
GITHUB_APP_INSTALLATION_ID=78901234
GITHUB_APP_ORG=presto-reconstructions

# GitHub OAuth (for personal runs - existing)
GITHUB_CLIENT_ID=oauth_client_id
GITHUB_CLIENT_SECRET=oauth_client_secret
GITHUB_CALLBACK_URL=http://143.198.98.66/oauth/github/callback
```

### Service Layer

**services/githubApp.js** (NEW)
- Generate installation access tokens (1-hour expiry)
- Create repos in organization
- Dispatch workflows using app credentials
- No user tokens stored

**services/github.js** (EXISTING)
- OAuth flow management
- User token encryption/storage
- Create repos in user accounts
- Dispatch workflows using user tokens

### Database Schema Updates

**reconstruction_jobs table** - Add columns:
```sql
ALTER TABLE reconstruction_jobs ADD COLUMN auth_type ENUM('oauth', 'github_app') NOT NULL DEFAULT 'github_app';
ALTER TABLE reconstruction_jobs ADD COLUMN is_anonymous BOOLEAN DEFAULT TRUE;
ALTER TABLE reconstruction_jobs ADD COLUMN github_org VARCHAR(255) DEFAULT NULL;
```

**Tracking:**
- `auth_type`: 'oauth' or 'github_app'
- `is_anonymous`: TRUE for GitHub App, FALSE for OAuth
- `github_org`: Organization name for GitHub App runs
- `user_id`: NULL for anonymous, user ID for OAuth

### UI Components

**Form Interface** (holocene_da.html, temp12k.html):

```html
<!-- Option 1: Quick Run (No Login) -->
<div class="run-option">
  <h4>🚀 Quick Run (No Login Required)</h4>
  <p>Results will be stored in our public archive</p>
  <button id="run-anonymous">Run Now</button>
</div>

<!-- Option 2: Personal Run (Login Required) -->
<div class="run-option">
  <h4>👤 Run in Your GitHub Account</h4>
  <div id="github-login">
    <p>Login to store results in your own repository</p>
    <a href="/oauth/github">Login with GitHub</a>
  </div>
  <div id="github-authenticated" style="display:none;">
    <p>Logged in as: <span id="username"></span></p>
    <button id="run-personal">Run in My Account</button>
    <a href="/oauth/github/logout">Logout</a>
  </div>
</div>
```

### Route Handling

**routes/editor.js** - Form submission logic:

```javascript
// Detect authentication type
const isAuthenticated = req.session && req.session.githubToken;
const authType = isAuthenticated ? 'oauth' : 'github_app';

if (authType === 'github_app') {
  // Use GitHub App service
  const githubApp = require('../services/githubApp');
  const result = await githubApp.createReconstructionRepo(formData);
  // Store in DB with auth_type='github_app', is_anonymous=true
} else {
  // Use OAuth service
  const github = require('../services/github');
  const result = await github.createReconstructionRepo(req.session.userId, formData);
  // Store in DB with auth_type='oauth', is_anonymous=false
}
```

## GitHub App Setup

### Permissions Required

**Repository permissions:**
- Contents: Read & Write (create files, push code)
- Workflows: Read & Write (dispatch workflows)
- Metadata: Read (repository metadata)

**Organization permissions:**
- Members: Read (optional, for future team features)

**Subscribe to events:**
- Workflow run (for status updates via webhook)

### Installation

1. Create GitHub App at https://github.com/organizations/YOUR_ORG/settings/apps/new
2. Install app on `presto-reconstructions` organization
3. Download private key (keep secure!)
4. Note App ID and Installation ID
5. Configure webhook URL: `http://143.198.98.66/webhooks/github`

## Security Considerations

### GitHub App (More Secure)
- ✅ Installation tokens expire after 1 hour
- ✅ No user credentials stored
- ✅ Granular permissions (only what's needed)
- ✅ Automatic webhook configuration
- ✅ Higher rate limits (5000 req/hr)

### OAuth (Less Secure but User-Owned)
- ⚠️ User tokens stored encrypted
- ⚠️ Tokens valid until revoked
- ⚠️ User must grant broad permissions
- ⚠️ Manual webhook configuration
- ⚠️ Lower rate limits (per user)

### Best Practices
- Store GitHub App private key in secure location
- Never commit private key to version control
- Use environment variables for all secrets
- Rotate secrets periodically
- Monitor API rate limits
- Log all authentication attempts

## Repository Naming Convention

**GitHub App (Centralized):**
```
presto-reconstructions/holocene-da-20260126-abc123
presto-reconstructions/temp12k-20260126-def456
```

**OAuth (Personal):**
```
username/presto-holocene-da-abc123
username/presto-temp12k-def456
```

**Format:**
- Prefix: `presto-` (for filtering/searching)
- Type: `holocene-da` or `temp12k`
- Date: `YYYYMMDD` (GitHub App only, for organization)
- Unique ID: Short hash (from database unique_id)

## User Experience

### Anonymous User Journey
1. Visit form page
2. Fill form parameters
3. Click "Run Now"
4. Immediately see status page
5. Get shareable link: `http://143.198.98.66/status?id=abc123`
6. Results available at: `https://github.com/presto-reconstructions/holocene-da-20260126-abc123`

### Authenticated User Journey
1. Visit form page
2. Click "Login with GitHub"
3. Authorize app (one time)
4. Fill form parameters
5. Click "Run in My Account"
6. See status page
7. Results in their account: `https://github.com/username/presto-holocene-da-abc123`
8. User can make repo private, customize, fork, etc.

## Migration Strategy

### Phase 1: Add GitHub App Support (Current)
- Implement `services/githubApp.js`
- Update database schema
- Update forms with both options
- Default to GitHub App (anonymous)
- Keep OAuth as optional enhancement

### Phase 2: Testing
- Test anonymous runs
- Test OAuth runs
- Verify both show in status page
- Test webhook delivery for both types

### Phase 3: Deployment
- Register GitHub App
- Create/configure `presto-reconstructions` org
- Update environment variables
- Run database migration
- Deploy to production

### Phase 4: Monitoring
- Track usage of each auth type
- Monitor API rate limits
- Watch for errors in logs
- Collect user feedback

## API Rate Limits

### GitHub App
- 5,000 requests per hour per installation
- Shared across all anonymous users
- Monitor usage via `/rate_limit` endpoint

### OAuth
- 5,000 requests per hour per user
- Each authenticated user has own limit
- Users unlikely to hit limit

**Strategy:** Encourage anonymous runs to conserve individual user limits.

## Future Enhancements

1. **Organization Management**
   - Auto-archive old repos (>90 days)
   - Add repo descriptions with metadata
   - Tag repos by reconstruction type

2. **GitHub Pages**
   - Auto-enable Pages for visualizations
   - Generate index.html with results
   - Shareable public URLs

3. **Team Collaboration**
   - Allow users to share access
   - Organization-level tracking
   - Batch processing for research groups

4. **Self-Service Archive**
   - Users can "claim" anonymous runs
   - Transfer ownership to personal account
   - Convert anonymous → personal

## Rollback Plan

If GitHub App has issues:
1. Set `GITHUB_APP_DISABLED=true` in environment
2. Hide "Run Now" button in UI
3. Show "Login with GitHub" as only option
4. Fall back to OAuth-only mode

## Decision Matrix

| Feature | GitHub App | OAuth |
|---------|-----------|-------|
| User login required | No | Yes |
| Repository location | Organization | User account |
| Token storage | None (ephemeral) | Encrypted in DB |
| Token lifetime | 1 hour | Until revoked |
| Rate limits | 5K/hr (shared) | 5K/hr (per user) |
| Setup complexity | Medium | Low |
| User data ownership | Organization | User |
| Privacy options | Public only* | Public or Private |
| Best for | Quick tests, demos | Research, long-term |

*Can make org repos private if org has paid plan

## Implementation Checklist

- [ ] Create HYBRID_ARCHITECTURE.md (this document)
- [ ] Implement services/githubApp.js
- [ ] Create db/migrations/002_add_auth_type.sql
- [ ] Update routes/editor.js for dual flow
- [ ] Update jsonEditor/forms/holocene_da.html UI
- [ ] Update jsonEditor/forms/temp12k.html UI
- [ ] Update public/status.html to show auth type
- [ ] Update config/index.js with GitHub App vars
- [ ] Update .env.example with GitHub App vars
- [ ] Update docker-compose.yml with GitHub App vars
- [ ] Register GitHub App on GitHub
- [ ] Create presto-reconstructions organization
- [ ] Test anonymous reconstruction
- [ ] Test OAuth reconstruction
- [ ] Update DEPLOYMENT_CHECKLIST.md
- [ ] Update GITHUB_ACTIONS_DEPLOYMENT.md

## Conclusion

The hybrid approach provides the best user experience:
- **Low barrier to entry** for new users (no login)
- **Power user features** for researchers (personal repos)
- **Better security** with short-lived tokens
- **Institutional archive** of public reconstructions
- **Flexibility** for different use cases

This architecture positions Presto as both a quick demo tool and a serious research platform.
