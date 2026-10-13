# ADR-006: 品牌资产母本走 Git LFS（主仓内）

- **状态：** 部分撤销（2026-09-16）
- **日期：** 2026-08-29
- **修订日期：** 2026-09-16
- **决策者：** 维护者（Issue #30 工程轨道）

## 背景

品牌 PNG/JPG/SVG 等二进制集中在 `docs/design/brand-assets/`（发版母本）。体量会随商店图、主视觉增长；若全部进入普通 Git 对象，会拖慢 clone 与 CI，并膨胀 `.git` 历史。

Issue #30 曾列 **Git LFS** 与 **Org 卫星仓** 两轨。Yiveno 为单 monorepo、小团队、`sync:brand-assets` 已钉死母本路径；卫星仓会引入双 PR / submodule，收益不足以覆盖成本。

## 决定

1. **品牌二进制走 Git LFS**，路径与发版流程**不变**：
   - `docs/design/brand-assets/**` — 发版母本（LFS）
   - `*.md` / `*.py` 等文本仍走普通 Git
2. **运行时目录不走 LFS**：`extension/public/`、`website/public/` 保持普通 Git（体积小，构建/CI 不依赖拉取母本 LFS）。
3. **不建** Org 卫星仓 `yiveno/brand-assets`（除非未来出现独立权限/生命周期需求，另开 ADR）。
4. 发版 Checklist、`bun run sync:brand-assets` 逻辑不变；仅母本在仓库内的存储方式为 LFS 指针 + GitHub LFS 存储。

## 后果

**必须：**

- 仓库根目录 `.gitattributes` 跟踪 `docs/design/brand-assets/` 下的 `png/jpg/jpeg/svg/ico/webp`。
- 贡献者 clone 后安装 Git LFS 并执行 `bun run setup:git-lfs`（避免 `git lfs install` 覆盖 Husky `pre-push`）。
- CI `actions/checkout` 设置 `lfs: true`。
- Husky `pre-push` 在检查通过后调用 `git lfs pre-push`；变更 `docs/design/brand-assets/` 时跑 `sync:brand-assets --check`。

**禁止：**

- 仅在 `extension/public/` 手改品牌图而不同步母本。
- 为减体积把活跃母本迁到卫星仓却不改 ADR。

## 部分撤销（2026-09-16）

**原决定第 1 条**中 `yiveno-brand-kit/** — 设计师交付归档（LFS）` **已撤销**。

**原因：** `yiveno-brand-kit/` 与 `docs/design/brand-assets/` 存在大量内容重叠；整仓 43 文件 / 42 MB 包含 28 个独有文件（品牌规范 .md、logo 矢量、CWS 概念稿、.py 脚本等）与 15 个与母本重复的文件。经 SHA 比对确认后，维护者决定：

- 将独有文件备份至仓外（`/tmp/yiveno-brand-kit-rescue-2026-09-16/`）
- 仓库内删除 `yiveno-brand-kit/` 整仓
- 同步删除了 `.gitattributes` 中的 `yiveno-brand-kit/` 段
- 更新了 5 处相关文档（README.md × 2、brand-asset-release-checklist.md、docs/README.md、CHROMEWEBSTORE.md）

**撤销后的范围：** LFS 仅跟踪 `docs/design/brand-assets/` 下的二进制文件。

**回退风险：** 低。独有内容已备份；git history 仍保留完整历史（`git log -- yiveno-brand-kit/` 可见撤销前内容）。

## 相关

- [`brand-asset-release-checklist.md`](../../design/brand-asset-release-checklist.md)
- [`brand-assets/README.md`](../../design/brand-assets/README.md)
- Issue [#30](https://github.com/yiveno/yiveno/issues/30)
