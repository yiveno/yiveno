#!/bin/bash
# 从根目录 .env 和 .env.local 加载环境变量
if [ -f ../.env ]; then
  export $(grep -v '^#' ../.env | xargs)
fi
if [ -f ../.env.local ]; then
  export $(grep -v '^#' ../.env.local | xargs)
fi

# 转为 Astro PUBLIC_ 前缀（Astro 客户端可用）
export PUBLIC_SUPABASE_URL="${SUPABASE_URL}"
export PUBLIC_SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}"
export PUBLIC_API_URL="${API_BASE_URL}"
export PUBLIC_WEBSITE_URL="${WEBSITE_URL}"

bunx --bun astro dev "$@"
