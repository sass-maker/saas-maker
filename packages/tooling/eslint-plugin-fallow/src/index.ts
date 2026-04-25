import { execSync } from 'node:child_process';

const rule = {
  meta: {
    type: 'suggestion' as const,
    docs: {
      description: 'Run Fallow codebase analysis at the ESLint level',
      category: 'Best Practices',
      recommended: true,
    },
    schema: [],
  },
  create(context: any) {
    return {
      Program() {
        const filePath = context.getFilename();
        const root = context.getCwd();

        try {
          const output = execSync(`fallow audit --format json "${filePath}"`, {
            cwd: root,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
          });

          if (!output || output.trim() === '') return;

          const results = JSON.parse(output);
          
          (results.findings || []).forEach((finding: any) => {
            context.report({
              loc: {
                start: { line: finding.line || 1, column: finding.column || 0 },
              },
              message: `[Fallow ${finding.type}] ${finding.message}`,
            });
          });
        } catch (err) {
          // Silent fail
        }
      },
    };
  },
};

export default {
  rules: {
    audit: rule,
  },
  configs: {
    recommended: {
      plugins: ['@saas-maker/fallow'],
      rules: {
        '@saas-maker/fallow/audit': 'warn',
      },
    },
  },
};
