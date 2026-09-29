/** @tavern-schema
{
  "description": "状态增量更新器——对角色 statuses 对象表里的一个状态做字段级更新：只改传入的字段，其余保留；某字段传 null＝删除该字段；remove:true＝删整个状态。什么情况调：叙事施加/刷新/解除状态——新状态带 applied_at（你按当前叙事时间手写，如 '第 3 日 9 时' 或 '第 2 轮'）；中途变动只传要改的字段。回执返回该角色完整 statuses JSON 与 AC 前后。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "target": { "type": "string", "required": true, "description": "角色名。" },
    "status": { "type": "string", "required": true, "enum": ["blinded","charmed","deafened","exhaustion","frightened","grappled","incapacitated","invisible","paralyzed","petrified","poisoned","prone","restrained","stunned","unconscious","Bless","Bane","Shield of Faith","Haste","Divine Favor","Branding Smite","False Life","Sleep","Color Spray","Power Word Stun","Power Word Kill","Divine Word","Animal Friendship","Banishment","Blindness/Deafness","Calm Emotions","Charm Person","Command","Compulsion","Confusion","Dominate Beast","Dominate Person","Entangle","Enthrall","Fear","Faerie Fire","Flesh to Stone","Grease","Hideous Laughter","Hold Person","Hold Monster","Hypnotic Pattern","Irresistible Dance","Levitate","Mass Suggestion","Modify Memory","Planar Binding","Polymorph","Resilient Sphere","Scrying","Slow","Suggestion","Shield","Hunter's Mark","Warding Bond","Resistance","Guidance","Longstrider","Heroism","Beacon of Hope","Death Ward","临时生命","Rage","Bardic Inspiration"], "description": "状态名（对象表的键）——只许临时状态枚举内的键（SRD 条件英文 / 法术 buff 英文 / 临时生命 / 职业特征机制态）；剧情约定/复盘不入 statuses，路由去 state.md 队伍·任务·伏笔或该角色生平。" },
    "applied_at": { "type": "string", "description": "施加时间——你按当前叙事时间手写（'第 3 日 9 时'/'第 2 轮'）。新状态必填；刷新/续期时更新；传 null 删除。" },
    "effect": { "type": "string", "description": "状态短注，一句以内：只写生效要点与持续（如「d6，一次攻检/检定/豁免加值，10 分钟」）——HUD 浮签展示用，塞长句会被折叠。传 null 删除。" },
    "on_use": { "type": "string", "description": "消费型骰式（如 '1d6'）——attack/check 的 consume 用掉即摘并按此加骰；有骰值写这里，勿混进 effect 文本。传 null 删除。" },
    "mods": { "type": "array", "items": { "type": "object", "additionalProperties": true }, "description": "机械修正数组 [{stat, magnitude}]——stat 白名单 ac/attack/save/attack_save/damage；magnitude 数值或骰式。传 null 删除；不传=保留原值。" },
    "remove": { "type": "boolean", "description": "摘除整个状态。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { resolveTarget, deriveAC, saveChar, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const { STATUS_KEYS } = await import(pathToFileURL(process.cwd() + '/../preset/lib/status.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context')
a.target || err('缺必填 target')
a.status || err('缺必填 status')
STATUS_KEYS.has(a.status) || err(`status 不在临时状态枚举:${a.status}——合法键 ${[...STATUS_KEYS].join(' / ')}`)

const STAT_OK = new Set(['ac', 'attack', 'save', 'attack_save', 'damage'])
const tg = resolveTarget(a.target) || err(`查无目标:${a.target}`)
const before = deriveAC(tg.j)
const st = (tg.j.statuses && !Array.isArray(tg.j.statuses)) ? { ...tg.j.statuses } : {}
const cur = st[a.status] ?? null
const verb = a.remove === true ? '摘除' : cur == null ? '施加' : '增量更新'

if (a.remove === true) {
  cur || err(`查无状态:${a.status}`)
  delete st[a.status]
} else {
  // 增量:从现有条目起步,只改传入字段;null=删字段;不传=保留。
  const entry = { ...(cur ?? {}) }
  const patch = (k, transform) => { if (a[k] === null) delete entry[k]; else if (a[k] !== undefined) entry[k] = transform(a[k]) }
  patch('applied_at', v => String(v))
  patch('effect', v => String(v))
  patch('on_use', v => { const s = String(v); /^-?\d+d\d+$/.test(s) || err(`on_use 不合法:${s}——骰式如 1d6`); return s.startsWith('+') ? s.slice(1) : s })
  if (a.mods === null) delete entry.mods
  else if (a.mods !== undefined) {
    Array.isArray(a.mods) && a.mods.length || err(`mods 须为非空数组 [{stat,magnitude}]`)
    entry.mods = a.mods.map(m => {
      m?.stat && STAT_OK.has(m.stat) || err(`mods.stat 不合法:${JSON.stringify(m)}——白名单 ${[...STAT_OK].join('/')}`)
      const mag = String(m.magnitude ?? '')
      const magOk = /^-?\d+d\d+$/.test(mag) || Number.isFinite(+mag)
      magOk || err(`mods.magnitude 不合法:${mag}——骰式或数值`)
      return { stat: m.stat, magnitude: mag.startsWith('+') ? mag.slice(1) : mag }
    })
  }
  cur == null && entry.applied_at === undefined && err(`新状态「${a.status}」须带 applied_at(施加时游戏时间,你手写)`)
  st[a.status] = entry
}
tg.j.statuses = st
const after = deriveAC(tg.j)
saveChar(tg.file, tg.j)
console.log(`[状态 · ${a.target} · ${verb} · ${a.status}]`)
if (a.remove !== true) console.log(`  该状态: ${JSON.stringify(st[a.status])}`)
before !== after && console.log(`  AC: ${before}→${after}`)
console.log(`  完整状态: ${JSON.stringify(st)}`)
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)