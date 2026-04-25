import { fleetSuperviseCommand } from './src/commands/supervise.js';
// We'll mock the setInterval to run once and exit
// @ts-ignore
global.setInterval = (fn) => { fn(); return {}; };
// @ts-ignore
global.process.exit = (code) => { console.log(`Exiting with code ${code}`); };

console.log('--- STARTING ONE-OFF SUPERVISOR CHECK ---');
fleetSuperviseCommand({ simulate: true });
setTimeout(() => process.exit(0), 2000);
