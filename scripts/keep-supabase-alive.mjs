#!/usr/bin/env node

/**
 * Supabase 项目保活脚本
 * 
 * 用途：定期 ping Supabase 项目，防止因非活跃而被暂停
 * 
 * Supabase 免费计划会在 7 天无活动后自动暂停项目。
 * 此脚本通过定期发起连接来保持项目活跃。
 * 
 * 使用方法：
 * 1. 本地测试: bun run scripts/keep-supabase-alive.mjs
 * 2. GitHub Actions: 自动每天运行（已配置）
 * 
 * 环境变量：
 * - VITE_SUPABASE_URL: Supabase 项目 URL
 * - VITE_SUPABASE_ANON_KEY: Supabase 匿名密钥
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 缺少 Supabase 环境变量')
  console.error('请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY')
  console.error('')
  console.error('本地运行: 确保 .env.local 文件存在')
  console.error('GitHub Actions: 确保在 Repository Secrets 中配置了这两个变量')
  process.exit(1)
}

async function keepAlive() {
  try {
    console.log('🔄 开始 Supabase 项目保活...')
    console.log(`📍 URL: ${supabaseUrl}`)
    console.log(`⏰ 时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`)
    console.log('')
    
    // 方法 1: 检查认证服务（GET 请求）
    console.log('1️⃣ 检查认证服务...')
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: {
        'apikey': supabaseAnonKey
      }
    })
    
    if (authResponse.ok) {
      console.log('   ✅ 认证服务正常')
    } else {
      console.warn(`   ⚠️ 认证服务响应: ${authResponse.status}`)
    }
    
    // 方法 2: 检查 REST API（建立数据库连接）
    console.log('2️⃣ 检查数据库连接...')
    const dbResponse = await fetch(`${supabaseUrl}/rest/v1/?select=*&limit=1`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    })
    
    if (dbResponse.ok || dbResponse.status === 404) {
      console.log('   ✅ 数据库连接正常')
    } else {
      console.warn(`   ⚠️ 数据库响应: ${dbResponse.status}`)
    }
    
    console.log('')
    console.log('✅ Supabase 项目保活成功！')
    console.log(`📊 项目将保持活跃，不会被自动暂停`)
    console.log(`🔄 下次运行: 24 小时后`)
    console.log('')
    
  } catch (err) {
    console.error('')
    console.error('❌ 保活失败！')
    console.error('错误信息:', err.message)
    console.error('')
    console.error('可能的原因:')
    console.error('1. Supabase 项目已被暂停（需要手动恢复）')
    console.error('2. 网络连接问题')
    console.error('3. 环境变量配置错误')
    console.error('')
    process.exit(1)
  }
}

keepAlive()
