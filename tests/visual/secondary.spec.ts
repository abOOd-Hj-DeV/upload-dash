import { expect, test } from '@playwright/test'

const variants = [
  { name: 'chats', route: '/chats', height: 817 },
  { name: 'empty-chats', route: '/chats?state=empty', height: 817 },
  { name: 'offline-chats', route: '/chats?state=offline', height: 817 },
  { name: 'sessions', route: '/sessions', height: 900 },
  { name: 'schedule', route: '/sessions?state=schedule', height: 900 },
  { name: 'before-session', route: '/sessions/upcoming', height: 932 },
  { name: 'session-record', route: '/sessions/upcoming?state=record', height: 1210 },
  { name: 'create-homework', route: '/sessions/upcoming?state=create', height: 1210 },
  { name: 'homework-library', route: '/sessions/upcoming?state=library', height: 1210 },
  { name: 'session-actions', route: '/sessions/upcoming?state=actions', height: 932 },
]
for (const width of [1440, 770, 370]) {
  for (const variant of variants) {
    test(`part 2 ${variant.name} at ${width}px`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      const height =
        width === 370
          ? variant.name.includes('chats')
            ? 876
            : variant.name === 'before-session' || variant.name === 'session-actions'
              ? 1534
              : variant.height === 1210
                ? 1801
                : 900
          : width === 770 && !variant.name.includes('chats')
            ? 1166
            : variant.height
      await page.setViewportSize({ width, height })
      await page.goto(variant.route)
      await page.evaluate(() => document.fonts.ready)
      await expect(page.locator('.secondary-main')).toBeVisible()
      if (['schedule', 'create-homework', 'homework-library'].includes(variant.name))
        await expect(page.getByRole('dialog')).toBeVisible()
      await expect
        .poll(() =>
          page
            .locator('img')
            .evaluateAll((images) =>
              images.every(
                (img) =>
                  (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
              ),
            ),
        )
        .toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      expect(errors).toEqual([])
      await expect(page).toHaveScreenshot(`part2-${variant.name}-${width}.png`, {
        fullPage: !['schedule', 'create-homework', 'homework-library'].includes(variant.name),
        animations: 'disabled',
      })
      if (width === 370 && variant.name === 'session-record') {
        await page.getByRole('button', { name: 'Session actions' }).click()
        await expect(page).toHaveScreenshot('part2-record-actions-phone.png', { fullPage: true })
      }
    })
  }
}

test('part 2 expanded navigation over phone session preparation', async ({ page }) => {
  await page.setViewportSize({ width: 370, height: 1534 })
  await page.goto('/sessions/upcoming?state=expanded')
  await page.evaluate(() => document.fonts.ready)
  await expect(page.getByRole('complementary', { name: 'Main navigation' })).toBeVisible()
  await expect(page.locator('.profile-copy')).toHaveCSS('display', 'flex')
  await expect(page).toHaveScreenshot('part2-expanded-before-session-phone.png', {
    fullPage: false,
  })
  await page.getByRole('button', { name: 'Close navigation', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Client Overview' })).toBeVisible()
})

test('part 2 phone chat thread, replies, and bottom navigation', async ({ page }) => {
  await page.setViewportSize({ width: 370, height: 876 })
  await page.goto('/chats?state=thread')
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot('part2-chat-thread-phone.png', { fullPage: true })
  await page.getByLabel('Message', { exact: true }).fill('Practice five minutes daily')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByRole('region', { name: /Conversation with Sara/ })).toContainText(
    'Practice five minutes daily',
  )
  await page.getByRole('button', { name: 'Back to conversations' }).click()
  await expect(page.locator('.chat-list')).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('button', { name: 'Sessions', exact: true })
    .click()
  await expect(page).toHaveURL('/sessions')
})
test('part 2 new pages survive 320px widths', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  for (const route of [
    '/chats',
    '/chats?state=thread',
    '/chats?state=offline',
    '/sessions',
    '/sessions?state=schedule',
    '/sessions/upcoming',
    '/sessions/upcoming?state=record',
    '/sessions/upcoming?state=create',
    '/sessions/upcoming?state=library',
  ]) {
    await page.goto(route)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      route,
    ).toBe(true)
    if (await page.getByRole('dialog').count())
      expect(
        await page
          .getByRole('dialog')
          .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
        route,
      ).toBe(true)
  }
})
test('part 2 schedules then opens patient detail without auth fallback', async ({ page }) => {
  await page.goto('/sessions')
  await page.getByRole('button', { name: 'Schedule New' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Patient', { exact: true }).selectOption('Mark lory')
  await dialog.getByLabel('Time', { exact: true }).selectOption('10:00')
  await dialog.getByLabel('Dated', { exact: true }).fill('2026-10-20')
  await dialog.getByLabel('Duration', { exact: true }).selectOption('45 minutes')
  await dialog.getByRole('button', { name: 'Schedule', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'All (17)' })).toBeVisible()
  await page.getByRole('button', { name: /Mark lory Private Session/ }).click()
  await expect(page.getByRole('heading', { name: 'Mark lory', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/sessions\/upcoming\?patient=/)
})
test('part 2 homework controls, focus trap, escape and focus restoration', async ({ page }) => {
  await page.setViewportSize({ width: 370, height: 900 })
  await page.goto('/sessions/upcoming?state=record')
  await page.getByRole('button', { name: '+ Add New Homework' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Homework title').fill('Stress diary')
  await dialog.getByLabel('Instructions for the client').fill('Write one entry daily')
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('button', { name: '+ Add New Homework' })).toBeFocused()
  await page.getByRole('button', { name: '+ Add New Homework' }).click()
  await dialog.getByRole('tab', { name: 'From the library' }).click()
  await dialog.getByRole('button', { name: 'Audio', exact: true }).click()
  await dialog.getByRole('button', { name: 'Add Muscle relaxation exercises' }).click()
  await expect(
    dialog.getByRole('button', { name: 'Added Muscle relaxation exercises' }),
  ).toBeDisabled()
  await dialog.getByRole('button', { name: 'Close dialog' }).click()
  await expect(page.getByText('Muscle relaxation exercises', { exact: true })).toBeVisible()
})
test('part 2 phone navigation drawer and notifications', async ({ page }) => {
  await page.setViewportSize({ width: 370, height: 900 })
  await page.goto('/sessions')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.locator('.sidebar')).toBeVisible()
  await expect(page).toHaveScreenshot('part2-expanded-navigation-phone.png', { fullPage: true })
  await page.keyboard.press('Escape')
  await expect(page.locator('.sidebar')).not.toBeVisible()
  await page.getByRole('button', { name: 'Notifications', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Notifications' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('region', { name: 'Notifications' })).not.toBeVisible()
})
test('part 2 collapsed sidebar preserves the chat layout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 817 })
  await page.goto('/chats?state=collapsed')
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('.sidebar')).toHaveCSS('width', '80px')
  await expect(page).toHaveScreenshot('part2-collapsed-chats.png', { fullPage: true })
})
test('part 2 browser online/offline events disable outgoing messages', async ({ page }) => {
  await page.goto('/chats')
  await page.getByLabel('Message', { exact: true }).fill('Not sent while offline')
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    window.dispatchEvent(new Event('offline'))
  })
  await expect(page.getByRole('status')).toContainText("You're offline")
  await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled()
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    window.dispatchEvent(new Event('online'))
  })
  await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled()
})
