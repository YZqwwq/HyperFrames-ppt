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
