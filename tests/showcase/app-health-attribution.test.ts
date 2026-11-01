import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import {
  appHealthEventProperties,
  handoffAppHealthNavigation,
  shouldInterceptAppHealthNavigationClick,
} from '../../apps/showcase/src/data/app-health-attribution';

async function readShowcase(relativePath: string) {
  return readFile(new URL(`../../apps/showcase/${relativePath}`, import.meta.url), 'utf8');
}

describe('bounded App Health CTA attribution', () => {
  it('marks ordinary and ambiguous traffic as unknown without copying query data', () => {
    expect(appHealthEventProperties('?note=PRIVATE_VALUE', 'project_directory', [])).toEqual({
      traffic_class: 'unknown',
      destination_id: 'project_directory',
    });
    expect(
      appHealthEventProperties('?fleet_qa=1&fleet_internal=1&token=PRIVATE_VALUE', null, [])
    ).toEqual({ traffic_class: 'unknown' });
    expect(appHealthEventProperties('?fleet_qa=1&fleet_qa=1', null, [])).toEqual({
      traffic_class: 'unknown',
    });
  });

  it('accepts only one explicit QA or internal marker and a curated public destination', () => {
    expect(appHealthEventProperties('?fleet_qa=1', 'project-one', ['project-one'])).toEqual({
      traffic_class: 'qa',
      destination_id: 'project-one',
    });
    expect(appHealthEventProperties('?fleet_internal=1', 'feedback_docs', [])).toEqual({
      traffic_class: 'internal',
      destination_id: 'feedback_docs',
    });
    expect(appHealthEventProperties('', 'https://private.example/path', [])).toEqual({
      traffic_class: 'unknown',
    });
    expect(
      JSON.stringify(appHealthEventProperties('?q=PRIVATE_VALUE', 'project_directory', []))
    ).not.toContain('PRIVATE_VALUE');
    expect(appHealthEventProperties('', 'not-in-server-allowlist', ['project-one'])).toEqual({
      traffic_class: 'unknown',
    });
  });

  it('sends bounded destinations through the existing click tracker', async () => {
    const [layout, hero, spec] = await Promise.all([
      readShowcase('src/layouts/Layout.astro'),
      readShowcase('src/components/Hero.astro'),
      readShowcase('src/components/Spec.astro'),
    ]);

    expect(layout).toMatch(/appHealth\.track\(\s*name,\s*appHealthEventProperties/);
    expect(layout).toContain('handoffAppHealthNavigation(');
    expect(layout).toContain('shouldInterceptAppHealthNavigationClick(');
    expect(layout).toContain('data-app-health-project-ids={appHealthProjectIds}');
    expect(layout).toContain("CORE.map(({ id }) => id).join(',')");
    expect(hero).toContain('data-app-health-destination="project_directory"');
    expect(hero).toContain('data-app-health-destination={project.id}');
    expect(spec).toContain('data-app-health-destination="feedback_docs"');

    const helper = await readShowcase('src/data/app-health-attribution.ts');
    expect(helper).not.toContain("from './projects'");
    expect(helper).toContain('scheduleTimeout(navigateOnce, 800)');
  });
});

describe('App Health navigation handoff', () => {
  const ordinaryClick = {
    isAnchor: true,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: '',
    download: false,
  };

  it('intercepts only ordinary same-tab anchor clicks', () => {
    expect(shouldInterceptAppHealthNavigationClick(ordinaryClick)).toBe(true);
    for (const update of [
      { isAnchor: false },
      { button: 1 },
      { metaKey: true },
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true },
      { target: '_blank' },
      { download: true },
    ]) {
      expect(shouldInterceptAppHealthNavigationClick({ ...ordinaryClick, ...update })).toBe(false);
    }
  });

  function scheduler() {
    const timers = new Map<number, () => void>();
    const cleared: number[] = [];
    let nextTimer = 1;
    return {
      schedule: (callback: () => void, delayMs: number) => {
        expect(delayMs).toBe(800);
        const timer = nextTimer++;
        timers.set(timer, callback);
        return timer;
      },
      clear: (timer: number) => {
        cleared.push(timer);
        timers.delete(timer);
      },
      fire: (timer: number) => {
        const callback = timers.get(timer);
        timers.delete(timer);
        callback?.();
      },
      cleared,
      timers,
    };
  }

  it('navigates after an accepted handoff and clears the cap timer', async () => {
    const time = scheduler();
    const navigate = vi.fn();
    const tracker = {
      marker: 'receiver',
      flushForNavigation(this: { marker: string }) {
        expect(this.marker).toBe('receiver');
        return Promise.resolve(true);
      },
    };

    handoffAppHealthNavigation(tracker, navigate, time.schedule, time.clear);
    await Promise.resolve();

    expect(navigate).toHaveBeenCalledOnce();
    expect(time.cleared).toEqual([1]);
  });

  it.each([
    ['legacy tracker', undefined],
    ['declined handoff', () => Promise.resolve(false)],
    ['rejected handoff', () => Promise.reject(new Error('synthetic'))],
    [
      'throwing handoff',
      () => {
        throw new Error('synthetic');
      },
    ],
  ])('uses the bounded legacy flush for a %s', async (_label, flushForNavigation) => {
    const time = scheduler();
    const navigate = vi.fn();
    const flush = vi.fn().mockResolvedValue(undefined);

    handoffAppHealthNavigation({ flush, flushForNavigation }, navigate, time.schedule, time.clear);
    await Promise.resolve();
    await Promise.resolve();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledOnce());

    expect(flush).toHaveBeenCalledOnce();
    expect(time.cleared).toEqual([1]);
  });

  it('navigates at the 800 ms cap once when the handoff remains pending', async () => {
    const time = scheduler();
    const navigate = vi.fn();
    let acceptHandoff!: (accepted: boolean) => void;

    handoffAppHealthNavigation(
      {
        flushForNavigation: () =>
          new Promise((resolve) => {
            acceptHandoff = resolve;
          }),
      },
      navigate,
      time.schedule,
      time.clear
    );
    time.fire(1);
    acceptHandoff(true);
    await Promise.resolve();

    expect(navigate).toHaveBeenCalledOnce();
    expect(time.cleared).toEqual([1]);
  });
});
