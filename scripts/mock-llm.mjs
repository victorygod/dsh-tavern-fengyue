#!/usr/bin/env node
/**
 * Cross-platform mock LLM launcher (the canonical entry — the former
 * scripts/mock-llm.sh has been folded into this file; same env knobs:
 * PORT / SEED / WEIGHTS / LATENCY_MS / CHUNK_DELAY_MS / REASONING_GAP_MS /
 * SHOW_TOOLS / REASONING). Use this on Windows (no sh) or anywhere you prefer
 * a node entry over sh. Run in the foreground; Ctrl-C stops it.
 *
 *   node scripts/mock-llm.mjs [-- --latency-ms 200 --seed 42]
 *   node scripts/mock-llm.mjs stop          # unix: pkill; win32: netstat+taskkill
 */
import { spawn, spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BIN_TS = join(REPO_ROOT, 'packages', 'mock', 'src', 'bin.ts')
const PORT = process.env.PORT ?? '8000'

if (process.argv[2] === 'stop') {
  if (process.platform === 'win32') {
    // 按监听端口找 PID（netstat -ano 输出的 LISTENING 行），再 taskkill。
    const out = spawnSync('netstat', ['-ano'], { encoding: 'utf8', shell: true }).stdout ?? ''
    const pids = new Set()
    for (const line of out.split('\n')) {
      if (line.includes(`:${PORT} `) && line.includes('LISTENING')) {
        const pid = Number(line.trim().split(/\s+/).at(-1))
        if (Number.isSafeInteger(pid) && pid > 0) pids.add(pid)
      }
    }
    for (const pid of pids) {
      spawnSync('taskkill', ['/F', '/PID', String(pid)], { shell: true })
      console.log(`mock LLM (pid ${pid}) stopped (win32).`)
    }
    if (pids.size === 0) console.log('No running mock LLM found.')
  } else {
    const probe = spawnSync('pkill', ['-f', 'packages/mock/src/bin.ts'], { encoding: 'utf8' })
    console.log(probe.status === 0 ? 'Mock LLM servers stopped.' : 'No running mock LLM servers found.')
  }
  process.exit(0)
}

// 与 mock 服务端同款默认思考行（内容池由 packages/mock 自带）。
const REASON = [
  '（思考）环顾四周，掂量手里的线索，决定先开口还是先按兵不动。',
  '（思考）柜台后的影子动了动，也许值得一问。',
  '（思考）骰盅还在响，先看看谁的气最盛。',
]
const weights = process.env.WEIGHTS ?? 'success=93,slow_success=4,rate_limit=2,server_error=1'
const latency = process.env.LATENCY_MS ?? '1000-3000'
const chunkDelay = process.env.CHUNK_DELAY_MS ?? '40'
const reasoningGap = process.env.REASONING_GAP_MS ?? '800'
const reasoning = process.env.REASONING ?? REASON.join('\n')

const args = [
  '--import', 'tsx', BIN_TS,
  '--port', PORT,
  '--sequence', 'random', '--repeat-last',
  '--random-weights', weights,
  '--latency-ms', process.env.LATENCY_MS ?? latency,
  '--chunk-delay-ms', chunkDelay,
  '--reasoning-gap-ms', reasoningGap,
  '--reasoning-text', reasoning,
]
if (process.env.SEED !== undefined) args.push('--seed', String(process.env.SEED))
if (process.env.SHOW_TOOLS === '1') args.push('--show-tools')
args.push(...process.argv.slice(2).filter(arg => arg !== '--'))

console.log(`Mock LLM starting (node entry) — connect with:`)
console.log(`  DEEPSEEK_BASE_URL=http://127.0.0.1:${PORT}/v1 DEEPSEEK_API_KEY=sk-mock pnpm tavern`)
console.log(`  stop via: node scripts/mock-llm.mjs stop (or Ctrl-C)`)
const child = spawn(process.execPath, args, { cwd: REPO_ROOT, stdio: 'inherit' })
child.on('exit', code => process.exitCode = code ?? 0)
