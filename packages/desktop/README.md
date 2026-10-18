# Future PPT 桌面预览版

复用 HyperFrames Studio 和 CLI 的嵌入式生产服务。桌面进程负责项目首页、原生文件对话框与后台服务生命周期；项目仍是 HTML Composition 文件夹。

## 本地开发

首次按仓库规范安装、构建依赖：

```sh
bun install --linker hoisted
bun run build
bun run desktop
```

已有完整工作区构建后，修改桌面入口只需 `bun run desktop`。修改 Studio 后先构建 Studio，再构建 CLI，以更新 CLI 内携带的前端资源。

应用首页支持新建、打开和最近项目。新建使用上游 `blank` 模板，不覆盖已有文件夹。打开的文件夹需含 `index.html`。当前模板的 GSAP 和字体仍可能访问网络，尚不承诺所有作品离线可用。

## 架构与边界

- Electron 44.8.0 自带界面浏览器与 Node 运行时；桌面入口不调用 Bun、Vite 或全局 Node。
- 首页与编辑器共用一个原生窗口。编辑器使用独立 WebContentsView、utility process、随机回环端口和会话 token；关闭应用窗口后释放 HTTP 服务、文件监听和后台任务。
- 首页拥有有限的项目选择 IPC；编辑窗口无 preload、无 Node integration，开启 sandbox / contextIsolation。
- 正式用户数据位于 Electron appData 下的 `Future PPT` 文件夹；最近项目不复制作品内容。
- 文件菜单可切换“项目首页”和“返回编辑器”，保留当前编辑会话。重复启动和系统激活只聚焦当前页面。后台 CLI 子进程继承 ELECTRON_RUN_AS_NODE=1，避免把工作任务误当成新应用启动。
- 当前跨平台目标配置为 Windows NSIS、macOS DMG；签名、公证、自动更新及 Mac 实机验证尚未完成。
- 视频导出、缩略图截图等沿用上游外部浏览器/媒体依赖，未在本阶段完成自包含分发验收。

## 验证与打包

```sh
bun run --cwd packages/desktop test
bun run --cwd packages/desktop typecheck
bun run --cwd packages/desktop build
bun run --cwd packages/desktop test:smoke
bun run --cwd packages/desktop pack
```

`test:smoke` 从临时工作目录启动，复制原有空白模板作为临时作品，使用独立临时用户目录，检查编辑器加载、素材标签点击后等待 10 秒、真实重复启动、系统激活、首页往返保留会话、Node 子进程执行、未授权请求拒绝、窗口权限隔离及服务关闭。可传入打包程序路径验证产物：

```sh
bun run --cwd packages/desktop test:smoke "release/win-unpacked/Future PPT.exe"
```

Windows 本地未签名验证可传 `--config.win.signAndEditExecutable=false` 给 `pack`。若 Electron 下载器网络受限，先获取并校验官方运行包，再传 `--config.electronDist=<解压目录>`，不要改用未经校验的运行时。

生成结果位于 `packages/desktop/release`，不提交到 Git。macOS 构建应在 macOS 机器进行；当前 Windows 验证不能替代 Mac 实机测试。

## 时间组（2026-10-16）

时间轴工具栏的“页面打组”把当前页面的全部图层和动画保存为一个子合成，总轴仅显示一个带起点和时长的片段。双击片段或右键“进入时间组”编辑内部时序，点击面包屑“总时间轴”返回。支持撤销、重做及重载后恢复；当前入口作用于整页，不是任意多选图层的局部打组。原子文件与页面放在同一目录以保留相对资源路径，文件名自动生成。

本次 Windows 预览包位于 release/time-groups/win-unpacked/Future PPT.exe。浏览器实测覆盖打组、撤销重做、双击/右键进入、返回、重载，以及组内拖动字母后片段起点与 GSAP 起点同步保存。Studio 相关 36 项测试、项目 lint 62 项测试及 TypeScript 检查通过。

## 编辑器中文补丁（2026-10-17）

首批覆盖编辑器顶部操作、面板导航、时间轴工具、时间组导航和常用文字/外观属性。默认简体中文；高级效果、部分弹窗和原生系统菜单尚未全部汉化。作品内容、项目名、文件路径、CSS 属性值及协议字段不参与翻译。

- 中文文案：`packages/studio/src/i18n/zh-CN.json`
- 英文对照：`packages/studio/src/i18n/en.json`
- 调用入口：`packages/studio/src/i18n/index.ts`，组件通过 `t("panel.timeline")` 引用语义键。带参数示例：`t("selection.count", { count: 3 })`。第三个参数可指定 `en`；此版尚未提供运行中切换语言的界面。
- 位置登记：`packages/studio/src/i18n/text-registry.json`，每项记录源文件、行、列与文本键；重复使用同一文本键的控件分别登记。

新增文案时同时补全两份语言文件，在组件中引用字面量文本键，再运行：

```sh
bun run --cwd packages/studio i18n:register
bun run --cwd packages/studio i18n:check
```

注册器读取源码 AST，拒绝不存在的键、缺少翻译、参数不匹配、无人使用的键；校验模式还会检测位置索引过期。源码格式化后应重新生成登记表。此表是依赖索引，不参与运行时渲染，不含用户作品文字。
