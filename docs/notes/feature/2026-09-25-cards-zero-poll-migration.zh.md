# 卡前端零轮询迁移:三源驱动(每卡前后对比)

状态:设计定稿(自审修订版) | 日期:2026-09-25 | 关联:[[2026-09-25-file-events-channel]](通道批,先读其图解)、[[2026-09-24-tavern-opening-surface-contract]]

> **目标(2026-09-25,用户)**:基础设施已备好(通道批),"完全杜绝轮询";让每张卡的数据交互更简洁、优雅、可靠,前端压力显著下降。
>
> **术语钉死**:杜绝的是**常驻数据 interval**。允许保留:本地动画(打字机)、一次性看门狗、一次性有界 boot 自旋。
>
> **阶段关系**:通道批 = 基建落地+真机验证(节拍不动);本批 = 逐卡拆迁定时器。任何一张卡停在中间形态都完全成立。

## 谱系与域分工(与"尾代理停没停"的关系)

本谱系已有三块砖:`tavern-tail-done` 落定信号(2026-09-20 tail-unlock-push,尾代理停没停由它管,早已零轮询)→ opening/assistantLive face(2026-09-24)→ files face(通道批)。**两域互不替代**:尾代理停没停=会话事件域(follow 流),文件变了=文件域(本通道);尾代理写盘部分(工具/记账)恰好归本通道管,两通道在 tail 运行窗口并肩工作。tail-unlock-push 留下的红线("session 事件不能随手复用,防投影副作用")正是本通道选独立 SSE 面的依据。遗留:维护行 `loadTailDetails` 2s(子会话 durable 日志,不在 tavern_workspace,仅 tail 期存在)——**谱系延伸候选(将来批)**:SSE 路由加 `{type:"tail"}` 帧推工具结果落地提示,engine 通知器角色第二次复用。

## 图解:三源驱动,一处裁决,rev 挡传输

```
之前:卡揣个钟,每 N 秒醒来问世界变没变(空闲也在烧)
之后:卡没有钟,三种情况才醒——
  boot    │ 挂载拉一次全量(一次性,非轮询)
  signal  │ 文件动了被叫醒(通道,~300ms 级)
  gesture │ 玩家动手(开册/翻段/发送,本来就有)
  ──────────────────────────────
  rev 门裁决"到底变没变":同值 → 连 data 都不回(拉式差量)
  空闲 = 零唤醒、零网络、零定时器
```

## 0. 零兜底的失效保障(全住在通道层,卡无感)

| 失效 | 侦测 | 自愈 |
|---|---|---|
| SSE 断线 | EventSource 原生重连 | 第二次 hello → 全订户强制 resync 拉一次,补齐断线期间的变更 |
| watcher 挂(EPERM/ENOSPC) | engine 捕获 error | 推 `{"type":"watch","ok":false}` → **单例自动降级 30s 慢拉**,`ok:true` 自动停 |
| 事件静默漏检 | 不可侦测 | **手势自愈**:每次玩家点击本来就走拉取,盲区最多活到下一次交互 |
| 极端组合(没人点+watcher 假活) | — | 可选分钟级保险拉,**默认关**,用户拍板 |

## 1. 芙宁娜(v1 直控 galgame)

| | 现在(index.js) | 改后 |
|---|---|---|
| 泵 | `pollTimer` 900ms 固定(:557),**后台页签不降频** | 删;`tavern.files.subscribe → void poll()`(rev 短路原样) |
| boot | bootPoll 350ms **无上界自旋、失败静默**(:532-536) | 加尝试上界 + 失败上屏(家训:禁空吞错);"一次性有界"属 boot 非轮询 |
| 120s 看门狗 | 藏在 poll() ③(:490)——poll 不跑就不生效 | 抽独立一次性 `setTimeout`(进 waiting 起臂) |
| 容器等待 | waitHost 200ms 自旋(:505,有界) | MutationObserver 盯 `.tavern-panel-galgame` 出现(纯 DOM 事件) |
| 动画 | typing 26ms | 不动(本地动画) |

**链路验证**(发送→等待):玩家送出 → user 行 durable → snapshot 重写 → 文件事件(~300ms) → poll ② 清屏进 waiting。延迟与旧钟同量级(300~900ms→300~400ms),且旧常驻钟消失。**CG 双缓冲/防剧透/段状态机零改动**——它们本来就是手势与 live 驱动的。

## 2. dnd5e(v9 声明形态,样板卡)

**runtime.mjs 泵净缩**:重臂/降频定时器**整段删除**(`PERIOD_*`/`schedule(doc.hidden?…)` 消失),零轮询版比通道批 §5 更简:

```javascript
const runBeat = () => { if (disposed || stopped() || beating) return
  beating = true
  void Promise.resolve().then(async () => { for (const p of deps.panels) { if (stopped()) return; try { await tickPanel(p) } catch {} } })
    .finally(() => { beating = false; if (kickWanted) { kickWanted = false; runBeat() } }) }   // 不再重臂
const kick = () => { if (disposed || stopped()) return; if (beating) { kickWanted = true; return } void runBeat() }
```

