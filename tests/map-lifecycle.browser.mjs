import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { createServer } from 'vite'

test('map callbacks stop before view teardown or base-layer removal', async (t) => {
  const fixture = await readFile(new URL('./fixtures/map-lifecycle.html', import.meta.url), 'utf8')
  const server = await createServer({
    server: { port: 0, host: '127.0.0.1' },
    plugins: [{
      name: 'map-lifecycle-fixture',
      configureServer(server) {
        server.middlewares.use('/__map-lifecycle.html', async (_req, res, next) => {
          try {
            const html = await server.transformIndexHtml('/__map-lifecycle.html', fixture)
            res.setHeader('Content-Type', 'text/html')
            res.end(html)
          } catch (error) {
            next(error)
          }
        })
      },
    }],
  })
  t.after(() => server.close())
  await server.listen()
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  t.after(() => browser.close())

  for (const scenario of ['immediate', 'resize', 'switch', 'moveend']) {
    await t.test(scenario, async () => {
      const page = await browser.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('https://**/*', route => route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ version: 8, sources: {}, layers: [] }),
      }))
      try {
        await page.goto(`${server.resolvedUrls.local[0]}__map-lifecycle.html`)
        await page.waitForFunction(() => typeof window.runMapLifecycleScenario === 'function')
        const result = await page.evaluate(name => window.runMapLifecycleScenario(name), scenario)
        assert.deepEqual(errors, [], 'pending callbacks must not access a removed map')
        assert.ok(result.mapCleared, 'the composable must release the map')
        assert.ok(result.events.includes('disconnect'), 'ResizeObserver must disconnect')
        assert.ok(result.events.includes('remove'), 'Leaflet must be removed')
        assert.ok(result.events.indexOf('disconnect') < result.events.indexOf('remove'),
          'ResizeObserver must disconnect before Leaflet removal')
      } finally {
        await page.close()
      }
    })
  }
})
