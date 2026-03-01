import chalk from 'chalk';

export const log = {
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  error: (msg: string) => console.error(chalk.red('✗'), msg),
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  dim: (msg: string) => console.log(chalk.dim(msg)),
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
