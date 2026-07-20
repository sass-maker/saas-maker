import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveSocialAccountsConfig, AccountRouter } from '../src/config/social-accounts.js';

test('resolveSocialAccountsConfig inlines env-backed secrets', () => {
  const env = {
    YT_T_CLIENT_ID: 'cid',
    YT_T_CLIENT_SECRET: 'csecret',
    YT_T_REFRESH_TOKEN: 'rtoken',
  };
  const out = resolveSocialAccountsConfig({
    youtube: {
      tutoring: {
        clientIdEnv: 'YT_T_CLIENT_ID',
        clientSecretEnv: 'YT_T_CLIENT_SECRET',
        refreshTokenEnv: 'YT_T_REFRESH_TOKEN',
        defaultPrivacy: 'private',
        projects: ['tutoring-q3'],
        default: true,
      },
    },
  }, env);
  assert.deepEqual(out.youtube.tutoring, {
    slug: 'tutoring',
    clientId: 'cid',
    clientSecret: 'csecret',
    refreshToken: 'rtoken',
    defaultPrivacy: 'private',
    projects: ['tutoring-q3'],
    default: true,
  });
});

test('resolveSocialAccountsConfig throws when an Env var is missing', () => {
  assert.throws(
    () => resolveSocialAccountsConfig({
      youtube: { tutoring: { clientIdEnv: 'NOT_SET' } },
    }, {}),
    /env var NOT_SET is not set/,
  );
});

test('AccountRouter prefers explicit account_slug', () => {
  const router = new AccountRouter({
    tutoring: { slug: 'tutoring', projects: ['p1'], default: true },
    brand: { slug: 'brand', projects: ['p2'] },
  });
  const account = router.route({ account_slug: 'brand', project_slug: 'p1' });
  assert.equal(account.slug, 'brand');
});

test('AccountRouter falls back to project_slug match', () => {
  const router = new AccountRouter({
    tutoring: { slug: 'tutoring', projects: ['p1'], default: true },
    brand: { slug: 'brand', projects: ['p2'] },
  });
  const account = router.route({ project_slug: 'p2' });
  assert.equal(account.slug, 'brand');
});

test('AccountRouter falls back to default when nothing matches', () => {
  const router = new AccountRouter({
    tutoring: { slug: 'tutoring', projects: ['p1'], default: true },
    brand: { slug: 'brand', projects: ['p2'] },
  });
  const account = router.route({ project_slug: 'unknown' });
  assert.equal(account.slug, 'tutoring');
});

test('AccountRouter throws for explicit unknown slug', () => {
  const router = new AccountRouter({
    tutoring: { slug: 'tutoring', projects: [], default: true },
  });
  assert.throws(() => router.route({ account_slug: 'nope' }), /no account configured/);
});
