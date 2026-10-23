import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const visualOwners = {
  'src/visual-auth-shell.css': 'src/ui.tsx',
  'src/visual-dashboard-clients.css': 'src/Dashboard.tsx',
  'src/visual-sessions-clinical.css': 'src/api-sessions-and-clinical-support.tsx',
  'src/visual-chats.css': 'src/Chats.tsx',
  'src/visual-profile-wallet.css': 'src/RemainingUI.tsx',
}

// Inspect local module wiring without rendering the app, starting a server or
// claiming that source order establishes computed layout or Figma parity.
function stylesheetImports() {
  const visited = new Set<string>()
  const styles: { file: string; owner: string }[] = []
  function visit(file: string) {
    if (visited.has(file)) return
    visited.add(file)
    const { importedFiles } = ts.preProcessFile(readFileSync(file, 'utf8'), true)
    for (const { fileName } of importedFiles) {
      if (!fileName.startsWith('.')) continue
      const dependency = resolve(dirname(file), fileName)
      if (dependency.endsWith('.css')) {
        styles.push({ file: relative(root, dependency), owner: relative(root, file) })
      } else {
        const source = [dependency, `${dependency}.tsx`, `${dependency}.ts`].find(existsSync)
        if (source && /\.tsx?$/.test(source)) visit(source)
      }
    }
  }
  visit(resolve(root, 'src/main.tsx'))
  return styles
}

describe('visual stylesheet integration (source-level only)', () => {
  it('loads shared base styles before component-owned repairs', () => {
    const styles = stylesheetImports().map(({ file }) => file)
    expect(styles.slice(0, 3)).toEqual(['src/styles.css', 'src/secondary.css', 'src/remaining.css'])
    for (const file of Object.keys(visualOwners)) {
      expect(styles.indexOf(file)).toBeGreaterThan(styles.indexOf('src/remaining.css'))
    }
  })

  it('reaches each domain stylesheet through exactly one owned import', () => {
    const styles = stylesheetImports()
    for (const [file, owner] of Object.entries(visualOwners)) {
      expect(styles.filter((entry) => entry.file === file)).toEqual([{ file, owner }])
    }
  })
})
