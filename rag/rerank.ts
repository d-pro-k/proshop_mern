import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// __dirname-relative so the script works regardless of cwd (root or rag/)
const PYTHON_BIN =
  process.platform === 'win32'
    ? path.join(__dirname, '.venv', 'Scripts', 'python.exe')
    : path.join(__dirname, '.venv', 'bin', 'python')
const RERANK_SCRIPT = path.join(__dirname, 'rerank.py')

export const rerank = (
  query: string,
  candidates: { id: string; text: string }[],
): Promise<{ id: string; score: number }[]> =>
  new Promise((resolve, reject) => {
    const py = spawn(PYTHON_BIN, [RERANK_SCRIPT])
    let out = ''
    let err = ''
    py.stdout.on('data', (d: Buffer) => (out += d))
    py.stderr.on('data', (d: Buffer) => (err += d))
    py.on('close', (code: number | null) => {
      if (code !== 0) reject(new Error(`rerank.py exit ${code}: ${err}`))
      else resolve(JSON.parse(out) as { id: string; score: number }[])
    })
    py.stdin.end(JSON.stringify({ query, candidates }))
  })
