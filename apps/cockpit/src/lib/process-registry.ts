// Shared in-memory registry for spawned agent child processes
// Used by /api/fleet/dispatch (writer) and /api/fleet/logs/:jobId (reader)
// In-process only — does not survive Next.js dev reloads or multi-instance deploy.

export const activeProcesses = new Map<string, any>();
