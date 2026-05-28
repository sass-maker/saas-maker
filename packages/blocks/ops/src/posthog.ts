import posthog from 'posthog-js';
import type { FoundryError } from './error.js';

export interface PostHogConfig {
  apiKey: string;
  host?: string;
  projectId?: string;
}

let isInitialized = false;

export function initOpsMonitoring(config: PostHogConfig) {
  if (typeof window !== 'undefined' && !isInitialized) {
    posthog.init(config.apiKey, {
      api_host: config.host || 'https://us.i.posthog.com',
      autocapture: false,
    });
    
    posthog.register({
      project_id: config.projectId,
      foundry_standard: true,
    });

    isInitialized = true;
  }
}

export function captureFoundryError(error: FoundryError) {
  if (!isInitialized) return;
  
  posthog.capture('foundry_error', {
    message: error.message,
    code: error.code,
    severity: error.severity,
    ...error.context,
    $exception_message: error.message,
    $exception_type: error.name,
    $exception_stack: error.stack,
  });
}
