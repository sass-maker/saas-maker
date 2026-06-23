#!/usr/bin/env node
import http from 'node:http';
import { spawn } from 'node:child_process';

const host = process.env.SYMPHONY_RUNNER_HOST || '127.0.0.1';
const port = Number(process.env.SYMPHONY_RUNNER_PORT || 3011);
const maxBodyBytes = 1024 * 1024;

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > maxBodyBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    json(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/run') {
    json(res, 404, { error: 'Not found' });
    return;
  }

  try {
    const { command, taskId } = await readJson(req);
    if (!command || typeof command !== 'string') {
      json(res, 400, { error: 'command is required' });
      return;
    }

    const child = spawn(command, {
      shell: true,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, FORCE_COLOR: 'true' },
    });

    child.unref();
    json(res, 200, { ok: true, pid: child.pid, taskId });
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, host, () => {
  console.log(`Symphony runner listening on http://${host}:${port}`);
});
