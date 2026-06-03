export default {
  ignoreFiles: ['**/dist/**', '**/.astro/**', '**/node_modules/**'],
  extends: ['stylelint-config-standard', 'stylelint-config-recommended-vue'],
  overrides: [
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html'
    }
  ],
  rules: {
    'block-no-empty': null,
    'color-no-hex': null,
    'custom-property-pattern': null,
    'no-empty-source': null,
    'function-no-unknown': [
      true,
      {
        ignoreFunctions: ['v-bind', 'var']
      }
    ],
    'selector-class-pattern': null,
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['deep', 'slotted', 'global', 'v-deep']
      }
    ]
  }
}
