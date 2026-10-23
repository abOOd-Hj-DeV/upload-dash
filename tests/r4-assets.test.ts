import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { asset } from '../src/assets'
import { remainingAssets } from '../src/remaining-assets'

const root = resolve(__dirname, '..')
const assetDir = join(root, 'public/assets')
const onDisk = readdirSync(assetDir)
const onDiskExact = new Set(onDisk)
const onDiskByLowercase = new Map(onDisk.map((file) => [file.toLowerCase(), file]))

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  )
const sources = [...walk(join(root, 'src')), join(root, 'index.html')]
  .filter((file) => /\.(tsx?|css|html)$/.test(file))
  .map((file) => ({ file: relative(root, file), text: readFileSync(file, 'utf8') }))
const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length

const IMAGE_TOKEN = /[\w./${}-]+\.(?:svg|png|jpe?g|webp|gif|ico|avif)\b/g
// Figma reference provenance (`file:` of a ReferenceFrame), not files served from public/assets.
const isReferenceFrame = (text: string, index: number) =>
  /file:\s*['"`]$/.test(text.slice(Math.max(0, index - 12), index))

type Reference = { name: string; where: string }
const literalReferences: Reference[] = []
const templateReferences: Reference[] = []
for (const { file, text } of sources) {
  for (const match of text.matchAll(IMAGE_TOKEN)) {
    if (isReferenceFrame(text, match.index)) continue
    const token = match[0]
    const where = `${file}:${lineOf(text, match.index)}`
    if (token.includes('${')) templateReferences.push({ name: token, where })
    else literalReferences.push({ name: token, where })
  }
}

// Candidate names only: skip operands of comparisons such as `item === 'Overview'`.
const quotedStrings = (expression: string) =>
  [...expression.matchAll(/(===|!==)?\s*(?:'([^']+)'|"([^"]+)")/g)]
    .filter((match) => !match[1])
    .map((match) => match[2] ?? match[3])

// Every `${...}` asset template must be expanded here so its runtime names are checked too.
const templateExpansions: Record<string, () => Reference[]> = {
  'preview-client-profile-${name}.svg': () => {
    const file = 'src/DemoClientProfile.tsx'
    const { text } = sources.find((source) => source.file === file)!
    return [...text.matchAll(/<PreviewIcon\s+name=(\{[^]*?\}|"[^"]*")\s*\/>/g)].flatMap((match) =>
      quotedStrings(match[1]).map((name) => ({
        name: `preview-client-profile-${name}.svg`,
        where: `${file}:${lineOf(text, match.index)}`,
      })),
    )
  },
}
const expandedReferences = templateReferences.flatMap(
  ({ name }) => templateExpansions[name]?.() ?? [],
)
const remainingReferences = Object.entries(remainingAssets).map(([key, name]) => ({
  name,
  where: `src/remaining-assets.ts:${key}`,
}))
const allReferences = [...literalReferences, ...expandedReferences, ...remainingReferences]

const resolveProblem = ({ name }: Reference) => {
  if (name.includes('/') && !name.startsWith('/assets/')) return 'not under /assets/'
  const base = name.split('/').pop()!
  if (onDiskExact.has(base)) return null
  const differentCase = onDiskByLowercase.get(base.toLowerCase())
  return differentCase ? `case mismatch: file is ${differentCase}` : 'missing in public/assets'
}

const unsafeName = (name: string) =>
  /[^A-Za-z0-9._-]/.test(name) ? 'unsafe characters' : name.length > 80 ? 'longer than 80' : null

describe('r4 asset integrity: every referenced asset resolves exactly (case-sensitive)', () => {
  it('finds the real reference surface (guards against a silently empty scan)', () => {
    expect(literalReferences.length).toBeGreaterThan(150)
    expect(sources.some(({ file }) => file.endsWith('.css'))).toBe(true)
    expect(literalReferences.some(({ where }) => where.startsWith('index.html'))).toBe(true)
    expect(expandedReferences.length).toBeGreaterThanOrEqual(15)
  })

  it('expands every templated asset name so dynamic icons are verified', () => {
    expect(templateReferences.filter(({ name }) => !templateExpansions[name])).toEqual([])
  })

  it('resolves every Icon/DesignIcon/asset()/data/CSS url()/favicon reference to an existing file', () => {
    const problems = allReferences
      .map((reference) => ({ ...reference, problem: resolveProblem(reference) }))
      .filter(({ problem }) => problem)
    expect(problems).toEqual([])
  })

  it('resolves every literal RemainingIcon/SettingRow/wallet metric key to remaining-assets', () => {
    const keyed = sources.flatMap(({ file, text }) =>
      [
        ...text.matchAll(/<RemainingIcon\s+name="([^"]+)"/g),
        ...text.matchAll(/\b(?:icon|chevron)="([^"]+)"/g),
        ...(/Wallet|wallet/.test(file) ? text.matchAll(/\bicon:\s*'([^']+)'/g) : []),
      ].map((match) => ({ key: match[1], where: `${file}:${lineOf(text, match.index)}` })),
    )
    expect(keyed.length).toBeGreaterThan(20)
    expect(keyed.filter(({ key }) => !(key in remainingAssets))).toEqual([])
  })

  it('builds asset URLs under /assets/ without rewriting the file name', () => {
    expect(asset('part3-verified.svg')).toBe('/assets/part3-verified.svg')
    expect(Object.values(remainingAssets).every((name) => !name.includes('/'))).toBe(true)
  })

  it('keeps referenced and shipped names portable for fresh Windows/macOS clones', () => {
    const names = [
      ...new Set([...onDisk, ...allReferences.map(({ name }) => name.split('/').pop()!)]),
    ]
    expect(names.map((name) => [name, unsafeName(name)]).filter(([, problem]) => problem)).toEqual(
      [],
    )
    const lowercase = onDisk.map((name) => name.toLowerCase())
    expect(lowercase.filter((name, index) => lowercase.indexOf(name) !== index)).toEqual([])
  })
})

const read = (name: string) => readFileSync(join(assetDir, name))
const signature = (bytes: Buffer) =>
  bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    ? 'png'
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      ? 'jpeg'
      : 'unknown'

// JPEG bytes shipped with a .png name: Vite and most hosts send `Content-Type: image/png`.
// The eight files formerly pinned here were re-encoded as real PNG during integration; keep this
// list empty so any new mislabeled file fails the test.
const KNOWN_JPEG_NAMED_PNG: string[] = []

describe('r4 asset integrity: files are valid and served with the right type', () => {
  it('ships only extensions with a correct image MIME mapping', () => {
    expect(onDisk.filter((name) => !['.svg', '.png'].includes(extname(name)))).toEqual([])
  })

  it('parses every SVG as standalone image/svg+xml with a size and no active/external content', () => {
    const problems = onDisk
      .filter((name) => name.endsWith('.svg'))
      .flatMap((name) => {
        const text = read(name).toString('utf8')
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
        const svg = doc.documentElement
        const issues = [
          doc.getElementsByTagName('parsererror').length && 'parse error',
          svg.localName !== 'svg' && `root <${svg.localName}>`,
          svg.namespaceURI !== 'http://www.w3.org/2000/svg' && 'missing SVG namespace',
          !svg.getAttribute('viewBox') &&
            !(svg.getAttribute('width') && svg.getAttribute('height')) &&
            'no viewBox/size',
          /<script|\bon[a-z]+\s*=|(?:xlink:)?href\s*=\s*["']\s*(?:https?:|\/\/)/i.test(text) &&
            'script or external reference',
        ].filter(Boolean)
        return issues.length ? [[name, issues]] : []
      })
    expect(problems).toEqual([])
  })

  it('stores real PNG bytes behind every .png name except the documented JPEG mislabels', () => {
    const pngs = onDisk.filter((name) => name.endsWith('.png'))
    const notPng = pngs.filter((name) => signature(read(name)) !== 'png')
    expect(notPng).toEqual(KNOWN_JPEG_NAMED_PNG)
    expect(notPng.every((name) => signature(read(name)) === 'jpeg')).toBe(true)
  })
})
