// dnd5e inject_location 注入器钉(2026-10-04):state.md「## 地点」地点ID → world.md「## 地点编号」映射表
// → locations/<file> 全文注入。无卡旅行段(地点ID 空/未匹配)=零输出。cwd=runtime,跨区读 ../preset/setup/。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

function rig(stateMd: string) {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-inject-'))
  const cwd = join(base, 'runtime')
  mkdirSync(cwd, { recursive: true })
  cpSync(join(CARD, 'setup'), join(base, 'preset', 'setup'), { recursive: true })
  writeFileSync(join(cwd, 'state.md'), stateMd)
  return { cwd, base }
}
function run(cwd: string) {
  const r = spawnSync(process.execPath, [join(CARD, 'scripts', 'inject_location.mjs')], { cwd, encoding: 'utf8' })
  return { status: r.status ?? 0, stdout: r.stdout, stderr: r.stderr }
}

describe('dnd5e inject_location 地点注入(ID→world.md「地点编号」映射→locations 全文)', () => {
  it('L01 → 注入凡戴尔镇地点卡(朗读文本+底牌全文)', () => {
    const { cwd, base } = rig('# 世界状态\n\n## 地点\n- 地点ID：L01\n- 地点名：凡戴尔镇\n')
    const r = run(cwd)
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('【当前地点卡】L01 凡戴尔镇')
    expect(r.stdout).toContain('## 朗读文本')
    expect(r.stdout).toContain('北口商路拐过最后一个山坳')
    expect(r.stdout).toContain('## 底牌')
    rmSync(base, { recursive: true, force: true })
  })

  it('空 ID(旅行段)/未匹配 ID/缺地点节 = 零输出', () => {
    const travel = rig('# 世界状态\n\n## 地点\n- 地点ID：\n- 地点名：凡戴尔镇外\n')
    expect(run(travel.cwd).stdout).toBe('')
    rmSync(travel.base, { recursive: true, force: true })

    const unknown = rig('# 世界状态\n\n## 地点\n- 地点ID：L99\n- 地点名：不存在\n')
    expect(run(unknown.cwd).stdout).toBe('')
    rmSync(unknown.base, { recursive: true, force: true })

    const absent = rig('# 世界状态\n\n## 时间\n- 当前时间：第1日·18时00分\n')
    expect(run(absent.cwd).stdout).toBe('')
    rmSync(absent.base, { recursive: true, force: true })
  })
})