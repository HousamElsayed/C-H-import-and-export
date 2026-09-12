import { chromium } from 'playwright'

const targets = process.argv.slice(2)
const dir = '/tmp/claude-0/-home-user-C-H-import-and-export/58f99081-d3cf-5e4c-bc6f-29a5cc666a9e/scratchpad'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const context = await browser.newContext({ viewport: { width: 1440, height: 980 } })
const page = await context.newPage()

const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
page.on('pageerror', (err) => errors.push(String(err)))

await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' })
await page.fill('input[name="email"]', 'owner@salaclinic.com')
await page.fill('input[name="password"]', 'Password123!')
await Promise.all([
  page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 }),
  page.click('button[type="submit"]'),
])

for (const target of targets.length ? targets : ['/']) {
  const name = target === '/' ? 'home' : target.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
  await page.goto(`http://localhost:3000${target}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true })
  const heading = await page.locator('h1').first().textContent().catch(() => null)
  console.log(`${target} -> ${name}.png | h1: ${heading?.trim() ?? '(none)'}`)
}

if (errors.length) {
  console.log('--- console errors ---')
  for (const error of [...new Set(errors)].slice(0, 15)) console.log(error)
}

await browser.close()
