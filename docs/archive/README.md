# docs/archive/ — 历史文档归档

> **默认状态：** **ARCHIVED** — 不是当前产品事实来源。  
> **例外（工作中研究）：** `research/dual-thread-notes/`、未结案的 `research/tte-beta-*` 研究包 — 可继续写入；权威仍以 `docs/product/` Normative 为准。私人遥测/完整库**禁止**入仓。

本目录包含 Yiveno 项目历史上积累的文档，以及仍在进行的研究笔记包。

---

## 目录结构

```
archive/
├── README.md                          # 本文件
│
├── research/                          # TTE 研究资料
│   ├── tte-beta-2026-09/             # TTE Beta 2026 年 9 月会话记录
│   │   ├── sessions/                 # 会话记录
│   │   ├── gold-cards/               # Gold cards
│   │   ├── annotations/              # 标注说明
│   │   └── *.md                     # 研究计划、checklist 等
│   ├── tte-beta-template/            # TTE 研究模板
│   │   ├── sessions/                 # 会话模板
│   │   └── gold-cards/               # Gold card 模板
│   ├── na-clue-morphology/           # 北美 clue 形态学研究
│   └── dual-thread-notes/            # 双线程暗线研究笔记（工作中；模板+个案；私人数据不入仓）
│
├── product/                           # 过时产品文档
│   └── Yiveno-市场调研-v1.md        # 市场调研（Non-normative）
│
├── engineering/                       # 过时工程文档
│   ├── Skills-复查路线图.md          # Skills 复查记录（已结案）
│   ├── Skills-复查-Issues.md         # Skills 复查 Issues（已结案）
│   ├── R4-Phase-E-验收与eval.md     # R4 验收文档（已落地）
│   ├── R4-Outcome-Labeling-P2-校准.md  # Outcome Labeling 校准（已合并）
│   └── Yiveno-logo-asset-generation-prompt.md  # Logo 生成 prompt
│
└── packages/                         # 过时包说明
    ├── README.md                      # 包说明汇总
    ├── types/                        # @yiveno/types 包
    ├── design-tokens/                # @yiveno/design-tokens 包
    ├── yiveno-probe/                 # @yiveno/probe 包
    ├── backend/                      # Backend 说明
    ├── supabase/                     # Supabase 说明
    └── frontend/src/dev/             # Frontend DEV 调试说明
```

---

## 归档原则

### 为什么归档？

1. **历史价值保留** — 记录设计决策演化过程
2. **避免混淆** — 新开发者不会误读过时文档
3. **清理主目录** — 保持 `docs/` 目录清晰

### 归档标准

- **过时的研究** — TTE Beta 会话已完成并分析
- **已结案的任务** — Skills 复查等任务已完成
- **Non-normative 背景** — 市场调研等仅作参考
- **包内部实现** — 已在代码或独立 README 中说明

### 归档后不维护

归档文件**不更新**。如需更新内容：

1. 从归档删除
2. 移动回对应 `docs/` 子目录
3. 更新为最新版本

---

## 快速索引

| 查找内容          | 建议位置                                   |
| ----------------- | ------------------------------------------ |
| TTE Beta 研究详情 | `archive/research/tte-beta-2026-09/`       |
| 市场背景研究      | `archive/product/Yiveno-市场调研-v1.md`    |
| Skills 复查记录   | `archive/engineering/Skills-复查路线图.md` |
| 设计决策历史      | `docs/architecture/decisions/`（活跃 ADR） |

---

## 相关活跃文档

| 文档     | 位置                                   |
| -------- | -------------------------------------- |
| 当前焦点 | `docs/product/CURRENT.md`              |
| 产品文档 | `docs/product/Yiveno-产品文档-v4.0.md` |
| 术语表   | `docs/product/Yiveno-术语表.md`        |
| ADR      | `docs/architecture/decisions/`         |

---

_Last updated: 2026-09-17_
