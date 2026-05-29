/**
 * OAuth Routes
 * Handles GitHub OAuth authentication flow
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const githubService = require('../services/github');
const config = require('../config');

// Shared MySQL pool (services/db.js) — one process-wide pool. Replaces the
// per-module createPool; also removes the startup race where `db` was briefly
// undefined while the async initializer ran.
const { promisePool: db } = require('../services/db');

/**
 * GET /oauth/github
 * Redirect to GitHub OAuth authorization page
 */
router.get('/github', (req, res) => {
  // Generate state parameter for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;
  req.session.returnTo = req.query.returnTo || '/forms';

  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: config.github.callbackUrl,
    scope: 'public_repo,user:email',
    state: state
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

/**
 * GET /oauth/github/callback
 * Handle OAuth callback from GitHub
 */
router.get('/github/callback', async (req, res) => {
  const { code, state } = req.query;

  // Verify state parameter (CSRF protection)
  if (!state || state !== req.session.oauthState) {
    return res.status(400).send('Invalid state parameter. Possible CSRF attack.');
  }

  // Clear state from session
  delete req.session.oauthState;

  try {
    // Exchange code for access token
    const tokenData = await githubService.authenticateUser(code);
    const { access_token, scope } = tokenData;

    // Get user information
    const userInfo = await githubService.getUserInfo(access_token);

    // Check if user exists in database
    const [existingUsers] = await db.query(
      'SELECT id FROM users WHERE github_id = ?',
      [userInfo.id]
    );

    let userId;

    if (existingUsers.length > 0) {
      // User exists, update information
      userId = existingUsers[0].id;
      await db.query(
        'UPDATE users SET github_username = ?, email = ? WHERE id = ?',
        [userInfo.username, userInfo.email, userId]
      );
    } else {
      // Create new user
      const [result] = await db.query(
        'INSERT INTO users (github_username, github_id, email) VALUES (?, ?, ?)',
        [userInfo.username, userInfo.id, userInfo.email]
      );
      userId = result.insertId;
    }

    // Encrypt and store token
    const encryptedToken = githubService.encryptToken(access_token);
    await db.query(
      'INSERT INTO github_tokens (user_id, encrypted_token, scope) VALUES (?, ?, ?)',
      [userId, encryptedToken, scope]
    );

    console.log(`OAuth success: userId=${userId}, username=${userInfo.username}`);

    // Store user info in session
    req.session.userId = userId;
    req.session.githubUsername = userInfo.username;
    req.session.githubId = userInfo.id;

    // Save session before redirecting to ensure values persist
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).send('Failed to save session');
      }

      // Redirect back to original page
      const returnTo = req.session.returnTo || '/forms';
      delete req.session.returnTo;
      res.redirect(returnTo);
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

/**
 * POST /oauth/github/logout
 * Clear user session and logout
 */
router.post('/github/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

/**
 * GET /oauth/github/status
 * Check if user is authenticated
 */
router.get('/github/status', (req, res) => {
  console.log('Session check - userId:', req.session.userId, 'username:', req.session.githubUsername);

  if (req.session.userId && req.session.githubUsername) {
    res.json({
      authenticated: true,
      username: req.session.githubUsername,
      userId: req.session.userId
    });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;
