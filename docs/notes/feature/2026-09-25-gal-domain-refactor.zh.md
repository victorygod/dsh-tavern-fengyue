# 芙宁娜 ui 域重构:单闭包袋子拆五胶囊六文件(行为零 diff)

状态:已实施(2026-09-25,四批:48d55e0 规则下沉 / 0ef4354 四胶囊成体 / e2bf737 index 重建 / 文档回写批) | 日期:2026-09-25 | 依赖:[[2026-09-25-ui-modules-manifest]](门 B 前置:feed/ptr/para/stage 四名走该装载,已落地) | 契约源头:`tavern_presets/芙宁娜/docs/design_galgame-ui_zh.md`(§3/§5 本批回写真话)、`docs/notes/feature/2026-09-25-composer-dock-g3-portal.zh.md`(停靠契约保持)

中文(本文件无英文镜像)

## 0. 一句话

index.js 从「19 键公共袋子 + 双摄取通道 + 唯一写手靠自觉」重排为五胶囊六文件:**仓库**(单通道摄取)、**书签**(唯一可变正本/防剧透唯一守门)、**演出机**(唯一推进者)、**舞台**(演出效果,无进度概念)、**组装**(发牌员)——规则全部下沉 view.mjs 纯函数件,行为零 diff,既有 16 例 client spec 全绿即交。

## 1. 立案证据(为什么非拆不可)

1. **双摄取通道**:`poll()`(index.js:463)与 boot 内嵌块(index.js:562)是两条平行数据摄取路,同一批 state 键两处人工同步。v10.1 两起事故(段读位键源 `sid` 空会话被吞、`asstText` 漏设致防剧透截断腿失效——index.js:8-12 头注自述)全是两路失同步:**同一条不变式住在两个地方 = 已发生两次的漂移事实**,不是假设。
2. **防剧透双定义**:view.mjs:57/:66 `backlogRows`/`backlogHTML`(seq 水位语义——整条行可见/不可见的粗粒度)全仓零调用;活版是 index.js:397 `renderBacklog` 内联(行偏移语义——截到已读行内偏移,保留半条行)。同一业务规则两个家、两套语义,一套是死的——未来任何人「看样子能用」接错即事故。
3. **公共袋子 19 键**:state = index.js:46-61(mode/r/paras/双 seq/双 text/asstRaw/lineEnds/liveText/reasoning/thinkOpen/history/cg 两键/assets/assetMissed/rev/sid),每个域随手读写;`savePointer` 被三个域各自调(:283 落定 :303 推进 :336 输入态)。改任何一域,理解半径 = 全文件——「改啥都不明不白」的度量就是头部 22 行编年史。
4. **契约文档漂移**:design §3「段落进度不落盘」、build §5「不做 token 级直播流」双双被 09-25 批推翻而未回写——绕开文档架构进入的功能必然找不到正本的家,只能往袋子里塞键。
5. **单文件是立项定案**:design §7 映射表「控制器:`ui/index.js` 重建为 v1 直控」、build §3 文件清单「index.js 重写(v1 状态机控制器…)」——立项从头便无域划分;此后每批(防剧透截断/读位/live 桥/零轮询)都是同动作:加三五键+几处跨域调用。袋子涨至 642 行。

## 2. 设计:五胶囊 + 四动词

### 2.1 对象表

| 胶囊 | 身份 | 私产 | 绝不做 |
|---|---|---|---|
| **剧本 Script** | 有什么可演(**不可变值**,无对象) | 段序列(含每段 cg 标记)/原文/行偏移/历史行 | 无行为,只被读;新轮回=整对象换血 |
| **书签 Bookmark** | 玩家读到哪(唯一可变正本) | 段 r/轮次水位 asstSeq/会话身份 sid/态 | 不碰 DOM 不碰剧本;持久化唯一写手 |
| **演出机 Presenter** | 唯一推进者(时序) | 打字机进度等瞬态 | 不算内容(问剧本)、不存读位(写书签)、不管演出效果(发舞台) |
| **舞台 Stage** | 演出效果 | 双缓冲图层/资产缓存/情绪浮层 | 不认识进度:不知道第几段、seq、剧本 |
| **仓库 Repo** | 外界唯一入口 | 摄取态(rev/水位/live 桥) | 不碰书签演出机,只交货 |

组装(mount)= 产房+拆迁办:造全部胶囊、发牌、清理表逆序。

### 2.2 四动词(全卡跨对象动词封顶)

```
rebind(剧本, 因由)     仓库 →组装→ 演出机:整本换,重新装。因由五种:boot|live|settle|user|stage
show(景)/prime(资产) 演出机 → 舞台:演出事件族(幂等换场/资产预载),舞台唯一对外面;
                       泵态 CG 换场(因由 stage)不 rebind 剧本,由演出机按事实集直发
advance/settle/sync   演出机 → 书签:全卡唯一写手调用(段推进/输入态落定/水位校准)
gate(剧本)            演出机/视件 → 书签(只读):领已读边界
```

