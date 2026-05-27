/**
 * 🎯 AcuityBookmarks ESLint 配置（简化版）
 * 前后端统一配置，专为 Bun + Vue + TypeScript 优化
 */

import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import unusedImports from 'eslint-plugin-unused-imports'

// ============================================================================
// 📦 公共配置
// ============================================================================

/**
 * 公共全局变量
 */
const commonGlobals = {
  // 标准 Web APIs
  console: 'readonly',
  setTimeout: 'readonly',
  setInterval: 'readonly',
  clearTimeout: 'readonly',
  clearInterval: 'readonly',
  fetch: 'readonly',
  URL: 'readonly',
  Response: 'readonly',
  Request: 'readonly',
  Headers: 'readonly',
  AbortController: 'readonly',
  performance: 'readonly',
  // Node.js 兼容
  process: 'readonly',
  Buffer: 'readonly',
  global: 'readonly'
}

/**
 * Bun 全局变量
 */
const bunGlobals = {
  Bun: 'readonly',
  ...commonGlobals
}

/**
 * Cloudflare Worker 全局变量
 */
const workerGlobals = {
  ...commonGlobals,
  URLSearchParams: 'readonly',
  FormData: 'readonly',
  ReadableStream: 'readonly',
  WritableStream: 'readonly',
  TransformStream: 'readonly',
  crypto: 'readonly',
  btoa: 'readonly',
  atob: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly'
}

/**
 * Chrome Extension 全局变量
 */
const chromeGlobals = {
  ...commonGlobals,
  chrome: 'readonly',
  indexedDB: 'readonly'
}

/**
 * Service Worker 全局变量
 */
const serviceWorkerGlobals = {
  ...chromeGlobals,
  self: 'readonly',
  clients: 'readonly'
}

/**
 * 公共代码质量规则
 */
const commonCodeQualityRules = {
  'no-console': ['error', { allow: ['warn', 'error'] }], // 只允许 console.warn 和 console.error
  'no-debugger': 'error',
  'no-alert': 'error',
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-unreachable': 'error',
  'no-undef': 'error',
  'prefer-const': 'error',
  'no-var': 'error',
  'no-empty': 'warn'
}

/**
 * 公共代码风格规则
 */
const commonStyleRules = {
  quotes: ['error', 'single'],
  semi: ['error', 'never'],
  'eol-last': 'error',
  'prefer-template': 'error',
  'object-shorthand': 'error',
  'prefer-arrow-callback': 'error',
  'prefer-destructuring': ['error', { array: false, object: true }],
  'prefer-spread': 'error',
  'prefer-rest-params': 'error',
  'no-duplicate-imports': 'error',
  'no-throw-literal': 'error',
  'prefer-promise-reject-errors': 'error',
  'no-return-await': 'error',
  'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
  'no-trailing-spaces': 'error',
  'space-before-blocks': 'error',
  'keyword-spacing': 'error',
  'comma-spacing': 'error',
  'key-spacing': 'error',
  'object-curly-spacing': ['error', 'always'],
  'prefer-numeric-literals': 'error',
  'no-implicit-coercion': 'error',
  radix: 'error'
}

/**
 * Unused imports 配置（统一配置）
 */
const unusedImportsConfig = {
  'unused-imports/no-unused-imports': 'error',
  'unused-imports/no-unused-vars': [
    'warn',
    {
      vars: 'all',
      varsIgnorePattern: '^_',
      args: 'after-used',
      argsIgnorePattern: '^_',
      ignoreRestSiblings: true,
      caughtErrorsIgnorePattern: '^_'
    }
  ]
}

/**
 * TypeScript 公共规则
 */
const typescriptCommonRules = {
  '@typescript-eslint/no-explicit-any': 'error',
  // 关闭原生规则，使用 unused-imports 插件代替（提供更好的自动修复）
  '@typescript-eslint/no-unused-vars': 'off',
  '@typescript-eslint/no-unused-expressions': 'off',
  'no-unreachable': 'error',
  '@typescript-eslint/no-non-null-assertion': 'off',
  '@typescript-eslint/no-var-requires': 'error',
  '@typescript-eslint/no-namespace': 'error',
  '@typescript-eslint/no-empty-function': 'off',
  '@typescript-eslint/ban-ts-comment': 'warn',
  '@typescript-eslint/no-empty-object-type': 'off',
  '@typescript-eslint/no-require-imports': 'off',
  '@typescript-eslint/prefer-as-const': 'warn',
  '@typescript-eslint/array-type': ['warn', { default: 'array-simple' }],
  '@typescript-eslint/consistent-type-definitions': ['warn', 'interface'],
  '@typescript-eslint/consistent-type-imports': 'warn',
  '@typescript-eslint/no-import-type-side-effects': 'warn',
  '@typescript-eslint/prefer-literal-enum-member': 'warn',
  '@typescript-eslint/prefer-enum-initializers': 'warn',

  // Phase 1 优化：异步代码规则（防止 Promise 相关 Bug）
  // 注意：这些规则需要类型信息，在 monorepo 中配置复杂，暂时禁用
  // '@typescript-eslint/no-floating-promises': 'error',
  // '@typescript-eslint/no-misused-promises': 'error',
  // '@typescript-eslint/await-thenable': 'error',
  // '@typescript-eslint/promise-function-async': 'warn',
  'no-async-promise-executor': 'error',
  'require-atomic-updates': 'error',

  // Phase 1 优化：代码质量规则
  'no-shadow': 'off',
  '@typescript-eslint/no-shadow': 'error',
  // '@typescript-eslint/prefer-nullish-coalescing': 'warn',  // 需要类型信息
  // '@typescript-eslint/prefer-optional-chain': 'warn',  // 需要类型信息
  'prefer-object-spread': 'error',
  'no-nested-ternary': 'warn',
  'max-depth': ['warn', 4],
  complexity: ['warn', 15],

  ...unusedImportsConfig
}

