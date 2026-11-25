import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const mode = process.argv[2] || 'start'
const extraArgs = process.argv.slice(3)

const cleanEnv = { ...process.env }
delete cleanEnv.ELECTRON_RUN_AS_NODE

let binPath
let binArgs

if (mode === 'dev') {
  binPath = process.execPath
  const cliJs = resolve('node_modules/electron-vite/bin/electron-vite.js')
  binArgs = [cliJs, 'dev', ...extraArgs]
} else {
  binPath = require('electron')
  binArgs = [resolve('out/main/index.js'), ...extraArgs]
}

const child = spawn(binPath, binArgs, {
  stdio: 'inherit',
  env: cleanEnv
})

child.on('exit', (code) => {
  process.exit(code === null ? 1 : code)
})
