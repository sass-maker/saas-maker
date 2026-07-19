import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { basename, join } from "node:path";

const root = new URL(".", import.meta.url).pathname;
const jobsPath = join(root, "jobs.tsv");
const logsDir = join(root, "logs");
const uiDir = join(root, "ui");
const outPath = join(uiDir, "index.html");

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const lines = readFileSync(jobsPath, "utf8").trim().split("\n");
const headers = lines.shift().split("\t");
const jobs = lines.map((line) => {
  const values = line.split("\t");
  return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
});

const recentLogs = existsSync(logsDir)
  ? readdirSync(logsDir)
      .filter((name) => name.endsWith(".log"))
      .map((name) => {
        const path = join(logsDir, name);
        return { name, mtimeMs: statSync(path).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, 8)
  : [];

const nextHint = {
  "daily-fleet-health-sentinel": "Tue-Sun, 8:00",
  "weekly-fleet-ops-audit": "Mon, 8:00",
  "biweekly-fleet-audit": "Mon, 10:00",
  "fleet-backlog-router": "Tue-Fri, 11:00",
  "marketing-queue-builder": "Tue/Thu, 15:00",
};

mkdirSync(uiDir, { recursive: true });

writeFileSync(
  outPath,
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fleet Codex Cron</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #101214;
      --panel: #181b1f;
      --panel-2: #20242a;
      --line: #30363d;
      --text: #f2f4f7;
      --muted: #a9b1bd;
      --accent: #7dd3fc;
      --ok: #85e89d;
      --warn: #ffd166;
      --danger: #ff7b72;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    header {
      padding: 28px 32px 20px;
      border-bottom: 1px solid var(--line);
      background: #14171a;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 26px;
      letter-spacing: 0;
    }
    .sub {
      margin: 0;
      color: var(--muted);
      max-width: 920px;
    }
    main {
      padding: 24px 32px 40px;
      max-width: 1280px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(160px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .metric {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px 16px;
    }
    .metric b {
      display: block;
      font-size: 24px;
      line-height: 1.1;
    }
    .metric span {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 16px;
      align-items: start;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
    th, td {
      padding: 12px 14px;
      text-align: left;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      background: var(--panel-2);
    }
    tr:last-child td { border-bottom: 0; }
    code {
      color: var(--accent);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .status {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      border: 1px solid rgba(133, 232, 157, .35);
      border-radius: 999px;
      padding: 2px 8px;
      color: var(--ok);
      background: rgba(133, 232, 157, .08);
      font-size: 12px;
      font-weight: 600;
    }
    aside {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
    }
    aside h2 {
      margin: 0 0 12px;
      font-size: 15px;
    }
    .log {
      padding: 8px 0;
      border-bottom: 1px solid var(--line);
      color: var(--muted);
      overflow-wrap: anywhere;
    }
    .log:last-child { border-bottom: 0; }
    .empty {
      color: var(--muted);
      padding: 8px 0;
    }
    .cmd {
      margin-top: 16px;
      padding: 12px;
      border-radius: 8px;
      background: #0b0d0f;
      border: 1px solid var(--line);
    }
    @media (max-width: 900px) {
      header, main { padding-left: 18px; padding-right: 18px; }
      .summary, .grid { grid-template-columns: 1fr; }
      table { display: block; overflow-x: auto; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Fleet Codex Cron</h1>
    <p class="sub">Codex app schedules converted into versioned fleet cron jobs. Cron owns timing; Fleet Ops owns prompts, logs, locks, and install state.</p>
  </header>
  <main>
    <section class="summary" aria-label="Cron summary">
      <div class="metric"><b>${jobs.length}</b><span>Jobs</span></div>
      <div class="metric"><b>${jobs.filter((job) => job.enabled === "yes").length}</b><span>Active</span></div>
      <div class="metric"><b>${recentLogs.length}</b><span>Recent Logs</span></div>
      <div class="metric"><b>cron</b><span>Runtime</span></div>
    </section>
    <section class="grid">
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Job</th>
            <th>When</th>
            <th>Model</th>
            <th>Prompt</th>
          </tr>
        </thead>
        <tbody>
          ${jobs
            .map(
              (job) => `<tr>
                <td><span class="status">${escapeHtml(job.enabled)}</span></td>
                <td><strong>${escapeHtml(job.name)}</strong><br><code>${escapeHtml(job.id)}</code></td>
                <td>${escapeHtml(nextHint[job.id] ?? job.cron)}<br><code>${escapeHtml(job.cron)}</code></td>
                <td>${escapeHtml(job.model)}<br><code>${escapeHtml(job.effort)}</code></td>
                <td><code>${escapeHtml(job.prompt_file)}</code></td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
      <aside>
        <h2>Recent Runs</h2>
        ${
          recentLogs.length
            ? recentLogs.map((log) => `<div class="log">${escapeHtml(basename(log.name))}</div>`).join("")
            : '<div class="empty">No cron logs yet.</div>'
        }
        <div class="cmd"><code>fleet-ops/scripts/agent-bin/install-codex-cron</code></div>
        <div class="cmd"><code>fleet-ops/scripts/agent-bin/run-codex-cron &lt;job-id&gt; --dry-run</code></div>
      </aside>
    </section>
  </main>
</body>
</html>
`,
);

console.log(outPath);

