export type AppHealthTrafficClass = 'qa' | 'internal' | 'unknown';

export interface AppHealthNavigationTracker {
  flush?: () => Promise<unknown>;
  flushForNavigation?: () => Promise<boolean>;
}

export interface AppHealthNavigationClick {
  isAnchor: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: string;
  download: boolean;
}

export function shouldInterceptAppHealthNavigationClick(click: AppHealthNavigationClick) {
  return (
    click.isAnchor &&
    click.button === 0 &&
    !click.metaKey &&
    !click.ctrlKey &&
    !click.shiftKey &&
    !click.altKey &&
    click.target !== '_blank' &&
    !click.download
  );
}

export function handoffAppHealthNavigation(
  appHealth: AppHealthNavigationTracker,
  navigate: () => void,
  scheduleTimeout: (callback: () => void, delayMs: number) => number,
  clearTimeout: (timer: number) => void
) {
  let navigated = false;
  let navigationTimeout: number | undefined;
  const navigateOnce = () => {
    if (navigated) return;
    navigated = true;
    if (navigationTimeout !== undefined) clearTimeout(navigationTimeout);
    navigate();
  };
  const flushWithTimeout = () => {
    if (navigated) return;
    Promise.resolve(appHealth.flush?.())
      .catch(() => {})
      .finally(navigateOnce);
  };

  navigationTimeout = scheduleTimeout(navigateOnce, 800);
  try {
    const handoff = appHealth.flushForNavigation?.();
    if (!handoff) {
      flushWithTimeout();
      return;
    }
    void Promise.resolve(handoff).then((accepted) => {
      if (navigated) return;
      if (accepted) navigateOnce();
      else flushWithTimeout();
    }, flushWithTimeout);
  } catch {
    flushWithTimeout();
  }
}

const fixedDestinations = new Set(['project_directory', 'feedback_docs']);

function declaredMarker(search: string, key: 'fleet_qa' | 'fleet_internal') {
  const values = new URLSearchParams(search).getAll(key);
  if (values.length === 0) return { present: false, valid: false };
  return { present: true, valid: values.length === 1 && values[0] === '1' };
}

export function appHealthEventProperties(
  search: string,
  destinationId: string | null,
  projectIds: readonly string[]
) {
  const qa = declaredMarker(search, 'fleet_qa');
  const internal = declaredMarker(search, 'fleet_internal');
  const ambiguous = (qa.present && !qa.valid) || (internal.present && !internal.valid);
  const trafficClass: AppHealthTrafficClass =
    ambiguous || qa.valid === internal.valid ? 'unknown' : qa.valid ? 'qa' : 'internal';
  const properties: Record<string, string> = { traffic_class: trafficClass };

  if (
    destinationId &&
    (fixedDestinations.has(destinationId) || projectIds.includes(destinationId))
  ) {
    properties.destination_id = destinationId;
  }
  return properties;
}
