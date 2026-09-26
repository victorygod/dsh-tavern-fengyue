// @vitest-environment jsdom
// 芙宁娜 galgame 卡行为钉(2026-09-25 零锚补位 + v10 零轮询拆迁改写):
// 直导卡资产本身(dnd5e-panel-runtime spec 同款先例——blob import 在 jsdom 不通,
// 卡级测试绕过 loadCardUi 直取件)。
//   ① boot 序列:首拍 manifest+panel(350ms)→ 存档/刷新直落 input;
//   ② 数据泵(事件驱动):文件事件→立即拉一拍,**无钟证明**(空闲 20s 零请求)——
//      v10 拆迁后原「900ms 每拍必拉」断例按"断而不删改写"迁到此处;
//   ③ 订阅时序:boot 基线就绪前不挂 files 订阅(防与 applyTurn 双驱动竞态);
//   ④ waiting 看门狗(一次性,120s)+ 玩家行→waiting 的 poll ② 链;
//   ⑤ unmount 清理纪律;⑥ bootPoll 上界+失败上屏。
// 设计:docs/notes/feature/2026-09-25-cards-zero-poll-migration.zh.md。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '../../../tavern_presets/芙宁娜/preset/ui/index.js'
import * as views from '../../../tavern_presets/芙宁娜/preset/ui/view.mjs'
// v11 分域(2026-09-25):四胶囊经 mods 声明装载,rig 直导四件注入——
// 断言不改,只补面(旧 rig 的 tavern 无 mods = 旧宿主形态,现属停摆面)。
import * as feedMod from '../../../tavern_presets/芙宁娜/preset/ui/feed.mjs'
import * as ptrMod from '../../../tavern_presets/芙宁娜/preset/ui/ptr.mjs'
import * as paraMod from '../../../tavern_presets/芙宁娜/preset/ui/para.mjs'
import * as stageMod from '../../../tavern_presets/芙宁娜/preset/ui/stage.mjs'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

interface Call { name: string; op: string }

/** 制式 rig:可变 panel 应答 + 受控 files face(记录 listener、退订真实生效)
 *  + G3 停靠面(记录卡注册的槽与解停次数)。 */
function rig(opts?: { data?: () => Record<string, unknown>; failPanel?: boolean; noDockFace?: boolean }) {
  const calls: Call[] = []
  const filesListeners: Array<() => void> = []
  const files = {
    subscribe: (cb: () => void) => {
      filesListeners.push(cb)
      return () => {
        const at = filesListeners.indexOf(cb)
        if (at >= 0) filesListeners.splice(at, 1)
      }
    },
  }
  const data = opts?.data ?? (() => ({
    history: [],
    lastUser: null,
    // text/orig 同串:不同脚本的落定字段名都被喂到(冷读走 applyTurn(text))。
    lastAssistant: { seq: 1, text: '第一句台词', orig: '第一句台词' },
    cg: { id: 'cg0', layers: [] },
  }))
  // rev 恒随拍递增(真身=快照 mtime:size;落盘即变)——死值会被 poll 的 rev 短路拦住。
  let revSeq = 0
  const runScript = (name: string, ...args: string[]) => {
    const op = args.length > 0 ? (JSON.parse(args[0] as string) as { op?: string }).op : undefined
    calls.push({ name, op: op ?? '' })
    if (name === 'gal_data.mjs') {
      if (op === 'manifest') return Promise.resolve(JSON.stringify({ ok: true, cgs: {} }))
      if (opts?.failPanel === true) return Promise.resolve(JSON.stringify({ ok: false, error: '数据源未就绪' }))
      revSeq += 1
      return Promise.resolve(JSON.stringify({ ok: true, rev: `rev-${revSeq}`, assetKeys: [], data: data() }))
    }
    return Promise.resolve('{}')
  }
  const dockSlots: Element[] = []
  const undocks: number[] = []
  const tavern: Record<string, unknown> = {
    runScript, views, readAsset: undefined, files,
    mods: { feed: feedMod, ptr: ptrMod, para: paraMod, stage: stageMod },
  }
  if (opts?.noDockFace !== true) {
    // G3 停靠面(2026-09-25):记录卡注册的槽;解停计数供 unmount 纪律钉。
    tavern.dockComposer = (slot: Element) => {
      dockSlots.push(slot)
      return () => { undocks.push(1) }
    }
  }
  return { calls, filesListeners, tavern, dockSlots, undocks }
}

