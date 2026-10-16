# 阶段一改造记录

日期：2026-10-16。基线：1c00b9a8d；Windows 工作区：HyperFrames-ppt-integration。

## 本次落地

- 原生 Studio 时间轴的自动关键帧按钮增加常驻文字：Edit keyframe / Move animation。提示说明当前编辑范围，继续使用已有全局状态与提交链路。
- 修复整体移动平面 from() 动画时起终点反转的问题：复用已有 synthesizeFlatTweenKeyframes，保留 from / to / fromTo 的方向、数值属性及缓动。不支持的转换明确拒绝。
- Inspector 构建使用 fileURLToPath 转换文件 URL，修复 Windows 下 F:\F:\ 路径错误。

没有更改全局自动关键帧默认值。当前整体位移提交针对选中的动画段，不能据此承诺同一对象多段动画都整体平移；隐式端点还依赖已有默认值推导。默认布局编辑的切换需继续完成这些边界验证。

## 原生编辑链路审计

| 操作 | 入口与路由 | 写入与历史 |
| --- | --- | --- |
| 普通文字 | useInlineTextEditing、useDomEditTextCommits、domStyleCommit | useDomEditPersist，经 SDK 或 patch-element 写入 |
| 素材属性 | useDomEditAttributeCommits | 同一持久化路径，需实测比例变化后的布局 |
| 样式、几何 | useDomGeometryCommits、elementOffsetStager、useDomEditPositionPatchCommit | 静态属性补丁；动画属性交给 useGsapAwareEditing |
| 动画位置 | gsapRuntimeBridge → gsapDragCommit / gsapDragPositionCommit | useGsapScriptCommits，经 SDK 或 gsap-mutations 写源码 |
| 动画属性 | useAnimatedPropertyCommit → gsapWholePropertyOffsetCommit | 整段偏移或关键帧写入，取决于已有全局编辑状态 |
| 撤销、重做 | usePersistentEditHistory、useEditHistoryActions、gsapUndoRestore | 沿用原生历史，不新增第二套项目数据 |

以上是源码审计，不代表每项均完成浏览器验收。

## 已取得的证据

- Studio 类型检查通过；所有改动的 TypeScript/TSX 和构建脚本 lint 通过，无警告。
- 三个定向 Vitest 文件通过，共 70 项：gsapDragCommit、gsapRuntimeBridge、TimelineToolbar。
- gsapWholePathOffset.browser.test.ts 通过：真实 Chromium、原生源码解析/写回及 HyperFrames runtime；覆盖 from/to/fromTo × none/power2.out；对比移动前后 0、0.5、1、1.5、2、1、0 秒的真实 DOM 坐标，共 42 组采样。每组 x=-5px、y=+10px。
- Inspector 单独构建通过；Studio 前端、库和声明构建通过。首次全工作区构建因 Inspector 原有路径错误返回失败，修复后尚未重新通过整条全工作区流水线。
- 本机 Bun 默认布局出现 AWS SDK 包链接错误，改用 `bun install --frozen-lockfile --linker hoisted --ignore-scripts` 后依赖链接成功（825 installs / 966 packages，锁文件未变）。挂起的安装脚本已停止；外部二进制下载与视频导出尚未验收，不能将其视为完整安装。浏览器测试复用系统 Edge。

浏览器测试是源码重新装载的轨迹验证，不等同于 Studio UI 保存、重开项目、撤销和重做的端到端验收。

## 下一步验收

1. 在现有示例体系中创建标准作品，包含标题、Logo、图形、显式位置动画和参数化计数。
2. 在原生 Studio 逐项验证改字、换图、颜色、整体移动、终点和计数目标；记录实际步骤与失败。
3. 验证多段动画、非零隐式端点和保存历史后，再确定默认布局模式的路由。
4. 继续按 DEVELOPMENT_PLAN.md 推进；本记录不将阶段一标为完成。
