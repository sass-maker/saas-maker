import { AgentWorkspaces, retiredBytesAsync } from './agent-workspaces.mjs';
import { ownedRetiredScan, publishRetiredScan } from './disk-scan-coordination.mjs';

const [root, token] = process.argv.slice(2);
const noGo = setTimeout(() => process.exit(1), 5_000);
process.once('message', async (message) => {
  if (message?.token !== token) return;
  clearTimeout(noGo);
  if (process.connected) process.disconnect();
  const row = ownedRetiredScan(root, token);
  if (!row) return;
  const manager = new AgentWorkspaces({ root });
  let result;
  try { result = { state: 'complete', bytes: await retiredBytesAsync(row.path) }; }
  catch (error) { result = { state: 'failed', error: error.message }; }
  // retiredBytesAsync settles only after every du child has closed, including
  // failure and timeout paths. Only then can a later generation start scanning.
  await publishRetiredScan(manager, token, result);
});
