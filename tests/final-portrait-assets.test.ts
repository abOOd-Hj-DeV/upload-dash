import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { closurePortraitAssets } from '../src/closure-portrait-assets'

const { wallet, sessions } = closurePortraitAssets
const readAsset = (image: string) => readFileSync(resolve('public/assets', image))
const identity = (portrait: { image: string; crop?: string }) =>
  `${portrait.image}:${portrait.crop ?? ''}`

describe('final closure portrait artwork and integration manifest (not UI acceptance)', () => {
  it('keeps the five earnings identities distinct, including both Omar rows', () => {
    expect(wallet.earnings.map(({ target }) => [target.row, target.name, target.amount])).toEqual([
      [1, 'Sarah Ali', 300],
      [2, 'Ahmed Mohammed', 200],
      [3, 'Sarah Khalid', 100],
      [4, 'Omar Youssef', 200],
      [5, 'Omar Youssef', 400],
    ])
    expect(new Set(wallet.earnings.map(identity)).size).toBe(5)
    expect(wallet.earnings[0].source.kind).toBe('existing-asset')
    expect(
      wallet.earnings.slice(1).every(({ source }) => source.kind === 'original-avatar-crop'),
    ).toBe(true)
  })

  it('maps responsive ATM rows to the same five photos without changing the dates or amounts', () => {
    expect(wallet.responsiveWithdrawals.map(identity)).toEqual(wallet.earnings.map(identity))
    expect(wallet.responsiveWithdrawals.map(({ target }) => target.name)).toEqual(
      Array(5).fill('ATM Withdrawal'),
    )
    expect(wallet.responsiveWithdrawals.map(({ target }) => [target.date, target.amount])).toEqual(
      wallet.earnings.map(({ target }) => [target.date, target.amount]),
    )
  })

  it('ships only native 42x44 avatar crops with the original border/mask, never screen artwork', () => {
    const expectedHashes = [
      '90acb4f23415c66a05bc74f0bac843b14a45025099db6d6d5436bed302f7f649',
      'ae799f80c6624292a431707596f98c81d3a480b2b8ac82a1b952bc0741a0820f',
      '2019ddb0e4c352d052fafc9412089e464611be743455f79f9bb5a714478fb034',
      '4d1adfdef1d0d7ab7e45e4342da66a340c299f53fb3faebce92fd3251aa87f7c',
    ]
    const crops = wallet.earnings.slice(1)
    expect(crops).toHaveLength(4)
    crops.forEach((portrait, index) => {
      const bytes = readAsset(portrait.image)
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([42, 44])
      expect(bytes.byteLength).toBeLessThan(8000)
      const hash = createHash('sha256').update(bytes).digest('hex')
      expect(hash).toBe(expectedHashes[index])
      expect(portrait.source.sha256).toBe(hash)
      expect(portrait.artwork).toBe('masked-avatar')
      expect(portrait.crop).toBeUndefined()
      expect(portrait.source.rectangle).toEqual([306, [428, 478, 528, 578][index], 42, 44])
    })
    expect(wallet.cropRendering).toEqual({
      width: 42,
      height: 44,
      includesBorderAndMask: true,
      additionalBorder: 0,
    })
  })

  it('documents each independently compared responsive Wallet frame and native avatar location', () => {
    expect(wallet.equivalentOriginals.map(({ nodeId }) => nodeId)).toEqual([
      '1:21695',
      '1:18994',
      '1:19238',
      '1:20077',
      '1:20245',
    ])
    wallet.equivalentOriginals.forEach(({ x, y }) => {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(y).toHaveLength(5)
      expect(new Set(y).size).toBe(5)
    })
  })

  it('recovers all eleven visible desktop/tablet identities without duplicated last portraits', () => {
    expect(sessions.desktopTablet.map(({ image, crop }) => [image, crop])).toEqual([
      ['dashboard-imgContainer1.png', 'portrait'],
      ['dashboard-imgContainer2.png', 'portrait'],
      ['dashboard-imgContainer3.png', undefined],
      ['dashboard-imgContainer4.png', 'khaled'],
      ['dashboard-imgContainer4.png', 'jad'],
      ['part2-07-imgContainer5.png', undefined],
      ['part2-07-imgContainer6.png', undefined],
      ['part2-07-imgContainer7.png', undefined],
      ['part2-07-imgContainer8.png', undefined],
      ['part2-07-imgContainer9.png', undefined],
      ['part2-07-imgContainer10.png', undefined],
    ])
    expect(new Set(sessions.desktopTablet.map(identity)).size).toBe(11)
    expect(sessions.desktopTablet.map(({ target }) => target.sessionId)).toEqual(
      Array.from({ length: 11 }, (_, index) => `session-${index}`),
    )
    expect(sessions.desktopTablet.slice(9).map(({ target }) => target.name)).toEqual([
      'Noor Al-Khatib',
      'Noor Al-Khatib',
    ])
  })

  it('preserves the original phone-specific Marwan and Fahad instead of assuming desktop aliases', () => {
    expect(sessions.phone).toHaveLength(7)
    expect(sessions.phone.slice(0, 5).map(identity)).toEqual(
      sessions.desktopTablet.slice(0, 5).map(identity),
    )
    expect(sessions.phone.slice(5).map(identity)).toEqual([
      'dashboard-imgContainer5.png:',
      'dashboard-imgContainer6.png:fahad',
    ])
    expect(sessions.phone.slice(5).map(identity)).not.toEqual(
      sessions.desktopTablet.slice(5, 7).map(identity),
    )
    expect(sessions.phone.map(({ source }) => source.rectangle)).toEqual(
      [276, 371, 466, 557, 648, 739, 830].map((y) => [16, y, 42, 44]),
    )
  })

  it('references only available local photos and bounded source rectangles with target row provenance', () => {
    const portraits = [...wallet.earnings, ...sessions.desktopTablet, ...sessions.phone]
    portraits.forEach(({ image, artwork, target, source }) => {
      expect(image).not.toMatch(/https?:|\.\./)
      expect(readAsset(image).length).toBeGreaterThan(0)
      expect(target.row).toBeGreaterThan(0)
      expect(target.name).not.toBe('')
      expect(source.frame.file).toBe(`frame-${source.frame.nodeId.replace(':', '-')}.png`)
      const [x, y, width, height] = source.rectangle
      expect([width, height]).toEqual([42, 44])
      expect(x).toBeGreaterThanOrEqual(0)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(x + width).toBeLessThanOrEqual(source.frame.viewport[0])
      expect(y + height).toBeLessThanOrEqual(source.frame.viewport[1])
      if (source.kind === 'existing-asset') {
        expect(artwork).toBe('photo')
        expect(source.asset).toBe(image)
        expect(source.sha256).toBeUndefined()
      }
    })
  })
})
