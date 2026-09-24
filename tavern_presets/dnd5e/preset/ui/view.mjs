// view.mjs — v9 声明形态:纯函数 data→HTML,无 DOM/无状态/无调度(image of the HUD)。
// 宿主面板运行时(panel-runtime)泵数据、管挂载与错误显面;本件只回答"给定数据长什么样"。
// ui-state 约定(extra.ui):questOpen=Set(任务手风琴展开键) · bookKey=已开册目标(acts 维护)。
// 可 node 直跑断言(纯函数);改名/挪动请同步 layout.json 的 view 字段。

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const norm = s => String(s ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '_')

// 中英显示名映射（展示决策归前端；术语=translation-protocol v3 台版锚点）
const CLS_CN = { barbarian: '野蛮人', bard: '吟游诗人', cleric: '牧师', druid: '德鲁伊', fighter: '战士', monk: '武僧', paladin: '圣骑士', ranger: '游侠', rogue: '盗贼', sorcerer: '术士', warlock: '契术师', wizard: '法师' }
const RACE_CN = { human: '人类', half_elf: '半精灵', elf: '精灵', high_elf: '高等精灵', dwarf: '矮人', halfling: '半身人', gnome: '地侏', half_orc: '半兽人', tiefling: '提夫林', dragonborn: '龙裔' }
const SKILL_CN = { acrobatics: '杂技', animal_handling: '驯兽', arcana: '奥秘', athletics: '运动', deception: '欺瞒', history: '历史', insight: '洞悉', intimidation: '威吓', investigation: '调查', medicine: '医药', nature: '自然', perception: '察觉', performance: '表演', persuasion: '游说', religion: '宗教', sleight_of_hand: '巧手', stealth: '隐匿', survival: '生存' }
const WEAPON_CN = { shortsword: '短剑', longsword: '长剑', mace: '硬头锤', quarterstaff: '木棍', shortbow: '短弓', dagger: '匕首', greataxe: '巨斧', greatsword: '巨剑', handaxe: '手斧', javelin: '标枪', lightcrossbow: '轻弩', warhammer: '战锤', longbow: '长弓' }
const DMG_CN = { piercing: '穿刺', slashing: '挥砍', bludgeoning: '钝击', fire: '火', cold: '寒冷', acid: '酸', poison: '毒', lightning: '闪电', thunder: '雷鸣', necrotic: '死灵', radiant: '光耀', force: '力场', psychic: '心灵' }
const PROP_CN = { finesse: '灵巧', light: '轻型', heavy: '重型', two_handed: '双手', reach: '及远', thrown: '投掷', ammunition: '弹药', loading: '装填', versatile: '多用', monk: '武僧', special: '特殊', ranged: '远程' }
const ARMOR_CN = { chain_mail: '锁甲', chain_mail_dashed: '锁甲', studded_leather_armor: '镶钉皮甲', scale_mail: '鳞甲', leather_armor: '皮甲', hide: '兽皮甲', chain_shirt: '链甲衫', breastplate: '胸甲', half_plate: '半身甲', plate: '板甲', padded: '布甲' }
const cn = (map, key) => map[norm(key)] ?? key
const ATTRS = [['力', 'str'], ['敏', 'dex'], ['体', 'con'], ['智', 'int'], ['感', 'wis'], ['魅', 'cha']]
const sign = v => (v >= 0 ? '+' : '−') + Math.abs(v)
const daypart = h => (h >= 21 || h < 5) ? ['night', '深夜'] : h < 8 ? ['dawn', '拂晓'] : h < 17 ? ['day', '白天'] : ['dusk', '黄昏']
const GENDER_META = {
  male: { glyph: '♂', cls: 'gm' },
  female: { glyph: '♀', cls: 'gf' },
  unknown: { glyph: null, cls: 'go' },   // 未知/未定 → 金环无符号（兜帽头像），不造占位
}
const genderOf = c => GENDER_META[c.gender] ?? GENDER_META.unknown
const dashId = r => norm(r).replace(/_/g, '-').replace(/[\s_-]+/g, '-')   // 图片槽键=连字符形('half-elf')
const avatarKey = c => `${dashId(c.race)}-${c.gender === 'female' ? 'female' : c.gender === 'male' ? 'male' : 'unknown'}`

// 头像两形态：图槽命中→img（138% 内裁层——图缘可被框沿吃掉,不溢出圆外,2026-09-24 定案）；缺席→名字首字
function avatarFor(c, avatars) {
  const url = avatars?.[avatarKey(c)]
  const letter = `<span class="pix-letter">${esc((c.name ?? '?')[0] ?? '?')}</span>`
  if (url) return letter + `<span class="av-clip"><img class="av-img" src="${String(url).replace(/"/g, '%22')}" alt=""></span>`
  return letter
}

