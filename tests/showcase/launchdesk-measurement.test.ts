import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { launchdeskEvent } from '../../apps/showcase/src/data/launchdesk-analytics';

describe('LaunchDesk bounded measurement', () => {
  it('emits fixed events only for the researched Awesome REA cohort', () => {
    expect(launchdeskEvent('awesomerea.com', 'playbook')).toBe('launchdesk.awesomerea.playbook');
    expect(launchdeskEvent('awesomerea.com', 'resource')).toBe('launchdesk.awesomerea.resource');
    expect(launchdeskEvent('awesomerea.com', 'submitIntent')).toBe(
      'launchdesk.awesomerea.submit_intent'
    );
    expect(launchdeskEvent('other.example', 'playbook')).toBeUndefined();
  });

  it('uses the shared click hook without sending URLs or changing link behavior', async () => {
    class Element {
      closest() {
        return link;
      }
    }
    class HTMLAnchorElement extends Element {
      href = '';
      target = '';
      eventName = '';
      hasAttribute() {
        return false;
      }
      getAttribute(name: string) {
        return name === 'data-app-health-event' ? this.eventName : null;
      }
    }

    const registrations: Record<string, (event: unknown) => void> = {};
    const tracked: unknown[][] = [];
    const assigned: string[] = [];
    const timers: Array<() => void> = [];
    let flushes = 0;
    const document = {
      addEventListener(name: string, handler: (event: unknown) => void) {
        registrations[name] = handler;
      },
    };
    const window = {
      appHealth: {
        track(...args: unknown[]) {
          tracked.push(args);
        },
        flush() {
          flushes++;
          return Promise.resolve();
        },
      },
      setTimeout(callback: () => void) {
        timers.push(callback);
      },
      location: {
        assign(href: string) {
          assigned.push(href);
        },
      },
    };
    const layout = await readFile(
      new URL('../../apps/showcase/src/layouts/Layout.astro', import.meta.url),
      'utf8'
    );
    const hook = layout.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1];
    expect(hook).toBeTruthy();

    const link = new HTMLAnchorElement();
    runInNewContext(hook!, { document, window, Element, HTMLAnchorElement, Promise });
    const click = registrations.click;
    expect(click).toBeTypeOf('function');

    const playbook = {
      href: '/launchdesk/awesomerea.com',
      target: '',
      eventName: launchdeskEvent('awesomerea.com', 'playbook')!,
    };
    Object.assign(link, playbook);
    let prevented = false;
    click({
      target: new Element(),
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault() {
        prevented = true;
      },
    });
    expect(prevented).toBe(true);
    expect(tracked).toEqual([[playbook.eventName]]);
    expect(flushes).toBe(1);
    expect(timers).toHaveLength(1);
    timers[0]();
    expect(assigned).toEqual([playbook.href]);

    const resource = {
      href: 'https://awesomerea.com/',
      target: '_blank',
      eventName: launchdeskEvent('awesomerea.com', 'resource')!,
    };
    Object.assign(link, resource);
    prevented = false;
    click({
      target: new Element(),
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault() {
        prevented = true;
      },
    });
    const submit = {
      href: 'https://github.com/kaixinbaba/awesome-rea/issues/new?template=1-project.yml',
      target: '_blank',
      eventName: launchdeskEvent('awesomerea.com', 'submitIntent')!,
    };
    Object.assign(link, submit);
    click({
      target: new Element(),
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault() {
        prevented = true;
      },
    });

    expect(tracked).toEqual([[playbook.eventName], [resource.eventName], [submit.eventName]]);
    expect(prevented).toBe(false);
    expect(flushes).toBe(1);
    expect(timers).toHaveLength(1);
    expect(assigned).toEqual([playbook.href]);
    expect(JSON.stringify(tracked)).not.toContain('https://');
    expect(JSON.stringify(tracked)).not.toContain('?template=');
  });
});
