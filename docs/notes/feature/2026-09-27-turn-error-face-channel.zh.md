# 回合失败通道:turnError face 三层 + 芙宁娜失败演出(含快败回声锁)

状态:**已实施**(2026-09-27 批:宿主 face + 芙宁娜卡演出 + 失败回执可见性三层,真机双 phase 全绿)| 日期:2026-09-27 | 关联:[[2026-09-25-file-events-channel]](face 家法同族:纯事件面+按名装载)、[[2026-09-25-gal-domain-refactor]](卡分域,interrupt 落点在演出机)、[[2026-09-24-tavern-opening-surface-contract]](声明面家族)

> **缘起(真机立案)**:玩家在芙宁娜卡上发消息全程「卡住」——点发送后转圈,无任何错误可见。诊断双案:①对话失败原发是 provider 401(配置侧问题,见 devlog 2026-09-27 条),但 dnd 卡「有报错」而芙宁娜「没有」——**不是特权差异,是可见性差异**;②galgame 形态 `chat.css` 明文「转写区恒隐」(`.tavern-transcript{opacity:0;pointer-events:none}`),而失败回合宿主侧的唯一出口就是转写里的红行(`.errMsg`)——**画了,但生在玩家看不见的地方**;③卡面唯一可感知的失败是 `gal_data` 回空串,9 拍后统一「数据源未就绪」——原因链在 api→face 被逐层丢弃。

## 0. 可见性三层(fail-visible 家族,先修这个)

| 层 | 修复前 | 修复后 |
|---|---|---|
| 宿主 face(`packages/ui/src/client/card-ui.ts` `runScript`) | `then(value => value.text)`——api 的 `value.failure`(reason/exitCode)被扔掉,**所有失败一个样** | `failure` 在场即抛:`Error("script \"gal_data.mjs\" failed (exit 1)")` 原文带上 |
| 卡仓库(`preset/ui/feed.mjs` `tryFetch`) | `catch { return null }`——错象归零 | catch 落进 not-ok 信封 `{ok:false, error: message}`,boot 拍携真因 |
| 演出机(`preset/ui/para.mjs` `dead()`) | 文案写死「详见控制台」 | 具体原因照登对话框,console 留痕不限 |

自此任何平台任何失败,玩家在屏幕上看到的就是诊断材料——2026-09-27 Windows 分诊批([windows-sandbox-refusal](../bug-fix/2026-09-27-windows-sandbox-refusal.zh.md))能 10 分钟定案,靠的就是这层先通。

## 1. 宿主:`tavern.turnError` face(files face 同族)

- **形状**:`subscribe(listener: ({seq?, code?, message}) => unsubscribe)`;台词与转写 `.errMsg` 行**同源同变换**(`code===MISSING_CREDENTIAL → t('chat.errorKey')`)。
- **live-only 门**:喂点在转写读取器的 `primed` 门后(`TavernApp.tsx`)——活到的失败拍即投,重放(重挂载首读)不补投;**转写历史行仍是失败事实的正本**,face 只保证「别让转写恒隐的卡失明」。
- 家法同 files face:纯事件不去重、dispose 清 listener、不订阅零影响(旧卡/旧宿主双向安全)。
- 类型:`TavernTurnErrorFace`/`TurnErrorFact`(`card-ui.ts`);WriterColumn 不挂卡,喂点仅 RP 读取器一处。

## 2. 卡:芙宁娜失败演出(preset/ui 三件)

- **骨架**:`.gg-dialog` 首子元素 `.gg-err`(红族沿用停止键 `.gg-stop` 色板,`ui.css`);index.js 订阅路由 `tavern.turnError?.subscribe → presenter.interrupt`,旧宿主无 face → console 留痕降级(fail-visible,看门狗兜底仍在)。
- **`para.interrupt(text)`**:
  - 横幅上文 + `waiting → input` **即刻回落**——120s 看门狗降级为死回合兜底,不再是 UX(这是「卡住」体感的主修);
  - 横幅**存活到成功拍**:boot/①settle 调 `clearInterrupt()` 揭幕,跨 waiting 回落仍可见;再失败可再上屏;
  - 空文案(宿主未携关于失败的信息)不吞屏:不上横幅不切模式,退回看门狗。
- **快败回声锁(`errJust`)**:404 级 provider 快败(SSE 秒回)可早于卡面 ②(快照落盘→文件事件→泵拍)到达。reverse 序里,失败拍后迟到的 ② 是**本回合自己的玩家行回声**,不当新发送——锁在败拍置位,首拍 ② 消费(不进 waiting),真新发送的 ② 照常进 waiting;①settle/boot 解锁。慢败序(② 先到)原语义不变。两序真机皆验。

## 3. 测试与真机

- `card-ui.client.spec`:纯事件面契约钉(连发送达/双订阅/单摘/dispose 静默)+ mount face 接线钉(turnError 经 tavern 到卡)。
- `galgame-card.client.spec` 新 ⑦ 域五钉:失败拍上文+即刻回落(不耗看门狗)/存活到成功拍+可再上屏/快败竞态回声锁/空文案不吞屏/旧宿主留痕降级+unmount 摘订阅。合计 UI 全套 192 绿。
- 真机 `scripts/e2e-gal-errorface.mjs` 双 phase:error(坏 baseURL boot)→ 横幅「DeepSeek Messages request failed (404)」+ waiting 即消 + 宿主转写红行在场(恒隐但事实不丢);happy → 转写 27→246 字符真回复、零横幅零红行。
- **E2E 判据分叉(galgame 形制)**:读段期 composer 收进卡槽,`waitSettled` 的发送键形态判据对本卡恒不可见——改读宿主转写整段 textContent 增长(模式无关);composer 定位收窄 `.gg-dock-slot textarea`;DOM 断言用 `[class*="errMsg"]`(构建产物 CSS modules 哈希类,源码类名直选必空)。
