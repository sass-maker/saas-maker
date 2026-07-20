#!/usr/bin/env node
// One-shot helper to mint a long-lived Instagram access token + capture the
// IG Business user ID. Uses the Instagram API with Instagram Login flow
// (recommended for new apps as of 2024).
//
// Prereqs:
// - Meta Developer app with the Instagram product added, "Instagram API setup with
//   Instagram Login" enabled, and http://127.0.0.1:8766/oauth/callback added to
//   "OAuth redirect URIs".
// - Your IG handle is converted to Professional (Business or Creator) and added
//   as an Instagram Tester on the app (Roles → Instagram Testers).
//
// Usage:
//   IG_APP_ID=... IG_APP_SECRET=... node scripts/instagram-oauth-bootstrap.js
//
// Prints two env values; paste them into .env as IG_<SLUG>_USER_ID and
// IG_<SLUG>_LONG_LIVED_TOKEN.

import http from 'node:http';
import { URL } from 'node:url';

const APP_ID = process.env.IG_APP_ID;
const APP_SECRET = process.env.IG_APP_SECRET;
const SCOPES = process.env.IG_SCOPES
  ?? 'instagram_business_basic,instagram_business_content_publish';
const PORT = Number(process.env.IG_OAUTH_PORT ?? 8766);
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth/callback`;
const ACCOUNT_SLUG = process.env.IG_ACCOUNT_SLUG ?? 'tutoring';

if (!APP_ID || !APP_SECRET) {
  console.error('Set IG_APP_ID and IG_APP_SECRET (from your Meta developer app) first.');
  process.exit(1);
}

const authUrl = new URL('https://www.instagram.com/oauth/authorize');
authUrl.searchParams.set('enable_fb_login', '0');
authUrl.searchParams.set('force_authn', '1');
authUrl.searchParams.set('client_id', APP_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPES);

console.log('\n1) Open this URL in a browser logged into the target IG handle:\n');
console.log(authUrl.toString());
console.log(`\n2) Waiting for redirect to ${REDIRECT_URI} ...\n`);

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
    const shortLived = await exchangeCode(code);
    const longLived = await exchangeForLongLived(shortLived.access_token);
    const userId = shortLived.user_id;
    res.writeHead(200, { 'content-type': 'text/plain' })
      .end('Token captured. You can close this tab.');
    const slugUpper = ACCOUNT_SLUG.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    console.log('\nPaste these into .env:\n');
    console.log(`IG_${slugUpper}_USER_ID=${userId}`);
    console.log(`IG_${slugUpper}_LONG_LIVED_TOKEN=${longLived.access_token}`);
    console.log(`\nToken TTL: ${Math.round((longLived.expires_in ?? 0) / 86400)} days. Run scripts/refresh-instagram-tokens.js on a daily cron to keep it alive.\n`);
    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' }).end(String(err));
    server.close();
    process.exit(1);
  }
});

server.listen(PORT);

async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: APP_ID,
    client_secret: APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
    code,
  });
  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const payload = await res.json();
  if (!res.ok || !payload.access_token) {
    throw new Error(`code exchange failed: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function exchangeForLongLived(shortToken) {
  const url = new URL('https://graph.instagram.com/access_token');
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', APP_SECRET);
  url.searchParams.set('access_token', shortToken);
  const res = await fetch(url);
  const payload = await res.json();
  if (!res.ok || !payload.access_token) {
    throw new Error(`long-lived exchange failed: ${JSON.stringify(payload)}`);
  }
  return payload;
}
