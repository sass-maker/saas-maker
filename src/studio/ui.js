const TOOLS = [
  {
    id: 'ideas',
    label: 'Video ideas',
    hint: 'Ideas with title, angle, hook, and format for a niche.',
    fields: [
      { name: 'niche', label: 'Niche', placeholder: 'home espresso', required: true },
      { name: 'count', label: 'Count', type: 'number', value: '10' },
    ],
  },
  {
    id: 'niche',
    label: 'Niche explorer',
    hint: 'Sub-niches with audience and competition estimates.',
    fields: [{ name: 'niche', label: 'Niche', placeholder: 'home espresso', required: true }],
  },
  {
    id: 'channel',
    label: 'Channel names',
    hint: 'Brandable channel name suggestions.',
    fields: [
      { name: 'niche', label: 'Niche', placeholder: 'home espresso', required: true },
      { name: 'count', label: 'Count', type: 'number', value: '8' },
    ],
  },
  {
    id: 'titles',
    label: 'Titles',
    hint: 'Title variants under 100 characters.',
    fields: [
      { name: 'topic', label: 'Topic', placeholder: 'latte art basics', required: true },
      { name: 'count', label: 'Count', type: 'number', value: '5' },
    ],
  },
  {
    id: 'description',
    label: 'Description',
    hint: 'Hook, summary, chapters block, CTA, hashtags.',
    fields: [
      { name: 'topic', label: 'Topic', placeholder: 'latte art basics', required: true },
      { name: 'hook', label: 'Hook (optional)' },
      { name: 'cta', label: 'CTA (optional)' },
    ],
  },
  {
    id: 'tags',
    label: 'Tags',
    hint: 'Deduped tags fit to the 500-char budget.',
    fields: [
      { name: 'topic', label: 'Topic', placeholder: 'latte art basics', required: true },
      { name: 'niche', label: 'Niche (optional)' },
    ],
  },
  {
    id: 'organize',
    label: 'Tag organizer',
    hint: 'Clean and rank an existing comma-separated tag list.',
    fields: [{ name: 'tags', label: 'Tags (comma separated)', type: 'textarea', required: true }],
  },
  {
    id: 'script',
    label: 'Script',
    hint: 'Scene-structured script, 30s to 20min. Paste an article to adapt it.',
    fields: [
      { name: 'topic', label: 'Topic' },
      { name: 'duration', label: 'Duration (seconds)', type: 'number', value: '60' },
      { name: 'niche', label: 'Niche (optional)' },
      { name: 'article', label: 'Article / transcript to adapt (optional)', type: 'textarea' },
    ],
  },
  {
    id: 'voice',
    label: 'Brand voice',
    hint: 'Derive a voice profile from a sample transcript.',
    fields: [{ name: 'samples', label: 'Sample transcript', type: 'textarea', required: true }],
  },
  {
    id: 'keywords',
    label: 'Keywords',
    hint: 'Autocomplete-based keyword research, no API key.',
    fields: [{ name: 'seed', label: 'Seed keyword', placeholder: 'latte art', required: true }],
  },
  {
    id: 'transcript',
    label: 'Transcript',
    hint: 'Fetch public captions for a YouTube URL.',
    fields: [{ name: 'url', label: 'YouTube URL', placeholder: 'https://youtu.be/…', required: true }],
  },
  {
    id: 'thumbnails',
    label: 'Thumbnails',
    hint: 'Thumbnail concepts: composition, overlay, emotion, colors.',
    fields: [
      { name: 'topic', label: 'Topic', placeholder: 'latte art basics', required: true },
      { name: 'count', label: 'Count', type: 'number', value: '3' },
    ],
  },
  {
    id: 'faceless',
    label: 'Faceless run',
    hint: 'Topic → script → brief → render. Mock engine unless MoneyPrinterTurbo API is running. Never posts.',
    fields: [
      { name: 'topic', label: 'Topic', placeholder: 'latte art basics', required: true },
      { name: 'duration', label: 'Duration (seconds)', type: 'number', value: '60' },
      { name: 'niche', label: 'Niche (optional)' },
      {
        name: 'engine',
        label: 'Engine',
        type: 'select',
        options: ['mock', 'kokoro', 'moneyprinterturbo'],
      },
    ],
  },
  {
    id: 'plan',
    label: 'Factory: plan',
    hint: 'Fill the backlog with ideas for a niche (status: new).',
    fields: [
      { name: 'niche', label: 'Niche', placeholder: 'home espresso', required: true },
      { name: 'count', label: 'Count', type: 'number', value: '10' },
    ],
  },
  {
    id: 'produce',
    label: 'Factory: produce',
    hint: 'Render the next N backlog ideas: script → video → quality gate → publish packet.',
    fields: [
      { name: 'count', label: 'How many', type: 'number', value: '1' },
      { name: 'engine', label: 'Engine', type: 'select', options: ['kokoro', 'mock', 'moneyprinterturbo'] },
      { name: 'duration', label: 'Duration (seconds)', type: 'number', value: '60' },
    ],
  },
  {
    id: 'save',
    label: 'Save idea',
    hint: 'Add an idea to the manager (statuses: new → scripted → rendered → posted).',
    fields: [
      { name: 'title', label: 'Title', required: true },
      { name: 'niche', label: 'Niche (optional)' },
      { name: 'hook', label: 'Hook (optional)' },
      { name: 'notes', label: 'Notes (optional)' },
    ],
  },
];