### 2.3 六条铁律(不变式)

1. 剧本不可变:引用相等即没变(rev 语义升入对象层)。
2. 书签唯一可变正本:唯一写手=演出机,唯一持久化点=书签自己。
3. 任何正文出口(对话框/live 行/backlog)必过 gate——防剧透一处定义;键漏设=gate 无从构造,错不出去。
4. 舞台无进度:只收演出事件,幂等。「入队不切 CG、段展示时切」从隐语升为演出机明文职责。
5. 摄取一通道:boot=live=落定=新玩家行=CG 态,同一 ingest、因由区分——双摄取漂移面拆除。
6. 降级自理:存储不可用→书签退内存;旧宿主无 live face→仓库只走落定拍;无 dockComposer face→组装留痕降级;**宿主无 manifest 批(mods 整面不出)→组装守卫留痕停摆对应域**——本卡要求宿主≥关联案合入版。降级是各胶囊内部的事,组装层不感知。

## 3. 文件结构与户籍(门 B:layout.json modules)

```
preset/ui/
  index.js   ~110  组装:唯一 mount 导出。等容器(MutationObserver)/订阅路由(live·files→仓库,
                   opening→重渲一拍)/dockComposer 槽注册/清理表逆序/造胶囊发牌(唯一认识全部胶囊)
  feed.mjs   ~90   仓库:createRepo({runScript, liveBridge, views}) → { ingest(因由), onScript(cb) }
                   拉泵+rev 门+键自愈(sid);BOOT_TRIES 上界与失败上屏也住这。交货=事实集
                   {剧本(views.makeScript 产出;同拍未变=引用相等)、cg、assetKeys、sid、水位}
                   ——onScript 直达演出机(不 rebind 剧本的因由 stage 走同一条:剧本引用不动)
  ptr.mjs    ~60   书签壳:createBookmark({storage}) → {r, asstSeq, sid, mode} 唯一可变正本;
                   pack/unpack 走 view 规则;LRU≤16;坏条目跳过;存储不可用退化内存
  para.mjs  ~230   演出机:createPresenter({bookmark, stage, views, nodes, onRender,
                   stopper, opening}) → mode 迁移+120s 看门狗/打字机(TYPE_MS)/点击节流/
                   三分支执行/思考行/开场白/backlog 开合/段 CG 时机(向舞台发 show)/
                   事实集转发(cg→show、assetKeys→prime)
  stage.mjs ~130   舞台:createStage({readAsset, runScript, nodes}) → { show(id) 幂等换场+情绪浮层,
                   prime(keys) 资产预载, dispose }。全量层索引(cgs:id→layers/intro)由舞台经
                   注入的 runScript 调泵 op:manifest 自取一次缓存(泵 panel 载荷只带当前 CG
                   切片,全量表唯一取数口)
  view.mjs  ~250   纯函数件(四槽契约不动,经 tavern.views 注入)——§4 全清单
layout.json  +  "modules": ["feed", "ptr", "para", "stage"];既有字段(transcript/html/suppress/dock/panels)全部原样
css/prompt/scripts/hooks/greetings/assets  冻结面,一行不动
```

注入拓扑(组装发牌,违例写不出——舞台想改书签没有把手):

```
index ─造→ feed(注入 views)─交货:事实集{剧本·cg·资产·水位}─直达→ presenter
     ─造→ bookmark(ptr) ─┐
     ─造→ stage ─────────┼→ 注入 presenter
     开场 face/停止键/节点 ─┘
presenter ─唯一写→ bookmark ─演出事件 show(景)/prime(资产)→ stage
presenter/视件 → view 规则(经注入) → 渲染
```

## 4. 规则下沉清单(view.mjs 全家,node 直测)

保留现役:`esc / stripDirectives / parseLine / splitParagraphs / lineEndsOf`
**删除死账**:`backlogRows / backlogHTML`(seq 水位语义,零调用,零行为面)
新增(index.js 隐性规则显性化):

- `makeScript(orig, historyRows)` → 剧本快照 `{paras[{text,cg}], raw, lineEnds, history}`
- `visibleHistory(script, bookmark)` → 防剧透口径(历史行 + 当前轮截到已读)——backlog 行唯一出处
- `decideRestore(saved, {asstSeq, parasLen})` → `'resume' | 'replay' | 'input'`(三分支;含 r 越界 clamp、asstSeq 相等/前进/无存位)
- `mergeLive(script, liveText)` → `{newParas, liveTail}`(遇 \n 切完整行;活性尾;入队不切 CG)
- `packPointer / unpackPointer`(LRU≤16 单键格式;坏 JSON 跳过;sid 通道)
- `renderHistoryHTML(行集, 可见集)` → 行偏移语义,接替 renderBacklog 内联(含 `.text` 取值纪律——[object Object] 回归钉)

