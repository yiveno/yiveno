<script setup lang="ts">
/**
 * 挂在账号域 Nav / 登录页：维持 UI Port，并在会话变化时推 website_auth_changed。
 * 亦承接扩展 `request_extension_connect`（已登录零导航 Connect）。
 */
import { onMounted, onUnmounted } from 'vue'
import { getSession } from '../services/auth'
import { runExtensionConnectFromWebsite } from '../services/run-extension-connect'
import { getSupabase } from '../services/supabase'
import {
  ensureUiBridgeConnected,
  publishWebsiteAuthChanged,
  subscribeExtensionAuthChanged,
  subscribeRequestExtensionConnect
} from '../services/ui-bridge'

defineOptions({ name: 'UiBridgeHost' })

const emit = defineEmits<{
  extensionAuthChanged: [
    payload: { signedIn: boolean; userId?: string; displayName?: string; avatarUrl?: string }
  ]
}>()

let stopExtensionAuth: (() => void) | null = null
let stopRequestConnect: (() => void) | null = null
let stopAuthState: (() => void) | null = null

async function pushWebsiteAuthFromSession(): Promise<void> {
  const session = await getSession()
  if (session?.user?.id) {
    publishWebsiteAuthChanged({ signedIn: true, userId: session.user.id })
    return
  }
  publishWebsiteAuthChanged({ signedIn: false })
}

onMounted(() => {
  void ensureUiBridgeConnected().then(() => {
    void pushWebsiteAuthFromSession()
  })
  stopExtensionAuth = subscribeExtensionAuthChanged(payload => {
    emit('extensionAuthChanged', payload)
  })
  stopRequestConnect = subscribeRequestExtensionConnect(payload => {
    void runExtensionConnectFromWebsite(payload.extensionId, { announceViaBridge: true })
  })
  void getSupabase().then(supabase => {
    const { data } = supabase.auth.onAuthStateChange(() => {
      void pushWebsiteAuthFromSession()
    })
    stopAuthState = () => {
      data.subscription.unsubscribe()
    }
  })
})

onUnmounted(() => {
  stopExtensionAuth?.()
  stopExtensionAuth = null
  stopRequestConnect?.()
  stopRequestConnect = null
  stopAuthState?.()
  stopAuthState = null
})
</script>

<template>
  <!-- 无 UI：仅维持官网 ↔ 扩展 UI 桥 -->
  <span class="ui-bridge-host" hidden aria-hidden="true" />
</template>
