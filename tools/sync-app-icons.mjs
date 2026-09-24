import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = join(root, 'icon.png')
const source = readFileSync(sourcePath)
const sourceImage = await loadImage(source)

if (sourceImage.width !== sourceImage.height) {
  throw new Error(`Application icon must be square, got ${sourceImage.width}x${sourceImage.height}`)
}

const shellBuild = join(root, 'apps/shell/build')
const rendererIcons = [
  'apps/shell/src/renderer/src/assets/app-icon.png',
  'apps/docs/build/icon.png',
  'apps/docs/src/renderer/assets/app-icon.png',
]
for (const relative of rendererIcons) {
  const target = join(root, relative)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, source)
}
writeFileSync(join(shellBuild, 'icon.png'), source)

const canvas = createCanvas(sourceImage.width, sourceImage.height)
const context = canvas.getContext('2d')
context.drawImage(sourceImage, 0, 0)

function renderPng(size, insetRatio = 1) {
  const output = createCanvas(size, size)
  const ctx = output.getContext('2d')
  const inset = (size * (1 - insetRatio)) / 2
  ctx.drawImage(sourceImage, inset, inset, size - inset * 2, size - inset * 2)
  return output.toBuffer('image/png')
}

const iconsetSizes = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
]
const iconset = join(shellBuild, 'icon.iconset')
mkdirSync(iconset, { recursive: true })
for (const [name, size] of iconsetSizes) {
  writeFileSync(join(iconset, name), renderPng(size, 824 / 1024))
}
writeFileSync(join(shellBuild, 'icon-mac.png'), renderPng(1024, 824 / 1024))

if (process.platform === 'darwin') {
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(shellBuild, 'icon.icns')], {
    stdio: 'inherit',
  })
}

const linuxSizes = [16, 32, 48, 64, 128, 256, 512, 1024]
const linuxDir = join(shellBuild, 'icons')
mkdirSync(linuxDir, { recursive: true })
for (const size of linuxSizes) {
  writeFileSync(join(linuxDir, `${size}x${size}.png`), renderPng(size))
}

const winSizes = [16, 24, 32, 48, 64, 128, 256]
const pngEntries = winSizes.map((size) => ({ size, png: renderPng(size) }))
const header = Buffer.alloc(6)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(pngEntries.length, 4)
const directory = Buffer.alloc(16 * pngEntries.length)
let offset = header.length + directory.length
for (const [index, entry] of pngEntries.entries()) {
  const start = index * 16
  directory.writeUInt8(entry.size === 256 ? 0 : entry.size, start)
  directory.writeUInt8(entry.size === 256 ? 0 : entry.size, start + 1)
  directory.writeUInt16LE(1, start + 4)
  directory.writeUInt16LE(32, start + 6)
  directory.writeUInt32LE(entry.png.length, start + 8)
  directory.writeUInt32LE(offset, start + 12)
  offset += entry.png.length
}
writeFileSync(
  join(shellBuild, 'icon.ico'),
  Buffer.concat([header, directory, ...pngEntries.map(({ png }) => png)]),
)

console.log('Synchronized shell and docs application icons from icon.png')
