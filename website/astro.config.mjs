import { defineConfig } from 'astro/config'
import vue from '@astrojs/vue'

export default defineConfig({
  output: 'static',
  integrations: [vue()],
  vite: {
    ssr: {
      noExternal: ['@supabase/supabase-js']
    }
  },
  devToolbar: { enabled: false }
})
