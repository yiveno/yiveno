/**
 * Service Worker 无 document/window。
 * Vite/Rolldown 仍可能向 background 注入 `preload-helper`（即便 modulePreload:false）；
 * 动态 import 预加载或错误上报会 ReferenceError。
 * 对 background + preload-helper 做 DOM/window 守卫。
 */
import type { Plugin } from 'vite'

function patchPreloadCode(code: string): string {
  let next = code

  // —— document 预加载分支 ——
  next = next.replaceAll(
    'if(t&&t.length>0){const e=document.getElementsByTagName("link")',
    'if(t&&t.length>0&&typeof document!=="undefined"){const e=document.getElementsByTagName("link")'
  )
  next = next.replaceAll(
    'if(n&&n.length>0){const r=document.getElementsByTagName("link")',
    'if(n&&n.length>0&&typeof document!=="undefined"){const r=document.getElementsByTagName("link")'
  )
  next = next.replaceAll(
    'if (n && n.length > 0) {\n\t\tconst links = document.getElementsByTagName("link")',
    'if (n && n.length > 0 && typeof document !== "undefined") {\n\t\tconst links = document.getElementsByTagName("link")'
  )
  next = next.replaceAll(
    'if (deps && deps.length > 0) {\n\t\tconst links = document.getElementsByTagName("link")',
    'if (deps && deps.length > 0 && typeof document !== "undefined") {\n\t\tconst links = document.getElementsByTagName("link")'
  )
  // 未压缩：`if (n && n.length > 0) { const r = document...`
  next = next.replaceAll(
    'if (n && n.length > 0) {\n\t\tconst r = document.getElementsByTagName("link")',
    'if (n && n.length > 0 && typeof document !== "undefined") {\n\t\tconst r = document.getElementsByTagName("link")'
  )

  // —— preloadError：SW 无 window，直接 rethrow ——
  next = next.replaceAll(
    'function a(e){const t=new Event("vite:preloadError",{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}',
    'function a(e){if(typeof window==="undefined")throw e;const t=new Event("vite:preloadError",{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}'
  )
  next = next.replaceAll(
    'function a(e) {\n\t\tconst t = new Event("vite:preloadError", { cancelable: true });\n\t\tif (t.payload = e, window.dispatchEvent(t), !t.defaultPrevented) throw e;\n\t}',
    'function a(e) {\n\t\tif (typeof window === "undefined") throw e;\n\t\tconst t = new Event("vite:preloadError", { cancelable: true });\n\t\tif (t.payload = e, window.dispatchEvent(t), !t.defaultPrevented) throw e;\n\t}'
  )
  // 另一种 pretty 形态（dispatchEvent 单独一行）
  if (next.includes('vite:preloadError') && next.includes('window.dispatchEvent(e)')) {
    next = next.replaceAll(
      'window.dispatchEvent(e);',
      'if (typeof window !== "undefined") window.dispatchEvent(e);'
    )
  }

  return next
}

function shouldPatchFile(fileName: string, code: string): boolean {
  if (fileName === 'background.js' || /(^|\/)background\.js$/.test(fileName)) {
    return true
  }
  if (fileName.includes('preload-helper')) {
    return true
  }
  return code.includes('vite:preloadError')
}

export function swSafeModulePreloadPlugin(): Plugin {
  return {
    name: 'yiveno-sw-safe-modulepreload',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') {
          continue
        }
        if (!shouldPatchFile(chunk.fileName, chunk.code)) {
          continue
        }
        const patched = patchPreloadCode(chunk.code)
        if (patched !== chunk.code) {
          chunk.code = patched
        }
      }
    }
  }
}
