# Agent Note：酒馆转写着陆合约——按会话的阅读锚与 cause 贯通的着陆仲裁

Status: implemented

中文（本文件无英文镜像）

## 问题

转写的全部滚动语义只有一个「离底 80px 钉底」布尔（`chat-view.tsx` 的 `useBottomPinnedScroll`），它不分会话、不知换绑原因、组件实例作用域。后果：

1. **玩家永远回不到离开时的位置**——切走再切回、刷新、重启，一律跳到最新一行。「点到哪里，回来就展示到哪里」不存在；09-14 决策文档甚至把「打开/刷新必落最新一行」写成了设计目标。
2. **切换瞬间的几何抖动会重新钉住**——换绑时全量重放使容器高度塌缩，scrollTop 被 clamp 触发 scroll 事件，按「距底 ≤80px」重新置 true。玩家从没有机会带着「不钉」状态回来。
3. **唯一不剧透的着陆（载入存档）是三层行为的 coincident active**：引擎 fork 按 `atSeq: stamp.seq` 切短日志（`engine/src/index.ts` 的 load 动作）＋客户端全量重放＋钉屏落底——客户端从未见过 `stamp.seq`，这个「落在存档点」没有任何一层显式承诺，任何一层改动都会无声打破它。
4. 测试面上，09-14 落地的三个 bottom-pin 用例住在 `packages/ui/tests-client-plane/`（KNOWN GAP：该目录从未被 vitest include 匹配），**滚动链路的真实测试锚定是零**。

另：vendor 契约里的 `ChatScrollPosition (`slots.ts:123)`——`{anchorKey, anchorTop, scrollTop}`＋`save/read` 面——在本仓从未实现。它当年的两类病（锚 key 在 reflow 下漂移、锚恢复与异步分页窗口竞速）在酒馆侧都不成立：重放是同步全量、行可用 durable seq 定位。采纳其语义、不搬其实现。

## 决策

**四层正交，一条着陆合约。** 每层只回答一个问题，层间只经合约通信：

```
┌─────────────────────────────────────────────────────────────────────┐
│ ④ 着陆仲裁器（TavernChatView 内，booking 表 = landing.ts 纯函数）      │
│    输入: cause + 锚存层读数 + wire 事实     输出: 恰好一条 LandingPlan │
│    {follow: boolean, anchorSeq, offsetPx}                            │
└───────────────┬─────────────────────────────────┬───────────────────┘
                │ plan                            │ 离场捕获
┌───────────────▼────────────────┐  ┌─────────────▼───────────────────┐
│ ③ 滚动机械层 transcript-scroll │  │ ② 锚存层 reader-anchor.ts       │
│    follow()/unfollow()/land()  │  │    per-session {seq, offsetPx,  │
│    80px 带内/带外翻转 onFollow- │◄─┤    follow}；capture/read/clear  │
│    Change；无 deps glue 只在   │  │    ≤capacity LRU；localStorage  │
│    follow 时贴底；land 一次性  │  │    逐键持久（jsdom/隐私态退化内存）│
└───────────────┬────────────────┘  └─────────────────────────────────┘
                │ data-seq 定位