const TURN = () => ({
  history: [],
  lastUser: null,
  lastAssistant: { seq: 1, text: '第一句台词', orig: '第一句台词' },
  cg: { id: 'cg0', layers: [] },
})

const panelCalls = (calls: Call[]) => calls.filter(c => c.name === 'gal_data.mjs' && c.op === 'panel')

const STAGE = () => {
  const host = document.createElement('div')
  host.className = 'tavern-panel-galgame'
  document.body.append(host)
  return host
}

const drive = async (tavern: ReturnType<typeof rig>['tavern'], host: HTMLElement) => ({
  unmount: mount(tavern),
  host,
})

/** 四段回复的制式数据(session in payload = 段读位键源)。 */
const GG4 = (seq = 5) => ({
  session: 'session-gg',
  history: [],
  lastUser: null,
  lastAssistant: { seq, text: '其一\n其二\n其三\n其四', orig: '其一\n其二\n其三\n其四' },
  cg: { id: 'cg0', layers: [] },
})

/** 空回合首挂制式(2026-09-25 键源修复的钉):无 assistant 行;withSession=快照 head 已出。 */
const GG0 = (withSession: boolean) => ({
  ...(withSession ? { session: 'session-gg' } : {}),
  history: [],
  lastUser: null,
  lastAssistant: null,
  cg: { id: 'cg0', layers: [] },
})

/** 四段回复 + 同拍历史行(backlog 防剧透守卫断言需 history 携带当前回复整行全文)。 */
const GG4H = (seq = 5) => ({
  session: 'session-gg',
  history: [
    { role: 'user', seq: 4, text: '玩家问' },
    { role: 'assistant', seq, text: '其一\n其二\n其三\n其四' },
  ],
  lastUser: { seq: 4, text: '玩家问' },
  lastAssistant: { seq, text: '其一\n其二\n其三\n其四', orig: '其一\n其二\n其三\n其四' },
  cg: { id: 'cg0', layers: [] },
})

