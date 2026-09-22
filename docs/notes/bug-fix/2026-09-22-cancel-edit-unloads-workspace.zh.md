# Agent Note：放弃编辑必须卸载工作空间——路由三元组只认磁盘真相

Status: implemented

[English](2026-09-22-cancel-edit-unloads-workspace.md) | 中文

## 问题

选卡页点开一张卡的「编辑」，再「返回卡库」，然后刷新页面——会话不是留在选卡页，而是被当成游戏直接开了这张卡。因果链：(1) `editFromLibrary` 把整张卡 `preset/` 拷进工作空间（`hasCard=true`）并盖 `.tavern-editing` 戳，前端靠 `editing` 门挡住不进聊天。(2) 「返回」走 `cancelEdit`，它清掉戳之后**把原卡重新载入工作空间**——本意是"恢复原卡内容"，副作用是工作空间永久绑着这张卡。(3) 刷新后路由门 `inChat = hasCard && !drafting && editing === null`读到 `(true, false, null)`——与"正在玩这张卡"完全同构，于是直开聊天。建卡路径的 `cancelDraft` 会把三个根抹回空白，所以"建卡→返回→刷新"留在选卡页；编辑路径漏了这个对称的卸载动作。

深挖出一个测试盲区：`tavern-app.client.spec.tsx` 把编辑会话静态 mock 成 `hasCard:false`，与真实引擎（编辑中必然 `hasCard:true`）不符——刷新后的路由推导从未被任何测试覆盖。

## 决策

**让磁盘状态说真话，不动路由门。** `cancelEdit` 改为与 `cancelDraft` 对齐的卸载语义：清编辑戳 + 把 `preset/`、`runtime/`、`savings/` 抹回空白三件套（两个放弃路径共用 `workspace.ts` 新增的 `wipeWorkspaceDirs`，从结构上杜绝再次漂移）。数据安全有三重担保：编辑从不直写卡库（写回只走 `saveEdit`/`publishCard`），丢的只是工作空间副本；放弃路径之前必经 `editFromLibrary`，其 `seedRuntime` 本就先抹 `runtime/`，「带真实游玩存档的会话」到不了这里；写卡助手副本绑 root 不绑会话历史，卸载无感。对照改动：`cancelDraft` 收编进同一助手、`start` 路由（`TavernView.tsx`）与 `inChat` 门一行未动、`TavernView` 的返回注释改为新语义。

**守卫双面钉死。** 引擎侧新增组合测试：编辑→脏写→`cancelEdit`→断言 `(hasCard, drafting, editing)=(false, false, null)`、卡库原卡分毫未动、空白会话重复调用幂等。客户端侧把静态 mock 换成镜像磁盘真值的状态机（`editingLifecycle()`：blank→editing→cancelled），并新增「返回后再挂载」回归用例复现刷新场景。客户端平面套件按 `tests-client-plane/README.zh.md` 记录仍处挂起（vitest include 未覆盖），该用例已过 lint 与语法校验，接入即生效。

## 备选方案

**保留卡、另加"选卡意图"持久标记。** 在路由门多判一个磁盘标记（类似 `tavern.pendingSession` 的磁盘版）。败在状态面更大：又造一个易腐烂的标记文件，且它与 `(hasCard, drafting, editing)` 三元组部分冗余——三个字段已经能表达"无卡"， fourth marker 只是把同一事实存两遍，将来两处漂移又要一轮排障。

**只在前端返回时改本地路由、不碰引擎。** 胜在零引擎改动，但刷新后前端无从知道"用户在选卡页"与"用户在游戏里"的区别（这正是本案根因），必须引入全局态才能补丁——等于把磁盘缺失的语义用内存态续命，刷新窗口内依然错。

## 后果

「返回卡库」后刷新如实留在选卡页，编辑会话的工作空间回到空白页状态。代价：放弃编辑丢掉的不只是"相对原卡的改动"，而是整个工作空间副本——语义上与"放弃建卡"完全一致，且因编辑从不直写卡库，卡库那张卡永远无损。「返回卡库」从此与「不保存」弹框选项、建卡的放弃路径三者共享同一条事实：离开编辑 = 工作空间归零。
