import { defineConfig } from 'astro/config'
import vue from '@astrojs/vue'

export default defineConfig({
  output: 'static',
  integrations: [vue()],
  vite: {
    envPrefix: ['PUBLIC_'],
    // 登录岛会同步拉 supabase-js；预构建避免动态 import 504 / 旧 hash 失效
    optimizeDeps: {
      include: ['@supabase/supabase-js']
    },
    ssr: {
      noExternal: ['@supabase/supabase-js']
    }
  },
  devToolbar: { enabled: false }
})
