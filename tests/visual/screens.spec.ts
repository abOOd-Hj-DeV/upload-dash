import { expect, test } from '@playwright/test'

const sizes = [
  { name: 'desktop', width: 1440, height: 1024 },
  { name: 'tablet', width: 770, height: 1024 },
  { name: 'phone', width: 370, height: 1024 },
]

for (const size of sizes) {
  for (const route of ['login', 'signup', 'verify']) {
    test(`${route} — ${size.name}`, async ({ page }) => {
      await page.setViewportSize(size)
      await page.goto(`/${route}`)
      await page.evaluate(() => document.fonts.ready)
      await expect(page.locator('h1')).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true)
      await expect(page).toHaveScreenshot(`${route}-${size.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      })
    })
  }
}

const dashboards = [
  { name: 'desktop', width: 1440, height: 950 },
  { name: 'tablet', width: 740, height: 1070 },
  { name: 'phone', width: 370, height: 1911 },
]
for (const size of dashboards) {
  for (const state of ['default', 'search', 'notifications', 'offline', 'meeting']) {
    test(`dashboard ${state} — ${size.name}`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.setViewportSize(size)
      await page.goto(`/dashboard${state === 'default' ? '' : `?state=${state}`}`)
      await page.evaluate(() => document.fonts.ready)
      if (state === 'search' && size.name === 'phone')
        await expect(page.getByLabel('Search patients')).toBeVisible()
      if (state === 'notifications')
        await expect(page.getByRole('region', { name: 'Notifications' })).toBeVisible()
      if (state === 'meeting') await expect(page.getByRole('dialog')).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true)
      expect(
        await page
          .locator('img')
          .evaluateAll((images) =>
            images.every(
              (img) =>
                (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      ).toBe(true)
      expect(errors).toEqual([])
      await expect(page).toHaveScreenshot(`dashboard-${state}-${size.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      })
    })
  }
}

test('collapsed desktop navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 })
  await page.goto('/dashboard?state=collapsed')
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('.sidebar')).toHaveCSS('width', '80px')
  await expect(page).toHaveScreenshot('dashboard-collapsed.png', { fullPage: true })
})

test('expanded phone navigation', async ({ page }) => {
  await page.setViewportSize({ width: 370, height: 1024 })
  await page.goto('/dashboard?state=expanded')
  await page.evaluate(() => document.fonts.ready)
  await expect(page.getByRole('complementary', { name: 'Main navigation' })).toBeVisible()
  await expect(page).toHaveScreenshot('dashboard-expanded-phone.png', { fullPage: true })
})

test('keyboard focus remains in the meeting dialog and restores on escape', async ({ page }) => {
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Start session' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Start session' })).toBeFocused()
})

test('mobile flow opens navigation, search, notifications and a meeting', async ({ page }) => {
  await page.setViewportSize({ width: 370, height: 800 })
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.locator('.sidebar')).toBeVisible()
  await page
    .getByRole('button', { name: 'Close navigation' })
    .click({ position: { x: 320, y: 400 } })
  await expect(page.locator('.sidebar')).not.toBeVisible()
  await page.getByRole('button', { name: 'Open search' }).click()
  await page.getByLabel('Search patients').fill('Fa')
  await expect(page.getByLabel('Search results').getByText('Fatima', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Notifications', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Notifications' })).toBeVisible()
  await page.getByRole('button', { name: 'Close notifications' }).click()
  await page.getByRole('button', { name: 'Start session' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('minimum 320px screen does not overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  for (const route of ['/login', '/signup', '/verify', '/dashboard']) {
    await page.goto(route)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  }
})
