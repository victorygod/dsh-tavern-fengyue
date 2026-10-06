// dnd5e mvu_commit 钩子钉(2026-10-04):真实脚本+临时树——抽 ```mvu``` 块→JSON→写 state.md(八节)
// +应用 memory(history append|overwrite + description/thought 恒覆写)。money/exp 已迁 gain_money/gain_exp 工具(块内不再应用)。
// 坏块/缺块=只 stdout 留痕不写盘。cwd=runtime,`../preset/lib` 兄弟(部署同构,cpSync 复制 lib)。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

/** 临时运行树:cwd=runtime;cpSync lib→base/preset/lib(工具 import ../preset/lib/core.mjs 同构)。 */
function rig(snapshot: string, stateMd = '# 世界状态\n') {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-commit-'))
  const cwd = join(base, 'runtime')
  mkdirSync(join(cwd, 'characters'), { recursive: true })
  cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  writeFileSync(join(cwd, 'state.md'), stateMd)
  writeFileSync(join(cwd, '.chat.snapshot.jsonl'), snapshot)
  return { cwd, base }
}
const head = '{"type":"head","sessionId":"s","cardTitle":"t","clientTimeZone":"Z"}\n'
const snap = (orig: string) =>
  head + '{"seq":2,"kind":"user","orig":"我看看","plain":"我看看"}\n' + `{"seq":3,"kind":"assistant","orig":${JSON.stringify(orig)},"plain":${JSON.stringify(orig)}}\n`
const block = (json: string) => `正文……\n<details class="mvu-block"><summary>本回合结算</summary><pre data-mvu>${json}</pre></details>\n`

function run(cwd: string) {
  const r = spawnSync(process.execPath, [join(CARD, 'scripts', 'mvu_commit.mjs')], { cwd, encoding: 'utf8' })
  return { status: r.status ?? 0, stdout: r.stdout, stderr: r.stderr }
}
const md = (cwd: string) => readFileSync(join(cwd, 'state.md'), 'utf8')
const j = (cwd: string, f: string) => JSON.parse(readFileSync(join(cwd, 'characters', f), 'utf8'))

