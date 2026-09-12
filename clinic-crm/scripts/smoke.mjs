/**
 * End-to-end smoke test against a running dev server.
 * Usage: node scripts/smoke.mjs [baseUrl]
 */
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:3000'
const EMAIL = 'owner@salaclinic.com'
const PASSWORD = 'Password123!'

const results = []
let failures = 0

function isAppointmentUrl(url) {
  const path = new URL(url).pathname
  return /^\/calendar\/[a-z0-9]{12,}$/.test(path)
}

function check(name, passed, detail = '') {
  results.push(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!passed) failures += 1
}

// A far-future, run-unique day so repeated runs never collide with each other.
const testDate = new Date()
testDate.setDate(testDate.getDate() + 120 + Math.floor(Math.random() * 200))
const testDay = testDate.toISOString().slice(0, 10)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
const page = await context.newPage()

const consoleErrors = []
page.on('pageerror', (error) => consoleErrors.push(String(error)))

// --- sign in -----------------------------------------------------------------
await page.goto(`${base}/login`, { waitUntil: 'networkidle' })
await page.fill('input[name="email"]', EMAIL)
await page.fill('input[name="password"]', PASSWORD)
await Promise.all([
  page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 }),
  page.click('button[type="submit"]'),
])
check('sign in', !page.url().includes('/login'))

// --- every navigation target renders ----------------------------------------
const routes = [
  '/', '/calendar', '/clients', '/invoices', '/reports',
  '/inventory', '/inventory/products', '/inventory/consumption', '/inventory/movements',
  '/services', '/packages', '/marketing', '/messages', '/team', '/settings', '/audit',
]
for (const route of routes) {
  const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' })
  const status = response?.status() ?? 0
  const heading = await page.locator('h1').first().textContent().catch(() => null)
  check(`GET ${route}`, status < 400 && Boolean(heading), `status ${status}`)
}

// --- book an appointment -----------------------------------------------------
await page.goto(`${base}/calendar/new`, { waitUntil: 'networkidle' })
await page.click('ul li button')
await page.click('button:has-text("Brow Shaping & Tint")')
const staffSelect = page.locator('select#staffId')
const staffValue = await staffSelect.locator('option:not([value=""])').first().getAttribute('value')
await staffSelect.selectOption(staffValue)
await page.fill('input#time', '08:05')

await page.fill('input#date', testDay)

await page.click('button[type="submit"]:has-text("Book appointment")')
await page.waitForTimeout(2500)
const bookedUrl = page.url()
const bookingError = await page.locator('.text-danger').first().textContent().catch(() => '')
check(
  'booking created',
  isAppointmentUrl(bookedUrl),
  isAppointmentUrl(bookedUrl) ? bookedUrl.replace(base, '') : (bookingError?.trim() || bookedUrl.replace(base, '')),
)

// --- double booking is rejected ---------------------------------------------
if (isAppointmentUrl(bookedUrl)) {
  await page.goto(`${base}/calendar/new`, { waitUntil: 'networkidle' })
  await page.click('ul li button')
  await page.click('button:has-text("Brow Shaping & Tint")')
  await page.locator('select#staffId').selectOption(staffValue)
  await page.fill('input#time', '08:05')
  await page.fill('input#date', testDay)
  await page.click('button[type="submit"]:has-text("Book appointment")')
  await page.waitForTimeout(2500)
  const stillOnForm = page.url().includes('/calendar/new')
  const errorText = await page.locator('.text-danger').first().textContent().catch(() => '')
  check('double booking rejected', stillOnForm && /already has appointment/i.test(errorText ?? ''), errorText?.trim() ?? 'no error shown')
}

// --- status lifecycle --------------------------------------------------------
if (isAppointmentUrl(bookedUrl)) {
  await page.goto(bookedUrl, { waitUntil: 'networkidle' })
  await page.click('button:has-text("Mark confirmed")')
  await page.waitForTimeout(1500)
  const confirmed = await page.locator('text=Confirmed').first().isVisible().catch(() => false)
  check('status transition to confirmed', confirmed)
}

check('no uncaught page errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))

await browser.close()

console.log(results.join('\n'))
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
