const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = process.env.INIT_CWD || process.cwd();
if (root.includes('node_modules')) process.exit(0);

try {
  execSync('pnpm exec husky install || npx husky install', { cwd: root, stdio: 'ignore' });

  const huskyDir = path.join(root, '.husky');
  if (!fs.existsSync(huskyDir)) fs.mkdirSync(huskyDir, { recursive: true });

  // Light pre-push: secret scan + lint only (<10s target)
  const prePush = `#!/bin/sh
set -e

# Lint (fast — Biome or ESLint, whatever is configured)
if grep -q '"lint"' package.json 2>/dev/null; then
  pnpm run lint --if-present || { echo "lint failed — fix before pushing" >&2; exit 1; }
fi

# Secret scan — abort if tokens/keys found in tracked files
SECRETS=$(git ls-files -z 2>/dev/null \\
  | xargs -0 grep -lE \\
    'sk-(proj-|ant-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|AIzaSy[A-Za-z0-9_-]{33}|xoxb-[A-Za-z0-9-]+|-----BEGIN (RSA |EC )?PRIVATE KEY-----' 2>/dev/null \\
  | grep -vE '(\\.example$|\\.sample$|/tests?/|/__tests__/|/fixtures?/|/mocks?/|/vendor/)' \\
  || true)
if [ -n "$SECRETS" ]; then
  echo "Possible secret(s) in tracked files — push aborted:" >&2
  printf '  %s\\n' $SECRETS >&2
  exit 1
fi
`;

  const prePushPath = path.join(huskyDir, 'pre-push');
  const currentPrePush = fs.existsSync(prePushPath)
    ? fs.readFileSync(prePushPath, 'utf8')
    : '';
  if (!currentPrePush || currentPrePush === prePush) {
    fs.writeFileSync(prePushPath, prePush, { mode: 0o755 });
    console.log('✓ husky pre-push hook configured (light: lint + secret scan)');
  } else {
    console.log('✓ existing husky pre-push hook preserved');
  }
} catch (e) {
  // Non-fatal — hooks are nice-to-have, not required
  console.warn('dev-config: could not set up husky hooks:', e.message);
}
