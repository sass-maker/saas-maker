import chalk from 'chalk';

let isVerbose = true;

export function setVerbose(v: boolean) {
  isVerbose = v;
}

export const log = {
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  error: (msg: string) => console.error(chalk.red('✗'), msg),
  warn: (msg: string) => console.warn(chalk.yellow('⚠'), msg),
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  dim: (msg: string) => console.log(chalk.dim(msg)),
  debug: (msg: string) => {
    if (isVerbose) console.log(chalk.gray('debug:'), msg);
  },
};

export function table(rows: string[][]): void {
  if (rows.length === 0) return;
  const widths = rows[0].map((_, i) =>
    Math.max(...rows.map((row) => (row[i] ?? '').length)),
  );
  for (const row of rows) {
    console.log(row.map((cell, i) => cell.padEnd(widths[i])).join('  '));
  }
}
