export interface ChromeExtensionInfo {
  installed: boolean
  version?: string
}

export function checkExtension(): ChromeExtensionInfo {
  return { installed: false }
}
