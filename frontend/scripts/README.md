# Frontend Scripts

本目录只保留当前仍可运行的维护脚本。

## 构建与审计

```bash
bun scripts/clean-dist.cjs
bun scripts/build-perf.mjs
bun scripts/analyze-bundle.mjs
bun scripts/validate-background.cjs
```

- `clean-dist.cjs`：清理扩展构建产物。
- `build-perf.mjs`：执行前端性能构建检查。
- `analyze-bundle.mjs`：分析扩展包体积。
- `validate-background.cjs`：校验 MV3 background 构建结果。

## i18n

```bash
bun scripts/i18n-extract.ts
bun scripts/i18n-validate.ts
bun scripts/i18n-replace.ts
```

- `i18n-extract.ts`：扫描硬编码文案并生成 `i18n-report.json`。
- `i18n-validate.ts`：校验 i18n 资源完整性。
- `i18n-replace.ts`：按报告辅助替换文案。

历史脚手架与热构建脚本已移除；新增页面入口请直接修改 `frontend/vite/build-options.ts`。
