// Stylelint configuration for design-tokens package
// 简化配置：只保留基本的代码质量检查

export default {
  ignoreFiles: ['**/node_modules/**', '**/dist/**', '**/.cache/**'],

  extends: ['stylelint-config-standard', 'stylelint-config-recommended-vue'],

  plugins: ['stylelint-order'],

  overrides: [
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html'
    }
  ],

  rules: {
    // 基本规则
    'no-duplicate-selectors': true,
    'selector-class-pattern': null,
    'custom-property-pattern': null,
    'value-keyword-case': null,
    'property-no-unknown': null,

    // Vue 支持
    'function-no-unknown': [
      true,
      {
        ignoreFunctions: ['v-bind', 'theme', 'var']
      }
    ],
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['deep', 'slotted', 'global', 'v-deep']
      }
    ],
    'selector-pseudo-element-no-unknown': [
      true,
      {
        ignorePseudoElements: ['v-deep', 'v-global', 'v-slotted']
      }
    ]
  }
}
