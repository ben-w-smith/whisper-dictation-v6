import { _electron as electron } from '@playwright/test'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = join(__dirname, '..', 'screenshots', 'current')

async function main() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true })

  const app = await electron.launch({
    args: [join(__dirname, '..')],
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: undefined,
    },
  })

  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  // Navigate to home view
  await window.evaluate(() => {
    window.location.hash = '#/home'
  })
  await window.waitForTimeout(500)

  // Screenshot the home view
  await window.screenshot({ path: join(SCREENSHOT_DIR, 'home-general.png') })

  // Navigate to each sub-page by clicking sidebar buttons
  const pages = ['Model', 'AI', 'History', 'About']
  for (const page of pages) {
    await window.click(`button:has-text("${page}")`)
    await window.waitForTimeout(300)
    await window.screenshot({ path: join(SCREENSHOT_DIR, `home-${page.toLowerCase()}.png`) })
  }

  await app.close()
  console.log(`Screenshots saved to ${SCREENSHOT_DIR}`)
}

main().catch((err) => {
  console.error('Screenshot capture failed:', err)
  process.exit(1)
})
