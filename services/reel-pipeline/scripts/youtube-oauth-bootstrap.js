#!/usr/bin/env node
// One-shot helper to mint a YouTube Data API refresh token.
// Usage: YOUTUBE_OAUTH_CLIENT_ID=... YOUTUBE_OAUTH_CLIENT_SECRET=... node scripts/youtube-oauth-bootstrap.js
// Prints the refresh token; paste it into .env as YOUTUBE_OAUTH_REFRESH_TOKEN.

import http from 'node:http';
import { URL } from 'node:url';

const CLIENT_ID = process.env.YOUTUBE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
const SCOPE = 'https://www.googleapis.com/auth/youtube.upload';
const PORT = Number(process.env.YOUTUBE_OAUTH_PORT ?? 8765);
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth/callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set YOUTUBE_OAUTH_CLIENT_ID and YOUTUBE_OAUTH_CLIENT_SECRET first.');
  process.exit(1);
}

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPE);
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');

console.log('\nOpen this URL in a browser logged into the target YouTube account:\n');
console.log(authUrl.toString());
console.log(`\nWaiting for the OAuth callback on ${REDIRECT_URI} ...\n`);

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/oauth/callback')) {
    res.writeHead(404).end();
    return;
  }
  const params = new URL(req.url, REDIRECT_URI).searchParams;
  const code = params.get('code');
  const error = params.get('error');
  if (error || !code) {
    res.writeHead(400, { 'content-type': 'text/plain' }).end(`OAuth error: ${error ?? 'no code'}`);
    server.close();
    process.exit(1);
  }
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }).toString(),
    });
    const payload = await tokenRes.json();
    if (!tokenRes.ok || !payload.refresh_token) {
      throw new Error(`token exchange failed: ${JSON.stringify(payload)}`);
    }
    res.writeHead(200, { 'content-type': 'text/plain' })
      .end('Refresh token captured. You can close this tab.');
    console.log('\nRefresh token (paste into .env as YOUTUBE_OAUTH_REFRESH_TOKEN):\n');
    console.log(payload.refresh_token);
    console.log('');
    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' }).end(String(err));
    server.close();
    process.exit(1);
  }
});

server.listen(PORT);
