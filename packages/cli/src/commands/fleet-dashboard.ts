import chalk from 'chalk';
import { getLocalFleet } from '../lib/fleet.js';
import { detectTooling } from '../lib/tooling.js';

export async function fleetDashboardCommand(): Promise<void> {
  const fleet = getLocalFleet();
  if (fleet.length === 0) {
    console.log('No fleet projects detected.');
    return;
  }

  const rows = fleet.map(p => detectTooling(p.path, p.slug));

  // Column widths
  const col = (s: string, w: number) => s.slice(0, w).padEnd(w);
  const dim = chalk.dim;
  const green = chalk.green;
  const yellow = chalk.yellow;

  console.log('\n' + chalk.bold.white(' FOUNDRY FLEET MATRIX') + '\n');

  const header = [
    col('PROJECT', 22),
    col('FRAMEWORK', 12),
    col('DB', 18),
    col('AUTH', 16),
    col('DEPLOY', 10),
    col('TESTS', 12),
    col('SM', 4),
    col('FND', 4),
  ].join('  ');

  console.log(dim(header));
  console.log(dim('─'.repeat(header.length)));

  for (const r of rows) {
    const smCell = r.saasmakerCount > 0 ? green(`✓${r.saasmakerCount}`) : yellow('✗');
    const fndCell = r.foundryLinked ? green('✓') : yellow('✗');
    const row = [
      col(r.name, 22),
      col(r.frameworkVersion || r.framework, 12),
      col(r.db, 18),
      col(r.auth, 16),
      col(r.deploy, 10),
      col(r.testFrameworks, 12),
      smCell.padEnd(4),
      fndCell,
    ].join('  ');
    console.log(row);
  }

  console.log('\n' + dim(`${rows.length} projects · SM = @saas-maker/* packages · FND = foundry.json`));

  // Summary stats
  const frameworks = rows.reduce((acc, r) => { acc[r.framework] = (acc[r.framework]||0)+1; return acc; }, {} as Record<string,number>);
  console.log('\n' + chalk.bold('Stack breakdown:'));
  Object.entries(frameworks).sort((a,b) => b[1]-a[1]).forEach(([k,v]) =>
    console.log(`  ${k}: ${v} project${v>1?'s':''}`)
  );

  const noTests = rows.filter(r => r.testFrameworks === '-').length;
  const noAuth = rows.filter(r => r.auth === '-').length;
  if (noTests > 0) console.log('\n' + yellow(`⚠  ${noTests} projects have no tests`));
  if (noAuth > 0) console.log(dim(`ℹ  ${noAuth} projects have no auth (may be intentional)`));
  console.log('');
}