## 5. 迁移映射(旧 → 新居所)

| 旧(index.js) | 新居所 |
|---|---|
| `build/el/whenHost/槽注册/订阅接线/清理表` | index 组装(el→build 时一次性取节点传递,不再每拍全量重查) |
| `poll / bootPoll 内嵌块`(含键自愈) | `feed.ingest` 单通道(v10.1 病灶拆除) |
| `readPointers / savePointer` | ptr + view.pack/unpack |
| `applyTurn / syncDurable / pushAssistantLine / handleLive / displayLive` | `view.mergeLive` + presenter 按 rebind 因由消费 |
| `startParagraph / completeParagraph / onStageClick / setMode / requestStop / 看门狗 / 打字机` | para |
| `crossfade / ensureCgLayers / switchCg / setMood / 资产补缺` | stage(副产微态 `cgFront` 双缓冲位随居) |
| `onResize 及 resize 监听挂载/回收`(:119-121) | index 组装(挂窗与回收);`placeThink` 响应归 para 视件区;`blOpen` 归 para(mode 亚态) |
| `renderBacklog / rowHTML` | `view.renderHistoryHTML(visibleHistory 口径)` |
| `renderThink / placeThink / handleReasoning / toggleThink / renderGreet / syncDomState / openBacklog / closeBacklog / dbg` | para 视件区(mode 亚态) |
| `TYPE_MS / WAIT_TIMEOUT_MS / BOOT_TRIES` 常量 | 分别住 para / para / feed(随属主) |
| 头注 22 行 v10.x 编年史 | 压缩为 3 行指针指向本文档与 design/build 文档(事故史进 docs,不删) |

## 6. 行为零 diff 冻结面

prompt 三张 / `hooks.json` / `scripts/` 四件(gal_data 泵协议冻结:`op:panel|manifest`、rev 算法)/ layout.json 既有字段 / `chat.css`(转写隐身;转写管辖 suppress:["transcript"] 是**另一张案**,不混批)/ greetings / assets / G3 槽契约(`data-dock-slot` + dockComposer face)/ mount 签名 / faces 消费方式 / **测试观察面三件**——`root.dataset.state` 调试串格式(index.js:114;spec :218/:224/:248/:347 钉)、`gg.reader.pointers` 条目结构 `{r,paras,asstSeq,mode,ts}` 与 `s:` 键(spec :212/:225/:286/:321 直读直写)、dockComposer 缺席 warn 文案(spec :417)。这三样是「行为零 diff」在测试面的真实载体,搬家时按公共契约保真,不得当「内部细节」随手改。**LLM 侧与宿主侧观测零 diff;视觉零改(ui.css 类名契约不变)。**

## 7. 测试与验收

1. **unit(新)**:`packages/ui/tests/galgame-rules.unit.spec.ts` —— makeScript 切分与纯 CG 行归并 / visibleHistory 防剧透(段水位、回合前进、无当前轮)/ decideRestore 三分支与 clamp / mergeLive 活性尾与不切 CG / packPointer LRU 与坏条目 / renderHistoryHTML 转义([object Object] 回归钉)。
2. **client(保活)**:`galgame-card.client.spec.ts` 现役 **16 例**(v10 零轮询 12 + G3 停靠 4)全绿**不改断言**——审查已核:全部断言走 DOM/localStorage/console 观察面,无一例直访闭包 state;重构需要的仅是测试 rig 注入 `tavern.mods`(改进口,行为面不变)。直导六件(blob 不通 jsdom 的既有进口模式)。
3. **host**:card-ui.client.spec.ts 增 manifest 例(关联案交付)。
4. **真机**:CDP E2E `--no-open` 五场景——点读节奏/读位恢复(三分支)/防剧透截断/live 两拍/停靠显隐;动宿主 ui 源先 `pnpm build` 双面,全套 `pnpm test` 绿。
5. **工作区同步**:preset/ 是导入快照——卡库改完必须同步 `tavern_workspace/ws-*/preset/芙宁娜/` 副本再验(量证先例:v10.1 修复曾因不同步而在真机测不到)。

## 8. 施工序(每步全套绿门)

1. 宿主 manifest 先立(关联案,独立 PR 合入)。
2. view.mjs 规则下沉 + unit spec——**先锁规格**(纯增量,index.js 不动;新测试把现行为钉死成规格)。
3. 四件成体:feed/ptr/para/stage 按 §2-§5 落文件(layout.json 同批开 modules;此时 index.js 仍旧消费——新件经 mount 装载但尚无人调用,装载面由 host spec 验)。
4. index.js 重建为组装+发牌,删尽内联旧逻辑+死账;16 例 client spec 全绿。
5. 文档回写:design §3(build §5 同批)读位落盘与 live 桥的真话、build 增分域节;死代码删除。
6. 工作区同步 + 真机五场景 + CDP 截图对原型。