describe('dnd5e mvu_commit 钩子(真实脚本:抽块→写 state.md 八节+memory)', () => {
  it('写 state.md 八节:节题逐字(附近 NPC/战斗 保核) + nearby 三态/combat 渲染', () => {
    const data = JSON.stringify({
      time: '第1日·19时30分',
      location: { id: 'L01', name: '凡戴尔镇' },
      weather: '阴', terrain: '山路',
      nearby: [{ name: '西德', stance: '中立' }, { name: '奥里安', stance: '同伴' }],
      quests: ['【主线】前往凡戴尔', '✓ 另一件'], foreshadow: ['待回收：黑蜘蛛的身份'],
      combat: null,
    })
    const { cwd, base } = rig(snap(block(data)))
    const r = run(cwd)
    expect(r.status).toBe(0)
    const m = md(cwd)
    expect(m).toContain('## 时间\n- 当前时间：第1日·19时30分')
    expect(m).toContain('## 地点\n- 地点ID：L01\n- 地点名：凡戴尔镇')
    expect(m).toContain('## 天气\n- 阴')
    expect(m).toContain('## 地形\n- 山路')
    expect(m).toContain('## 附近 NPC\n- 西德 | 中立\n- 奥里安 | 同伴')
    expect(m).toContain('## 任务\n- 【主线】前往凡戴尔\n- ✓ 另一件')
    expect(m).toContain('## 伏笔\n- 待回收：黑蜘蛛的身份')
    rmSync(base, { recursive: true, force: true })
  })

  it('memory(history_append/description 覆写) + money/exp 已迁工具(块内不再应用)', () => {
    const data = JSON.stringify({
      time: '第1日·19时30分', location: { id: '', name: '凡戴尔镇外' }, weather: '阴', terrain: '山路',
      nearby: [], quests: [], foreshadow: [], combat: null,
      money: [{ who: '铁武', direction: 'gain', amount: '2gp3sp' }],
      exp: [{ who: '铁武', exp: 350 }],
      memory: [{ who: '铁武', history_append: '第2日·练成了军旅步法', description: '升级后的战士' }],
    })
    const { cwd, base } = rig(snap(block(data)))
    writeFileSync(join(cwd, 'characters', '铁武.json'), JSON.stringify({ name: '铁武', role: 'npc', class: 'fighter', level: 1, exp: 0, con: 10, hp: 19, hp_max: 19, hd_available: 0, gp: 0, sp: 0, cp: 0, history: ['旧事'], statuses: {} }))
    const r = run(cwd)
    expect(r.status).toBe(0)
    const w = j(cwd, '铁武.json')
    expect(w.gp).toBe(0); expect(w.sp).toBe(0)                 // money 已迁 gain_money 工具——块内不再应用
    expect(w.exp).toBe(0); expect(w.level).toBe(1)             // exp 已迁 gain_exp 工具——块内不再应用
    expect(w.history).toEqual(['旧事', '第2日·练成了军旅步法'])   // history_append 只增
    expect(w.description).toBe('升级后的战士')                   // description 恒覆写
    expect(w.role).toBe('npc')                                  // 未点名键不动
    rmSync(base, { recursive: true, force: true })
  })

  it('history ≥10 用 history_overwrite 整体总结替换;thought 玩家卡拒落留痕', () => {
    const data = JSON.stringify({
      time: '第1日·20时', location: { id: '', name: '途' }, weather: '晴', terrain: '路',
      nearby: [], quests: [], foreshadow: [], combat: null,
      memory: [{ who: '铁武', history_overwrite: '旧事整合成一句', thought: '想念故乡' }],
    })
    const { cwd, base } = rig(snap(block(data)))
    writeFileSync(join(cwd, 'characters', '铁武.json'), JSON.stringify({
      name: '铁武', role: 'npc', hp: 10, hp_max: 10, statuses: {},
      history: Array.from({ length: 11 }, (_, i) => `第${i + 1}日·行${i}`),
    }))
    const r = run(cwd)
    expect(r.status).toBe(0)
    const w = j(cwd, '铁武.json')
    expect(w.history).toEqual(['旧事整合成一句'])               // 整表替换
    expect(w.thought).toBe('想念故乡')
    rmSync(base, { recursive: true, force: true })
  })

  it('缺块/坏 JSON=不写盘(只 stdout 留痕)', () => {
    const seed = '# 世界状态\n\n## 时间\n- 当前时间：第1日·18时00分\n'
    const a = rig(snap('正文没有 mvu 块。'), seed)
    const ra = run(a.cwd)
    expect(ra.status).toBe(0)
    expect(ra.stdout).toContain('无块')
    expect(md(a.cwd)).toBe(seed)                                // 原样不写

    const b = rig(snap(block('{坏了')), seed)
    const rb = run(b.cwd)
    expect(rb.status).toBe(0)
    expect(rb.stdout).toContain('解析失败')
    expect(md(b.cwd)).toBe(seed)
    rmSync(a.base, { recursive: true, force: true })
    rmSync(b.base, { recursive: true, force: true })
  })

  it('缺键节保留旧值不空(全量声明是契约,缺键=模型失误保旧)', () => {
    const seed = '# 世界状态\n\n## 任务\n- 【主线】前往凡戴尔\n'
    const data = JSON.stringify({ time: '第1日·19时30分', location: { id: 'L01', name: '凡戴尔镇' }, weather: '阴', terrain: '山路', nearby: [], quests: [], foreshadow: [] })
    // 塞一个「缺 quests 键」的块:直接构造对象后删 key
    const obj = JSON.parse(data); delete obj.quests; delete obj.foreshadow
    const { cwd, base } = rig(snap(block(JSON.stringify(obj))), seed)
    run(cwd)
    const m = md(cwd)
    expect(m).toContain('## 任务\n- 【主线】前往凡戴尔')        // 旧值保留
    rmSync(base, { recursive: true, force: true })
  })
})