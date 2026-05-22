<script setup lang="ts">
const config = useRuntimeConfig()
const nodeEnv = process.env.NODE_ENV
const isDev = process.dev

const apiTestResult = ref('')

const testApi = async () => {
  try {
    apiTestResult.value = '正在测试...'
    const apiBaseUrl = config.public.apiBaseUrl

    console.log('测试 API URL:', apiBaseUrl)

    const response = await fetch(`${apiBaseUrl}/health`)
    const data = await response.text()

    apiTestResult.value = `成功！\nURL: ${apiBaseUrl}\n响应: ${data}`
  } catch (error) {
    apiTestResult.value = `失败！\n错误: ${error instanceof Error ? error.message : String(error)}`
  }
}
</script>

<template>
  <div style="padding: 2rem; font-family: monospace">
    <h1>环境变量调试</h1>

    <h2>Runtime Config (Public)</h2>
    <pre>{{ JSON.stringify(config.public, null, 2) }}</pre>

    <h2>当前环境</h2>
    <ul>
      <li>NODE_ENV: {{ nodeEnv }}</li>
      <li>开发模式: {{ isDev }}</li>
    </ul>

    <h2>API 测试</h2>
    <button @click="testApi">测试 API 连接</button>
    <pre v-if="apiTestResult">{{ apiTestResult }}</pre>
  </div>
</template>