## 9. 明确不做

- 不动 v1 直控形态(五胶囊是分域版,不复活 v2 投影)。
- 不引入事件总线/状态管理库——四动词直呼,单舞台游戏机搞协议是过度设计。
- 不改视觉/类名契约;不改泵协议;不动 dnd5e(v1/v2 各安其位,vendoring 决策不变)。
- 不夹带任何行为改想(施工中发现的行为疑点记单,重构落定后另案)。

## 10. 风险与契约

- **搬运丢隐性知识**(v10.1 同类):§8 第 2 步「先锁规格后搬家」——unit spec 即规格,任何一步红即停。
- **时序竞态**(live 落定/boot 三方):ingest 单通道内序,rev 门仍是唯一真值裁决者;「boot 基线就绪后才订」只约束 **files/泵订阅**(index.js:626-631,spec :140-141 反向钉)——live/opening 订阅现役在 whenHost 内即挂(:541-:548),迁移必须保持同时点,否则零 diff 被无声打破。
- **拆而失聚**(演出机成为新的袋子):其知识全部外置(view 规则+注入 handle),自身只留时序;预算按现役承接面校定——para ~230(承接函数 census ≈225 行)、index ~110,超预算=设计回炉。
- 测试 100% 绿是硬门(仓内既定纪律);fail-visible 家法双侧不放(模块缺席留痕见关联案 §5)。

## 11. 落点事实(实施对账,2026-09-25)

- **行数实测**:index 139(组装发牌)/feed 85/ptr 36/para 311/stage 75/view 168,合计 814(旧形态 index 642+view 73=715)。**预算改判**:para 311 超案估 ~230——census ≈225 承接面 + 视件区(思考/开场白/开合/调试 ≈60)+ 工厂壳;不回炉理由:演出机本体无一条规则逻辑(全部在 view+单测),行数全来自 DOM 视件密度,爆炸半径达标;§10「超预算=设计回炉」按此按例改判并记档。
- **施工病灶一例(量证后修)**:仓库 emit 曾以**已递增后的水位**重算 fresh 旗标——落定拍 `5 > 5` 恒 false,①落定校准/②新玩家行 waiting 两条分支全部哑火(13/16 红的公共根因);探针三行定位,修为调用方以 bump 前局部真值传入。这是「双摄取时代」的族病(同一真值两次计算)在单摄取体内的最后一次显形,记档为反面教材。
- **与案的两处件随偏差**(均已入 build 文档 §8):① live 桥直达演出机不经仓库(队列是演出瞬态、合流是 view 纯规则;「摄取一通道」铁律真实疆域=泵,四动词表 live 一行通道改记「组装→演出机直呼」);② `stage.warm()` 显式入口(boot 原序的 ensureCgLayers 件化后单独成面)。
- **验证对账**:16 例 client spec 断言零改动全绿(v10.1 两起事故的钉原样保活);`galgame-rules.unit.spec` 18 例锁规格;宿主 manifest 四例;全套 449 绿。真机 CDP 五场景与工作区同步见批 6(施工序第 6 步)。

## 12. 真机验收回填(2026-09-25,批 6)

- **主链路满分**:e2e-gal-reader 真机 CDP(mock LLM 确定性环境,`--success-text` 四段整文)五场景全绿——落定进 reading 段1/4 → 点读到段2+存位 `r=1`+backlog 恰截 2 行(防剧透闭环)→ **真·切卡往返恢复段2** → 再点进段3。§7 五场景中点读/读位/防剧透/停靠(切卡往返隐含)四项钉死;live 两拍在 client spec(:187 用例)与 unit 规格钉双面锁定,真机项由用户实测(同日,原话「没啥毛病」)合账。
- **工作区同步已验**:存量 4 个芙宁娜工作区照 v10.1 家法(与库 diff 先行零漂移确认)同步,六件逐一 ✓;宿主装配身份 `fengyue 标记 11 处 → 装配 ✓`(dev status)。
- **顺带记红(非本案)**:e2e-landing 一红,E2E 自身天生缺口(先 waitSettled 再 fill,首等时草稿空 → 发送键 `disabled={draft===''}` 恒 hidden——e2e-landing.mjs:84-86 + chat-view.tsx:996),与域重构零关;红因三度改判的定罪过程见 devlog 2026-09-25 批 6 条目。环境复原:settings.yaml 还原(备份 bak-e2e-mock 保留)、mock 进程随会话管理。
- **死账清点**:view.mjs 的 `backlogRows/backlogHTML`(seq 水位语义、零调用)已删;四、五批次见 git。