export function studioPageHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Content Studio — reel-pipeline</title>
<style>
  :root { --bg:#0b1020; --panel:#141a2f; --line:#26304f; --text:#e6e9f2; --dim:#8b93ad; --accent:#5eead4; --err:#fb7185; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:14px/1.45 -apple-system,'Segoe UI',Roboto,sans-serif; }
  header { display:flex; align-items:baseline; gap:12px; padding:10px 16px; border-bottom:1px solid var(--line); }
  header h1 { font-size:16px; margin:0; }
  header a { color:var(--dim); font-size:12px; text-decoration:none; }
  main { display:grid; grid-template-columns:180px minmax(0,1fr); min-height:calc(100vh - 41px); }
  nav { border-right:1px solid var(--line); padding:8px 0; }
  nav button { display:block; width:100%; text-align:left; padding:7px 14px; background:none; border:0; color:var(--dim); font:inherit; cursor:pointer; }
  nav button:hover { color:var(--text); }
  nav button.active { color:var(--accent); background:var(--panel); }
  section { padding:16px; max-width:960px; }
  .hint { color:var(--dim); margin:2px 0 14px; }
  form { display:grid; gap:10px; max-width:560px; }
  label { display:grid; gap:4px; font-size:12px; color:var(--dim); }
  input, textarea, select { background:var(--panel); border:1px solid var(--line); color:var(--text); border-radius:6px; padding:7px 9px; font:inherit; }
  textarea { min-height:110px; resize:vertical; }
  .run { justify-self:start; background:var(--accent); color:#04211c; border:0; border-radius:6px; padding:8px 18px; font-weight:600; cursor:pointer; }
  .run[disabled] { opacity:.5; cursor:wait; }
  .result { margin-top:16px; }
  .result pre { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:12px; overflow-x:auto; white-space:pre-wrap; word-break:break-word; }
  .result .meta { display:flex; gap:10px; align-items:center; margin-bottom:6px; font-size:12px; color:var(--dim); }
  .result .copy { background:none; border:1px solid var(--line); color:var(--dim); border-radius:5px; padding:2px 10px; cursor:pointer; }
  .error { color:var(--err); }
  table { border-collapse:collapse; width:100%; margin-top:10px; font-size:13px; }
  th, td { text-align:left; border-bottom:1px solid var(--line); padding:6px 8px; }
  th { color:var(--dim); font-weight:500; }
  td select { padding:3px 6px; }
  .panel { display:none; }
  .panel.active { display:block; }
</style>
</head>
<body>
<header>
  <h1>Content Studio</h1>
  <a href="/review">review UI →</a>
</header>
<main>
  <nav id="nav"></nav>
  <div id="panels"></div>
</main>
<script>
const TOOLS = ${JSON.stringify(TOOLS)};

const nav = document.getElementById('nav');
const panels = document.getElementById('panels');

for (const tool of TOOLS) {
  const btn = document.createElement('button');
  btn.textContent = tool.label;
  btn.dataset.tool = tool.id;
  btn.onclick = () => activate(tool.id);
  nav.appendChild(btn);

  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.id = 'panel-' + tool.id;
  panel.innerHTML = '<h2>' + tool.label + '</h2><p class="hint">' + tool.hint + '</p>';
  panel.appendChild(buildForm(tool));
  const result = document.createElement('div');
  result.className = 'result';
  result.id = 'result-' + tool.id;
  panel.appendChild(result);
  panels.appendChild(panel);
}

const managerBtn = document.createElement('button');
managerBtn.textContent = 'Ideas manager';
managerBtn.dataset.tool = 'manager';
managerBtn.onclick = () => { activate('manager'); loadIdeas(); };
nav.appendChild(managerBtn);

const rendersBtn = document.createElement('button');
rendersBtn.textContent = 'Renders';
rendersBtn.dataset.tool = 'renders';
rendersBtn.onclick = () => { activate('renders'); loadRenders(); };
nav.appendChild(rendersBtn);

const rendersPanel = document.createElement('section');
rendersPanel.className = 'panel';
rendersPanel.id = 'panel-renders';
rendersPanel.innerHTML = '<h2>Renders</h2><p class="hint">Produced videos with quality verdicts. Approve moves an idea to posted; reject returns it to the backlog.</p><div id="renders-table"></div><div id="renders-player"></div>';
panels.appendChild(rendersPanel);

const managerPanel = document.createElement('section');
managerPanel.className = 'panel';
managerPanel.id = 'panel-manager';
managerPanel.innerHTML = '<h2>Ideas manager</h2><p class="hint">Saved ideas and their pipeline status.</p><div id="ideas-table"></div>';
panels.appendChild(managerPanel);

function buildForm(tool) {
  const form = document.createElement('form');
  for (const field of tool.fields) {
    const label = document.createElement('label');
    label.textContent = field.label;
    let input;
    if (field.type === 'textarea') input = document.createElement('textarea');
    else if (field.type === 'select') {
      input = document.createElement('select');
      for (const option of field.options) {
        const el = document.createElement('option');
        el.value = option; el.textContent = option;
        input.appendChild(el);
      }
    } else {
      input = document.createElement('input');
      input.type = field.type || 'text';
    }
    input.name = field.name;
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.value) input.value = field.value;
    if (field.required) input.required = true;
    label.appendChild(input);
    form.appendChild(label);
  }
  const run = document.createElement('button');
  run.className = 'run';
  run.textContent = 'Run';
  form.appendChild(run);
  form.onsubmit = async (event) => {
    event.preventDefault();
    const body = {};
    for (const field of tool.fields) {
      const raw = form.elements[field.name].value.trim();
      if (!raw) continue;
      body[field.name] = field.type === 'number' ? Number(raw) : raw;
    }
    run.disabled = true;
    const box = document.getElementById('result-' + tool.id);
    box.innerHTML = '<p class="hint">running…</p>';
    try {
      const res = await fetch('/studio/' + tool.id, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || res.status);
      renderResult(box, payload.data);
      if (tool.id === 'save' || tool.id === 'faceless') loadIdeas();
    } catch (error) {
      box.innerHTML = '<p class="error">' + escapeText(error.message) + '</p>';
    } finally {
      run.disabled = false;
    }
  };
  return form;
}

function renderResult(box, data) {
  const text = JSON.stringify(data, null, 2);
  box.innerHTML = '';
  const meta = document.createElement('div');
  meta.className = 'meta';
  if (data && data.source) meta.append('source: ' + data.source + ' ');
  const copy = document.createElement('button');
  copy.className = 'copy';
  copy.textContent = 'copy JSON';
  copy.onclick = () => navigator.clipboard.writeText(text);
  meta.appendChild(copy);
  const pre = document.createElement('pre');
  pre.textContent = text;
  box.appendChild(meta);
  box.appendChild(pre);
}

async function loadIdeas() {
  const table = document.getElementById('ideas-table');
  const res = await fetch('/studio/ideas-list');
  const payload = await res.json();
  const ideas = payload.data || [];
  if (!ideas.length) { table.innerHTML = '<p class="hint">no saved ideas yet</p>'; return; }
  const rows = ideas.map((idea) =>
    '<tr><td>' + escapeText(idea.title) + '</td><td>' + escapeText(idea.niche || '') + '</td><td>' +
    statusSelect(idea) + '</td><td>' + escapeText(idea.updatedAt || '') + '</td></tr>').join('');
  table.innerHTML = '<table><tr><th>Title</th><th>Niche</th><th>Status</th><th>Updated</th></tr>' + rows + '</table>';
  for (const select of table.querySelectorAll('select[data-id]')) {
    select.onchange = async () => {
      await fetch('/studio/status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: select.dataset.id, to: select.value }),
      });
      loadIdeas();
    };
  }
}

