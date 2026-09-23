#!/usr/bin/env node
// Packages the genoffice CLI (packages/cli) into a self-contained tar.gz for
// GitHub Releases. The tar mirrors the packaged app's Resources/ layout so
// src/resources.ts finds the runtime assets without code changes:
//
//   mutantcatoffice-cli-<version>-<arch>.tar.gz
//   ├── cli/{genoffice,genoffice.cmd,genoffice.cjs,package.json,node_modules,skills}
//   ├── wasm/{pdfium.wasm,hb-subset.wasm}
//   └── native/xlsx-sidecar
//
// The xlsx-sidecar must already be built for this host/arch
// (npm run native:build -w @genoffice/sheets); the script fails loudly when it
// is missing so the tar never ships dead workbook support.
//
// Usage: node scripts/package-cli.mjs [x64|arm64]

import { execFileSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const cliDir = join(root, 'packages/cli')
const pkg = JSON.parse(readFileSync(join(cliDir, 'package.json'), 'utf8'))
const arch = process.argv[2] ?? (process.arch === 'arm64' ? 'arm64' : 'x64')
const version = pkg.version

function fatal(message) {
  console.error(`[package-cli] ERROR: ${message}`)
  process.exit(1)
}

console.log(`[package-cli] building genoffice CLI ${version} (${arch})`)
execFileSync('npm', ['run', 'build', '-w', '@genoffice/cli'], { cwd: root, stdio: 'inherit' })

const pdfiumWasm = join(root, 'node_modules/@embedpdf/pdfium/dist/pdfium.wasm')
const hbSubsetWasm = join(root, 'apps/pdf/node_modules/harfbuzzjs/hb-subset.wasm')
const sidecar = join(root, 'apps/sheets/native/xlsx-engine/target/release/xlsx-sidecar')
for (const [label, file] of [
  ['pdfium.wasm', pdfiumWasm],
  ['hb-subset.wasm', hbSubsetWasm],
  ['xlsx-sidecar', sidecar],
]) {
  if (!existsSync(file)) fatal(`${label} missing at ${file} (npm ci / native:build first)`)
}

const outDir = join(root, 'release')
const stage = join(outDir, `.cli-stage-${arch}`)
rmSync(stage, { recursive: true, force: true })
mkdirSync(stage, { recursive: true })
mkdirSync(join(stage, 'cli'), { recursive: true })
mkdirSync(join(stage, 'wasm'), { recursive: true })
mkdirSync(join(stage, 'native'), { recursive: true })

const cliStage = join(stage, 'cli')
cpSync(join(cliDir, 'bin/genoffice'), join(cliStage, 'genoffice'))
chmodSync(join(cliStage, 'genoffice'), 0o755)
cpSync(join(cliDir, 'bin/genoffice.cmd'), join(cliStage, 'genoffice.cmd'))
cpSync(join(cliDir, 'dist/genoffice.cjs'), join(cliStage, 'genoffice.cjs'))
cpSync(join(cliDir, 'dist/node_modules'), join(cliStage, 'node_modules'), { recursive: true })
cpSync(join(cliDir, 'package.json'), join(cliStage, 'package.json'))
cpSync(join(root, 'skills/genoffice'), join(cliStage, 'skills/genoffice'), { recursive: true })
cpSync(pdfiumWasm, join(stage, 'wasm/pdfium.wasm'))
cpSync(hbSubsetWasm, join(stage, 'wasm/hb-subset.wasm'))
cpSync(sidecar, join(stage, 'native/xlsx-sidecar'))
chmodSync(join(stage, 'native/xlsx-sidecar'), 0o755)

const artifact = join(outDir, `mutantcatoffice-cli-${version}-${arch}.tar.gz`)
execFileSync('tar', ['-czf', artifact, '-C', stage, '.'], { stdio: 'inherit' })
rmSync(stage, { recursive: true, force: true })
console.log(`[package-cli] ${artifact}`)
