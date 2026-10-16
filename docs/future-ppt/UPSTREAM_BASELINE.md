# 上游接入基线

日期：2026-10-16（Asia/Shanghai）。本文件记录源码接入，不代表 Phase 0 运行验收已经通过。

- 目标仓库：https://github.com/YZqwwq/HyperFrames-ppt
- 上游仓库：https://github.com/heygen-com/hyperframes
- 固定上游提交：0e9f380c2e2295db4b88945a77cfa81001ac5c27
- 目标仓库原有提交：292aebedd29b19eea0353006af83db109015efa0
- 接入方式：合并两个已有 Git 历史，保留原始提交，不强制覆盖目标分支。
- GitHub 原生 Fork 标识：本次 Git 合并不会建立 GitHub fork network 关系。

本地 remotes：origin 指向目标仓库，upstream 指向官方仓库。其他开发者克隆后需要自行执行 `git remote add upstream https://github.com/heygen-com/hyperframes.git`。

上游根目录 README 与许可证保留；本项目说明位于 docs/future-ppt。上游现有包结构及业务源码不作修改。

## 开发基线调整

2026-10-16：按项目决定移除独立 Future PPT DOM 原型，后续直接基于 HyperFrames 原生 Studio、SDK 和 Player 开发。原型的历史测试不作为上游能力验收依据。当前本地运行结果见 [本地环境与能力验证](LOCAL_EVALUATION.md)；以下待完成事项保留为初次接入时的记录。

## 待完成

- 按上游 AGENTS.md 使用 Bun 安装依赖、构建，运行 Studio。
- 实际运行普通 Composition 和 Slideshow 示例。
- 审计稳定 ID、SDK Overrides、Undo/Redo 与持久化链路。
- 验证人工微调与动画绑定、跨页实例的兼容性。
- 逐项检查 NOTICE、第三方素材与依赖授权；本次仅保留上游声明，不宣称已完成许可证审计。

完成后再记录依赖版本、运行日志、源码位置以及已复用/需扩展/暂不处理能力清单。

## 本地检出限制

上游检出包含 LFS 媒体引用。初次检出尝试从目标仓库获取素材时返回 404；本轮采用 GIT_LFS_SKIP_SMUDGE=1 保留指针完成源码接入，媒体素材尚未完整下载或迁移。后续运行媒体样例前需要从 upstream 获取相应 LFS 对象；发布到独立仓库前也需核对所需 LFS 对象可用性。

上游当前提交另有 65 个路径被 LFS 属性覆盖但实际内容并非指针，Git 检出会报告警告。未改写这些上游文件，也未将其转换为新指针。

目标仓库初始 README 和 LICENSE 原文分别保存为 INITIAL_README.md、INITIAL_LICENSE.txt，根目录采用上游原文。

初次接入目录保留不动；完整源码及本次提交使用相邻的 HyperFrames-ppt-integration 工作区和 setup/ppt-foundation 分支。

## 2026-10-16 补齐验证

设备 SSH 已成功认证为 YZqwwq，origin 使用 git@github.com:YZqwwq/HyperFrames-ppt.git，upstream 使用 git@github.com:heygen-com/hyperframes.git。

已通过 `git fetch --refetch --no-filter --no-tags --no-write-fetch-head upstream main` 补齐完整 Git 历史对象，并成功执行 `git lfs fetch --all upstream HEAD`。随后独立枚举所有历史 LFS 对象，逐个验证文件存在、大小和 SHA-256：409 / 409 个通过，总计 1,479,655,403 字节，缺失及损坏均为 0。此前“素材尚未下载”的状态已解除；GitHub 分支更新以实际 push 结果为准。检出的媒体仍为指针，需要使用时可执行 `git lfs checkout`。

此次接入仅增加项目文档及独立验证原型。上游构建、Studio 运行和编辑能力审计仍未执行。
