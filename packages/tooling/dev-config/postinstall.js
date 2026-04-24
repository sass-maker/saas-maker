const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = process.env.INIT_CWD || process.cwd();
if (root.includes('node_modules')) return;

try {
  console.log('Setting up SaaS Maker Dev Config at:', root);
  execSync('npx husky install', { cwd: root });
  
  const huskyDir = path.join(root, '.husky');
  if (!fs.existsSync(huskyDir)) fs.mkdirSync(huskyDir);

  const prePush = '#!/bin/sh\nset -e\nnpm run lint || { echo "Lint failed, fix before pushing"; exit 1; }';
  fs.writeFileSync(path.join(huskyDir, 'pre-push'), prePush, { mode: 0o755 });
  console.log('✓ Husky hooks configured');
} catch (e) {
  console.error('Failed to setup dev-config:', e.message);
}
