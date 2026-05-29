// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // SEO 模块配置
  modules: ['@nuxtjs/seo'],

  css: [
    '@acuity-bookmarks/design-tokens/css/material-theme.css',
    '@acuity-bookmarks/design-tokens/css/variables.css',
    '@acuity-bookmarks/design-tokens/css/semantic-colors.css',
    // 移除 brand-override.css，严格使用 Material Design tokens 原始配置
    '~/assets/css/utilities.css',
    '~/assets/css/main.css'
  ],

  // 站点配置
  site: {
    url: 'https://acuitybookmarks.com',
    name: 'AcuityBookmarks',
    description: 'AI 驱动的智能书签管理工具，让您的书签井然有序',
    defaultLocale: 'zh-CN'
  },

  // SEO 配置
  seo: {
    redirectToCanonicalSiteUrl: true
  },

  // 应用配置
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: 'AcuityBookmarks - AI 驱动的智能书签管理',
      meta: [
        {
          name: 'description',
          content:
            'AcuityBookmarks 是一款基于 AI 技术的 Chrome 浏览器扩展，专为解决书签混乱、查找困难等问题而设计。支持 2 万+ 书签的流畅管理，本地优先，隐私安全。'
        },
        {
          name: 'keywords',
          content: '书签管理,AI 书签,Chrome 扩展,智能书签,书签整理,浏览器扩展'
        }
      ],
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }]
    }
  },

  // 运行时配置
  runtimeConfig: {
    // 私有配置（仅在服务端可用）
    apiSecret: process.env.NUXT_API_SECRET || '',
    sendgridApiKey: process.env.NUXT_SENDGRID_API_KEY || '',
    brevoApiKey: process.env.NUXT_BREVO_API_KEY || '',

    // 公共配置（客户端和服务端都可用）
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://acuitybookmarks.com',
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || 'https://api.acuitybookmarks.com',
      supabase: {
        url: process.env.NUXT_PUBLIC_SUPABASE_URL || '',
        anonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || ''
      },
      googleClientId: process.env.NUXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      // Chrome 扩展 ID（用于官网与扩展通信）
      extensionId:
        process.env.VITE_EXTENSION_ID ||
        process.env.NUXT_PUBLIC_EXTENSION_ID ||
        'gdjcmpenmogdikhnnaebmddhmdgbfcgl'
    }
  },

  // TypeScript 配置
  typescript: {
    strict: true,
    typeCheck: false // ⚠️ 暂时禁用类型检查，避免开发时的性能问题
  },

  // 开发服务器配置
  devServer: {
    port: 3001,
    host: 'localhost'
  },

  // 路由规则 - 认证页面使用客户端渲染
  routeRules: {
    '/login': { ssr: false },
    '/register': { ssr: false },
    '/reset-password': { ssr: false },
    '/update-password': { ssr: false },
    '/auth/**': { ssr: false },
    '/account': { ssr: false }
  },

  // 预渲染配置
  nitro: {
    prerender: {
      // 跳过需要客户端运行时的认证页面
      ignore: ['/login', '/register', '/reset-password', '/auth/callback', '/update-password'],
      // 失败时继续
      failOnError: false
    }
  }
})
