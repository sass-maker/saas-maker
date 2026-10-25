const AWESOMEREA_EVENTS = {
  playbook: 'launchdesk.awesomerea.playbook',
  resource: 'launchdesk.awesomerea.resource',
  submitIntent: 'launchdesk.awesomerea.submit_intent',
} as const;

type AwesomereaAction = keyof typeof AWESOMEREA_EVENTS;

/**
 * The App Health browser tracker accepts event names only. Keep this bounded to
 * the one researched LaunchDesk cohort; never derive event data from a URL.
 */
export function launchdeskEvent(domain: string, action: AwesomereaAction): string | undefined {
  return domain === 'awesomerea.com' ? AWESOMEREA_EVENTS[action] : undefined;
}
