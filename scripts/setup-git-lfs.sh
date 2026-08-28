#!/usr/bin/env sh
# 配置本仓 Git LFS filter（不覆盖 Husky pre-push）。
# 用法：bun run setup:git-lfs
set -e

if ! command -v git-lfs >/dev/null 2>&1; then
  echo "❌ 未找到 git-lfs。macOS: brew install git-lfs"
  exit 1
fi

git config --local filter.lfs.clean "git-lfs clean -- %f"
git config --local filter.lfs.smudge "git-lfs smudge -- %f"
git config --local filter.lfs.process "git-lfs filter-process"
git config --local filter.lfs.required true

echo "📥 拉取 LFS 对象…"
git lfs pull

echo "✅ Git LFS 已配置（本仓 local filter；pre-push 由 Husky 调用 git lfs pre-push）"