┌───────────────▼─────────────────────────────────────────────────────┐
│ ① 数据/重放层（不动）：durable 日志 seq 单调；read() 全量重放；        │
│    ChatLine 增 seq；行渲染带 data-seq——锚的物理载体                  │
└─────────────────────────────────────────────────────────────────────┘
```

**cause 枚举贯通。** 换绑入口六条（boot / 侧栏 manual-open / 切回 exit-return / 载入 load / 重试 retry·edit-start / 清空 clear），`decideLanding(cause, {stored, hasContent, loadAnchorSeq})` 是唯一翻译点：

| cause | 有位置锚 | 无锚/贴底锚 |
|---|---|---|
| boot / manual-open / exit-return | 恢复锚，流式不拽 | 跟随底 |
| exit-return 且切走时贴底 | — | 跟随底（贴底语义） |
| load | — | 跟随底（fork 切短的回放底部 = 存档点；wire 新增 `anchorSeq` 让这层 coincident 变成已被引擎背书的契约） |
| retry / edit-start | — | 跟随底（时序开始的地方） |
| clear | — | 跟随底（`cleared` 开场页另管） |

**跳主动作破坏恢复。** `send()`（含重试重发）= `store.capture(sessionId, null)` + follow()——玩家的发送先于任何待恢复锚生效，恢复与发送的竞态由此消失（锚不存在了）。

**不跟随的可见性。** 解除跟随（带外阅读或锚恢复）时转写右下角出现「回到底部」灯（`chat.toTail`），点击接回跟随并落底——缺席完成的回复不再需要玩家自己找。

**WriterColumn 不动。** 写卡列（工具性会话、单列）保持旧 hook 语义；本合约只作用于 TavernChatView 的游戏会话。

## 落点事实

- `packages/ui/src/client/reader-anchor.ts`：锚存层。`ReaderAnchor {seq, offsetPx, follow}`；`tavern.readerAnchor.<sessionId>` 逐键 localStorage；容量上限内 LRU（读串线）；坏 JSON / 非法数值条目按无锚处理。
- `packages/ui/src/client/landing.ts`：`decideLanding` 纯函数表（上表）。
- `packages/ui/src/client/transcript-scroll.ts`：`useTranscriptScroller`——follow/unfollow/land/isFollowing/onFollowChange；glue 无 deps effect 只在 follow 时贴底；`land(row, offsetPx)` 一次性把锚行顶送到指定视口位置，不接管后续 commit。
- `chat-view.tsx`：`ChatLine.seq?` 与各行 `data-seq`；`useBottomPinnedScroll` 保留给 WriterColumn。
- `TavernApp.tsx`：会话离场捕获（`[sessionId]` effect 清理段：DOM 仍带旧行）、着陆应用（lines 定案后一次性 land/follow）、send 清锚、「回到底部」灯。
- wire：`TavernRebindValue` 增 `anchorSeq: number | null`（load=存档刻 seq；reset=null）；engine load 两分支随行。

## 备选方案

- **只在 lines 身份变化时滚动**（09-14 已否决过一次）：依旧否决——机械层与锚恢复都要能对「增长来源」免疫，枚举法会如老文档所述反复漏源复发。
- **scrollbar 哨兵行 IntersectionObserver**：为一次性的着陆跳转引入观察器生命周期，比「行顶 − scrollTop」的纯几何贵；且 jsdom 无排版，测试成本翻倍。
- **恢复全程锚定**（stock 阅读器的设法）：每次锚行上方内容高度变化都重算视口。酒馆的转写行是追加流+图片懒载——上方案行高度只在一帧内变化，一次性 land 足够；持续锚定留给未来真的出现上方重写（如历史行编辑）时再评估。
- **归档会话落顶**：写稿时也评估过「侧栏旧会话落顶防剧透」，但侧栏行是**工作空间**而非会话（`rpc.workspaces` 按盘扫描、每根一定只有一个活绑定会话；被换绑的旧会话 id 根本不出现在侧栏）——该场景不存在，忠实记录以免未来重添。防剧透由「载入时 fork 切短」承担，行为已由 engine 测试与客户端用例双侧锚定。

## 后果

- 玩家阅读位置在切会话、刷新、重启三链路像素级恢复；正在流式的会话切走再回不再跳最新一行，回底灯可见。
- 09-14 的「fresh mount 必落最新」目标被推翻：fresh mount 的落点由 cause 决定（boot 有锚恢复锚，无锚才落底）。发码前后的行为差异全部钉在 `transcript-landing.unit.spec` / `transcript-landing.client.spec` 两套（此前该链路零锚定）。
- 锚以 durable seq 为身份：重放规则、行聚合、窗口截断（windowLast——当前三卡全部 `"all"` 休眠）怎么改都不漂移；锚行不在场时按 follow 兜底。
- 阅读锚是前端个人信息——localStorage 直存即可，不动引擎；换绑后旧会话 id 的锚自然成孤儿，LRU 上限兜住体积。
- 待办：tests-client-plane 整套恢复（README 有记载，等上游 testkit 或本方接手）；本批不动。
