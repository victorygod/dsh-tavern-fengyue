// dnd5e history 整合警报注入器钉(2026-09-30):history_alert 真脚本+临时树(cwd=runtime 与 preset 兄弟——
// 部署同构,同 dnd5e-presence)。「history 整合律」触发器=渲染期实查点名:超行 character 档逐行欠账点名
// (文件路径+现值行数),无欠账=输出空串({{history_alert()}} 渲染原样吞空,prompt 不多认一个节点)。
// 分工律:警报=触发器+名单+指针,整合动作语义(how)单源在 maintenancePrompt 3.a 整合律,不双写。
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const PRE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'tavern_presets', 'dnd5e', 'preset')

const history = (n: number) => Array.from({ length: n }, (_, i) => `第${i + 1}日·行事${i}，因果一线`)
const char = (name: string, hist: number | undefined) =>
  hist === undefined ? { name, role: 'pc' } : { name, role: 'npc', history: history(hist), description: '现况一句' }

/** 建临时树(cwd=runtime,characters/ 内逐档落盘);j 为字符串=原样写(坏 JSON 病例)。 */
function rig(chars: Record<string, unknown>): string {
  const cwd = join(mkdtempSync(join(tmpdir(), 'dnd5e-history-alert-')), 'runtime')
  mkdirSync(join(cwd, 'characters'), { recursive: true })
  for (const [f, j] of Object.entries(chars)) {
    writeFileSync(join(cwd, 'characters', f), typeof j === 'string' ? j : JSON.stringify(j))
  }
  return cwd
}

function run(cwd: string): string {
  const r = spawnSync(process.execPath, [join(PRE, 'scripts', 'history_alert.mjs')], { cwd, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`history_alert exit ${r.status}: ${r.stderr.slice(0, 300)}`)
  return r.stdout
}

describe('dnd5e history 超行警报注入器(整合律触发器——欠账点名/清零归静默)', () => {
  it('无欠账(≤10 行/无 history 键/无 characters 目录)一律空输出', () => {
    expect(run(rig({ 'player.json': char('奥里安', undefined), '瑟薇.json': char('瑟薇', 4) }))).toBe('')
    expect(run(rig({ '霍伯.json': char('霍伯', 10) }))).toBe('')      // 恰好 10 行=线值内,不报
    expect(run(rig({}))).toBe('')                                        // 空名册
    const noDir = join(mkdtempSync(join(tmpdir(), 'dnd5e-history-alert-')), 'runtime')
    mkdirSync(noDir, { recursive: true })                                // runtime 在、characters 缺=开局未完成态
    expect(run(noDir)).toBe('')
    rmSync(dirname(noDir), { recursive: true, force: true })
  })

  it('超行档逐行点名:路径+行数,恰好 10 行的同档不混入', () => {
    const cwd = rig({ '瑟薇.json': char('瑟薇', 13), '霍伯.json': char('霍伯', 11), 'player.json': char('奥里安', undefined), '格雷.json': char('格雷', 10) })
    const out = run(cwd)
    expect(out).toContain('history 超行警报')
    expect(out).toContain('- characters/瑟薇.json（13 行）')
    expect(out).toContain('- characters/霍伯.json（11 行）')
    expect(out).not.toContain('格雷')                                   // 10 行不超线
    expect(out).not.toContain('player.json')                            // 无 history 键=无欠账
    rmSync(dirname(cwd), { recursive: true, force: true })
  })

  it('警报=触发器+名单+指针:阈值数字由 LIMIT 派生,整合动作语义归 3.a 整合律不重复', () => {
    const cwd = rig({ '瑟薇.json': char('瑟薇', 12) })
    const out = run(cwd)
    expect(out).toContain('已超过 10 行（整合线，本回合办）')   // 线值单源=脚本,数字随 LIMIT 输出
    expect(out).toContain('- characters/瑟薇.json（12 行）')
    expect(out).toContain('照 3.a「history 整合律」')
    expect(out).not.toContain('runtimeEdit')                   // how 不双写——正本在 maintenancePrompt 3.a
    rmSync(dirname(cwd), { recursive: true, force: true })
  })

  it('坏 JSON 档跳过不阻报(其余欠账照点)', () => {
    const cwd = rig({ '坏档.json': '{oops', '瑟薇.json': char('瑟薇', 12) })
    const out = run(cwd)
    expect(out).toContain('- characters/瑟薇.json（12 行）')
    expect(out).not.toContain('坏档')
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
})
