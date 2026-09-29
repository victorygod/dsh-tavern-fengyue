// extract-monster-extra.mjs — 怪物语料补抽（G1 豁免型能力 + G2 Weapon 骑手段）。
// 产出 preset/lib/monster-ability-data.mjs（ABILITIES 豁免能力表 + RIDERS 骑手表）。
// 与 extract-monster(武器攻击 488 条已入库)互补:本脚本只抽被首表遗漏的两族。
// 运行: node tavern_presets/dnd5e/scripts/extract-monster-extra.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PRESET = join(HERE, '..', 'preset')              // dnd5e/preset/
const MON = join(PRESET, 'setup', 'dnd5e-srd-lorebook', 'monsters')
const OUT = join(PRESET, 'lib', 'monster-ability-data.mjs')
const slug = n => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-')
const diceClean = s => s.replace(/\s+/g, '').replace(/^(\d+d\d+)\+(\d+)$/, '$1+$2')

const abilities = {}, riders = {}
const anomalies = []
const files = readdirSync(MON).filter(f => f.endsWith('.md') && f !== 'INDEX.md')

for (const f of files) {
  const raw = readFileSync(join(MON, f), 'utf8')
  const fmM = raw.match(/^---\n([\s\S]*?)\n---/)
  const fm = Object.fromEntries((fmM?.[1] ?? '').split('\n').map(l => { const i = l.indexOf(':'); return i < 0 ? [] : [l.slice(0, i).trim(), l.slice(i + 1).trim()] }).filter(a => a.length))
  const monName = fm.name ?? f.replace(/\.md$/, '')
  const mslug = slug(monName)

  for (const line of raw.split('\n')) {
    // ── G1 豁免型伤害能力:DC N X saving throw + 伤害骰 + (half 判定) ──
    const ab = line.match(/^\*\*\*(.+?)\.\*\*\*.*?(DC (\d+) (\w+) saving throw)/i)
    if (ab && /taking|take/.test(line) && /\d+d\d+/.test(line)) {
      const dm = line.match(/(?:taking|take) \d+ \((\d+d\d+(?:\s*\+\s*\d+)?)\) ([a-z]+) damage/i)
      if (dm) {
        const key = `${mslug}/${slug(ab[1])}`
        const e = { save: ab[4].toLowerCase(), dc: +ab[3], dice: diceClean(dm[1]), type: dm[2].toLowerCase() }
        e.half = /half as much/i.test(line)
        e.knockProne = /knocked prone/i.test(line)
        abilities[key] = e
      } else anomalies.push([monName, ab[1], 'SAVE-ALT-SHAPE'])
    }
    // ── G2 Weapon 骑手段:首段 damage + plus N (AdB) type ──
    const wm = line.match(/^\*\*\*(.+?)\.\*\*\*.*?Weapon Attack/i)
    if (wm) {
      const plus = line.match(/plus \d+ \((\d+d\d+(?:\s*\+\s*\d+)?)\) ([a-z]+)/i)
      if (plus) {
        const key = `${mslug}/${slug(wm[1])}`
        const rec = riders[key] || (riders[key] = [])
        rec.push({ dice: diceClean(plus[1]), type: plus[2].toLowerCase() })
      }
    }
  }
}

// 生成模块
const abLines = Object.entries(abilities).map(([k, v]) => {
  const p = [`save: '${v.save}'`, `dc: ${v.dc}`, `dice: '${v.dice}'`, `type: '${v.type}'`]
  if (v.half === false) p.push('half: false')
  if (v.knockProne) p.push('knockProne: true')
  return `  '${k}': { ${p.join(', ')} },`
}).join('\n')
const rdLines = Object.entries(riders).map(([k, v]) => `  '${k}': [ ${v.map(r => `{ dice: '${r.dice}', type: '${r.type}' }`).join(', ')} ],`).join('\n')

const mod = `// 怪物豁免能力表 + Weapon 骑手表(2026-09-28 由 lorebook 补抽;脚本=preset/scripts/extract-monster-extra.mjs)。
// ABILITIES:豁免型伤害能力(龙息等)——消费面=豁免结算(依赖 cast 豁免消费者,暂挂 backlog G1,数据先行)。
//   {save, dc, dice, type, half?默认true, knockProne?};half=false=失败全额无减半(or take 句),knockProne=附带倒地状态。
// RIDERS:Weapon 攻击的 plus 骑手段(龙焰咬 second段)——消费面=attack/骰件结算时叠加(暂挂 backlog G2)。
export const ABILITIES = {
${abLines || '  // (空)'}
}
export const RIDERS = {
${rdLines || '  // (空)'}
}
`
writeFileSync(OUT, mod)
console.log(`abilities=${Object.keys(abilities).length} riderKeys=${Object.keys(riders).length} anomalies=${anomalies.length}`)
for (const a of anomalies.slice(0, 12)) console.log('  ' + a.join('  '))