import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../../..')
const source = readFileSync(join(root, 'icon.png'))

describe('application icon assets', () => {
  it('uses the repository icon as the shell and docs app artwork', () => {
    for (const path of [
      'apps/shell/build/icon.png',
      'apps/shell/src/renderer/src/assets/app-icon.png',
      'apps/docs/build/icon.png',
      'apps/docs/src/renderer/assets/app-icon.png',
    ]) {
      expect(readFileSync(join(root, path)), path).toEqual(source)
    }

    const macIcon = readFileSync(join(root, 'apps/shell/build/icon-mac.png'))
    expect(macIcon.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    expect(macIcon.readUInt32BE(16), 'macOS icon width').toBe(1024)
    expect(macIcon.readUInt32BE(20), 'macOS icon height').toBe(1024)
  })

  it('ships every Linux icon size derived from the source artwork', () => {
    for (const size of [16, 32, 48, 64, 128, 256, 512, 1024]) {
      const path = join(root, `apps/shell/build/icons/${size}x${size}.png`)
      const png = readFileSync(path)
      expect(statSync(path).size, `${size}x${size}`).toBeGreaterThan(0)
      expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      expect(png.readUInt32BE(16), `${size}x${size} width`).toBe(size)
      expect(png.readUInt32BE(20), `${size}x${size} height`).toBe(size)
    }
  })

  it('includes valid multi-size Windows and macOS application icons', () => {
    const ico = readFileSync(join(root, 'apps/shell/build/icon.ico'))
    expect(ico.readUInt16LE(0)).toBe(0)
    expect(ico.readUInt16LE(2)).toBe(1)
    expect(ico.readUInt16LE(4)).toBeGreaterThan(1)

    const icns = readFileSync(join(root, 'apps/shell/build/icon.icns'))
    expect(icns.toString('ascii', 0, 4)).toBe('icns')
    expect(icns.readUInt32BE(4)).toBe(icns.length)
  })
})
