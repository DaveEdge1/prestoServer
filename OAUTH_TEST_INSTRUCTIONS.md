# OAuth Testing Instructions

## ✅ Setup Complete

1. **Database migrations**: ✅ Run successfully
   - `users` table created
   - `github_tokens` table created
   - `reconstruction_jobs` table created (with hybrid auth columns)
   - `webhook_events` table created

2. **Dependencies**: ✅ Installed
   - `@octokit/rest` and `@octokit/app` installed
   - `crypto-js` installed
   - All npm packages ready

3. **Server**: ✅ Running on http://localhost:81
   - Health check: http://localhost:81/health
   - OAuth status: http://localhost:81/oauth/github/status

4. **Environment variables**: ✅ Configured
   - GITHUB_CLIENT_ID: Set
   - GITHUB_CLIENT_SECRET: Set
   - ENCRYPTION_KEY: Generated
   - SESSION_SECRET: Generated
   - GITHUB_WEBHOOK_SECRET: Generated

## 🔧 GitHub OAuth App Configuration Needed

Your GitHub OAuth app needs to be configured with the correct callback URL:

1. Go to: https://github.com/settings/developers
2. Find your OAuth App (Client ID: `Ov23liRXr5qy1HEQbWi0`)
3. Update the **Authorization callback URL** to:
   ```
   http://localhost:81/oauth/github/callback
   ```

**Important**: For local testing, GitHub needs to allow `localhost` callbacks. You may need to:
- Add `http://localhost:81/oauth/github/callback` as a callback URL
- Or use a tool like ngrok to create a public URL

## 🧪 Testing the OAuth Flow

### Step 1: Open the form
```
http://localhost:81/editor/?recon=holocene_da&user=test&domain=example.com&uniqueID=test-123
```

### Step 2: You should see three options:
1. ✅ **Quick Run (No Login Required)** - This uses GitHub App (not configured yet)
2. ✅ **Run in Your GitHub Account** - OAuth pathway (ready to test!)
3. ✅ **Traditional Workflow (Email Results)** - Legacy method

### Step 3: Test OAuth Login
1. Click the "Login with GitHub" button
2. You should be redirected to GitHub OAuth authorization page
3. After authorizing, you'll be redirected back to the form
4. The form should show "Logged in as: [your-github-username]"
5. Submit the form to test repository creation

## 📊 Verify Database Records

After testing, check the database:

```bash
# Check user was created
docker exec prestoserver-mysql-1 mysql -u dave --password=peb0pk0q -D lipdverse -e "SELECT * FROM users;"

# Check token was stored (encrypted)
docker exec prestoserver-mysql-1 mysql -u dave --password=peb0pk0q -D lipdverse -e "SELECT user_id, LEFT(encrypted_token, 20) as token_preview, scope FROM github_tokens;"

# Check reconstruction job (if you submitted)
docker exec prestoserver-mysql-1 mysql -u dave --password=peb0pk0q -D lipdverse -e "SELECT unique_id, auth_type, is_anonymous, github_org, github_repo_name FROM reconstruction_jobs ORDER BY created_at DESC LIMIT 5;"
```

## ⚠️ Current Limitation

The **Quick Run (GitHub App)** option will fail because:
- GitHub App is not configured (GITHUB_APP_ID, etc. not set)
- This is expected - we're only testing OAuth for now

## 🎯 Next Steps After OAuth Test

1. Test OAuth login flow ✅
2. Test repository creation in your personal GitHub account
3. Verify workflow dispatch works
4. Check webhook handling (when workflow runs)
5. Later: Set up GitHub App for anonymous reconstructions

## 🐛 Troubleshooting

**"Invalid state parameter"**
- Clear cookies and try again
- Session secret might have changed

**"GitHub OAuth error: redirect_uri_mismatch"**
- GitHub OAuth app callback URL doesn't match `.env` file
- Update GitHub app settings to use `http://localhost:81/oauth/github/callback`

**"Repository creation failed"**
- Check GitHub token scopes (need `repo` scope)
- Verify templates exist in `templates/workflows/` and `templates/scripts/`

**Server logs**
```bash
# View live server logs
tail -f C:\Users\dce25\AppData\Local\Temp\claude\C--Users-dce25-prestoServer\tasks\be05f4f.output
```

## 📝 Production Deployment Notes

When deploying to production:
1. Update `GITHUB_CALLBACK_URL` in `.env` to production URL
2. Update GitHub OAuth app callback URL to match
3. Consider setting up GitHub App for anonymous reconstructions
4. Set up webhook endpoint for workflow status updates