// ── 渲染数据小件 ──
// 缺席语义（2026-09-22 拍板）：hp 键缺席＝未知 ≠ 0——文本 ???/???、条体按满血充（真 0 血照旧 dying/low）。
// 键裁剪律的战斗面扩展：纯场景 NPC 战斗面前可无 hp 族；缺席信号由泵层(ui_data)以 null 保真送到。
const val = v => v == null ? '???' : v
const hpText = c => `${val(c.hp)}${c.temp_hp > 0 ? '+' + c.temp_hp : ''}/${val(c.hp_max)}`
const tmpWidth = c => (c.temp_hp && c.hp_max) ? Math.min((c.temp_hp / c.hp_max) * 100, 100 - (c.derived?.hpPct ?? 0)) : 0
const chipsSmall = st => (st ?? []).map(x => `<span class="stc ${esc(x.kind ?? 'i')}"><span class="k">${esc(x.name)}</span>${esc(x.remaining ?? '')}</span>`).join('')

// ── 渲染：主角卡 ──
function heroCard(p, avatars) {
  const g = genderOf(p)
  const d = p.derived ?? {}
  const unk = d.hpPct == null   // 泵层缺席信号:未知 hp——满血充+??? 文本,不算濒死
  const hpP = unk ? 100 : d.hpPct
  const low = !unk && hpP > 0 && hpP <= 25
  const dying = !unk && (p.hp ?? 1) <= 0
  const tw = tmpWidth(p)
  // EXP 进度条（成长族：ui_data 无 expBar=键缺席,不渲染）
  const xb = d.expBar
  let xp = 100
  if (xb && xb.next !== null) {
    const span = xb.next - xb.min
    xp = span > 0 ? Math.max(0, Math.min(100, Math.round(((xb.exp - xb.min) / span) * 100))) : 100
  }
  return `
      <div class="h-card ${dying ? 'dying' : ''}" data-act="book" data-target="${esc(p._file ?? 'player')}">
        <div class="row1">
          <div class="h-av ${g.cls}">${avatarFor(p, avatars)}<span class="h-lv">LV${esc(p.level ?? '???')}</span></div>
          <div class="h-names">
            <div class="h-nm">${esc(p.name ?? '')}</div>
            <div class="h-tags">
              <span class="h-tag">${esc(cn(RACE_CN, p.race) ?? '')}</span>
              ${g.glyph ? `<span class="g-glyph ${g.cls}" data-tip="性别">${g.glyph}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="h-hp">
          <div class="hpbar ${low ? 'low' : ''}" data-tip="HP ${esc(hpText(p))}${p.temp_hp > 0 ? '（含临时）' : ''}">
            <div class="fill" style="width:${hpP}%"></div>
            ${tw ? `<div class="tmp" style="width:${tw}%; left:${hpP}%"></div>` : ''}
            <div class="cap"><span class="lb">HP</span><span class="nn">${esc(hpText(p))}</span></div>
          </div>
        </div>
        ${xb ? `<div class="h-exp" data-tip="EXP ${esc(xb.exp)}${xb.next === null ? '（已到 20 级顶）' : ' / 升至 LV' + esc(p.level == null ? '?' : p.level + 1) + ' 需 ' + esc(xb.next)}"><div class="bar"><div class="fill" style="width:${xp}%"></div></div><span class="lb">EXP ${esc(xb.exp)}/${xb.next === null ? 'MAX' : esc(xb.next)}</span></div>` : ''}
        ${(p.statuses ?? []).length || (p.pending ?? []).length ? `<div class="h-status">${chipsSmall(p.statuses)}${(p.pending ?? []).length ? `<span class="stc i pending" data-tip="存在未分配的成长项（属性点/新法术）——点卡打开数据册，进对应节分配"><span class="k">◆</span>未分配成长${(p.pending ?? []).length > 1 ? '·' + (p.pending ?? []).length : ''}</span>` : ''}</div>` : ''}
      </div>`
}

// ── 渲染：同伴列 ──
function matesHtml(list, avatars) {
  if (!list?.length) return ''
  return `<div class="hero-mates"><div class="mates" id="sec-mates">` + `<div class="m-zone">同伴</div>` + list.map(c => {
    const g = genderOf(c)
    const d = c.derived ?? {}
    const unk = d.hpPct == null   // 缺席=未知:满血充+??? 文本,不算濒死
    const hpP = unk ? 100 : d.hpPct
    const dying = !unk && (c.hp ?? 1) <= 0
    return `<div class="m-card ${dying ? 'dying' : ''}" data-act="book" data-target="${esc(c._file ?? c.name ?? '')}">
        <div class="m-av ${g.cls}">${avatarFor(c, avatars)}<span class="m-lv">LV${esc(c.level ?? '???')}</span></div>
        <div class="m-main">
          <div class="m-top"><span class="m-nm">${esc(c.name ?? '')}</span>${g.glyph ? `<span class="m-gd ${g.cls}">${g.glyph}</span>` : ''}</div>
          <div class="m-hp"><span class="tk"><span class="fl" style="width:${hpP}%"></span></span><span class="nn">${esc(hpText(c))}</span></div>
          ${(c.statuses ?? []).length ? `<div class="m-status">${chipsSmall(c.statuses)}</div>` : ''}
        </div>
      </div>`
  }).join('') + `</div></div>`
}

// ── 环境面板小组件（昼夜天幕/钟盘/天候）──
const SKY = {
  night: 'linear-gradient(180deg, rgba(44,58,108,.44), rgba(28,38,78,.2) 62%, transparent)',
  dawn: 'linear-gradient(180deg, rgba(214,142,84,.34), rgba(214,142,84,.1) 65%, transparent)',
  day: 'linear-gradient(180deg, rgba(120,168,196,.26), rgba(120,168,196,.08) 65%, transparent)',
  dusk: 'linear-gradient(180deg, rgba(178,88,58,.38), rgba(140,60,70,.14) 65%, transparent)',
}
const WEATHER_SVG = {
  sunny: `<svg viewBox="0 0 13 13"><circle cx="6.5" cy="6.5" r="2.6" fill="#e8c560"/><g stroke="#e8c560" stroke-width="1.1" stroke-linecap="round"><line x1="6.5" y1="1" x2="6.5" y2="2.4"/><line x1="6.5" y1="10.6" x2="6.5" y2="12"/><line x1="1" y1="6.5" x2="2.4" y2="6.5"/><line x1="10.6" y1="6.5" x2="12" y2="6.5"/><line x1="2.6" y1="2.6" x2="3.6" y2="3.6"/><line x1="9.4" y1="9.4" x2="10.4" y2="10.4"/><line x1="10.4" y1="2.6" x2="9.4" y2="3.6"/><line x1="2.6" y1="10.4" x2="3.6" y2="9.4"/></g></svg>`,
  rain: `<svg viewBox="0 0 13 13"><path d="M3.2 7.2a2.6 2.6 0 1 1 .6-5.1 3 3 0 0 1 5.8-.4 2.4 2.4 0 0 1 .2 4.8z" fill="#9fb0c8"/><g stroke="#7fb0d8" stroke-width="1.1" stroke-linecap="round"><line x1="4.2" y1="8.6" x2="3.6" y2="10.8"/><line x1="6.8" y1="8.6" x2="6.2" y2="10.8"/><line x1="9.4" y1="8.6" x2="8.8" y2="10.8"/></g></svg>`,
  cloudy: `<svg viewBox="0 0 13 13"><path d="M3.2 9.4a2.6 2.6 0 1 1 .6-5.1 3 3 0 0 1 5.8-.4 2.4 2.4 0 0 1 .2 4.8z" fill="#9fb0c8"/></svg>`,
  storm: `<svg viewBox="0 0 13 13"><path d="M3.2 6.8a2.6 2.6 0 1 1 .6-5.1 3 3 0 0 1 5.8-.4 2.4 2.4 0 0 1 .2 4.8z" fill="#8a93ab"/><path d="M6.6 7.4 4.8 10h1.4l-.9 2.4 2.9-3.2H6.6l1.2-1.8z" fill="#e8c560"/></svg>`,
  snow: `<svg viewBox="0 0 13 13"><path d="M3.2 7a2.6 2.6 0 1 1 .6-5.1 3 3 0 0 1 5.8-.4 2.4 2.4 0 0 1 .2 4.8z" fill="#9fb0c8"/><circle cx="4.4" cy="9.6" r=".9" fill="#eef2ff"/><circle cx="7" cy="11" r=".9" fill="#eef2ff"/><circle cx="9.4" cy="9.4" r=".9" fill="#eef2ff"/></svg>`,
  fog: `<svg viewBox="0 0 13 13"><g stroke="#aab4c8" stroke-width="1.3" stroke-linecap="round"><line x1="1.5" y1="4.5" x2="10" y2="4.5"/><line x1="3.5" y1="7" x2="11.5" y2="7"/><line x1="2" y1="9.5" x2="9.5" y2="9.5"/></g></svg>`,
}
const WEATHER_ZH = { 晴: 'sunny', 多云: 'cloudy', 阴: 'cloudy', 雨: 'rain', 小雨: 'rain', 大雨: 'rain', 暴雨: 'rain', 雷暴: 'storm', 雷雨: 'storm', 雪: 'snow', 小雪: 'snow', 大雪: 'snow', 雾: 'fog' }
const weatherId = t => { const k = norm(t); if (WEATHER_SVG[k]) return k; return WEATHER_ZH[String(t ?? '').trim()] ?? null }
function dialSvg(h) {
  const ang = (h % 24) / 24 * 360
  const night = h >= 21 || h < 5
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = i * Math.PI / 6
    const x1 = 20 + 15.5 * Math.sin(a), y1 = 20 - 15.5 * Math.cos(a)
    const x2 = 20 + 18 * Math.sin(a), y2 = 20 - 18 * Math.cos(a)
    const major = i % 3 === 0
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${major ? 'rgba(240,210,138,.85)' : 'rgba(201,162,75,.38)'}" stroke-width="${major ? 1.6 : 1}"/>`
  }).join('')
  const icon = night
    ? `<path d="M22.9 21.6a4.4 4.4 0 1 1-5.2-5.8 3.5 3.5 0 1 0 5.2 5.8z" fill="#cfd8f2"/>`
    : `<circle cx="20" cy="20" r="1.9" fill="#f0d28a"/><g stroke="#f0d28a" stroke-width="1" stroke-linecap="round"><line x1="20" y1="16.6" x2="20" y2="17.9"/><line x1="20" y1="22.1" x2="20" y2="23.4"/><line x1="16.6" y1="20" x2="17.9" y2="20"/><line x1="22.1" y1="20" x2="23.4" y2="20"/></g>`
  return `<svg class="dial" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18.4" fill="rgba(0,0,0,.4)" stroke="rgba(201,162,75,.55)" stroke-width="1.4"/>${ticks}<g transform="rotate(${ang.toFixed(1)} 20 20)"><line x1="20" y1="20" x2="20" y2="6.2" stroke="#f0d28a" stroke-width="1.6" stroke-linecap="round"/><circle cx="20" cy="6.2" r="1.5" fill="#f0d28a"/></g><circle cx="20" cy="20" r="4.7" fill="rgba(20,14,6,.78)" stroke="rgba(201,162,75,.4)" stroke-width=".8"/>${icon}</svg>`
}
const sec = (t, inner, tip) => `<div class="bk-sec"><div class="bk-cap"${tip ? ` data-tip="${esc(tip)}"` : ''}>${esc(t)}</div>${inner}</div>`
const chip = (k, v) => `<span class="bk-chip"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></span>`
/* 成长节：标题栏呼吸底（有待办时）→ acts 'grow' 弹出学习框；节 tip=中文锚（2026-09-24 术语案：标题=SRD 原文） */
const CAP_TIPS = {
  ability: '六维属性——力量/敏捷/体质/智力/感知/魅力,顶点即数值+调整值',
  saves: '豁免检定——抵抗法术与效果,仅列熟练豁免',
  vitals: '生存速览——护甲AC/速度/暗视/被动察觉/临时HP/力竭级/治愈骰',
  skills: '技能检定——仅列熟练项(★=专精,熟练加值翻倍)',
  profs: '熟练与语言——护甲/武器/工具熟练+语言掌握(组名悬停见规则解释)',
  cast: '施法——主属性/法术DC/法术攻击/环位/戏法与已知已备',
  cond: '状态——增益绿/减益红/信息金,effect 逐行小注',
  equip: '装备——已持有实装的武器/护甲/盾牌',
  gear: '背包——零碎持有(杂物/消耗品),随叙事增减',
  feats: '特征——职业能力(名｜说明｜回充时机｜已用),池类资源随长休/短休回充',
  resists: '抗性=伤害减半;免疫=伤害为零',
}
const PROF_TIPS = {
  '护甲熟练': 'Armor——穿该类护甲不吃劣势且可施法',
  '武器熟练': 'Weapons——攻检加熟练加值;未熟练=白板攻击',
  '工具熟练': 'Tools——用该工具做检定加熟练加值',
  '语言掌握': 'Languages——会说/会读/会写(SRD 语言不属熟练家族)',
}
function capPend(t, pend, open, kind, tip) {
  const cap = pend
    ? `<div class="bk-cap g-pend ${open ? 'on' : ''}" data-act="grow" data-kind="${kind}" data-tip="${esc(tip ?? '')}（有待分配——点开分配对话框，册保持在后）">${esc(t)}<span class="g-wait">有待分配</span></div>`
    : `<div class="bk-cap"${tip ? ` data-tip="${esc(tip)}"` : ''}>${esc(t)}</div>`
  return cap
}

