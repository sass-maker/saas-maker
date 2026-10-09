import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PORTFOLIO_PROJECT_STRIP_TAG } from '../dist/browser/element.mjs';
import { normalizeProjects, PortfolioProjectStrip, withReferralSource } from '../dist/index.mjs';

test('browser entrypoint is safe to import without a DOM', () => {
  assert.equal(PORTFOLIO_PROJECT_STRIP_TAG, 'portfolio-project-strip');
});

test('normalizes valid projects and removes duplicate ids', () => {
  assert.deepEqual(
    normalizeProjects([
      { id: 'one', name: 'One', url: 'https://one.example' },
      { id: 'one', name: 'Duplicate', url: 'https://duplicate.example' },
      { id: 'bad', name: 'Bad', url: 'javascript:alert(1)' },
    ]),
    [{ id: 'one', name: 'One', url: 'https://one.example' }]
  );
});

test('rejects non-arrays', () => assert.deepEqual(normalizeProjects(null), []));

test('keeps short project lists static and excludes the current project', () => {
  const markup = renderToStaticMarkup(
    createElement(PortfolioProjectStrip, {
      catalogUrl: '',
      currentProjectId: 'current',
      projects: [
        { id: 'current', name: 'Current', url: 'https://current.example' },
        { id: 'one', name: 'One', url: 'https://one.example', description: 'First project' },
        { id: 'two', name: 'Two', url: 'https://two.example' },
      ],
    })
  );

  assert.doesNotMatch(markup, />Current</);
  assert.match(markup, /data-loop="false"/);
  assert.doesNotMatch(markup, />Pause</);
  assert.doesNotMatch(markup, />More from Sarthak</);
  assert.match(markup, /href="https:\/\/one\.example\/\?ref=current"/);
  assert.match(markup, /aria-label="One \(opens in a new tab\)"/);
  assert.match(markup, /aria-describedby=/);
  assert.match(markup, /role="tooltip" hidden=""/);
  assert.equal((markup.match(/portfolio-project-strip__dot/g) ?? []).length, 1);
});

test('duplicates long lists accessibly without visible metadata controls', () => {
  const markup = renderToStaticMarkup(
    createElement(PortfolioProjectStrip, {
      catalogUrl: '',
      projects: [
        { id: 'one', name: 'One', url: 'https://one.example' },
        { id: 'two', name: 'Two', url: 'https://two.example' },
        { id: 'three', name: 'Three', url: 'https://three.example' },
      ],
    })
  );

  assert.match(markup, /data-loop="true"/);
  assert.doesNotMatch(markup, /aria-pressed/);
  assert.doesNotMatch(markup, /portfolio-project-strip__meta/);
  assert.equal(
    (markup.match(/portfolio-project-strip__duplicate" aria-hidden="true"/g) ?? []).length,
    3
  );
});

test('adds referral source without mutating canonical destination state', () => {
  const canonical = 'https://one.example/path?campaign=launch#details';
  assert.equal(
    withReferralSource(canonical, 'codevetter'),
    'https://one.example/path?campaign=launch&ref=codevetter#details'
  );
  assert.equal(canonical, 'https://one.example/path?campaign=launch#details');
  assert.equal(withReferralSource(canonical), canonical);
  assert.equal(withReferralSource('not a url', 'codevetter'), 'not a url');
});

test('curated layout renders only three stable noncurrent links with descriptions and existing referrals', () => {
  const markup = renderToStaticMarkup(
    createElement(PortfolioProjectStrip, {
      catalogUrl: '',
      currentProjectId: 'current',
      layout: 'curated',
      projects: [
        { id: 'current', name: 'Current', url: 'https://current.example' },
        {
          id: 'one',
          name: 'One',
          url: 'https://one.example/path?campaign=launch#details',
          description: 'First <project>',
        },
        { id: 'one', name: 'Duplicate', url: 'https://duplicate.example' },
        { id: 'bad', name: 'Unsafe', url: 'javascript:alert(1)' },
        { id: 'two', name: 'Two', url: 'https://two.example', description: 'Second project' },
        { id: 'three', name: 'Three', url: 'https://three.example' },
        { id: 'four', name: 'Fourth', url: 'https://four.example' },
      ],
    })
  );
  assert.match(markup, /data-layout="curated"/);
  assert.equal((markup.match(/<a /g) ?? []).length, 3);
  assert.ok(markup.indexOf('>One<') < markup.indexOf('>Two<'));
  assert.ok(markup.indexOf('>Two<') < markup.indexOf('>Three<'));
  assert.match(markup, /First &lt;project&gt;/);
  assert.match(markup, /campaign=launch&amp;ref=current#details/);
  assert.doesNotMatch(
    markup,
    />Current<|>Fourth<|>Duplicate<|>Unsafe<|__duplicate|data-loop|role="tooltip"/
  );
});

test('curated short and empty lists preserve bounded absence without cloning', () => {
  const props = { catalogUrl: '', layout: 'curated', currentProjectId: 'current' };
  assert.equal(
    renderToStaticMarkup(
      createElement(PortfolioProjectStrip, {
        ...props,
        projects: [{ id: 'current', name: 'Current', url: 'https://current.example' }],
      })
    ),
    ''
  );
  const single = renderToStaticMarkup(
    createElement(PortfolioProjectStrip, {
      ...props,
      projects: [{ id: 'one', name: 'One', url: 'https://one.example' }],
    })
  );
  assert.equal((single.match(/<a /g) ?? []).length, 1);
  assert.doesNotMatch(single, /__duplicate|data-loop/);
});

test('studio is one static labelled line of safe noncurrent links and the directory', () => {
  const markup = renderToStaticMarkup(
    createElement(PortfolioProjectStrip, {
      layout: 'studio',
      currentProjectId: 'current',
      catalogUrl: '',
      projects: [
        { id: 'current', name: 'Current', url: 'https://current.example' },
        {
          id: 'one',
          name: 'One',
          url: 'https://one.example/?campaign=launch#details',
          description: 'One detail',
        },
        { id: 'one', name: 'Duplicate', url: 'https://duplicate.example' },
        { id: 'bad', name: 'Unsafe', url: 'javascript:alert(1)' },
        { id: 'two', name: 'Two', url: 'https://two.example' },
        { id: 'three', name: 'Three', url: 'https://three.example' },
        { id: 'four', name: 'Fourth', url: 'https://four.example' },
      ],
    })
  );
  assert.match(markup, /data-layout="studio"/);
  assert.match(markup, /From the studio/);
  assert.match(markup, /class="portfolio-project-strip__studio"/);
  assert.doesNotMatch(markup, /tabindex=|role="region"/);
  assert.equal((markup.match(/<a /g) ?? []).length, 4);
  assert.match(markup, /campaign=launch&amp;ref=current#details/);
  assert.match(markup, /href="https:\/\/sassmaker.com\/projects"/);
  assert.match(markup, /title="One detail"/);
  assert.doesNotMatch(
    markup,
    />Current<|>Duplicate<|>Unsafe<|>Fourth<|>One detail<|__duplicate|__description|data-loop/
  );
});

test('studio remains absent when every safe project is current', () => {
  assert.equal(
    renderToStaticMarkup(
      createElement(PortfolioProjectStrip, {
        layout: 'studio',
        catalogUrl: '',
        currentProjectId: 'one',
        projects: [{ id: 'one', name: 'One', url: 'https://one.example' }],
      })
    ),
    ''
  );
});
