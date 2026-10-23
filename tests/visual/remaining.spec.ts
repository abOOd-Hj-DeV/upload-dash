import { expect, test } from '@playwright/test'

const sizes = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 770, height: 1120 },
  { name: 'phone', width: 370, height: 900 },
]
const screens = [
  ['profile', '/profile'],
  ['settings', '/profile/settings'],
  ['help', '/profile/help'],
  ['wallet', '/wallet'],
  ['earnings', '/wallet?state=earnings'],
  ['withdrawals', '/wallet?state=withdrawals'],
  ['edit', '/profile/settings?state=edit'],
  ['password', '/profile/settings?state=password'],
  ['preferences', '/profile/settings?state=preferences'],
  ['hours', '/profile/settings?state=hours'],
  ['holidays', '/profile/settings?state=holidays'],
  ['logout', '/profile/settings?state=logout'],
  ['faq', '/profile/help?state=faq'],
  ['contact', '/profile/help?state=contact'],
  ['shamcash', '/wallet?state=shamcash'],
  ['haram', '/wallet?state=haram'],
] as const

for (const size of sizes) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } })
    for (const [name, route] of screens) {
      test(`${name} renders without missing assets and matches the reviewed baseline`, async ({
        page,
      }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        page.on('response', (response) => {
          if (response.url().includes('/assets/') && !response.ok()) errors.push(response.url())
        })
        await page.goto(route)
        await page.evaluate(() => document.fonts.ready)
        await expect(
          page.getByRole('heading', {
            name:
              name === 'wallet' ||
              name === 'earnings' ||
              name === 'withdrawals' ||
              name === 'shamcash' ||
              name === 'haram'
                ? size.name === 'phone'
                  ? 'Wallet'
                  : 'Dashboard'
                : 'Profile',
            exact: true,
          }),
        ).toBeVisible()
        const modal = ![
          'profile',
          'settings',
          'help',
          'wallet',
          'earnings',
          'withdrawals',
        ].includes(name)
        if (modal) await expect(page.getByRole('dialog')).toBeVisible()
        await expect
          .poll(async () =>
            page
              .locator('img')
              .evaluateAll(
                (images) =>
                  images.filter(
                    (image) =>
                      !(image as HTMLImageElement).complete ||
                      !(image as HTMLImageElement).naturalWidth,
                  ).length,
              ),
          )
          .toBe(0)
        expect(errors).toEqual([])
        await expect(page).toHaveScreenshot(`remaining-${name}-${size.name}.png`, {
          fullPage: !modal,
          animations: 'disabled',
        })
      })
    }
  })
}

test('all new screens and dialogs fit a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  for (const [, route] of screens) {
    await page.goto(route)
    await page.evaluate(() => document.fonts.ready)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
    const modal = page.getByRole('dialog')
    if (await modal.count()) {
      await expect(modal).toBeVisible()
      const bounds = await modal.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320)
      expect(
        await modal.evaluate((node) => node.scrollWidth - node.clientWidth),
      ).toBeLessThanOrEqual(1)
    }
  }
})

test('profile dialog traps and restores focus, and cancels on Escape', async ({ page }) => {
  await page.goto('/profile')
  const trigger = page.getByRole('button', { name: 'Edit Profile', exact: true })
  await trigger.click()
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()
  await modal.getByRole('button', { name: 'Close dialog' }).focus()
  await page.keyboard.press('Shift+Tab')
  await expect(modal.getByRole('button', { name: 'Save Changes' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(modal.getByRole('button', { name: 'Close dialog' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(modal).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('profile, settings, support and wallet navigation integrates with previous routes', async ({
  page,
}) => {
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Open profile' }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Manage Working Hours', exact: false }).click()
  await page.getByRole('checkbox', { name: 'Saturday', exact: true }).uncheck()
  await page.getByRole('button', { name: 'Save Preferences' }).click()
  await expect(page.getByRole('button', { name: /Manage Working Hours/ })).toContainText('5 days')
  await page.getByRole('button', { name: 'Help', exact: true }).click()
  await page.getByRole('button', { name: /FAQs/ }).click()
  await page.getByText('How are my earnings calculated?').click()
  await expect(page.getByText(/Demo guidance: the Wallet/)).toBeVisible()
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page
    .getByRole('complementary', { name: 'Main navigation' })
    .getByRole('button', { name: 'Wallet', exact: true })
    .click()
  await expect(page).toHaveURL(/\/wallet$/)
  await page.getByRole('button', { name: 'Withdrawals', exact: true }).click()
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click()
  await page.getByLabel('Select payment method').selectOption('shamcash')
  await page.getByLabel('Withdrawal amount').fill('750')
  await page.getByLabel('Shamcash Code').fill('demo-only')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('no money was moved')
})

test('offline events and expanded phone navigation remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 370, height: 900 })
  await page.goto('/profile/settings')
  await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible()
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    window.dispatchEvent(new Event('offline'))
  })
  await expect(page.getByRole('status')).toContainText("You're offline")
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
    window.dispatchEvent(new Event('online'))
  })
  await expect(page.getByText(/You're offline/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page
    .getByRole('complementary', { name: 'Main navigation' })
    .getByRole('button', { name: 'Wallet', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: 'Wallet', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'View withdrawals' }).click()
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})