function worldHtml(st) {
  if (!st || (st.place ?? '') === '') return ''
  const h = st.time_hour ?? 18
  const [dp, dpName] = daypart(h)
  const wKey = st.weather ? weatherId(st.weather) : null
  const lines = [
    st.region ? `<div class="l up">${esc(st.region)}</div>` : '',
    st.area ? `<div class="l up">${esc(st.area)}</div>` : '',
    `<div class="l now">${esc(st.place)}</div>`,
  ]
  return `
      <div class="wcard" style="--sky:${SKY[dp]}">
        ${dp === 'night' ? `<i class="star" style="left:24%;top:14%"></i><i class="star" style="left:62%;top:26%;animation-delay:.8s"></i><i class="star" style="left:10%;top:52%;animation-delay:1.4s"></i><i class="star" style="left:74%;top:66%;animation-delay:.4s"></i><i class="star" style="left:40%;top:8%;animation-delay:1.9s"></i>` : ''}
        <div class="w-top">${dialSvg(h)}
          <div class="w-date"><div class="d1">第 ${esc(st.time_day ?? 1)} 日 · ${dpName}</div>
            <div class="wchips">${wKey ? WEATHER_SVG[wKey] : ''}<span>${st.weather ? esc(st.weather) : ''}</span>${st.terrain ? `<span class="terr">${esc(st.terrain)}</span>` : ''}</div>
          </div>
        </div>
        <div class="loc">${lines.join('')}</div>
      </div>`
}

