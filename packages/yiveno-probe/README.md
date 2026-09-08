# @yiveno/probe

Yiveno **测试工作台**（非产品、不上架）。

## 定位（当前）

**写入测试数据** + **按选项批量清理**（无关干扰 / 半仿真 / 手写精选 / 整库）。

评审产出 / 对拍 UI **暂不在 Console**；包内仍保留 `verify/` 与夹具目录供后续或脚本用。

## 边界

| 在本包                                      | 不在本包                                            |
| ------------------------------------------- | --------------------------------------------------- |
| 主题语料 / 半仿真 / 干扰条目 / **数据预设** | Chrome / IndexedDB 执行（`frontend/src/dev/probe`） |
| 邻域判定 helpers（库内；Console 未接）      | `recall-eval` CI must                               |
| 测试工作台 Vue（Probe Console）             | CWS / `build:prod`                                  |
| 种库预设（= 内置预设）                      | §5.9 种子 TTE 达标宣称                              |

权威决策：[ADR-009](../../docs/architecture/decisions/ADR-009-yiveno-probe-package.md)

## 数据预设

```ts
import {
  BUILTIN_PROBE_DATA_RECIPES,
  parseProbeDataRecipeJson,
  compareSeedResultToRecipe
} from '@yiveno/probe'
```

Console：选预设 → 写入；参数可调 **半仿真/干扰随机种子**（本地过程随机、同值可复现；「换随机种子」重抽）。清理区按类别批量删。

手写精选语料仍为固定包；**仅**半仿真 / 无关干扰走本地过程随机（不上网、不烧 LLM）。

## 使用

```ts
import { resolveProbeCorpora, PROBE_SEED_PRESETS } from '@yiveno/probe'
import { ProbeConsole } from '@yiveno/probe/console'
```

扩展 DEV 页：`chrome-extension://<id>/probe-console.html`（仅 development 构建）。  
产品顶栏（DEV）：**Test workbench (DEV)** → 打开或聚焦该页。

### Console 文案口径（勿再发明缩写）

| 界面说法          | 含义                     | 代码字段（仅实现） |
| ----------------- | ------------------------ | ------------------ |
| 手写精选          | 固定主题语料包条目       | curated / personas |
| 半仿真书签/摘录   | 本地随机生成、略像真用户 | `diversity*Count`  |
| 无关干扰书签/摘录 | 本地随机生成、偏糊无关   | `noise*Count`      |
| 随机种子          | 仅控制半仿真/干扰可复现  | `fillerSeed`       |
| 先清空再写入      | 种库前清空当前库         | `replace`          |
