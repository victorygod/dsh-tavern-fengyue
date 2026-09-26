# 卡内模块声明清单:UI JS 从固定四槽升级为 layout.json 声明装载

状态:已实施(2026-09-25,e4e6215) | 日期:2026-09-25 | 关联:`docs/cards/card-presentation.zh.md`(薄 API 契约源头,modules 两行已补)、[[2026-09-25-gal-domain-refactor]](第一个消费方,已随批落地)、`packages/ui/src/client/card-ui.ts`(装载实现)

中文(本文件无英文镜像)

## 0. 一句话

卡自带的 UI JS 模块从「写死的四槽词表」升级为「layout.json 声明清单,宿主按单装载、经 `tavern.mods.<名>` 注入」——卡内逻辑域再多也有地方住,装载权仍在宿主手里。「卡声明、宿主执行」的家法(suppress / dock / panels 皆是先例)在「我带几个模块」上的第四次贯彻。

## 1. 现状与瓶颈(为什么)

- **装载词表硬编码**:`loadCardUi` 直读固定路径表(card-ui.ts:328-337,八条 Promise.all:`theme.css / chat.css / layout.json / index.js / view.mjs / acts.mjs / ui.css / runtime.mjs`)。第五个 JS 逻辑域没有槽可住。
- **blob 模块互不能 import**:每槽各自 `URL.createObjectURL(new Blob([code]))` + 动态 `import(url)`(card-ui.ts:376-386)。blob URL 无兄弟基址——卡文件里 `import './x.mjs'` 解析到不存在的地址。跨文件协作只能经 mount face 注入(既有 `tavern.views / acts / runtime`,card-ui.ts:489-491)。
- **词表进化有先例**:view/acts/runtime 三槽就是 v2 面板时代加的;本批是同一条进化线的下一步。
- **触发案**:芙宁娜域重构(关联案)需要五个 JS 文件以上;没有本机制,它只能全挤 index.js——单文件 642 行袋子就是这么长出来的。

## 2. 设计

### 2.1 声明面(layout.json)

```json
{
  "modules": ["feed", "ptr", "para", "stage"]
}
```

- 名字规则:`/^[a-z][a-z0-9-]*$/`;数量上限 8(声明面要有尺寸感——清单不当垃圾场;首个消费方现役 4 名,8 为翻倍余量);重复即非法。
- 名字 N ↔ 文件 `preset/ui/N.mjs`,一对一。
- **保留名**:四槽既有名(index / view / acts / runtime)禁用——撞名即双轨道注入,同一模块两个门,fail 整份。
- 非法(非数组 / 成员非字符串 / 违名字规则 / 超上限 / 撞保留名 / 重复)→ **沿用既有全域刑事政策**:与 suppress 词表同款,任一非法成员把 layout.json 拒回默认整份 + console 响亮(card-ui.ts:296-299 的 fail 路径)。卡会因 suppress/dock/modules 全体缺席而行为大变——响亮得不可能漏看。

### 2.2 装载面(loadCardUi)

- presence 判定照旧不动(仍按固定路径表判「有没有卡包」);modules 是**独立追加**的按单装载。
- 逐名 `readText(preset/ui/<名>.mjs)` → 既有 `importModule` 同款 blob 装载 → 收进 `mods` 表;空白文件按缺席处理(presence 家族同口径,card-ui.ts:338)。
- **逐名 fail-visible(读侧响亮是新增纪律)**:单名读不到 / 空白 / import 抛错 = console 响亮 + `mods` 缺该键,**不**拖死整卡(模块缺席是卡组装层的编译错,卡侧守卫留痕停摆对应域——见关联案契约;宿主不替卡猜可否继续)。注意既有 `importModule` 对 null/空白**静默**返回(null,仅 import 抛错才 warn,card-ui.ts:376-386),且 RPC 失败与文件不存在同返 null(:199-206)——模块循环的读侧/空侧响亮必须新写,不能按「沿用既有」施工。
- 注入:mount face 增 `mods: Record<string, module namespace>`(未声明 = 空对象)。**为什么挂一层 `mods` 命名空间而不是平铺进 `tavern.<名>`**:卡起的名字进宿主顶层键 = 抢宿主词汇(mount face 是宿主所有物,卡起名撞宿主未来 face 无从预防)——与「dock 意图由宿主解析」同一条所有权律。
- dispose:blob URL revoke 走既有 `urls` 表统一回收(card-ui.ts:517)——零新纪律。
- 信任级:与四槽完全同源(装卡即宿主级信任,blob import 无沙箱)——不新增攻击面。

### 2.3 与四槽的关系

四槽原样保留(既有卡零迁移)。新卡的建议形态:**契约槽走原槽**(index.js = mount 唯一入口;view.mjs = 纯函数件,node 直测契约面),**过程域走 modules**——四槽是平台熟词,modules 是自家地皮。

## 3. 改动清单