const clickDialog = (): void => {
  const dialog = document.querySelector('.gg-dialog')
  if (dialog !== null) dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

// 模式观察点(G3 迁移,2026-09-25):body.gal-input 类随量尺三件套退役——input 态
// 的可观察改为对话框 .gg-input 类(同一状态位的 CSS 驱动源;断而不删改写纪律)。
const inInputMode = (): boolean => document.querySelector('.gg-dialog')?.classList.contains('gg-input') ?? false

describe('芙宁娜 galgame 卡(v10 零轮询)', () => {
  it('boot 序列:容器落地即建 DOM → 首拍 manifest+panel(350ms)→ 存档/刷新直落 input', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)   // 卡内 ✂ diag 调试钉暂鸣
    vi.useFakeTimers()
    const { calls, filesListeners, tavern } = rig()
    const host = STAGE()
    mount(tavern)
    await vi.advanceTimersByTimeAsync(0)
    expect(host.querySelector('.gg')).not.toBeNull()                // whenHost 同步建骨架
    expect(filesListeners).toHaveLength(0)                          // boot 未成:files 订阅未挂(反向钉)
    await vi.advanceTimersByTimeAsync(550)                          // bootPoll 一拍:首拉
    expect(panelCalls(calls)).toHaveLength(1)
    expect(calls.some(c => c.op === 'manifest')).toBe(true)
    expect(inInputMode()).toBe(true)          // 落定不重播,直落 input
    expect(host.querySelector('.gg-name')?.textContent).toBe('你')
    expect(filesListeners.length).toBeGreaterThanOrEqual(1)         // boot 基线就绪后才订阅
  })

  it('数据泵(事件驱动):文件事件→立即拉;无钟证明:空闲 20s 零请求', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.useFakeTimers()
    const { calls, filesListeners, tavern } = rig()
    const host = STAGE()
    mount(tavern)
    await vi.advanceTimersByTimeAsync(550)
    expect(panelCalls(calls)).toHaveLength(1)

    for (const fire of [...filesListeners]) fire()                  // 工作区一动 → 立即拉
    await vi.advanceTimersByTimeAsync(0)
    expect(panelCalls(calls)).toHaveLength(2)                       // rev 同值短路,但拉取立发

    await vi.advanceTimersByTimeAsync(20_000)                       // 旧 900ms 钟在此期间该打 20+ 拍
    expect(panelCalls(calls)).toHaveLength(2)                       // v10:事件不来,一拍不发
  })

  it('玩家行落盘(事件)→ poll ② 清屏进 waiting;120s 看门狗一次性回 input', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.useFakeTimers()
    let turn = TURN()
    const { filesListeners, tavern } = rig({ data: () => turn })
    const host = STAGE()
    mount(tavern)
    await vi.advanceTimersByTimeAsync(550)
    expect(inInputMode()).toBe(true)

    turn = { ...TURN(), lastUser: { seq: 2, text: '走了' } }        // 玩家发送已落盘
    for (const fire of [...filesListeners]) fire()
    await vi.advanceTimersByTimeAsync(0)
    expect(inInputMode()).toBe(false)      // waiting(gg-waiting 隐藏文本)
    expect(host.className).toContain('gg-waiting')

    await vi.advanceTimersByTimeAsync(120_000)                       // 看门狗:一次到期回输入态
    expect(inInputMode()).toBe(true)
    expect(host.className).not.toContain('gg-waiting')
  })

  it('live 桥:宿主推流式正文 → 活性行即时上屏;完整行只入队,对话框点击翻段打字', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.useFakeTimers()
    const { tavern } = rig()
    const listeners: Array<(text: string) => void> = []
    const assistantLive = { subscribe: (cb: (text: string) => void) => { listeners.push(cb); return () => undefined } }
    const host = STAGE()
    mount({ ...tavern, assistantLive })
    await vi.advanceTimersByTimeAsync(550)

    for (const push of listeners) push('第一句台词')
    expect(host.querySelector('.gg-text')?.textContent).toContain('第一句台词')
    expect(inInputMode()).toBe(false)

    for (const push of listeners) push('第一句台词\n第二句台词\n')
    expect(host.querySelector('.gg-text')?.textContent).toContain('第一句台词')   // 只入队
    host.querySelector('.gg-dialog')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(26 * 10)
    expect(host.querySelector('.gg-text')?.textContent).toContain('第二句台词')
  })

  it('段读位(2026-09-25 批):同回合点读到段2→切走重挂载=回到段2完整上屏,不再直落 input', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.useFakeTimers()
    // 预置:上次玩到段1(r=0,reading)——boot 应复位段1而不是「视为全部已读直落 input」。
    localStorage.setItem('gg.reader.pointers', JSON.stringify({ 's:session-gg': { r: 0, paras: 4, asstSeq: 5, mode: 'reading', ts: 1 } }))
    const host = STAGE()
    const first = rig({ data: () => GG4(5) })
    mount(first.tavern)
    await vi.advanceTimersByTimeAsync(600)
    expect(inInputMode()).toBe(false)     // 恢复读位,不直落 input
    expect(host.querySelector('.gg')?.dataset.state).toContain('mode=reading')
    expect(host.querySelector('.gg')?.dataset.state).toContain('段 1/4')
    // 玩家点读:点一下补完打字,再点一下推进到段2 → 存位应更新 r=1。
    clickDialog()
    clickDialog()
    await vi.advanceTimersByTimeAsync(0)
    expect(host.querySelector('.gg')?.dataset.state).toContain('段 2/4')
    const saved = JSON.parse(localStorage.getItem('gg.reader.pointers') ?? '{}')['s:session-gg']
    expect(saved.r).toBe(1); expect(saved.mode).toBe('reading'); expect(saved.asstSeq).toBe(5)
    // 切走(卸载)再回来:新挂载 + 存位在场 → 回到段2。
    document.body.innerHTML = ''
    const second = rig({ data: () => GG4(5) })
    const host2 = STAGE()
    mount(second.tavern)
    await vi.advanceTimersByTimeAsync(600)
    expect(inInputMode()).toBe(false)
    expect(host2.querySelector('.gg')?.dataset.state).toContain('mode=reading')
    expect(host2.querySelector('.gg')?.dataset.state).toContain('段 2/4')
    expect(host2.querySelector('.gg-text')?.textContent).toBe('其二')
  })

  it('段读位:缺席期新回复落定(seq 前进)→ 重挂载回队头从头演绎(玩家未读,防剧透同义)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.useFakeTimers()
    localStorage.setItem('gg.reader.pointers', JSON.stringify({ 's:session-gg': { r: 3, paras: 4, asstSeq: 5, mode: 'reading', ts: 1 } }))
    const host = STAGE()
    const { tavern } = rig({ data: () => GG4(9) })     // 回复已换成 seq 9 的新一轮
    mount(tavern)
    await vi.advanceTimersByTimeAsync(600)
    expect(inInputMode()).toBe(false)
    expect(host.querySelector('.gg')?.dataset.state).toContain('mode=reading')
    expect(host.querySelector('.gg')?.dataset.state).toContain('段 1/4')
  })

  it('段读位:input 存位(点完过)重挂载 → 直落 input 旧契约保持', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.useFakeTimers()
    localStorage.setItem('gg.reader.pointers', JSON.stringify({ 's:session-gg': { r: 3, paras: 4, asstSeq: 5, mode: 'input', ts: 1 } }))
    const host = STAGE()
    const { tavern } = rig({ data: () => GG4(5) })
    mount(tavern)
    await vi.advanceTimersByTimeAsync(600)
    expect(inInputMode()).toBe(true)
    expect(host.querySelector('.gg-name')?.textContent).toBe('你')
  })

  it('段读位·键源提升(2026-09-25 修):空回合 boot(有 session 无回复)也取键 → 点读存位不流失', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.useFakeTimers()
    localStorage.removeItem('gg.reader.pointers')
    // 复现原缺口:boot 走空回合分支(开场期/玩家行未答)——旧代码 sid 恒 null,
    // 本页整个生命周期的点读存位被 savePointer 守卫静默吞光 → 点2段后切走重挂载
    // 就是「n 段全已读直落 input」(真机症状)。
    let turn: Record<string, unknown> = GG0(true)
    const { filesListeners, tavern } = rig({ data: () => turn })
    const listeners: Array<(text: string) => void> = []
    const assistantLive = { subscribe: (cb: (text: string) => void) => { listeners.push(cb); return () => undefined } }
    const host = STAGE()
    mount({ ...tavern, assistantLive })
    await vi.advanceTimersByTimeAsync(600)
    expect(inInputMode()).toBe(true)            // 空会话:输入态(键已在手)
    // 回答流出(live 桥):段1自动上屏 → 点两下推进到段2。此刻一次 poll 都没跑过——
    // 存位必须经 boot 键源当场落键,这是「提升」本身的钉(poll 自愈帮不上这里)。
    for (const push of listeners) push('其一\n其二\n其三\n其四\n')
    clickDialog()
    clickDialog()
    await vi.advanceTimersByTimeAsync(0)
    expect(host.querySelector('.gg')?.dataset.state).toContain('段 2/4')
    const savedEarly = JSON.parse(localStorage.getItem('gg.reader.pointers') ?? '{}')['s:session-gg']
    expect(savedEarly?.r).toBe(1); expect(savedEarly?.mode).toBe('reading')
    // 回答落盘(files 事件 → poll ① 校准 asstSeq)→ 切走重挂载:回到段2完整上屏
    turn = GG4(5)
    for (const fire of [...filesListeners]) fire()
    await vi.advanceTimersByTimeAsync(0)
    expect(host.querySelector('.gg')?.dataset.state).toContain('段 2/4')
    document.body.innerHTML = ''
    const second = rig({ data: () => GG4(5) })
    const host2 = STAGE()
    mount(second.tavern)
    await vi.advanceTimersByTimeAsync(600)
    expect(inInputMode()).toBe(false)
    expect(host2.querySelector('.gg')?.dataset.state).toContain('段 2/4')
    expect(host2.querySelector('.gg-text')?.textContent).toBe('其二')
  })

  it('段读位·键自愈(2026-09-25 修):boot 早于快照出生(session 缺席)→ 落盘拍 poll 补键,点读存位不流失', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.useFakeTimers()
    localStorage.removeItem('gg.reader.pointers')
    // 复现原缺口的另一半:全新会话首挂连快照都还没写(payload 无 session 可提)——
    // 光有 boot 提升不够,首条落盘拍必须由 poll 把键补上。
    let turn: Record<string, unknown> = GG0(false)
    const { filesListeners, tavern } = rig({ data: () => turn })
    const host = STAGE()
    mount(tavern)
    await vi.advanceTimersByTimeAsync(600)
    expect(inInputMode()).toBe(true)
    // 首条 submit 落盘:快照出生(head.sessionId 在场)+ 回答落定 → poll 自愈补键,落定拍即刻有位
    turn = GG4(5)
    for (const fire of [...filesListeners]) fire()
    await vi.advanceTimersByTimeAsync(0)
    expect(host.querySelector('.gg')?.dataset.state).toContain('mode=reading')
    expect(host.querySelector('.gg')?.dataset.state).toContain('段 1/4')
    const healed = JSON.parse(localStorage.getItem('gg.reader.pointers') ?? '{}')['s:session-gg']
    expect(healed?.r).toBe(0); expect(healed?.asstSeq).toBe(5)
    // 点读到段2 → 切走重挂载:同回合读位存活,回到段2完整上屏(用户原话链路)
    clickDialog()
    clickDialog()
    await vi.advanceTimersByTimeAsync(0)
    document.body.innerHTML = ''
    const second = rig({ data: () => GG4(5) })
    const host2 = STAGE()
    mount(second.tavern)
    await vi.advanceTimersByTimeAsync(600)
    expect(inInputMode()).toBe(false)
    expect(host2.querySelector('.gg')?.dataset.state).toContain('段 2/4')
    expect(host2.querySelector('.gg-text')?.textContent).toBe('其二')
  })

  it('backlog 防剧透·守卫闭环(2026-09-25 修):恢复读位后历史只截到已读段,点一条多展一段', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.useFakeTimers()
    // 预置读到段2(r=1);history 携带当前回复整行全文——修前 boot 漏设 asstText,
    // 守卫截断腿失效,恢复后历史直接整行全文剧透(真机报告第二弹)。
    localStorage.setItem('gg.reader.pointers', JSON.stringify({ 's:session-gg': { r: 1, paras: 4, asstSeq: 5, mode: 'reading', ts: 1 } }))
    const host = STAGE()
    const { tavern } = rig({ data: () => GG4H(5) })
    mount(tavern)
    await vi.advanceTimersByTimeAsync(600)
    expect(host.querySelector('.gg')?.dataset.state).toContain('段 2/4')       // 恢复读位本身健在
    const bl = (): string => Array.from(host.querySelectorAll('.bl-row.a .bl-text')).map(n => n.textContent ?? '').join('‖')
    expect(bl()).toContain('其二')
    expect(bl()).not.toContain('其三')                                          // 未读的后两段不得露面
    expect(host.querySelector('.bl-row.u .bl-text')?.textContent).toBe('玩家问') // 非当前行不受截断(全量正常渲染)
    clickDialog()                                                              // 恢复态无打字机:单点即推进
    await vi.advanceTimersByTimeAsync(0)
    expect(host.querySelector('.gg')?.dataset.state).toContain('段 3/4')
    expect(bl()).toContain('其三')
    expect(bl()).not.toContain('其四')
    clickDialog()                                  // 补完段3打字(typing 在跑:这一击是补全,非推进)
    clickDialog()                                  // 队尾推进到段4 → 历史完整入史
    await vi.advanceTimersByTimeAsync(0)
    expect(bl()).toContain('其四')                                              // 点到队尾=全读,回复完整入史
  })

  it('unmount 清理纪律:订阅表清空、定时器清、停靠解停、全量停摆', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.useFakeTimers()
    const { calls, filesListeners, tavern, undocks } = rig()
    const host = STAGE()
    const unmount = mount(tavern)
    await vi.advanceTimersByTimeAsync(550)
    const count = panelCalls(calls).length
    unmount()
    expect(filesListeners).toHaveLength(0)            // 退订真生效(fire 活表——不掰已退订闭包)
    for (const fire of [...filesListeners]) fire()
    await vi.advanceTimersByTimeAsync(9_000)
    expect(panelCalls(calls)).toHaveLength(count)
    expect(undocks).toHaveLength(1)                   // G3:卡侧解停双保险(body.gal-ui 类已随量尺退役)
  })

  it('bootPoll 上界(BOOT_TRIES):持续失败 → 停摆并上屏(曾无限静默自旋)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.useFakeTimers()
    const { calls, tavern } = rig({ failPanel: true })
    const host = STAGE()
    mount(tavern)
    await vi.advanceTimersByTimeAsync(350 * 15)
    expect(panelCalls(calls)).toHaveLength(9)                        // 9 拍后自停,不再自旋
    expect(host.querySelector('.gg-text')?.textContent).toContain('数据通道未就绪')
    expect(warn).toHaveBeenCalled()
  })
})

