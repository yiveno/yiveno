import { defineConfig } from 'astro/config'
import vue from '@astrojs/vue'

export default defineConfig({
  output: 'static',
  integrations: [vue()],
  vite: {
    envPrefix: ['PUBLIC_', 'VITE_'],
    ssr: {
      noExternal: ['@supabase/supabase-js']
    }
  },
  devToolbar: { enabled: false }
})