async function loadRenders() {
  const table = document.getElementById('renders-table');
  const res = await fetch('/studio/renders-list');
  const payload = await res.json();
  const renders = payload.data || [];
  if (!renders.length) { table.innerHTML = '<p class="hint">no renders yet — run Factory: produce</p>'; return; }
  const rows = renders.map((render, index) =>
    '<tr><td>' + escapeText(render.title) + '</td>' +
    '<td>' + (render.quality ? render.quality.verdict + ' (' + render.quality.overall + ')' : '—') + '</td>' +
    '<td>' + escapeText(render.provider || '') + '</td>' +
    '<td>' + escapeText(render.status) + '</td>' +
    '<td>' +
      (render.video ? '<button class="copy" data-play="' + index + '">play</button> ' : '') +
      '<button class="copy" data-approve="' + escapeText(render.ideaId) + '">approve</button> ' +
      '<button class="copy" data-reject="' + escapeText(render.ideaId) + '">reject</button>' +
    '</td></tr>').join('');
  table.innerHTML = '<table><tr><th>Title</th><th>Quality</th><th>Engine</th><th>Status</th><th></th></tr>' + rows + '</table>';
  const player = document.getElementById('renders-player');
  for (const btn of table.querySelectorAll('button[data-play]')) {
    btn.onclick = () => {
      const render = renders[Number(btn.dataset.play)];
      player.innerHTML = '<h3>' + escapeText(render.title) + '</h3>' +
        '<video controls style="max-width:320px;max-height:568px" src="/studio/render-file?path=' + encodeURIComponent(render.video) + '"></video>';
    };
  }
  const setStatus = async (id, to) => {
    await fetch('/studio/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, to }),
    });
    loadRenders();
  };
  for (const btn of table.querySelectorAll('button[data-approve]')) btn.onclick = () => setStatus(btn.dataset.approve, 'posted');
  for (const btn of table.querySelectorAll('button[data-reject]')) btn.onclick = () => setStatus(btn.dataset.reject, 'new');
}

function statusSelect(idea) {
  const statuses = ['new', 'scripted', 'rendered', 'posted'];
  return '<select data-id="' + escapeText(idea.id) + '">' + statuses.map((status) =>
    '<option value="' + status + '"' + (idea.status === status ? ' selected' : '') + '>' + status + '</option>').join('') + '</select>';
}

function escapeText(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function activate(id) {
  for (const btn of nav.querySelectorAll('button')) btn.classList.toggle('active', btn.dataset.tool === id);
  for (const panel of panels.querySelectorAll('.panel')) panel.classList.toggle('active', panel.id === 'panel-' + id);
}

activate(TOOLS[0].id);
</script>
</body>
</html>`;
}
