# 桌面应用首阶段记录

日期：2026-10-16。新增工作区：`packages/desktop`。本阶段将现有原生 Studio 接入 Electron，未替换编辑器或项目存储格式。

## 已实现

- 中文项目首页：新建演示、打开项目文件夹、最近打开。
- 新建复用上游 blank 模板；已有文件夹不会被覆盖；项目内容仍写在用户选择的位置。
- 桌面程序携带 Electron 的浏览器和 Node，通过 utility process 启动已有的生产 Studio 服务，不启动 Vite、不调用全局 Bun。
- 首页与编辑器共用一个原生窗口，编辑器使用独立 WebContentsView、随机本地端口与会话凭据。关闭应用窗口后释放后台服务。
- 项目窗口开启 sandbox/contextIsolation，关闭 Node integration；只有可信首页可调用项目选择 IPC。
- 新增 CLI `./studio-host` 导出，复用既有资源编译、持久化、历史与 API。
- 配置 Windows NSIS / macOS DMG 目标；提供手动触发的双平台 ZIP 预览包工作流，尚未推送或运行远程工作流。

## 已验证（Windows x64）

- CLI 生产构建及桌面构建通过。
- 桌面 TypeScript 检查、4 项项目管理测试通过。
- Electron 源码启动通过：打开已有编辑示例，载入时间轴。
- Windows 目录包生成成功，产物位于 `packages/desktop/release/win-unpacked/Future PPT.exe`。
- 在临时工作目录启动打包 exe，使用临时空白作品：编辑器与时间轴加载成功；带凭据的接口返回 200，不带凭据返回 403；编辑窗口无 Node 与首页 IPC；窗口关闭后服务不可访问。
- 启动检查未调用 Vite 或系统 Bun。首页截图：`packages/desktop/release/home.png`（本地生成文件，不提交）。

## 尚未验收

- macOS 实机运行、Intel/Apple Silicon 分别打包；Windows ARM64。
- 完整手工编辑、保存重开、撤销重做在打包应用中的逐项验收。
- 视频导出及缩略图所需外部浏览器、FFmpeg 的完整内置分发；当前沿用上游依赖。
- 所有模板与作品离线可用；上游 blank 模板仍引用网络 GSAP，字体也可能联网。
- 安装器体验、应用图标、签名、公证和自动更新。当前 Windows 目录包未签名。

本阶段证明桌面入口和项目服务可打包运行，不将阶段一编辑契约或完整跨平台正式版标记完成。操作命令见 `packages/desktop/README.md`。

## 单窗口与意外返回首页修复（2026-10-16）

- 首页与编辑器在同一个窗口内切换；文件菜单提供“返回编辑器”，保留当前编辑会话。
- second-instance / activate 只聚焦当前页面，不再强制显示首页。
- 项目服务设置 ELECTRON_RUN_AS_NODE=1，使调用 process.execPath 的 CLI 后台任务以 Node 模式运行，避免再次启动桌面程序。
- 源码版与 Windows 打包版均通过：素材标签点击后等待 10 秒、真实二次启动、激活事件、首页往返、后台 Node 子进程、单窗口和服务退出检查。测试使用独立临时用户目录，不触碰正式最近项目记录。
- 修复版目录：`packages/desktop/release/window-fix/win-unpacked/Future PPT.exe`。旧版正在运行，因此保留旧产物，使用新版前需退出旧版。
- 类型检查、4 项项目管理测试、修改代码的格式与 lint 检查通过。macOS 尚未实机验证。