// ── 渲染：任务手风琴（展开态=ui.questOpen 集合,acts 翻转）──
function questsHtml(s, questOpen) {
  const main = s?.main ?? [], side = s?.side ?? []
  if (!main.length && !side.length) return ''
  const item = (raw, isMain) => {
    const done = /^\s*✓/.test(raw)
    const title = raw.replace(/^\s*[✓◆◇○✗]/, '').trim()
    const key = `${isMain ? 'M' : 'S'}:${title}`
    return `<div class="q-item ${isMain ? 'main' : ''} ${done ? 'done' : ''} ${(questOpen ?? new Set()).has(key) ? 'open' : ''}" data-act="quest" data-q="${esc(key)}">
        <div class="q-title">${done ? '✓ ' : isMain ? '◆ ' : '◇ '}${esc(title)}</div>
        <div class="q-deet">${esc(raw.trim())}</div>
      </div>`
  }
  return `<div class="q-tag">任务</div>` + main.map(t => item(t, true)).concat(side.map(t => item(t, false))).join('')
}

// ── 面板导出：左 HUD（主角+同伴）──
export function heroPanel(data, extra = {}) {
  const avatars = extra.avatars ?? {}
  const p = data?.player
  const mates = data?.companions ?? []
  if (!p) return `<div class="dnd-hud dnd-hud--hosted"><div class="hero" data-empty="1"></div></div>`
  return `<div class="dnd-hud dnd-hud--hosted">
    <div class="hero">${heroCard(p, avatars)}</div>
    ${matesHtml(mates, avatars)}
  </div>`
}

