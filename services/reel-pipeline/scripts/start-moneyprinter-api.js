#!/usr/bin/env node
import net from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';

const host = process.env.MONEYPRINTER_HOST ?? '127.0.0.1';
const port = Number(process.env.MONEYPRINTER_PORT ?? 18080);
const engineDir = path.resolve(process.env.MONEYPRINTER_ENGINE_DIR ?? 'engines/MoneyPrinterTurbo');

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`invalid MONEYPRINTER_PORT: ${process.env.MONEYPRINTER_PORT}`);
}

await assertPortFree(host, port);

console.log(`starting MoneyPrinterTurbo API at http://${host}:${port}`);
console.log(`canary: MONEYPRINTER_API_URL=http://${host}:${port} npm run canary:moneyprinter`);

const child = spawn('uv', [
  'run',
  'uvicorn',
  'app.asgi:app',
  '--host',
  host,
  '--port',
  String(port),
  '--log-level',
  process.env.MONEYPRINTER_LOG_LEVEL ?? 'warning',
], {
  cwd: engineDir,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

function assertPortFree(hostname, portNumber) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        reject(new Error(`port ${portNumber} is already in use; set MONEYPRINTER_PORT to a free port`));
        return;
      }
      reject(error);
    });
    server.once('listening', () => {
      server.close(resolve);
    });
    server.listen(portNumber, hostname);
  });
}
