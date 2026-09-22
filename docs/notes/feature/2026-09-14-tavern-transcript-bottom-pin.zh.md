# Agent Note：酒馆转写滚动条在读者靠近底部时持续钉屏

Status: implemented

[English](2026-09-14-tavern-transcript-bottom-pin.md) | 中文

## 问题

酒馆转写只能手动滚动：流式回合的增长超出视口下沿后最新内容堆积在屏幕外，而打开会话（刷新或侧栏切换）落点还在浏览器恢复的位置。两侧聊天面都需要该行为——主聊天和写卡列经 `chat-view.tsx` 渲染同一个 `.transcript` 滚动容器。

## 决策

**一个共享钩子，一条滚动规则。** `chat-view.tsx` 的 `useBottomPinnedScroll` 独占整个策略：钉住态在每次 scroll 事件上采样（距底 80px 以内），钉住时无依赖的 effect 在每次 commit 后重新贴底，新挂载初始即钉住。流式增量、打字点、错误行、开场页切换都因 effect 挂在渲染 commit 上而自动跟随——不依赖任何「增长来源」清单。

**不从 `ui-chat` 导入。** stock 聊天的跟滚与虚拟窗口和跳转导航交织（`atBottomRef`、锚点 key）；抽取会令酒馆 bundle 耦合到 root-slot 影子本不触及的 `ui-chat` 内部。酒馆转写是纯追加流，整个原语约 20 行，与使用它的组件同包同文件层。

**页面高度锚点随本变更加入百分比链。** `.app` 从 `100vh` 改为 `100%`：挂载点是 shell 的 `height: 100%` 链（web `base.css`）中的 `#root`，视口单位与它存在亚像素级分歧（缩放、常显滚动条）——文档一直带着一条「比窗口高一小点」的滚动条。`.app` 上方的槽位包装层是 `display: contents`，`100%` 直接对 `#root` 解析。

## 权衡过的备选

- **仅在 `lines` 身份变化时滚动**：否决——打字点、错误行、投影驱动的重渲染同样改变底部；枚举增长来源会在每次漏掉一个来源时复发该 bug。无依赖 effect 在未钉住时只花一次布尔判断。
- **哨兵行 IntersectionObserver**（聊天技术通用做法）：否决——为只有一个滚动容器、又无懒分页可服务的场景引入更重的状态；scroll 事件已给出的距离检查在这里就是精确答案。

## 后果

`packages/client/ui-tavern` 之外无源码改动；两个视图传入各自现有的 `.transcript` ref，写卡列与主聊天的修改一同落地。回合流式进行时回看历史不受打扰——读者回到 80px 带内之前更新不再拽走视口。jsdom 不做排版，spec 用元素级滚动度量访问器与派发的 scroll 事件断言钉屏（`tavern-app.client.spec.tsx` 的「transcript bottom pin」）。