// ── 面板导出：右 HUD（环境+任务）──
export function rightPanel(data, extra = {}) {
  const st = data?.state
  const questOpen = extra.ui?.questOpen
  return `<div class="dnd-hud dnd-hud--hosted">
    <div class="right">
      <div class="env">${worldHtml(st)}</div>
      <div class="quests">${questsHtml(st, questOpen)}</div>
    </div>
  </div>`
}

// ── 渲染：宽幅数据册（acts 以模态挂出;同构成 v8 全列）──
const fmtWeapon = w => !w.damage ? esc(cn(WEAPON_CN, w.name))
  : `${esc(cn(WEAPON_CN, w.name))} <span class="dv">${esc(w.damage)}${w.damage_type ? ' ' + esc(cn(DMG_CN, w.damage_type)) : ''}${w.props?.length ? ' ' + w.props.map(p => esc(cn(PROP_CN, p))).join('·') : ''}</span>`
function radarSvg(c, d) {
  const CX = 100, CY = 95, RR = 66
  const a = i => -Math.PI / 2 + i * Math.PI / 3
  const pt = (i, r) => [CX + r * Math.cos(a(i)), CY + r * Math.sin(a(i))]
  const ring = fr => ATTRS.map((_, i) => { const [x, y] = pt(i, RR * fr); return `${x.toFixed(1)},${y.toFixed(1)}` }).join(' ')
  const poly = ATTRS.map(([_, key]) => {
    const i = ATTRS.findIndex(x => x[1] === key)
    const m = (d?.attrMods ?? []).find(x => x.key === key)?.mod
    // 缺席系轴收束到中心（2026-09-22 拍板）——不明造 10 中庸值撑形;在场系照常 0.25~1 档。
    const t = m == null ? null : Math.max(0, Math.min(1, (m + 5) / 10))
    const [x, y] = pt(i, t == null ? 0 : RR * (0.25 + 0.75 * t))
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const labels = ATTRS.map(([lb, key], i) => {
    // 底轴(i=3)标签/值行内收(移植时统一外推 +4/+15 使底值溢出 viewBox 被裁——2026-09-22 用户目检修正)
    const drop = i === 3 ? -5 : 4
    const [x, y0] = pt(i, RR + 17)
    const y = y0 + drop
    const anchor = Math.abs(x - CX) < 8 ? 'middle' : x < CX ? 'end' : 'start'
    const m = (d?.attrMods ?? []).find(x2 => x2.key === key)?.mod
    return `<text class="rl" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${lb}</text>`
      + `<text x="${x.toFixed(1)}" y="${(y + 15).toFixed(1)}" text-anchor="${anchor}"><tspan class="rv">${esc(c[key] ?? '???')}</tspan><tspan class="rm">${m == null ? '' : ' ' + sign(m)}</tspan></text>`
  }).join('')
  return `<svg class="bk-radar" viewBox="0 0 200 190" role="img" aria-label="六维属性">`
    + [1 / 3, 2 / 3, 1].map(fr => `<polygon class="ring" points="${ring(fr)}"/>`).join('')
    + ATTRS.map((_, i) => { const [x, y] = pt(i, RR); return `<line class="axis" x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>` }).join('')
    + `<polygon class="poly" points="${poly}"/>` + labels + `</svg>`
}
const hasKind = (c, kind) => (c?.pending ?? []).some(x => String(x).includes(kind))
const profGroups = (c) => [
  (c.armor_prof ?? []).length ? ['护甲熟练', c.armor_prof] : null,
  (c.weapon_prof ?? []).length ? ['武器熟练', c.weapon_prof] : null,
  (c.tool_prof ?? []).length ? ['工具熟练', c.tool_prof] : null,
  (c.languages ?? []).length ? ['语言掌握', c.languages] : null,
].filter(Boolean)
const NONE_ROW = '<span class="bk-empty">无</span>'

export function bookHtml(c, avatars = {}, grow = {}) {
  const g = genderOf(c)
  const d = c.derived ?? {}
  const unk = d.hpPct == null   // 缺席=未知:满血充+??? 文本,不算濒死
  const hpP = unk ? 100 : d.hpPct
  const tw = tmpWidth(c)
  const head = `
      <div class="bk-h">
        <div class="bk-av ${g.cls}">${avatarFor(c, avatars)}</div>
        <div class="bk-hd">
          <div class="bk-nm">${esc(c.name ?? '')}</div>
          <div class="bk-sub">LV${esc(c.level ?? '???')} ${esc(cn(CLS_CN, c.class))}${c.subclass ? '·' + esc(c.subclass) : ''}·${esc(cn(RACE_CN, c.race))}${g.glyph ? `<span class="bk-g ${g.cls}">${g.glyph}</span>` : ''}</div>
          <div class="bk-sub2">${c.background ? esc(c.background) : ''}${c.background && c.persona?.alignment ? ' · ' : ''}${c.persona?.alignment ? esc(c.persona.alignment) : ''}</div>
        </div>
        <div class="bk-hp">
          <div class="hph" data-tip="HP ${esc(hpText(c))}${c.temp_hp > 0 ? '（含临时）' : ''}">
            <div class="fill" style="width:${hpP}%"></div>
            ${tw ? `<div class="tmp" style="width:${tw}%; left:${hpP}%"></div>` : ''}
            <div class="cap"><span class="lb">HP</span><span class="nn">${esc(hpText(c))}</span></div>
          </div>
          ${d.expBar ? `<div class="bke" data-tip="EXP ${esc(d.expBar.exp)}${d.expBar.next === null ? '（20 级顶）' : ' / 升至 LV' + esc(c.level == null ? '?' : c.level + 1) + ' 需 ' + esc(d.expBar.next)}"><div class="fl" style="width:${d.expBar.next === null ? 100 : Math.round(((d.expBar.exp - d.expBar.min) / Math.max(1, d.expBar.next - d.expBar.min)) * 100)}%"></div><div class="cap"><span class="lb">EXP</span><span class="nn">${esc(d.expBar.exp)}/${d.expBar.next === null ? 'MAX' : esc(d.expBar.next)}</span></div></div>` : ''}
          <div class="bk-coin" data-tip="钱包（不属于装备——挂在账条下,右对齐）">${esc(val(c.gp))}gp · ${esc(val(c.sp))}sp · ${esc(val(c.cp))}cp</div>
        </div>
        <button class="bk-x" data-act="bookClose" data-tip="合上册子">✕</button>
      </div>`

  /* 左栏：Ability Scores(呼吸+学习框入口) → Saving Throws → Vitals → Skills → Proficiencies（2026-09-24 版面定案） */
  const asiPend = c.role === 'pc' && hasKind(c, 'ASI')
  const spellsPend = c.role === 'pc' && hasKind(c, '新法术')
  const vitChips = `<div class="bk-chips">
      ${chip('AC', d.ac ?? '???')}${c.speed != null ? chip('速度', c.speed + '尺') : ''}
      ${c.darkvision ? chip('暗视', c.darkvision + '尺') : ''}${chip('被动察觉', d.passive ?? '???')}
      ${c.temp_hp > 0 ? chip('临时HP', '+' + c.temp_hp) : ''}
      ${c.exhaustion > 0 ? chip('力竭', c.exhaustion + '级') : ''}
      ${(c.hd_available != null && c.level != null) ? chip('治愈骰', c.hd_available + '/' + c.level) : ''}
    </div>`
  const left = c.role === 'pc' || d.skills ? `
      ${capPend('Ability Scores', asiPend, grow?.open === 'asi', 'asi', CAP_TIPS.ability)}
      ${radarSvg(c, d)}
      ${sec('Saving Throws', `<div class="bk-saves">${(d.saves ?? []).filter(s2 => s2.prof).map(s2 => `<span class="bk-sv prof">${esc(ATTRS.find(a => a[1] === s2.key)?.[0] ?? s2.key)} ${sign(s2.mod)}</span>`).join('') || NONE_ROW}</div>`, CAP_TIPS.saves)}
      ${sec('Vitals', vitChips, CAP_TIPS.vitals)}
      ${sec('Skills', `<div class="bk-skills">${(d.skills ?? []).filter(s2 => s2.prof).map(s2 => `
        <div class="bk-sk prof"><span class="dot"></span><span class="nm2">${esc(cn(SKILL_CN, s2.key))}${s2.exp ? '<span class="exp">★</span>' : ''}</span><span class="attr-tag">${esc((ATTRS.find(a => a[1] === s2.attr)?.[0] ?? s2.attr).toUpperCase())}</span><span class="md2">${sign(s2.mod)}</span></div>`).join('') || NONE_ROW}</div>`, CAP_TIPS.skills)}
      ${sec('Proficiencies', `<div class="bk-pb" data-tip="熟练加值——随等级 2→6,只加在熟练事项上(攻检/豁免/检定/DC)">Proficiency Bonus<b>+${d.pb ?? 2}</b></div><div class="bk-prof-groups">${profGroups(c).map(([lb, items]) => `<div class="bk-pg"><span class="gl">${esc(lb)}</span><span class="gs">${items.map(x => `<span data-tip="${esc(PROF_TIPS[lb] ?? '')}">${esc(x)}</span>`).join('') || NONE_ROW}</span></div>`).join('')}</div>`, CAP_TIPS.profs)}` : ''

  /* 右栏：Spellcasting(呼吸+学习框入口) → Conditions → Equipment/Gear → Features → Resistances / Immunities */
  const spFaces = c.spellSplit ?? { cantrips: [], known: c.spells_known ?? [] }
  const spRow = (lb, arr) => `<div class="bk-sp-row"><span class="lv">${lb}</span><span class="nms">${(arr ?? []).length ? esc(arr.join(' · ')) : NONE_ROW}</span></div>`
  const castInner = (d.slotsLv ?? []).length ? `
        <div class="bk-cast-top">
          ${chip('主属性', ({ wis: '感知', cha: '魅力', int: '智力' })[c.caster_attr] ?? c.caster_attr ?? '—')}${chip('法术DC', d.dc ?? '—')}${chip('法术攻击', sign(d.atk ?? 0))}
        </div>
        <div class="bk-slots">${d.slotsLv.map(s2 => `<div class="bk-slot"><span class="lv">${s2.lv}环</span><span class="pips">${Array.from({ length: s2.total }, (_, i) => `<span class="pip ${i < s2.now ? '' : 'used'}"></span>`).join('')}</span></div>`).join('')}</div>
        <div class="bk-spells">${spRow('戏法', spFaces.cantrips)}${spRow('已知', spFaces.known)}${spRow('已备', c.spells_prepared)}</div>` : NONE_ROW
  const castHtml = `
      <div class="bk-sec">${capPend('Spellcasting', spellsPend, grow?.open === 'spells', 'spells', CAP_TIPS.cast)}${castInner}</div>`
  const sts = c.statuses ?? []
  const stHtml = `
      <div class="bk-sec"><div class="bk-cap" data-tip="${esc(CAP_TIPS.cond)}">Conditions</div>
        ${sts.length ? `<div class="bk-st">${sts.map(s2 => `<span class="stc ${esc(s2.kind ?? 'i')}"><span class="k">${esc(s2.name)}</span>${esc(s2.remaining ?? '')}</span>`).join('')}</div>
        <div class="bk-stnotes">${sts.filter(s2 => s2.effect).map(s2 => `<p>${esc(s2.name)}：${esc(s2.effect)}</p>`).join('')}</div>` : NONE_ROW}
      </div>`
  const eqHtml = sec('Equipment', `
        <div class="bk-rows">
          ${(d.weapons ?? []).map(w => `<div class="bk-row"><span class="a">${fmtWeapon(w)}</span></div>`).join('')}
          ${c.armor ? `<div class="bk-row"><span class="a">${esc(cn(ARMOR_CN, c.armor))}</span><span class="b">AC ${esc(d.ac ?? '—')}</span></div>` : `<div class="bk-row"><span class="a">护甲</span><span class="b">无</span></div>`}
          ${(c.shield === true || c.shield === 'true') ? `<div class="bk-row"><span class="a">盾牌</span><span class="b">+2 AC</span></div>` : ''}
        </div>
        <div class="bk-sec" style="margin-top:8px">
          <div class="bk-cap" data-tip="${esc(CAP_TIPS.gear)}">Gear</div>
          <div class="bk-rows bk-note-rows">${(c.gear ?? []).map(t => `<div class="bk-row"><span class="a">${esc(t)}</span></div>`).join('') || NONE_ROW}</div>
        </div>`, CAP_TIPS.equip)
  const ftHtml = sec('Features', `
        <div class="bk-rows bk-note-rows">
          ${(c.features ?? []).map(f => { const seg = String(f).split('|'); const right = [seg[1], seg[2]].filter(Boolean).join(' · '); return `<div class="bk-row"><span class="a">${esc(seg[0])}</span>${right ? `<span class="b">${esc(right)}</span>` : ''}</div>` }).join('') || NONE_ROW}
        </div>`, CAP_TIPS.feats)
  const profHtml = ''
  const defHtml = sec('Resistances / Immunities', `
        <div class="bk-chips">
          ${(c.resist ?? []).map(r => chip('抗', r)).join('')}
          ${(c.immune ?? []).map(r => chip('免', r)).join('')}
          ${((c.resist ?? []).length + (c.immune ?? []).length) === 0 ? NONE_ROW : ''}
        </div>`, CAP_TIPS.resists)
  /* 小传：[秘] 行 NPC 永不显示；玩家显示但去前缀（biography 双职能=背景+记忆） */
  const isPC = c.role === 'pc'
  const bio = (c.biography ?? [])
    .map(b => String(b).replace(/^·\s*/, ''))
    .filter(b => isPC || !b.startsWith('[秘]'))
    .map(b => b.replace(/^\[秘\]\s*/, ''))
    .filter(Boolean)
  const taleHtml = bio.length || c.description || c.persona ? `
      <div class="bk-sec bk-tale">
        <div class="bk-cap">小传</div>
        ${c.description ? `<div class="desc">${esc(c.description)}</div>` : ''}
        ${c.persona ? `<div class="bk-perso">
          <span class="pl">性格</span><span class="pv">${esc(c.persona.personality ?? '')}</span>
          <span class="pl">理想</span><span class="pv">${esc(c.persona.ideals ?? '')}</span>
          <span class="pl">羁绊</span><span class="pv">${esc(c.persona.bonds ?? '')}</span>
          <span class="pl">缺陷</span><span class="pv">${esc(c.persona.flaws ?? '')}</span>
        </div>` : ''}
        ${bio.length ? `<div class="bk-mems"><div class="mt">追忆</div>${bio.map(m => `<p>${esc(m)}</p>`).join('')}</div>` : ''}
      </div>` : ''
  const CHROME = `<div class="bk-fade" data-act="bookClose"></div><div class="bk-arrow"><svg width="18" height="10" viewBox="0 0 18 10"><path d="M2 2l7 6 7-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`
  return `<div class="book open">${head}<div class="bk-body">
      ${taleHtml}
      <div class="bk-cols">
        <div>${left}</div>
        <div>${castHtml}${stHtml}${eqHtml}${ftHtml}${defHtml}</div>
      </div>
    </div>${CHROME}</div>`
}