```
宿主 packages/ui
  + card-ui.ts: CardLayout 增 modules 字段 + parseLayout 校验(名字规则/上限 8/保留名/去重,fail 即整单默认);
    loadCardUi 增 modules 装载循环(逐名 readText→importModule→mods 表,逐名 fail-visible);
    mount face 增 mods 注入(:457 起的 face 字面量)
  + card-ui.client.spec.ts: manifest 例四条(声明装载注入 / 拼错整单拒+warn / 声明了但文件缺→单键缺席留痕 /
    dispose 后 URL.revokeObjectURL 计数=宣称模块数——blob 维度现役零锚定,非「自顺延」);jsdom 面
    blob 动态 import 不通,断言按既有对冲形态书写(globalThis 捕获+回退分支,先例该文件 :161-187)
  ~ docs/cards/card-presentation.zh.md §修改面分类表两行:layout.json 行(:22)补 modules 声明、
    index.js 行(:24)的 mount 面清单补 mods
卡
  (第一个消费方芙宁娜由 [[2026-09-25-gal-domain-refactor]] 实施批携带,本案不单独动卡)
```

## 4. 明确不做

1. **不做目录枚举/通配**(读 `preset/ui/**` 全装):树语义已被直读探测的教训否决(card-ui.ts:325-327 注释在案)——装载面必须是声明出来的有限单。
2. **不把 blob URL 下发给卡自由 import**(卡拿 URL 数组自己 dynamic import):那是把装载权还给卡,违「卡声明、宿主执行」。import map / 多入口同一病。
3. **不做 per-module 沙箱/信任分级**:装卡即宿主级信任,模块粒度无意义;真要隔离是 iframe 案的既定后手。
4. **不做模块间依赖解析**(声明 A 依赖 B 宿主保证顺序):依赖关系是卡组装层的知识,宿主只认清单——`tavern.mods` 到手后由卡的 index.js 发牌。

## 5. 风险与契约

1. **声明与文件失配**(声明了缺文件 / 写错名):逐名 fail-visible 留痕;卡组装层对关键模块缺席必须再留痕并停摆对应域(fail-visible 家法两侧都要响,不许「整卡静默降级」)。关联案的 index.js 守卫将按此实现。
2. **layout 整体解析失败**:既有整单 fallback 语义不变(modules 随整单缺席——与 suppress/dock 同命运)。
3. **回归面**:装载路径三卡共用——dnd5e / codex / 芙宁娜 client spec 全跑 + 三卡真机 CDP(动宿主 ui 源照例 `pnpm build` 双面,E2E `--no-open`)。
4. **jsdom×blob 差异**:宿主 spec 里 blob 动态 import 在 Node/jsdom 不通(既有两度成灾记录;卡级 spec 皆为直导绕行先例)——manifest 的装载断言必须走对冲形态(见 §3),直接断言 mount face 是空头支票。
5. **旧宿主×新卡**:未合入本批的宿主对 layout.json 未知键静默忽略——`mods` 整面不出、新卡组装层须留痕停摆对应域(新卡要求宿主≥本批;卡侧守卫见关联案 §2.3 铁律 6)。

## 6. 验收

1. 声明 modules 的卡:mount 收到 `tavern.mods.<名>`,为模块 namespace(导出函数可见可调;宿主 spec 面按 §5.4 对冲形态断言)。
2. 名字拼错/撞保留名:整份 layout.json 拒回默认(modules 随 suppress/dock/panels 一并缺席——galgame 形态下即面板容器不挂、开场失守、不停靠,行为大变且响亮,不可能漏看)+ console 响亮。
3. 声明而文件缺:单键缺席 + warn,其余模块照常注入。
4. 未声明/旧卡(dnd5e、codex):`tavern.mods` = {},既有 spec 全绿零改动、行为逐帧一致。
5. dispose 后 blob URL 全 revoke——**新增断言**(spy `URL.revokeObjectURL` 计数=宣称模块数):现役 dispose 测试只锚「幂等不炸」,URL 维度零覆盖。

## 8. 真机验收回填(2026-09-25,批 6)

- **首消费方真机通过**:芙宁娜 `modules:["feed","ptr","para","stage"]` 四名宿主按单装载、经 `tavern.mods` 注入,四胶囊接线成功——e2e-gal-reader 五场景满分(落定/点读+存位/防剧透/真·切卡往返恢复段2/再点推进),卡片活着=manifest 装配可达的直接证明。
- 页面装配身份 `fengyue 标记 11 处 → 酒馆 fengyue 装配 ✓`(dev status);全套 449 例绿 + `pnpm build` 双面。

## 7. 落点事实(实施对账)

- `card-ui.ts`:`CardLayout.modules` + `parseLayout` 校验(名字规则/上限 8/保留名/去重/fail 整单)、装载循环(逐名 readText→blob 装载→mods 表,读侧响亮为新纪律)与 mount face `mods` 注言全部按案落地;四例 spec 齐验收 1-4。
- 验收 1 的 face 断言形态如实记为**双向对冲**(jsdom 下 vite-node 是否吞 data: URL 因环境而异):跑通则真断言 `tavern.mods` namespace;否则 console 留痕由真机承担——真机阶段由关联案卡自带守卫必然覆盖(无 mods 卡即 fail-visible 停摆,不可能静默通过)。
- 维度修正:验收 5 的 URL.revokeObjectURL 断言在 jsdom 下以**手工补桩**(defineProperty 上计数桩)实现,非既有库面——桩记数 = index.js+两宣称模块共 3,断言成立。
- 第一个消费方(芙宁娜)manifest 四名 feed/ptr/para/stage 随 [[2026-09-25-gal-domain-refactor]] 落地;旧卡零迁移。
