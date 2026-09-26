// {{get_npc_state()}} — 【附近 NPC 面板】:state.md「## 附近 NPC」三态名单(行式 `- 名 | 同伴/中立/敌对`,
// 尾代每回合按场景维护——上榜必有档,含杂兵)。名单=唯一在场真源(v4,2026-09-25 用户定案复活):
// 无 role 兜底(漏更=漏)、无点名词匹配(v3 算法退役)。前端人际三区(ui_data)读同源 presence,两侧镜像。
import { pathToFileURL } from 'node:url'
const { presence } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const out = []
const sel = presence()
for (const [pool, label] of [['mates', '同伴'], ['neutrals', '中立'], ['foes', '敌对']]) {
  for (const r of sel[pool]) {
    if (r.j === null) { out.push(`### ${r.name}（${label}）：缺档或损坏——勿采信（尾代应补建）`); continue }
    out.push(`### ${r.name}（${label}）`)
    out.push(JSON.stringify(r.j, null, 1))
  }
}
console.log(out.length ? out.join('\n') : '（附近 NPC 名单为空——开局未完成,或尾代漏维护本回合场景人物）')
