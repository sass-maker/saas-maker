#!/usr/bin/env node
import { spawn } from 'node:child_process';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
const COCKPIT_PORT = process.env.COCKPIT_PORT || '3001';
const API_PORT = new URL(API_URL).port || '8787';

const children = [];

async function isHealthy(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

function start(name, command, args, env) {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: false,
  });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (signal || code === 0) return;
    console.error(`[${name}] exited with code ${code}`);
  });
  return child;
}

function stopAll() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGINT');
  }
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(130);
});
process.on('SIGTERM', () => {
  stopAll();
  process.exit(143);
});

const apiHealthy = await isHealthy(`${API_URL}/health`);
if (!apiHealthy) {
  start('api', 'pnpm', ['-F', '@saas-maker/api', 'dev', '--port', API_PORT], {
    LOCAL_AUTH_BYPASS: 'true',
  });
}

await new Promise((resolve) => setTimeout(resolve, apiHealthy ? 0 : 1500));

start('cockpit', 'pnpm', ['--dir', 'apps/cockpit', 'exec', 'next', 'dev', '--webpack', '--port', COCKPIT_PORT], {
  LOCAL_AUTH_BYPASS: 'true',
  NEXT_PUBLIC_API_URL: API_URL,
});
