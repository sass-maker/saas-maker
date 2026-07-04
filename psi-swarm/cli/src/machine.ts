import { cpus, totalmem } from 'node:os';

export interface MachineProfile {
  cores: number;
  totalMemGB: number;
  recommendedParallel: number;
}

const MIN_RAM_PER_CHROME_MB = 1500;
const ABSOLUTE_CAP = 4;

export function profileMachine(): MachineProfile {
  const cores = cpus().length;
  const totalMemMB = totalmem() / (1024 * 1024);
  const ramCap = Math.floor(totalMemMB / MIN_RAM_PER_CHROME_MB);
  // Leave 2 cores headroom for OS + Lighthouse main process.
  const cpuCap = Math.max(1, cores - 2);
  const recommended = Math.max(1, Math.min(cpuCap, ramCap, ABSOLUTE_CAP));
  return {
    cores,
    totalMemGB: totalMemMB / 1024,
    recommendedParallel: recommended,
  };
}

export function resolveParallelism(spec: string | number | undefined, presetCount: number): number {
  const profile = profileMachine();
  if (spec === undefined || spec === '1' || spec === 1) return 1;
  if (spec === 'auto') return Math.min(profile.recommendedParallel, presetCount);
  const n = typeof spec === 'number' ? spec : parseInt(spec, 10);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`Invalid --parallel value: ${spec}. Use 1, an integer, or "auto".`);
  }
  return Math.max(1, Math.min(n, presetCount));
}
