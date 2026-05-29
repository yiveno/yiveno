/**
 * 视觉回归测试
 *
 * 测试目标：确保 UI 不会意外变化
 */

import { test, expect } from '@playwright/test'

test.describe('BookmarkList 视觉测试', () => {
  test('默认状态', async ({ page }) => {
    await page.goto('/management.html')

    // 等待书签加载
    await page.waitForSelector('[data-testid="bookmark-list"]')

    // 截图对比
    await expect(page).toHaveScreenshot('bookmark-list-default.png')
  })

  test('搜索状态', async ({ page }) => {
    await page.goto('/management.html')

    // 点击搜索按钮
    await page.click('[data-testid="search-button"]')

    // 输入搜索词
    await page.fill('[data-testid="search-input"]', 'Vue')

    // 等待搜索结果
    await page.waitForSelector('[data-testid="search-results"]')

    // 截图对比
    await expect(page).toHaveScreenshot('bookmark-list-search.png')
  })

  test('空状态', async ({ page }) => {
    await page.goto('/management.html')

    // 模拟空状态（通过 URL 参数）
    await page.goto('/management.html?empty=true')

    // 等待空状态组件
    await page.waitForSelector('[data-testid="empty-state"]')

    // 截图对比
    await expect(page).toHaveScreenshot('bookmark-list-empty.png')
  })

  test('深色主题', async ({ page }) => {
    await page.goto('/management.html')

    // 切换到深色主题
    await page.click('[data-testid="theme-toggle"]')

    // 等待主题切换完成
    await page.waitForTimeout(500)

    // 截图对比
    await expect(page).toHaveScreenshot('bookmark-list-dark.png')
  })
})