| | 现在 | 改后 |
|---|---|---|
| 泵 | loop 定时重臂 2s/隐 10s | mount 时 `runBeat()` 一次;kick(文件/手势/降级慢拉同入口);**容器出现靠 MutationObserver 重挂首拍**(自审增量:删泵后不再有免费重试) |
| 表面 | visPoll 300ms 摸开场类名 | `tavern.opening.subscribe → kick`(**必选迁移**:hideDuringOpening 的回显原来靠每拍 applyVisibility,删泵后无 tick 可蹭) |
| 契约 | `op:panel` 每次全量投影 | **拉式差量**:args 带 `rev`,同值 → `{ok,rev,changed:false}` 无 data;**脚本配套 30~50 行惰性化**(现状 player/companions/state 是模块顶层急加载,gal_data 连 manifest 都顶层读——不惰性化则只省传输不省读盘) |
| 旧账 | ui_zh.md:89"rev 心跳"列了硬要求从未接线;`op:rev` 死件 | 一并结清:触发器从时间换成事件,比原两级协议少一跳 |
| 手势 | acts 的 refresh(name) 只解门不拉数 | 不动——front_commit 落盘自带事件,kick 后 refreshOnce 生效;book 自取切片 |

`refreshOnce`/`revs`/`lastData`/act 全链语义不变;**spawn 仍是取数单位**(事件数=回合数级,有界),消灭 spawn 留给"只读 RPC 纯增量"另案(通道批已留口)。

## 3. dnd 老卡(codex 阅读器,遗产)

| | 现在 | 改后(最小改,推荐) |
|---|---|---|
| 泵 | 2.5s 全量拉**无 rev 门,每拍无条件 innerHTML 重绘**(index.js:167) | 删 timer;`subscribe → void refresh()`;**加客户端全文本比对门**(上次 JSON 文本相同→跳过 paint)——脚本零改动 |
| 表面 | visPoll 500ms 管三件事(:95-104) | `opening.subscribe` 回调里做同三件事 |
| 容器 | waitHost 200ms(:109) | MutationObserver |

v9 归一(view/acts/runtime 同 dnd5e)列为可选大改,不推荐:独立遗产体系,零轮询经由最小改已达成。

## 4. 完整受益清单与统一用法(全库盘点)

**A 卡侧(本批)**:芙宁娜 ①900ms 泵→subscribe→poll() ②bootPoll 无界自旋→上界+上屏 ③waitHost→MutationObserver ④waiting 120s→独立看门狗;dnd5e ⑤泵双频→kick ⑥visPoll→opening(必选) ⑦op:rev 漂移→rev 短路结清;dnd ⑧2.5s 无门全量→subscribe+全文本门 ⑨visPoll/waitHost→同上。

**B 宿主前端(后续同模式批)**:编辑器树+选中(双档 2s/8s)、卡身份 meta(双档)、DraftPanel chip(2s)——三者皆 `subscribeFileEvents(sessionId)` 后触发既有刷新;`loadTailDetails`(tail 期 2s)**不直接受益**→`{type:"tail"}` 延伸点。

**C 服务端腹地(同 watcher 复用)**:引擎工具面同步(现为每次组装的目录探针)直接吃事件;存档列表刷新可由 savings/ 落盘事件自然化(非紧迫)。

**D 明确不受益**(防贪功):chat 流式/回合落定/尾代理进度/session 列表/credentials——早已全推送,本通道零增量。

**统一用法**:卡侧 `tavern.files?.subscribe?.(() => 既有拉取())` 三行;宿主侧 `subscribeFileEvents(sessionId, 既有刷新)`。两条心智规则:回调只触发拉取、不解析事件;降级(resync/30s 慢拉/手势自愈)全在通道层消化,消费方无感。

**到期重估条款**:若 tavern wire 冻结解除,`@Remote({mode:'stream'})` 骑 WS mux(免费鉴权、免新路由)应回头收编本 SSE 路由——当时因冻结+客户端产物不可再生而落选;帧类型注册表保持封闭(hello/files/watch[,tail]),消费方必须容忍未知帧。

## 5. 自审修订记录(相对初稿)

1. **容器时序缺口**:删泵后丢失 2s 免费重试,waitHost 类统一改 MutationObserver(事件化,连有界自旋也消掉);
2. **通道去抖窗改逐事件重臂 + 1s 最大窗**(已同步修 [[2026-09-25-file-events-channel]] §3.1)——quiet 语义 + burst 长于 300ms 不再中途 flush 半写文件;
3. **opening.subscribe 由"顺手收编"升格"必选"**——零轮询后 applyVisibility 无 tick 可蹭;
4. **rev 短路的脚本惰性化成本如实入账**(不再是"几行")。

## 6. 量化(空闲 = 无人写盘、无人点按)

| 卡 | 常驻 interval | 空闲网络请求 | 空闲 spawn | 重绘 |
|---|---|---|---|---|
| 芙宁娜 | 1→**0** | ~67/分→**0** | ~1.1/秒→**0** | rev 挡,不变 |
| dnd5e | 泵+visPoll→**0** | ~60/分→**0** | ~1/秒→**0** | rev 挡,不变 |
| dnd | 3 个→**0** | ~36/分→**0** | ~0.4/秒→**0** | **每拍无条件→截住** |
| 高峰 | 事件驱动:≤3.3 批/秒/会话,kickWanted 串行,rev 挡传输 | 同左 | 同左 | 同左 |

## 7. 实施顺序(每步全绿)

1. dnd5e 样板:零轮询泵 + MutationObserver + `op:panel rev 短路`(脚本惰性化)+ opening 迁移 + engine/单例的 watch 降级帧与慢拉;
2. 真机验证:空闲 Network 零请求、写盘→HUD 秒动、kill watcher→30s 慢拉自动接管;
3. 芙宁娜迁移(删钟/订阅/boot 上界+上屏/看门狗迁出/Observer);
4. dnd 最小改(订阅+全文本门+opening 迁移/Observer);
5. (可选,默认关)分钟级保险拉;
6. 文档收尾:ui_zh.md / panel-data_zh.md 轮询契约更新(rev 心跳条目结账)。