describe('芙宁娜 galgame 卡(G3 停靠:卡供槽,宿主搬运)', () => {
  it('挂载即注册槽:data-dock-slot="composer" 元素经 dockComposer face 交给宿主,不依赖 boot 数据', () => {
    const r = rig()
    const host = STAGE()
    mount(r.tavern)
    const slot = host.querySelector('[data-dock-slot="composer"]')
    expect(slot).not.toBeNull()
    expect(r.dockSlots).toEqual([slot])
  })

  it('unmount 走 stops 解停——宿主 handle dispose 之外的卡侧显式回退(双保险)', () => {
    const r = rig()
    STAGE()
    const unmount = mount(r.tavern)
    expect(r.undocks).toHaveLength(0)
    unmount()
    expect(r.undocks).toHaveLength(1)
  })

  it('旧宿主无 face → fail-visible 留痕(console 响亮),卡与其余形态继续工作(降级而非静默)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.useFakeTimers()
    const r = rig({ noDockFace: true })
    const host = STAGE()
    mount(r.tavern)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('宿主无 dockComposer face'))
    // 降级不毁卡:boot 通道照常走完(首拍 panel 到达)
    return vi.advanceTimersByTimeAsync(550).then(() => {
      expect(host.querySelector('.gg-text')).not.toBeNull()
    })
  })

  it('卡内零宿主节点写入:mount 全程不触碰 .tavern-composer(量尺退役的行为面)', () => {
    // jsdom 里预置一个宿主 composer 原件:若卡仍走 querySelector+内联写入,
    // style 属性会脏;G3 下卡不知晓它的存在。
    const composer = document.createElement('div')
    composer.className = 'tavern-composer'
    document.body.append(composer)
    const r = rig()
    STAGE()
    mount(r.tavern)
    expect(composer.getAttribute('style')).toBeNull()
  })
})
