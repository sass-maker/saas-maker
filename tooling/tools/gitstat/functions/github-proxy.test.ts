import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { onRequestGet } from './api/gh.ts'
import viteConfig, { ghProxyPlugin } from '../vite.config.ts'

const originalFetch = globalThis.fetch
const invalidPaths = [
  '', 'users/example', '.example.test/users', 'https://example.test/users',
  'http://api.github.com/users', 'https://api.github.com/users', '//example.test/users',
  '///api.github.com/users', '//api.github.com:443/users',
  '//user:password@api.github.com/users', '//api.github.com:8443/users',
  '/\\example.test/users', '\\example.test/users', '/\n/example.test/users',
  '/users/example#fragment',
]

afterEach(() => { globalThis.fetch = originalFetch })

function productionContext(path: string) {
  return {
    request: new Request(`https://fixture.test/api/gh?path=${encodeURIComponent(path)}`),
    env: { GH_PUBLIC_TOKEN: 'synthetic-in-memory-token' },
    params: {}, data: {}, next: async () => new Response(null),
    waitUntil: () => {},
  }
}

test('production REST proxy sends a synthetic token only to a validated GitHub URL', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return new Response('{"ok":true}', { status: 200 })
  }
  const response = await onRequestGet(productionContext('/users/example/repos?per_page=30&page=2') as never)
  assert.equal(response.status, 200)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.github.com/users/example/repos?per_page=30&page=2')
  assert.equal(new Headers(calls[0].init?.headers).get('Authorization'), 'Bearer synthetic-in-memory-token')
})

test('production REST proxy rejects unsafe path forms before any fetch or token transmission', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; return new Response(null) }
  for (const path of invalidPaths) {
    assert.equal((await onRequestGet(productionContext(path) as never)).status, 400, JSON.stringify(path))
  }
  assert.equal(calls, 0)
})

type Middleware = (request: { url: string; method: string }, response: {
  statusCode: number; setHeader: (key: string, value: string) => void; end: (body: string) => void
}, next: () => void) => Promise<void>

function developmentMiddleware(): Middleware {
  let handler: Middleware | undefined
  const configure = ghProxyPlugin().configureServer as (server: {
    middlewares: { use: (middleware: Middleware) => void }
  }) => void
  configure({ middlewares: { use: (middleware) => { handler = middleware } } })
  assert.ok(handler)
  return handler
}

test('development REST proxy is anonymous and applies the same pre-fetch path boundary', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return new Response('{"ok":true}', { status: 200 })
  }
  assert.equal(viteConfig.envDir, false)
  const handler = developmentMiddleware()
  const response = { statusCode: 0, setHeader: () => {}, end: () => {} }
  const invoke = (path: string) => handler({ url: `/api/gh?path=${encodeURIComponent(path)}`, method: 'GET' }, response, () => assert.fail('Unexpected next middleware'))
  await invoke('/repos/example/public?per_page=30')
  assert.equal(response.statusCode, 200)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.github.com/repos/example/public?per_page=30')
  assert.equal(new Headers(calls[0].init?.headers).has('Authorization'), false)
  calls.length = 0
  for (const path of invalidPaths) {
    await invoke(path)
    assert.equal(response.statusCode, 400, JSON.stringify(path))
  }
  assert.equal(calls.length, 0)
})
