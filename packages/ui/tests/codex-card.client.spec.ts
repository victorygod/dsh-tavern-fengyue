// @vitest-environment jsdom
// dnd 老卡(codex 手簿)行为钉(2026-09-25 零锚补位 + v10 零轮询拆迁改写):
// 直导卡资产本身(blob import 在 jsdom 不通,卡级测试绕过 loadCardUi)。
//   ① boot:容器在场即同步建骨架+微任务首拉(原 200ms 自旋退役改 MutationObserver——
//      由「容器后置落地」例钉另一侧);
//   ② 数据泵(事件驱动):文件事件→立即拉,**无钟证明**(空闲 20s 零请求)——原
//      「2.5s 每拍必拉」断例按「断而不删改写」迁移;数据变更文本门→重绘;
//   ③ 表面三联:opening face 订阅驱动(原 500ms visPoll 退役);
//   ④ 容器后置落地:MutationObserver 事件化补拍;
//   ⑤ unmount 清理纪律。
// 设计:docs/notes/feature/2026-09-25-cards-zero-poll-migration.zh.md。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '../../../tavern_presets/dnd/preset/ui/index.js'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

/** ui_data 应答机:可变整册投影 + 受控 files/opening face。 */
function rig(player) {
  const calls = []
  const filesListeners = []
  const openingListeners = []
  let current = player
  const runScript = (name) => {
    calls.push(name)
    return Promise.resolve(JSON.stringify({
      ok: true, ...current, npcs: [], quests: [], items: [], skills: [], places: [],
      state: { name: '序章', desc: '旅途尚未开始' },
    }))
  }
  const tavern = {
    runScript,
    files: { subscribe: cb => { filesListeners.push(cb); return () => { const at = filesListeners.indexOf(cb); if (at >= 0) filesListeners.splice(at, 1) } } },
    opening: {
      greetings: [],
      active: false,
      subscribe: cb => { openingListeners.push(cb); return () => { const at = openingListeners.indexOf(cb); if (at >= 0) openingListeners.splice(at, 1) } },
    },
  }
  return { calls, filesListeners, openingListeners, tavern, setPlayer: next => { current = next } }
}

const STAGE = () => {
  const host = document.createElement('div')
  host.className = 'tavern-panel-codex'
  document.body.append(host)
  const composer = document.createElement('div')
  composer.className = 'tavern-composer'
  document.body.append(composer)
  const transcript = document.createElement('div')
  transcript.className = 'tavern-transcript'
  document.body.append(transcript)
  return { host, composer, transcript }
}

describe('dnd codex 手簿(v10 零轮询)', () => {
  it('boot:容器在场→同步建骨架→微任务首拉 + 表面初评(composer 让位)', async () => {
    vi.useFakeTimers()
    const { calls, tavern } = rig({ player: { name: '洛克', desc: '身经百战的老兵' } })
    const { host, composer } = STAGE()
    mount(tavern)
    expect(host.textContent).toContain('冒险手簿')   // 同步建骨架
    await vi.advanceTimersByTimeAsync(0)
    expect(host.textContent).toContain('洛克')         // 首拉后整册上屏
    expect(calls).toEqual(['ui_data.mjs'])
    expect(composer.className).toContain('codex-shift') // 表面初评:面板在场→composer 让位
  })

  it('数据泵(事件驱动):文件事件→立即拉;无钟证明:空闲 20s 零请求;文本变更→重绘', async () => {
    vi.useFakeTimers()
    const { calls, filesListeners, tavern, setPlayer } = rig({ player: { name: '洛克', desc: '身经百战的老兵' } })
    const { host } = STAGE()
    mount(tavern)
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toHaveLength(1)

    for (const fire of [...filesListeners]) fire()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toHaveLength(2)                      // 事件→立即拉(文本同值,门截住重绘)

    setPlayer({ player: { name: '洛克·改', desc: '受了新伤' } })
    for (const fire of filesListeners) fire()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toHaveLength(3)
    expect(host.textContent).toContain('洛克·改')       // 文本变→数据换→重绘(门只挡没变的)

    await vi.advanceTimersByTimeAsync(20_000)           // 旧 2.5s 钟该打 8 拍
    expect(calls).toHaveLength(3)                       // v10:事件不来,一拍不发
  })

  it('表面三联(opening face 驱动,500ms visPoll 退役):开场隐身+取消让位;散场复原', async () => {
    vi.useFakeTimers()
    const { openingListeners, tavern } = rig({ player: { name: '洛克', desc: '老兵' } })
    const { host, composer, transcript } = STAGE()
    mount(tavern)
    await vi.advanceTimersByTimeAsync(0)

    tavern.opening.active = true                        // 开场页在场
    for (const flip of [...openingListeners]) flip()
    expect((host as HTMLElement).style.display).toBe('none')
    expect(composer.className).not.toContain('codex-shift')
    expect(transcript.className).toContain('opening-live')

    tavern.opening.active = false                       // 散场:全复原
    for (const flip of [...openingListeners]) flip()
    expect((host as HTMLElement).style.display).toBe('')
    expect(composer.className).toContain('codex-shift')
    expect(transcript.className).not.toContain('opening-live')
  })

  it('容器后置落地:MutationObserver 事件化补拍(200ms 自旋退役)', async () => {
    vi.useFakeTimers()
    const { calls, tavern } = rig({ player: { name: '洛克', desc: '老兵' } })
    const { host } = STAGE()
    host.remove()                                       // mount 时容器缺席
    mount(tavern)
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toHaveLength(0)                       // 容器缺席:面板不启动(首拉也不发)
    document.body.append(host)                          // 宿主稍后渲染
    await vi.advanceTimersByTimeAsync(0)                // observer 微任务→launch
    await vi.advanceTimersByTimeAsync(0)                // 首拉微任务
    expect(calls).toHaveLength(1)
    expect(host.textContent).toContain('冒险手簿')
    expect(host.textContent).toContain('洛克')
  })

  it('unmount 清理纪律:订阅表清空,面板拆件,后续活表事件零响应', async () => {
    vi.useFakeTimers()
    const { calls, filesListeners, tavern } = rig({ player: { name: '洛克', desc: '老兵' } })
    const { host } = STAGE()
    const unmount = mount(tavern)
    await vi.advanceTimersByTimeAsync(0)
    const count = calls.length
    unmount()
    expect(filesListeners).toHaveLength(0)            // 退订真生效(fire 活表——不掰已退订闭包)
    for (const fire of [...filesListeners]) fire()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(calls).toHaveLength(count)
    expect(host.querySelector('.codex')).toBeNull()   // stop 拆件:手簿骨架随卸载清空
  })
})
