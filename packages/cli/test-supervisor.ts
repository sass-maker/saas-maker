import { fleetSuperviseCommand } from './src/commands/supervise.js';
// We'll mock the setInterval to run once and exit
// @ts-expect-error
global.setInterval = (fn) => {
  fn();
  return {};
};
// @ts-expect-error
global.process.exit = (code) => {
  console.log(`Exiting with code ${code}`);
};

console.log('--- STARTING ONE-OFF SUPERVISOR CHECK ---');
fleetSuperviseCommand({ simulate: true });
setTimeout(() => process.exit(0), 2000);
