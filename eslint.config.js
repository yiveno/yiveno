/**
 * 🎯 Yiveno ESLint 配置（简化版）
 * 前后端统一配置，专为 Bun + Vue + TypeScript 优化
 */

import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import unusedImports from 'eslint-plugin-unused-imports'

const repoRoot = fileURLToPath(new URL('.', import.meta.url))
const frontendRoot = fileURLToPath(new URL('./frontend', import.meta.url))
const websiteRoot = fileURLToPath(new URL('./website', import.meta.url))
const probeRoot = fileURLToPath(new URL('./packages/yiveno-probe', import.meta.url))
const isFrontendCwd = process.cwd().endsWith('/frontend')
const isBackendCwd = process.cwd().endsWith('/backend')
const isWebsiteCwd = process.cwd().endsWith('/website')
const frontendTsconfigRoot = isFrontendCwd ? process.cwd() : frontendRoot

/**
 * 将仓库相对路径转换为当前工作目录下的 ESLint glob。
 * 支持从 monorepo 根目录或各 workspace 子目录运行 lint。
 */
function scopePath(repoRelativePath) {
  if (isFrontendCwd && repoRelativePath.startsWith('frontend/')) {
    return repoRelativePath.slice('frontend/'.length)
  }
  if (isBackendCwd && repoRelativePath.startsWith('backend/')) {
    return repoRelativePath.slice('backend/'.length)
  }
  if (isWebsiteCwd && repoRelativePath.startsWith('website/')) {
    return repoRelativePath.slice('website/'.length)
  }
  return repoRelativePath
}

/**
 * ESLint flat config 的 glob：在 workspace 子目录运行时，src 前缀 glob 无法匹配嵌套路径，需转为双星号前缀。
 */
function eslintScopePath(repoRelativePath) {
  if (isFrontendCwd && repoRelativePath.startsWith('frontend/src/')) {
    return `**/${repoRelativePath.slice('frontend/src/'.length)}`
  }
  if (isBackendCwd && repoRelativePath.startsWith('backend/src/')) {
    return `**/${repoRelativePath.slice('backend/src/'.length)}`
  }
  if (isWebsiteCwd && repoRelativePath.startsWith('website/src/')) {
    return `**/${repoRelativePath.slice('website/src/'.length)}`
  }
  return scopePath(repoRelativePath)
}

function eslintScopePaths(...paths) {
  return paths.map(eslintScopePath)
}

// files/ignores 相对 eslint.config.js 所在目录（仓库根），与 process.cwd 无关。
// 从 frontend/ 子目录跑 eslint 时若写成 src/**，会匹配不到 frontend/src/**。
const frontendVueFiles = ['frontend/src/**/*.vue']
const frontendTsFiles = ['frontend/src/**/*.{ts,tsx}']
const frontendScriptTsFiles = ['frontend/scripts/**/*.ts']
const backendTsFiles = ['backend/src/**/*.ts']
const websiteTsFiles = ['website/src/**/*.{ts,tsx}']
const websiteVueFiles = ['website/src/**/*.vue']
/** @yiveno/probe：DEV Console Vue（根目录 lint / lint-staged 须能解析 SFC + import type） */
const probeVueFiles = ['packages/yiveno-probe/src/**/*.vue']
const testFiles = eslintScopePaths(
  'frontend/src/tests/**/*.{ts,tsx,js}',
  'frontend/src/**/*.test.{ts,tsx,js}',
  'frontend/src/**/*.spec.{ts,tsx,js}',
  'frontend/src/**/__tests__/**/*.{ts,tsx,js}',
  'backend/src/**/*.test.{ts,tsx,js}',
  'backend/src/**/*.spec.{ts,tsx,js}'
)

const vueParser = pluginVue.configs['flat/recommended'][1].languageOptions.parser

/** Vue SFC 解析配置（放在配置末尾，避免 parserOptions 被 architecture 规则块覆盖） */
function createVueLanguageOptions(tsconfigRoot) {
  return {
    parser: vueParser,
    parserOptions: {
      parser: tseslint.parser,
      extraFileExtensions: ['.vue'],
      ecmaVersion: 'latest',
      sourceType: 'module',
      projectService: true,
      tsconfigRootDir: tsconfigRoot
    }
  }
}

