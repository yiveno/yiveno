/** 从官网环境读取站点根 URL。 */
export function getWebsiteBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_WEBSITE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'https://yiveno.com'
}

/** 打开官网账户页（新标签）。 */
export async function openWebsiteAccountPage(): Promise<void> {
  await chrome.tabs.create({ url: `${getWebsiteBaseUrl()}/account` })
}

/** 打开官网登录页（新标签；不含扩展 connect 参数时由调用方拼）。 */
export async function openWebsiteLoginPage(url?: string): Promise<void> {
  await chrome.tabs.create({ url: url ?? `${getWebsiteBaseUrl()}/login` })
}
