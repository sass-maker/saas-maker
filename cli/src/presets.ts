export interface ThrottleConfig {
  rttMs: number;
  throughputKbps: number;
  requestLatencyMs: number;
  downloadThroughputKbps: number;
  uploadThroughputKbps: number;
  cpuSlowdownMultiplier: number;
}

export interface ScreenEmulation {
  mobile: boolean;
  width: number;
  height: number;
  deviceScaleFactor: number;
  disabled: boolean;
}

export interface Preset {
  name: string;
  label: string;
  formFactor: 'mobile' | 'desktop';
  throttling: ThrottleConfig;
  screenEmulation: ScreenEmulation;
}

const slow3G = (cpu: number): ThrottleConfig => ({
  rttMs: 300,
  throughputKbps: 700,
  requestLatencyMs: 1125,
  downloadThroughputKbps: 630,
  uploadThroughputKbps: 270,
  cpuSlowdownMultiplier: cpu,
});

const slow4G = (cpu: number): ThrottleConfig => ({
  rttMs: 150,
  throughputKbps: 1638.4,
  requestLatencyMs: 562.5,
  downloadThroughputKbps: 1474.56,
  uploadThroughputKbps: 675,
  cpuSlowdownMultiplier: cpu,
});

const fast4G = (cpu: number): ThrottleConfig => ({
  rttMs: 75,
  throughputKbps: 5000,
  requestLatencyMs: 281.25,
  downloadThroughputKbps: 4500,
  uploadThroughputKbps: 1500,
  cpuSlowdownMultiplier: cpu,
});

const cable = (cpu: number): ThrottleConfig => ({
  rttMs: 40,
  throughputKbps: 10240,
  requestLatencyMs: 150,
  downloadThroughputKbps: 10000,
  uploadThroughputKbps: 5000,
  cpuSlowdownMultiplier: cpu,
});

const MOBILE_SCREEN: ScreenEmulation = {
  mobile: true,
  width: 412,
  height: 823,
  deviceScaleFactor: 1.75,
  disabled: false,
};

const DESKTOP_SCREEN: ScreenEmulation = {
  mobile: false,
  width: 1350,
  height: 940,
  deviceScaleFactor: 1,
  disabled: false,
};

export const PRESETS: Record<string, Preset> = {
  'mobile-slow': {
    name: 'mobile-slow',
    label: 'Mobile · Slow 3G · low-end Android (6× CPU)',
    formFactor: 'mobile',
    throttling: slow3G(6),
    screenEmulation: MOBILE_SCREEN,
  },
  'mobile-mid': {
    name: 'mobile-mid',
    label: 'Mobile · Slow 4G · mid Android (4× CPU)',
    formFactor: 'mobile',
    throttling: slow4G(4),
    screenEmulation: MOBILE_SCREEN,
  },
  'mobile-fast': {
    name: 'mobile-fast',
    label: 'Mobile · Fast 4G · iPhone-class (2× CPU)',
    formFactor: 'mobile',
    throttling: fast4G(2),
    screenEmulation: MOBILE_SCREEN,
  },
  desktop: {
    name: 'desktop',
    label: 'Desktop · Cable (1× CPU)',
    formFactor: 'desktop',
    throttling: cable(1),
    screenEmulation: DESKTOP_SCREEN,
  },
};

export const PRESET_GROUPS: Record<string, string[]> = {
  realistic: ['mobile-slow', 'mobile-mid', 'mobile-fast', 'desktop'],
  mobile: ['mobile-slow', 'mobile-mid', 'mobile-fast'],
  desktop: ['desktop'],
  psi: ['mobile-mid', 'desktop'],
};

export function resolvePresets(spec: string): Preset[] {
  if (PRESET_GROUPS[spec]) return PRESET_GROUPS[spec].map((n) => PRESETS[n]);
  const names = spec.split(',').map((s) => s.trim()).filter(Boolean);
  const resolved: Preset[] = [];
  for (const n of names) {
    if (!PRESETS[n]) {
      throw new Error(
        `Unknown preset: ${n}. Available: ${Object.keys(PRESETS).join(', ')}`,
      );
    }
    resolved.push(PRESETS[n]);
  }
  if (resolved.length === 0) throw new Error('No presets resolved.');
  return resolved;
}