// ============================================================================
// 📦 公共配置
// ============================================================================

const commonGlobals = {
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
  process: 'readonly',
  Buffer: 'readonly',
  global: 'readonly'
}

const bunGlobals = {
  Bun: 'readonly',
  ...commonGlobals
}

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

const chromeGlobals = {
  ...commonGlobals,
  chrome: 'readonly',
  indexedDB: 'readonly'
}

const serviceWorkerGlobals = {
  ...chromeGlobals,
  self: 'readonly',
  clients: 'readonly'
}

/** JS 文件使用的完整代码质量规则 */
const commonCodeQualityRules = {
  'no-console': ['error', { allow: ['warn', 'error'] }],
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
 * TS/Vue 运行时质量规则（合入 commonCodeQualityRules 子集，不含 no-undef）
 * TypeScript 已负责名称解析，ESLint no-undef 在 TS/Vue 下容易误报。
 */
const typescriptCodeQualityRules = {
  'no-console': commonCodeQualityRules['no-console'],
  'no-debugger': commonCodeQualityRules['no-debugger'],
  'no-alert': commonCodeQualityRules['no-alert'],
  'no-eval': commonCodeQualityRules['no-eval'],
  'no-implied-eval': commonCodeQualityRules['no-implied-eval'],
  'no-new-func': commonCodeQualityRules['no-new-func'],
  'no-unreachable': commonCodeQualityRules['no-unreachable'],
  'prefer-const': commonCodeQualityRules['prefer-const'],
  'no-var': commonCodeQualityRules['no-var'],
  'no-empty': commonCodeQualityRules['no-empty']
}

/** 仅用于纯 JS 文件；TS/Vue 格式由 Prettier 负责 */
const commonStyleRules = {
  'prefer-template': 'error',
  'object-shorthand': 'error',
  'prefer-arrow-callback': 'error',
  'no-duplicate-imports': 'error',
  'no-throw-literal': 'error',
  'prefer-promise-reject-errors': 'error',
  'no-return-await': 'error',
  'prefer-numeric-literals': 'error',
  'no-implicit-coercion': 'error',
  radix: 'error'
}

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
 * ESLint 职责：架构铁律、Vue 响应式安全、TS 类型安全、未使用 import。
 * 格式统一交给 Prettier；复杂度/嵌套深度不做 ESLint 门禁。
 */
const typescriptCommonRules = {
  '@typescript-eslint/no-explicit-any': 'error',
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
  // 允许 import('pkg').Type（动态 import 取类型）；仍偏好 type-only 静态 import
  '@typescript-eslint/consistent-type-imports': ['warn', { disallowTypeAnnotations: false }],
  '@typescript-eslint/no-floating-promises': 'warn',
  'no-async-promise-executor': 'error',
  'require-atomic-updates': 'off', // Vue ref 跨 await 赋值易误报；真实竞态靠代码审查 / 测试
  'no-shadow': 'off',
  '@typescript-eslint/no-shadow': 'error',
  ...unusedImportsConfig
}

const vueCommonRules = {
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
  'vue/no-side-effects-in-computed-properties': 'error',
  'vue/no-mutating-props': 'error',
  'vue/no-async-in-computed-properties': 'error',
  'vue/no-ref-as-operand': 'error',
  'vue/no-watch-after-await': 'error',
  'vue/require-explicit-emits': 'warn',
  'vue/no-ref-object-reactivity-loss': 'error',
  'vue/no-setup-props-reactivity-loss': 'error',
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
  'vue/no-deprecated-slot-attribute': 'off',
  'vue/no-deprecated-slot-scope-attribute': 'error',
  'vue/no-v-for-template-key': 'error',
  'vue/no-useless-v-bind': 'off',
  'vue/no-useless-mustaches': 'off',
  'vue/prefer-true-attribute-shorthand': 'off'
}

/** chrome.bookmarks.* 调用检测（含 onCreated.addListener 等链式调用） */
const chromeBookmarksCallSelectors = [
  {
    selector:
      "CallExpression[callee.object.object.name='chrome'][callee.object.property.name='bookmarks']",
    message:
      '禁止直接调用 chrome.bookmarks.*，请使用 chrome.runtime.sendMessage 通知 Background Script，或通过 infrastructure adapter'
  },
  {
    selector:
      "CallExpression[callee.object.object.object.name='chrome'][callee.object.object.property.name='bookmarks']",
    message:
      '禁止直接调用 chrome.bookmarks.*，请使用 chrome.runtime.sendMessage 通知 Background Script，或通过 infrastructure adapter'
  }
]

/** chrome.tabs.* 调用检测（presentation 层禁止直连） */
const chromeTabsCallSelectors = [
  {
    selector:
      "CallExpression[callee.object.object.name='chrome'][callee.object.property.name='tabs']",
    message:
      '禁止在 presentation 层直接调用 chrome.tabs.*，请通过 application/browser 服务或 Background Script'
  },
  {
    selector:
      "CallExpression[callee.object.object.object.name='chrome'][callee.object.object.property.name='tabs']",
    message:
      '禁止在 presentation 层直接调用 chrome.tabs.*，请通过 application/browser 服务或 Background Script'
  }
]

const storageRestrictionSelectors = [
  {
    selector: "CallExpression[callee.object.name='localStorage']",
    message: 'Chrome Extension 中禁止使用 localStorage，请使用 chrome.storage.local'
  },
  {
    selector: "CallExpression[callee.object.name='sessionStorage']",
    message: 'Chrome Extension 中禁止使用 sessionStorage，请使用 chrome.storage.session'
  }
]

const backgroundImportPatterns = [
  {
    group: ['**/background/**', '@/background/**'],
    message:
      '禁止导入 background 层。请将共享逻辑移到 infrastructure/ 层，或通过 chrome.runtime.sendMessage 通信。'
  }
]

const supabaseImportRestriction = {
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

// ============================================================================
// 🎯 主配置
// ============================================================================

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/build/**',
      '**/.wrangler/**',
      '**/.cache/**',
      '**/.vite/**',
      '**/.vite-temp/**',
      '**/.tmp/**',
      '**/*.tsbuildinfo',
      '**/*.log',
      '**/coverage/**',
      '**/.lighthouseci/**',
      '**/.astro/**',
      '**/docs/**',
      '**/scripts/**/*.cjs',
      '**/*.md',
      'vite.config.ts',
      'vitest.config.ts',
      '**/.vue-global-types/**',
      '**/vite-env.d.ts',
      '**/.venv/**',
      '**/*.min.js',
      '**/.git/**',
      '**/bun.lockb',
      '**/*.lock',
      '**/*.sh',
      '**/*.bash',
      '**/*.py',
      // wrangler types 生成物：体积大且会被 types:gen 覆盖（与 lint-staged 一致）
      scopePath('backend/worker-configuration.d.ts'),
      '**/worker-configuration.d.ts'
    ]
  },

  {
    plugins: {
      '@typescript-eslint': tseslint.plugin
    }
  },

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

  ...pluginVue.configs['flat/recommended'],

  // 仅作用于 TS 文件，避免 tseslint parser 覆盖 Vue SFC 解析
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: config.files ?? ['**/*.{ts,tsx,mts,cts}']
  })),

  {
    files: frontendVueFiles,
    plugins: {
      'unused-imports': unusedImports,
      '@typescript-eslint': tseslint.plugin
    },
    rules: {
      ...typescriptCodeQualityRules,
      ...vueCommonRules,
      ...typescriptCommonRules
    }
  },

  {
    files: websiteVueFiles,
    plugins: {
      'unused-imports': unusedImports,
      '@typescript-eslint': tseslint.plugin
    },
    rules: {
      ...typescriptCodeQualityRules,
      ...vueCommonRules,
      ...typescriptCommonRules
    }
  },

  {
    files: probeVueFiles,
    plugins: {
      'unused-imports': unusedImports,
      '@typescript-eslint': tseslint.plugin
    },
    rules: {
      ...typescriptCodeQualityRules,
      ...vueCommonRules,
      ...typescriptCommonRules
    }
  },

  {
    files: frontendTsFiles,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        projectService: true,
        tsconfigRootDir: frontendTsconfigRoot
      }
    },
    plugins: {
      'unused-imports': unusedImports,
      '@typescript-eslint': tseslint.plugin
    },
    rules: {
      ...typescriptCodeQualityRules,
      ...typescriptCommonRules
    }
  },

  {
    files: frontendScriptTsFiles,
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ]
    }
  },

  {
    files: backendTsFiles,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        projectService: true,
        tsconfigRootDir: repoRoot
      }
    },
    plugins: {
      'unused-imports': unusedImports,
      '@typescript-eslint': tseslint.plugin
    },
    rules: {
      ...typescriptCodeQualityRules,
      ...typescriptCommonRules
    }
  },

  {
    files: websiteTsFiles,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        projectService: true,
        tsconfigRootDir: websiteRoot
      }
    },
    plugins: {
      'unused-imports': unusedImports,
      '@typescript-eslint': tseslint.plugin
    },
    rules: {
      ...typescriptCodeQualityRules,
      ...typescriptCommonRules
    }
  },

  // DDD v4：非 background/offscreen 层禁止导入 background
  {
    files: eslintScopePaths(
      'frontend/src/infrastructure/**/*.ts',
      'frontend/src/core/**/*.ts',
      'frontend/src/pages/**/*.{ts,vue}',
      'frontend/src/application/**/*.ts',
      'frontend/src/components/**/*.{ts,vue}',
      'frontend/src/composables/**/*.ts',
      'frontend/src/stores/**/*.ts'
    ),
    rules: {
      'no-restricted-imports': ['error', { patterns: backgroundImportPatterns }]
    }
  },

  // DDD：core 禁止使用 Chrome API（仅允许注释/类型描述出现 chrome.*）
  // 实际调用 chrome.* 必须由 infrastructure/browser adapter / background / offscreen 承担
  {
    files: eslintScopePaths('frontend/src/core/**/*.ts'),
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='chrome']",
          message:
            'core 层禁止调用 chrome.*，请通过 infrastructure/browser adapter 或 background handler。'
        },
        {
          selector: "MemberExpression[object.name='chrome'][property.name='i18n']",
          message: 'core 层禁止访问 chrome.i18n，请通过注入的 t() 或 infrastructure/i18n 模块。'
        },
        {
          selector: "CallExpression[callee.object.name='localStorage']",
          message: 'core 层禁止使用 localStorage，请使用 chrome.storage.local 经 infrastructure。'
        },
        {
          selector: "CallExpression[callee.object.name='sessionStorage']",
          message:
            'core 层禁止使用 sessionStorage，请使用 chrome.storage.session 经 infrastructure。'
        },
        {
          selector: "MemberExpression[object.name='window'][property.name='localStorage']",
          message: 'core 层禁止访问 window.localStorage，service worker 无 window。'
        },
        {
          selector: "MemberExpression[object.name='window'][property.name='sessionStorage']",
          message: 'core 层禁止访问 window.sessionStorage，service worker 无 window。'
        }
      ]
    }
  },

  // DDD：core 不得依赖 UI / 应用层（含 v4 目标层路径）
  {
    files: eslintScopePaths('frontend/src/core/**/*.ts'),
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...backgroundImportPatterns,
            {
              group: [
                '@/application/**',
                '@/components/**',
                '@/pages/**',
                '@/stores/**',
                '../application/**',
                '../components/**',
                '../pages/**',
                '../stores/**'
              ],
              message: 'core 层禁止依赖 application / UI / store。请将纯领域逻辑保持在 core 内。'
            }
          ]
        }
      ]
    }
  },

  // DDD：application 不得依赖 UI 组件/页面（v4 恢复 application 层后生效）
  {
    files: eslintScopePaths('frontend/src/application/**/*.ts'),
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...backgroundImportPatterns,
            {
              group: ['@/components/**', '@/pages/**', '../components/**', '../pages/**'],
              message: 'application 层禁止依赖 UI 组件/页面。'
            }
          ]
        }
      ]
    }
  },

  // DDD：infrastructure 除 ui/ 外禁止依赖 Vue 组件（防止 UI 逻辑扩散到非视觉子目录）
  // - 例外：infrastructure/ui/** 与 infrastructure/ui/icons/** 本身可互相引用
  // - 其它子目录（identity/storage/ai/...）应保持纯逻辑，禁止 .vue 依赖
  {
    files: eslintScopePaths(
      'frontend/src/infrastructure/identity/**/*.ts',
      'frontend/src/infrastructure/identity/**/*.vue',
      'frontend/src/infrastructure/storage/**/*.ts',
      'frontend/src/infrastructure/storage/**/*.vue',
      'frontend/src/infrastructure/ai/**/*.ts',
      'frontend/src/infrastructure/ai/**/*.vue',
      'frontend/src/infrastructure/auth/**/*.ts',
      'frontend/src/infrastructure/auth/**/*.vue',
      'frontend/src/infrastructure/browser/**/*.ts',
      'frontend/src/infrastructure/browser/**/*.vue',
      'frontend/src/infrastructure/logging/**/*.ts',
      'frontend/src/infrastructure/logging/**/*.vue',
      'frontend/src/infrastructure/analytics/**/*.ts',
      'frontend/src/infrastructure/analytics/**/*.vue',
      'frontend/src/infrastructure/indexeddb/**/*.ts',
      'frontend/src/infrastructure/indexeddb/**/*.vue',
      'frontend/src/infrastructure/messaging/**/*.ts',
      'frontend/src/infrastructure/messaging/**/*.vue',
      'frontend/src/infrastructure/i18n/**/*.ts',
      'frontend/src/infrastructure/i18n/**/*.vue',
      'frontend/src/infrastructure/debug/**/*.ts',
      'frontend/src/infrastructure/debug/**/*.vue',
      'frontend/src/infrastructure/recall/**/*.ts',
      'frontend/src/infrastructure/recall/**/*.vue',
      'frontend/src/infrastructure/sync/**/*.ts',
      'frontend/src/infrastructure/sync/**/*.vue',
      'frontend/src/infrastructure/mcp/**/*.ts',
      'frontend/src/infrastructure/mcp/**/*.vue'
    ),
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/*.vue'],
              message:
                'infrastructure 子目录（除 ui/）禁止依赖 Vue 组件；UI 组件仅允许位于 infrastructure/ui/**。'
            }
          ]
        }
      ]
    }
  },

  // DDD：core / UI 层禁止直连 IndexedDB（须经 application / background）
  // - core 不能直接调用 memoryItemRepository / keywordIndexRepository；只允许通过 application service
  // - UI / store 进一步禁止 indexedDBManager（兼容历史规则描述）
  {
    files: eslintScopePaths(
      'frontend/src/core/**/*.ts',
      'frontend/src/pages/**/*.{ts,vue}',
      'frontend/src/components/**/*.{ts,vue}',
      'frontend/src/composables/**/*.ts',
      'frontend/src/stores/**/*.ts'
    ),
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...backgroundImportPatterns,
            {
              group: [
                '@/infrastructure/indexeddb/manager',
                '@/infrastructure/indexeddb/manager.ts',
                '**/infrastructure/indexeddb/manager',
                '**/infrastructure/indexeddb/manager.ts',
                '@/infrastructure/indexeddb/memory-item-repository',
                '@/infrastructure/indexeddb/memory-item-repository.ts',
                '@/infrastructure/indexeddb/keyword-index-repository',
                '@/infrastructure/indexeddb/keyword-index-repository.ts',
                '@/infrastructure/indexeddb/memory-db',
                '@/infrastructure/indexeddb/memory-db.ts',
                '@/infrastructure/indexeddb/memory-db-definition',
                '@/infrastructure/indexeddb/memory-db-definition.ts',
                '@/infrastructure/indexeddb/keyword-index-types',
                '@/infrastructure/indexeddb/keyword-index-types.ts',
                '**/infrastructure/indexeddb/memory-item-repository',
                '**/infrastructure/indexeddb/memory-item-repository.ts',
                '**/infrastructure/indexeddb/keyword-index-repository',
                '**/infrastructure/indexeddb/keyword-index-repository.ts',
                '**/infrastructure/indexeddb/memory-db',
                '**/infrastructure/indexeddb/memory-db.ts',
                '**/infrastructure/indexeddb/memory-db-definition',
                '**/infrastructure/indexeddb/memory-db-definition.ts',
                '**/infrastructure/indexeddb/keyword-index-types',
                '**/infrastructure/indexeddb/keyword-index-types.ts'
              ],
              message:
                'core / UI / store 层禁止直连 IndexedDB，请通过 application 层或 chrome.runtime.sendMessage。'
            }
          ]
        }
      ]
    }
  },

  // 架构铁律：chrome.bookmarks.* 仅允许 background / offscreen / infrastructure browser adapter
  {
    files: isFrontendCwd ? ['src/**/*.{ts,tsx,vue,js}'] : ['frontend/src/**/*.{ts,tsx,vue,js}'],
    ignores: eslintScopePaths(
      'frontend/src/background/**',
      'frontend/src/offscreen/**',
      'frontend/src/infrastructure/browser/**'
    ),
    rules: {
      'no-restricted-syntax': [
        'error',
        ...chromeBookmarksCallSelectors,
        ...storageRestrictionSelectors
      ],
      ...supabaseImportRestriction
    }
  },

  // 架构铁律：UI 层禁止直连 chrome.tabs.*
  {
    files: eslintScopePaths('frontend/src/pages/**/*.{ts,tsx,vue,js}'),
    rules: {
      'no-restricted-syntax': ['error', ...chromeTabsCallSelectors]
    }
  },

  // frontend 禁止直连 Supabase SDK（后端 / 官网 adapter 除外）
  {
    files: isFrontendCwd ? ['src/**/*.{ts,tsx,vue,js}'] : ['frontend/src/**/*.{ts,tsx,vue,js}'],
    rules: supabaseImportRestriction
  },

  {
    files: eslintScopePaths('backend/**/*.js'),
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

  {
    files: eslintScopePaths('backend/**/*.ts'),
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off'
    }
  },

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

  // 测试文件纳入 lint，但放宽 console / Chrome API 约束（测试需 mock Chrome API）
  {
    files: testFiles,
    languageOptions: {
      parserOptions: {
        projectService: false
      }
    },
    rules: {
      'no-console': 'off',
      'no-restricted-syntax': 'off',
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-vars': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'require-atomic-updates': 'off'
    }
  },

  // logger / DEV expose：console 是刻意出口（非业务路径散落 log）
  {
    files: [
      'frontend/src/infrastructure/logging/logger.ts',
      'frontend/src/infrastructure/debug/**/*.ts',
      'frontend/src/dev/probe/**/*.ts',
      'frontend/src/background/main.ts'
    ],
    rules: {
      'no-console': 'off'
    }
  },

  // Vue SFC 解析（必须位于 architecture 规则之后，防止 parserOptions 被覆盖）
  {
    files: frontendVueFiles,
    languageOptions: createVueLanguageOptions(frontendTsconfigRoot)
  },
  {
    files: websiteVueFiles,
    languageOptions: createVueLanguageOptions(websiteRoot)
  },
  {
    files: probeVueFiles,
    languageOptions: createVueLanguageOptions(probeRoot)
  },

  // 破坏性操作当前用 window.confirm/alert；自定义对话框落地前放行
  {
    files: [
      '**/pages/settings/Settings.vue',
      '**/pages/detail/Detail.vue',
      '**/pages/library/Library.vue'
    ],
    rules: {
      'no-alert': 'off'
    }
  },

  prettierConfig
]