// ============================================================================
// 🎯 主配置
// ============================================================================

export default [
  // 基础忽略配置
  {
    ignores: [
      // 依赖和构建产物
      '**/node_modules/**',
      '**/dist/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/build/**',
      '**/.wrangler/**',

      // 缓存和临时文件
      '**/.cache/**',
      '**/.vite/**',
      '**/.vite-temp/**',
      '**/.tmp/**',
      '**/*.tsbuildinfo',
      '**/*.log',

      // 测试相关
      'frontend/src/tests/**',
      '**/__tests__/**',
      '**/*.test.ts',
      '**/*.test.js',
      '**/*.spec.ts',
      '**/*.spec.js',
      '**/coverage/**',
      '**/.lighthouseci/**',

      // 文档和脚本（不需要严格检查）
      '**/docs/**',
      '**/scripts/**/*.cjs',
      '**/*.md',

      // 配置文件（已有专门配置）
      'vite.config.ts',
      'vitest.config.ts',
      'vitest.e2e.config.ts',
      'playwright.config.ts',

      // 生成的类型文件
      '**/.vue-global-types/**',
      '**/vite-env.d.ts',

      // 其他
      '**/.venv/**',
      '**/*.min.js',
      '**/.git/**',
      '**/bun.lockb',
      '**/*.lock',
      '**/*.sh',
      '**/*.bash',
      '**/*.py'
    ]
  },

  // JavaScript 基础配置
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...bunGlobals,
        chrome: 'readonly'
      }
    },
    plugins: {
      'unused-imports': unusedImports
    },
    rules: {
      ...js.configs.recommended.rules,
      ...commonCodeQualityRules,
      ...commonStyleRules,
      'no-unused-vars': 'off',
      ...unusedImportsConfig,
      'sort-imports': [
        'error',
        {
          ignoreCase: true,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false
        }
      ]
    }
  },

  // Vue 3 基础配置
  ...pluginVue.configs['flat/recommended'],

  // TypeScript 基础配置
  ...tseslint.configs.recommended,

  // Vue 文件配置
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: pluginVue.configs['flat/recommended'][1].languageOptions.parser,
      parserOptions: {
        parser: { ts: tseslint.parser },
        extraFileExtensions: ['.vue'],
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      'unused-imports': unusedImports
    },
    rules: {
      // Vue 特定规则（宽松配置）
      'vue/multi-word-component-names': 'off',
      'vue/attribute-hyphenation': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-closing-bracket-spacing': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/no-v-html': 'off',
      'vue/no-use-v-if-with-v-for': 'off',
      'vue/require-default-prop': 'off',
      'vue/no-required-prop-with-default': 'off',

      // 🔒 安全规则：防止在 computed 中修改响应式状态
      'vue/no-side-effects-in-computed-properties': 'error',
      'vue/no-mutating-props': 'error',
      'vue/no-async-in-computed-properties': 'error',
      'vue/no-ref-as-operand': 'error',
      'vue/no-watch-after-await': 'error',
      'vue/require-explicit-emits': 'warn',

      // Phase 1 优化：Vue 3 响应式规则（防止响应式丢失）
      'vue/no-ref-object-reactivity-loss': 'error',
      'vue/no-setup-props-reactivity-loss': 'error',

      // Phase 1 优化：组件规范
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/custom-event-name-casing': ['error', 'camelCase'],
      'vue/define-macros-order': [
        'warn',
        {
          order: ['defineOptions', 'defineProps', 'defineEmits', 'defineSlots']
        }
      ],
      'vue/block-order': [
        'error',
        {
          order: ['script', 'template', 'style']
        }
      ],

      // Material Web Components 使用原生 slot 属性，不是 Vue 的 v-slot
      'vue/no-deprecated-slot-attribute': 'off',
      'vue/no-deprecated-slot-scope-attribute': 'error',

      // ⚡ 性能优化规则
      'vue/no-v-for-template-key': 'error',
      'vue/no-useless-v-bind': 'off', // 关闭：太严格，影响代码可读性
      'vue/no-useless-mustaches': 'off', // 关闭：太严格，影响代码可读性
      'vue/prefer-true-attribute-shorthand': 'off', // 关闭：太严格，影响代码可读性

      // TypeScript 规则
      ...typescriptCommonRules
    }
  },

  // Frontend TypeScript 文件配置
  {
    files: ['frontend/**/*.ts', 'frontend/**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        tsconfigRootDir: process.cwd()
      }
    },
    plugins: {
      'unused-imports': unusedImports
    },
    rules: {
      ...typescriptCommonRules
    }
  },

  // Backend TypeScript 文件配置
  {
    files: ['backend/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        tsconfigRootDir: process.cwd()
      }
    },
    plugins: {
      'unused-imports': unusedImports
    },
    rules: {
      ...typescriptCommonRules
    }
  },

  // Website TypeScript 文件配置
  {
    files: ['website/**/*.ts', 'website/**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        tsconfigRootDir: process.cwd()
      }
    },
    plugins: {
      'unused-imports': unusedImports
    },
    rules: {
      ...typescriptCommonRules
    }
  },

  // 🚨 架构铁律：禁止非 background 层导入 background 层
  // 违反此规则会导致构建分包污染，background.js 循环依赖，Service Worker 崩溃
  {
    files: [
      'frontend/src/services/**/*.ts',
      'frontend/src/infrastructure/**/*.ts',
      'frontend/src/core/**/*.ts',
      'frontend/src/domain/**/*.ts',
      'frontend/src/application/**/*.ts',
      'frontend/src/components/**/*.ts',
      'frontend/src/components/**/*.vue',
      'frontend/src/presentation/**/*.ts',
      'frontend/src/presentation/**/*.vue',
      'frontend/src/stores/**/*.ts'
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/background/**', '@/background/**'],
              message:
                '禁止从 services/infrastructure/core 层导入 background 层。请将共享逻辑移到 infrastructure/ 层，或使用动态 import。'
            }
          ]
        }
      ]
    }
  },

  // Chrome Extension 前端约束
  {
    files: ['frontend/src/**/*.{ts,tsx,vue,js}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='chrome'][callee.property.name='bookmarks'] > :not(MemberExpression[object.name='chrome'][property.name='runtime'])",
          message:
            '禁止在前端组件中直接调用 chrome.bookmarks.*，请使用 chrome.runtime.sendMessage 通知 Background Script'
        },
        {
          selector: "CallExpression[callee.object.name='localStorage']",
          message: 'Chrome Extension 中禁止使用 localStorage，请使用 chrome.storage.local'
        },
        {
          selector: "CallExpression[callee.object.name='sessionStorage']",
          message: 'Chrome Extension 中禁止使用 sessionStorage，请使用 chrome.storage.session'
        }
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message: '请使用 @/infrastructure/supabase/client 而不是直接导入'
            }
          ]
        }
      ]
    }
  },

  // ES Module 脚本配置
  {
    files: ['scripts/enhance-autofix.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...commonGlobals,
        __dirname: 'readonly',
        __filename: 'readonly'
      }
    },
    rules: {
      'no-process-exit': 'warn',
      'no-sync': 'warn',
      'no-throw-literal': 'error',
      'no-new-func': 'error',
      'no-new-wrappers': 'error',
      'no-new-object': 'error',
      'no-new-symbol': 'error',
      'no-new': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'error'
    }
  },

  // Backend (Cloudflare Worker + Bun) 配置
  {
    files: ['backend/**/*.js'],
    languageOptions: {
      globals: {
        ...workerGlobals,
        Bun: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly'
      }
    },
    rules: {
      'no-process-exit': 'warn',
      'no-sync': 'warn',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'prefer-template': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-unused-vars': 'warn',
      'no-magic-numbers': 'off'
    }
  },

  // Backend TypeScript 配置 - 放宽类型限制以适配 Cloudflare Worker API
  {
    files: ['backend/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Worker API 类型不完整
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off'
    }
  },

  // Background Script 配置
  {
    files: ['background.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...serviceWorkerGlobals,
        openManagementPageWithAI: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-empty': 'warn',
      'no-unused-vars': 'error',
      'no-case-declarations': 'error',
      'no-useless-escape': 'warn',
      'no-magic-numbers': 'off'
    }
  },

  // Page-fetcher 脚本配置
  {
    files: ['page-fetcher.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...chromeGlobals,
        Promise: 'readonly',
        Date: 'readonly',
        Map: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn'
    }
  },

  // 测试文件配置 - 允许 console.log
  {
    files: [
      '**/*.test.ts',
      '**/*.test.js',
      '**/__tests__/**/*.ts',
      '**/__tests__/**/*.js',
      '**/scripts/**/*.js',
      '**/test-*.js'
    ],
    rules: {
      'no-console': 'off'
    }
  },

  // Prettier 配置（必须最后）
  prettierConfig
]
