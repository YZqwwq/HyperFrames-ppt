# 本地环境与能力验证

日期：2026-10-16（Asia/Shanghai）。本轮任务：拉取源码、安装 Bun、构建并运行项目，评估动态 PPT 开发基础。

## 结论

本机可以运行 HyperFrames Studio，支持在此基础上继续开发。优先复用 SDK、Studio、Player，不需要先重写动画引擎。独立 Future PPT 原型已按项目决定移除，后续以原生 Studio（5190）为开发入口。跨页持续对象需要在 HyperFrames Composition 中重新验证。

## 环境与安装结果

- 仓库：`https://github.com/YZqwwq/HyperFrames-ppt.git`
- 当前提交：`021b2156e9795846078832dd7db6d9073f078c5a`
- 当前目录为独立 Git 仓库，`origin` 使用 HTTPS；采用 depth=1 浅克隆。
- macOS 13.7.8 / Apple M1 / 8 GB RAM。
- Node 24.11.0；新增 `.nvmrc` 固定项目版本，不修改全局默认 Node。
- Bun 1.4.3，安装在 nvm 的 Node 24.11.0 环境中。需要先 `nvm use` 才能直接使用 `bun`。
- Bun 通过官方 npm registry 安装；原有内部 npm 镜像返回 500。本次命令临时指定官方源，未修改默认 registry。
- `bun install --frozen-lockfile --registry=https://registry.npmjs.org` 成功，733 个包，安装报告约 775 秒。锁文件未改动。
- `bun run build` 全工作区成功。首次沙箱内执行因 tsx IPC 管道权限失败，沙箱外执行成功。
- 构建存在 Vite bundle size 警告，不影响本次完成。
- 安装、构建后仓库目录约 2.0 GiB，node_modules 约 1.5 GiB，.git 约 68 MiB；不包括用户级缓存、系统 swap 和临时下载。
- 本轮未安装 Git LFS、未下载全部 LFS 对象。远端旧基线文档中的其他工作区 LFS/SSH 状态不代表本机当前状态。

## 启动与预览

```bash
cd /Users/admin/Documents/trae_projects/HyperFrames-ppt
source "$HOME/.nvm/nvm.sh"
nvm use
bun run dev
```

- Studio：<http://127.0.0.1:5190/#project/counter-demo>

本轮 Studio 使用 `bun run --cwd packages/studio dev --port 5190 --strictPort`，仅监听本机。沙箱内 Vite 把端口绑定失败表现为不断换端口；沙箱外成功。普通本地终端不需要 Codex 沙箱授权。

`counter-demo` 是 `registry/blocks/apple-money-count` 的本地副本，入口复制为 index.html，素材一起复制到 `packages/studio/data/projects/counter-demo`。该目录已被仓库忽略，原始模板未修改。另保留 `local-evaluation` 复杂测试夹具副本；该夹具出现子场景加载警告，不作为成功样例。

## 已执行验证

| 验证 | 结果 | 证明范围 |
| --- | --- | --- |
| 全工作区 build | 通过 | 当前依赖及本机可以构建全部包 |
| SDK 四个测试文件 | 107/107 通过 | session、dispatch、template、timings |
| Player 两个 Slideshow 测试文件 | 147/147 通过 | 导航控制器及 slideshow 组件；不等于完成真实演讲者双窗口验收 |
| 官方计数样例 lint | 0 errors / 0 warnings | 静态结构 |
| 官方计数样例浏览器 check | 整体失败 | runtime 和 motion 无错误；layout 6 errors / 1 warning / 11 info；contrast 1 warning |
| Studio 打开官方计数样例 | 成功 | 画布、时间轴、关键帧、设计面板显示正常 |
| Studio seek 到 2 秒 | 成功 | 5 秒作品显示 $6,329，动画对象可检查 |
| Studio 左移 5px、撤销 | 成功 | 读回 X 从 614.7421875 到 609.7421875，撤销后恢复 614.7421875，原有动画恢复 |

Slideshow 测试期间 happy-dom 输出过 localhost:3000 audience 页面网络异常，但两份测试文件最终通过；不把该测试结果当作真实观众窗口连通性证明。

浏览器 check 检测到 Apple M1 硬件 WebGL。失败项集中于金额与爆炸粒子的文字遮挡/重叠，及金额颜色在部分时刻的对比度 1.47:1（要求 3:1）。这说明官方样例可运行，但没有通过项目自身的视觉质量门槛。本轮记录问题，不通过改变检查规则隐藏失败。

