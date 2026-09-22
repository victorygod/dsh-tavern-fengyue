#!/usr/bin/env node
/**
 * Cross-platform cleanup for tavern fengyue dev loops (the canonical entry —
 * the former scripts/cleanup.sh has been folded into this file):
 *
 *   node scripts/cleanup.mjs            # or: pnpm cleanup
 *
 * Frees ports 3080 (host web) and 8000 (mock), kills this repo's stray host
 * / mock processes, and removes stale pid files. Foreign processes holding
 * the ports are killed by PORT ownership only.
 */
import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

const PORTS = ['3080', '8000']
const PID_DIR = join(process.env.DSH_HOME ?? join(process.env.HOME ?? '', '.dsh-tavern-fengyue'), 'logs')

const pidsForPortWin = port => {
  const out = spawnSync('netstat', ['-ano'], { encoding: 'utf8', shell: true }).stdout ?? ''
  const pids = new Set()
  for (const line of out.split('\n')) {
    if (line.includes(`:${port} `) && line.includes('LISTENING')) {
      const pid = Number(line.trim().split(/\s+/).at(-1))
      if (Number.isSafeInteger(pid) && pid > 0) pids.add(pid)
    }
  }
  return [...pids]
}
// lsof -t：纯 PID 列表（无表头）。旧实现按 split 列序抠 PID：[0] 是 COMMAND
// （'node'→NaN 全滤掉，端口路径从没杀对过），而输出末尾的空行又解析成 pid 0 ——
// process.kill(0) 是「杀自己整个进程组」，脚本在第一步就把自己干掉了。
const pidsForPortUnix = port => {
  const out = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' }).stdout ?? ''
  return out.split('\n').map(l => Number(l)).filter(pid => Number.isSafeInteger(pid) && pid > 0)
}

// 卫语句守住 pid 0/负数：kill(0) 杀进程组、kill(-1) 杀全用户，都绝不是清理想做的。
const kill = pid => {
  if (!Number.isSafeInteger(pid) || pid <= 0) return
  try { process.kill(pid, 'SIGTERM') } catch { return }
}

for (const port of PORTS) {
  const pids = process.platform === 'win32' ? pidsForPortWin(port) : pidsForPortUnix(port)
  for (const pid of pids) {
    console.log(`terminate port ${port} pid ${pid}`)
    kill(pid)
  }
}

// 进程表里属本仓的宿主/链（跨平台：win 用 PowerShell 按命令行签名杀；unix 用 pkill）。
const SIGNATURES = [
  'dsh-tavern-fengyue/node_modules/@deepseek-ai/dsh/lib/bin.js',
  'pnpm dsh tavern',
  'packages/mock/src/bin.ts',
  'test-support/llm-mock-server/src/bin.ts',
]
if (process.platform === 'win32') {
  for (const signature of SIGNATURES) {
    const safe = signature.replaceAll("'", "''")
    spawnSync('powershell', ['-NoProfile', '-Command',
      `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${safe}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`],
      { shell: true })
  }
} else {
  for (const signature of SIGNATURES) spawnSync('pkill', ['-f', signature])
}

for (const name of ['tavern-fengyue', 'tavern-fengyue.mock']) {
  rmSync(join(PID_DIR, `${name}.pid`), { force: true })
}

const remaining = PORTS.map(port => {
  const busy = (process.platform === 'win32' ? pidsForPortWin(port) : pidsForPortUnix(port)).length
  return `${port}:${busy}`
})
console.log(`清理完成：端口占用 ${remaining.join(' / ')}`)
