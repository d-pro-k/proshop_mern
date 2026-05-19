import { test, expect, request as pwRequest } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Real admin login via /api/users/login → real Bearer token → localStorage userInfo.
// Mock token does not work — backend /api/feature-flags rejects invalid tokens
// and the table will render empty. Seed admin credentials assumed.
async function loginAdmin(page) {
  const apiContext = await pwRequest.newContext({ baseURL: 'http://localhost:3000' })
  const res = await apiContext.post('/api/users/login', {
    data: { email: 'admin@example.com', password: '123456' },
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok()) {
    throw new Error(`Admin login failed: ${res.status()} ${await res.text()}`)
  }
  const user = await res.json()
  if (!user.isAdmin) throw new Error('Logged-in user is not admin')

  // addInitScript runs before every page navigation in this test context.
  await page.addInitScript((u) => {
    window.localStorage.setItem('userInfo', JSON.stringify(u))
  }, user)
  await apiContext.dispose()
}

test('Dashboard renders and snapshot captured', async ({ page }) => {
  // Front-end must be running on http://localhost:3000 before this test.
  // Start with `npm run client` (or `npm run dev`) in a separate shell from repo root.

  await loginAdmin(page)
  await page.goto('/admin/feature-flags')

  // Wait for the table skeleton to be replaced by real data.
  // useFeatures hook has a ~500ms artificial latency; waitForSelector handles it.
  await page.waitForSelector('table tbody tr', { timeout: 5_000 })

  // Robust row check — verify the table rendered with at least one data row.
  // Avoids hardcoding feature count (features.json may grow/shrink).
  const firstRow = page.locator('table tbody tr').first()
  await expect(firstRow).toBeVisible()
  const rowCount = await page.locator('table tbody tr').count()
  expect(rowCount).toBeGreaterThan(0)

  // Snapshot current render.
  const currentPath = path.join(__dirname, 'current-dashboard.png')
  await page.screenshot({ path: currentPath, fullPage: false })
  console.log(`Screenshot saved: ${currentPath} (${rowCount} feature rows)`)
})