测试命令：

```bash
bun run --cwd packages/sdk test src/session.test.ts src/session.dispatch.test.ts src/session.template.test.ts src/session.timings.test.ts --maxWorkers=1
bun run --cwd packages/player test src/slideshow/SlideshowController.test.ts src/slideshow/hyperframes-slideshow.test.ts --maxWorkers=1
node packages/cli/bin/hyperframes.mjs lint packages/studio/data/projects/counter-demo
node packages/cli/bin/hyperframes.mjs check packages/studio/data/projects/counter-demo
```

## 能力矩阵与开发建议

| 能力 | 证据 | 判断 |
| --- | --- | --- |
| 画布、图层、属性、时间轴 | Studio 实际界面；docs/studio/canvas.mdx | 复用现有编辑器，精简为 PPT 用户需要的界面 |
| 精确位移、撤销 | 实际 5px 位移及坐标读回、撤销 | 可复用，但必须区分静态布局与动画编辑 |
| 稳定对象 ID | SDK openComposition、session、文档及测试 | 复用 data-hf-id，避免 AI 重写时丢失身份 |
| 局部文本、样式、时序操作 | SDK session/dispatch/template/timings 测试 | 复用 typed operations，不用整页重生成作为微调机制 |
| Patch、Overrides、Undo/Redo | packages/sdk/src/session.ts、history.ts | 已有实现；应明确宿主与 SDK 谁拥有历史和持久化 |
| GSAP 动画/关键帧 | 实际读取 5 个金额动画，界面关键帧显示正常 | 可复用；动态表达式/循环生成的任意代码仍有可编辑性边界 |
| AI 操作编辑器 | 本地页面 WebMCP seek/select/inspect/transform 实测 | 已具备操作接口，但本轮未接入完整 AI 生成工作流 |
| 幻灯片导航、逐步揭示、分支、热点、演讲者模式 | Slideshow 源码、文档及 147 项测试 | 有现成基础；完整 deck 实际演示和观众同步仍待验证 |
| 全局时间轴上的跨页持续对象 | SlideshowController.enterSlide 逻辑 | 需在 HyperFrames Composition 中验证对象身份、连续运动及保存行为 |
| 视频导出 | Producer/Engine 构建成功，浏览器 check 成功执行 | 本轮未验收 MP4 编码与完整输出，不能宣称视频导出已通过 |
| 完整 PPTX 导入导出 | 本轮未发现成型链路，现有规划也不承诺无损 PPTX | 作为独立能力规划，勿与网页演示混同 |

### 关键发现

1. Studio 默认开启自动关键帧。在第 2 秒移动金额时，原入场动画被转换成包含该位置的关键帧结构；这符合动画编辑行为，但不是“整条路径平移 5px”。产品入口应明确区分这两种意图，并验证关闭自动关键帧后的整段位移。
2. SlideshowController.enterSlide 会处理媒体停止、fragment 停点或 slide 内代表帧；它不能直接作为“连续播放时间轴上只改变页面区间”的证明。已移除原型的历史测试不能证明 HyperFrames 的跨页对象行为。
3. docs/guides/slideshow.mdx 明确提醒：当前对 deck 直接 render 可能只渲染第一页。互动演示与线性 MP4 导出应分别验收。
4. 金额是运行时计数器，文本会被动画代码更新。即使面板暴露文本编辑，也不代表任何动态文本都能改字后保持语义；应选真实标题样例验证文字修改闭环。

### 下一轮最小验证

- 用一个真实两页标题/Logo 作品，验证改字、整段左移 5px、修改动画终点、保存刷新和撤销重做。
- 在上游 Composition 中实现一个对象跨两页持续运动，检查 DOM 身份、动画时间及保存后行为。
- 优先使用 SDK 操作和现有历史机制；在这两个验证完成前，不建立与 HTML 并行的第二套权威 JSON 数据。
- 8 GB 内存环境从小作品、单 worker 开始；视频导出、4K、多任务并行和全量媒体回归另行评估。

## 证据与范围

本地日志与截图保存于 `qa-artifacts/local-evaluation/`（被 Git 忽略）。本轮未运行全仓全部测试、完整视频导出或全部 LFS 素材回归，也未改变框架业务源码。报告和 `.nvmrc` 未提交、未推送。
