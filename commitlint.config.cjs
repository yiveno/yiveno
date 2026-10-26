/**
 * Commit message 校验（首行 prefix + scope）
 * 体层文件索引校验见 .husky/commit-msg → scripts/check-commit-message.mjs
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // 新增用户可感能力 / 新 message type / 新 ADR 落地
        'fix', // 修复已有行为 / 契约 / 门禁
        'refactor', // 不改对外行为的内部重构
        'docs', // 文档 / ADR / 注释
        'test', // 测试数据 / eval must / TTE
        'chore', // 工程工具 / 依赖 / 配置 / 清理
        'ci', // GitHub Actions / hooks / doc:check 配置
        'perf', // 性能优化
        'style' // 仅格式（Prettier 自动改，不应手动提交）
      ]
    ],
    'type-case': [2, 'always', 'lower-case'],
    'scope-case': [2, 'always', 'lower-case'],
    'scope-empty': [0, 'never'], // scope 可选
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 72],
    'body-leading-blank': [2, 'always']
  },
  // 允许的「非提交」自动 message：merge / revert / initial —— 这些跳过整校验
  ignores: [(message) => /^(Merge |Revert |Initial commit)/i.test(message)]
}
