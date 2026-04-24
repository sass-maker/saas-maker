import posthog from 'posthog-js';

export interface AnalyticsConfig {
  apiKey: string;
  apiHost?: string;
  debug?: boolean;
  persistence?: 'localStorage' | 'sessionStorage' | 'cookie' | 'memory';
  capturePageview?: boolean;
}

export class FoundryAnalytics {
  private static instance: FoundryAnalytics;
  private initialized = false;

  constructor(config: AnalyticsConfig) {
    if (typeof window !== 'undefined' && !this.initialized) {
      posthog.init(config.apiKey, {
        api_host: config.apiHost || 'https://us.i.posthog.com',
        loaded: (ph) => {
          if (config.debug) ph.debug();
        },
        persistence: config.persistence || 'localStorage',
        autocapture: true,
        capture_pageview: config.capturePageview ?? true,
      });

      // Add Foundry standard properties to every event
      posthog.register({
        foundry_standard: true,
        foundry_sdk: 'analytics-sdk',
        foundry_version: '1.0.0',
      });

      this.initialized = true;
    }
  }

  static init(config: AnalyticsConfig): FoundryAnalytics {
    if (!FoundryAnalytics.instance) {
      FoundryAnalytics.instance = new FoundryAnalytics(config);
    }
    return FoundryAnalytics.instance;
  }

  track(name: string, properties?: Record<string, any>) {
    posthog.capture(name, properties);
  }

  identify(distinctId: string, properties?: Record<string, any>) {
    posthog.identify(distinctId, properties);
  }

  alias(alias: string, distinctId: string) {
    posthog.alias(alias, distinctId);
  }

  reset() {
    posthog.reset();
  }
}

// Backward compatibility for the <script> tag users
if (typeof window !== 'undefined') {
  const win = window as any;
  const scripts = document.querySelectorAll('script[data-ph-key]');
  const scriptEl = scripts[scripts.length - 1] as HTMLScriptElement | undefined;

  if (scriptEl) {
    const apiKey = scriptEl.getAttribute('data-ph-key');
    const apiHost = scriptEl.getAttribute('data-ph-host') || undefined;

    if (apiKey) {
      FoundryAnalytics.init({
        apiKey,
        apiHost,
        debug: scriptEl.getAttribute('data-debug') === 'true',
      });
    }
  }

  // Define global sm object
  win.sm = {
    track: (name: string, props?: Record<string, any>) => posthog.capture(name, props),
    identify: (id: string, props?: Record<string, any>) => posthog.identify(id, props),
    init: (config: AnalyticsConfig) => FoundryAnalytics.init(config),
  };
}

export default FoundryAnalytics;
